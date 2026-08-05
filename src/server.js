const express = require("express");
const lobbyRouter = require("./routes/lobby");

const app = express();
const PORT = 8000;

app.use(express.json());

app.use("/api/lobby", lobbyRouter);

app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});
