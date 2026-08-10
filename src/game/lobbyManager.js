const { getGame } = require("./gameManager");

const lobbies = new Map();

function createLobby(lobby) {
  if (lobbies.has(lobby.id)) {
    throw new Error("Lobby already exists");
  }

  lobbies.set(lobby.id, lobby);

  return lobby;
}

function getLobby(lobbyId) {
  return lobbies.get(lobbyId);
}

function getLobbies() {
  return Array.from(lobbies.values()).map((lobby) => ({
    id: lobby.id,
    ownerId: lobby.ownerId,
    ownerUsername: lobby.ownerUsername,
    players: lobby.players.size,
    started: lobby.started,
    playersConnected: Array.from(lobby.players.values()).filter(
      (player) => player.connected,
    ).length,
  }));
}

async function deleteLobby(lobbyId) {
  console.log("Deleting lobby...");
  console.log("Lobby data: ");
  console.log(lobbies.get(lobbyId));

  const game = getGame(lobbyId);
  await saveGameData(game);

  return lobbies.delete(lobbyId);
}

async function saveGameData(game) {
  const res = await fetch("/api/game/save", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(game),
  });

  console.log("Response inside saveGameData");
  console.log({ res });
}

function addPlayer(lobbyId, userId, username) {
  const lobby = lobbies.get(lobbyId);

  if (!lobby) {
    return {
      success: false,
      error: "missing lobby",
    };
  }

  if (lobby.started) {
    return {
      success: false,
      error: "game already started",
    };
  }

  const currentLobby = getLobbyByPlayer(userId);

  if (currentLobby) {
    return {
      success: false,
      error: "already in a lobby",
    };
  }

  lobby.players.set(userId, {
    connected: true,
    username,
  });

  return {
    success: true,
    error: null,
  };
}

function removePlayer(lobbyId, userId) {
  const lobby = lobbies.get(lobbyId);

  if (!lobby) {
    return false;
  }

  lobby.players.delete(userId);

  return true;
}

function setLobbyStarted(lobbyId, started) {
  const lobby = lobbies.get(lobbyId);

  if (!lobby) {
    return false;
  }

  lobby.started = started;

  return true;
}

function setPlayerConnected(lobbyId, userId, connected) {
  const lobby = lobbies.get(lobbyId);

  if (!lobby) {
    return false;
  }

  const player = lobby.players.get(userId);

  if (!player) {
    return false;
  }

  player.connected = connected;

  return true;
}

function isPlayerConnected(lobbyId, userId) {
  const lobby = lobbies.get(lobbyId);

  if (!lobby) {
    return false;
  }

  const player = lobby.players.get(userId);

  return player?.connected ?? false;
}

function getLobbyByPlayer(userId) {
  for (const lobby of lobbies.values()) {
    if (lobby.players.has(userId)) {
      return lobby;
    }
  }

  return null;
}

module.exports = {
  createLobby,
  getLobby,
  getLobbies,
  deleteLobby,
  addPlayer,
  removePlayer,
  setLobbyStarted,
  setPlayerConnected,
  isPlayerConnected,
  getLobbyByPlayer,
};
