require("dotenv").config();

const express = require("express");
const http = require("http");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const { Server } = require("socket.io");

const db = require("./db");
const authRouter = require("./routes/authRouter");
const userRouter = require("./routes/userRouter");
const { router: sessionRouter } = require("./routes/sessionRouter");
const { transporter } = require("./email/mailService");
const { cleanupExpiredUnverifiedAccounts } = require("./email/verificationUtils");
const { rateLimit } = require("express-rate-limit");
const profanityFilter = require("./profanityFilter");

const app = express();
const server = http.createServer(app);

const corsOptions = {
  origin: process.env.CLIENT_URL,
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true,
};

const io = new Server(server, {
  pingInterval: 25000,
  pingTimeout: 60000,
  transports: ["websocket", "polling"],
  cors: corsOptions,
});
app.set("io", io);

const PORT = process.env.PORT || 8000;

app.use(express.json());
app.use(cookieParser());
app.use(cors(corsOptions));

const SERVER_START_TIME = Date.now().toString();

app.set("trust proxy", 1);

const generalAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Troppe richieste, riprova più tardi" },
});

const strictAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Troppi tentativi, riprova più tardi" },
});

app.use("/api/auth", generalAuthLimiter);
app.use(
  [
    "/api/auth/login",
    "/api/auth/register",
    "/api/auth/forgot-password",
    "/api/auth/confirm-account-deletion",
  ],
  strictAuthLimiter,
);

app.use("/api/auth", authRouter);
app.use("/api/user", userRouter);
app.use("/api/session", sessionRouter);

app.get("/sw.js", (_, res) => {
  res.setHeader("Content-Type", "application/javascript");
  res.setHeader(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, proxy-revalidate",
  );

  if (process.env.NODE_ENV === "development") {
    const killSwitch = `
      self.addEventListener('install', e => self.skipWaiting());
      self.addEventListener('activate', e => {
        e.waitUntil(
          caches.keys()
            .then(keys => Promise.all(keys.map(k => caches.delete(k))))
            .then(() => self.registration.unregister())
        );
      });
    `;
    return res.send(killSwitch);
  }

  const swPath = path.join(__dirname, "../public/sw.js");

  fs.readFile(swPath, "utf8", (err, data) => {
    if (err) {
      res.status(500).send("Error during Service Worker loading");
      return;
    }

    const modifiedSw = data.replace("{{SERVER_VERSION}}", SERVER_START_TIME);
    res.send(modifiedSw);
  });
});

app.use(
  express.static(path.join(__dirname, "../public"), {
    setHeaders: (res, filePath) => {
      if (
        filePath.endsWith("lobbies.html") ||
        filePath.endsWith("profile.html") ||
        filePath.endsWith("game.html")
      ) {
        res.setHeader("Cache-Control", "no-store, must-revalidate");
        res.setHeader("Pragma", "no-cache");
        res.setHeader("Expires", "0");
      } else if (
        filePath.endsWith(".html") ||
        filePath.endsWith(".css") ||
        filePath.endsWith(".js")
      ) {
        res.setHeader("Cache-Control", "no-cache");
      }
    },
  }),
);

const setupSockets = require("./sockets");
setupSockets(io);

app.use((_, res) => {
  res.status(404).sendFile(path.join(__dirname, "../public/404.html"));
});

app.use((err, _, res, __) => {
  console.error("ERROR:", err);
  res.status(500).json({ error: "Internal server error" });
});

async function startApp() {
  try {
    profanityFilter.setThreshold(85);

    if (!profanityFilter.isLoaded()) {
      throw new Error("profanity-list.json missing or empty");
    }

    await transporter.verify();
    console.log("Mail service ready");

    const result = await db.query("SELECT NOW()");
    console.log("Database connected:", result.rows[0]);

    await db.query(`
      DELETE FROM games
      WHERE id IN (
        SELECT game_id FROM elo_history
        GROUP BY game_id
        HAVING bool_or(new_elo IS NULL)
      )
    `);

    setInterval(() => {
      db.query("DELETE FROM sessions WHERE expires_at < NOW()").catch((error) =>
        console.error("Session cleanup error:", error),
      );
    }, 60 * 60 * 1000);

    setInterval(cleanupExpiredUnverifiedAccounts, 60 * 1000);

    server.listen(PORT, () => {
      console.log(`Server started on port ${PORT}`);
    });
  } catch (error) {
    console.error("Startup checks failed:", error);
    process.exit(1);
  }
}

startApp();