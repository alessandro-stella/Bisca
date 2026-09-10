require("dotenv").config();

const express = require("express");
const http = require("http");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const path = require("path");
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

app.use("/api/user", userRouter);
app.use("/api/session", sessionRouter);

app.use(express.static(path.join(__dirname, "../public")));

const setupSockets = require("./sockets");
setupSockets(io);

async function purgeCloudflareCache() {
  const zoneId = process.env.CLOUDFLARE_ZONE_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;

  if (!zoneId || !apiToken) {
    console.log(
      "Missing Cloudflare variabled in .env, skipping cache purge...",
    );
    return;
  }

  try {
    console.log("Requesting cache purge to Cloudflare...");
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${zoneId}/purge_cache`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ purge_everything: true }),
      },
    );

    const data = await response.json();

    if (data.success) {
      console.log("Cloudflare cache emptied successfully!");
    } else {
      console.error("Cloudflare API error:", data.errors);
    }
  } catch (error) {
    console.error("Couldn't reach Cloudflare:", error.message);
  }
}

server.listen(PORT, async () => {
  console.log(`Server started on port ${PORT}`);

  try {
    const result = await db.query("SELECT NOW()");
    console.log("Database connected:", result.rows[0]);
  } catch (error) {
    console.error("Database connection failed:");
    console.error(error);
  }

  await purgeCloudflareCache();
});

app.use((err, _, res, __) => {
  console.error("ERROR:", err);
  res.status(500).send(err.message);
});
