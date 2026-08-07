require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");

const db = require("./db");
const lobbyRouter = require("./routes/lobby");

const app = express();
const PORT = process.env.PORT || 8000;

app.use(express.json());
app.use(cors());

app.use("/api/lobby", lobbyRouter);

app.use(express.static(path.join(__dirname, "../public")));

// app.get("/", (req, res) => {
//   res.sendFile(path.join(__dirname, "../public/index.html"));
// });

app.get("/", (req, res) => {
  res.send("Server Railway OK");
});

app.listen(PORT, async () => {
  console.log(`Server started on port ${PORT}`);

  try {
    const result = await db.query("SELECT NOW()");
    console.log("Database connected:", result.rows[0]);
  } catch (error) {
    console.error("Database connection failed:");
    console.error(error);
  }
});

app.use((err, req, res, next) => {
  console.error("ERROR:", err);
  res.status(500).send(err.message);
});
