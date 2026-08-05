const express = require("express");
const { v4: uuidv4 } = require("uuid");

const router = express.Router();

let lobbies = new Map();

// Fetch all lobbies
router.get("/", (req, res) => {
  console.log("All lobbies requested");

  res.json({
    lobbies: Array.from(lobbies.values()),
  });
});

// Create lobby
router.post("/", (req, res) => {
  const { name } = req.body;
  console.log(`Creating lobby "${name}"`);

  const lobby = {
    id: uuidv4(),
    name,
    players: [],
  };

  lobbies.set(lobby.id, lobby);

  res.status(201).json(lobby);
});

// Get lobby by id
router.get("/:id", (req, res) => {
  const lobbyId = req.params.id;

  console.log(`Fetching lobby with id ${lobbyId}`);
  const lobby = lobbies.get(lobbyId);

  if (!lobby) {
    return res.status(404).json({ error: "Lobby not found" });
  }

  res.json(lobby);
});

module.exports = router;
