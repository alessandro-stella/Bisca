require("dotenv").config();

const express = require("express");
const http = require("http");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const { Server } = require("socket.io");

const db = require("./db");
const userRouter = require("./routes/userRouter");
const { router: sessionRouter } = require("./routes/sessionRouter");

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

const PORT = process.env.PORT || 8000;

app.use(express.json());
app.use(cookieParser());
app.use(cors(corsOptions));

const SERVER_START_TIME = Date.now().toString();

app.use("/api/user", userRouter);
app.use("/api/session", sessionRouter);

app.get("/sw.js", (_, res) => {
  const swPath = path.join(__dirname, "../public/sw.js");

  fs.readFile(swPath, "utf8", (err, data) => {
    if (err) {
      res.status(500).send("Errore nel caricamento del Service Worker");
      return;
    }

    const modifiedSw = data.replace("{{SERVER_VERSION}}", SERVER_START_TIME);

    res.setHeader("Content-Type", "application/javascript");
    res.setHeader(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, proxy-revalidate",
    );

    res.send(modifiedSw);
  });
});

app.use(
  express.static(path.join(__dirname, "../public"), {
    setHeaders: (res, filePath) => {
      if (
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

server.listen(PORT, async () => {
  console.log(`Server started on port ${PORT}`);

  try {
    const result = await db.query("SELECT NOW()");
    console.log("Database connected:", result.rows[0]);
  } catch (error) {
    console.error("Database connection failed:");
    console.error(error);
  }
});

app.use((err, _, res, __) => {
  console.error("ERROR:", err);
  res.status(500).send(err.message);
});
