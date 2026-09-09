const { getGame, saveGameData } = require("./gameManager");

const lobbies = new Map();
const LOBBY_TIMEOUT = 10 * 60 * 1000; // 10 minutes
let cleanupInterval;

function startLobbyCleanup() {
  cleanupInterval = setInterval(() => {
    const now = Date.now();

    for (const [lobbyId, lobby] of lobbies.entries()) {
      const isAnyoneConnected = Array.from(lobby.players.values()).some((p) => p.connected);

      if (!isAnyoneConnected) {
        if (!lobby.offlineSince) {
          lobby.offlineSince = now;
        } else if (now - lobby.offlineSince >= LOBBY_TIMEOUT) {
          console.log(`Eliminazione lobby per inattività totale: ${lobbyId}`);
          deleteLobby(lobbyId);
        }
      } else {
        lobby.offlineSince = null;
      }
      
      if (lobby.players.size === 1 && now - lobby.createdAt >= LOBBY_TIMEOUT) {
        console.log(`Eliminazione lobby ferma a 1 player: ${lobbyId}`);
        deleteLobby(lobbyId);
      }
    }

    if (lobbies.size === 0) {
      clearInterval(cleanupInterval);
      cleanupInterval = null;
    }
  }, 60*1000);
}

function createLobby(lobby) {
  if (lobbies.has(lobby.id)) {
    throw new Error("Lobby already exists");
  }

  lobby.createdAt = Date.now();
  lobby.offlineSince = null;

  lobbies.set(lobby.id, lobby);

  if (!cleanupInterval) {
    startLobbyCleanup();
  }

  return lobby;
}

function getLobby(lobbyId) {
  return lobbies.get(lobbyId);
}

function getLobbies() {
  return Array.from(lobbies.values()).map((lobby) => ({
    id: lobby.id,
    name: lobby.name,
    ownerId: lobby.ownerId,
    ownerUsername: lobby.ownerUsername,
    players: lobby.players.size,
    maxPlayers: lobby.maxPlayers,
    started: lobby.started,
    closed: lobby.closed,
    hasPassword: !!lobby.passwordHash,
    playersConnected: Array.from(lobby.players.values()).filter(
      (player) => player.connected,
    ).length,
    startingLives: lobby.startingLives,
    initialCards: lobby.initialCards,
  }));
}

async function deleteLobby(lobbyId) {
  const game = getGame(lobbyId);

  if (game) {
    const playersArray = Array.from(game.players.entries()).map(
      ([userId, player]) => ({
        userId: userId,
        position: player.position,
        leftEarly: player.leftEarly || false,
      }),
    );

    const dataToSave = {
      id: game.lobbyId,
      duration: game.turn,
      players: playersArray,
      winner: game.winnerId || null,
    };

    try {
      await saveGameData(dataToSave);
    } catch (e) {
      console.log("Error while saving game data: ", e);
    }
  }

  return lobbies.delete(lobbyId);
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

  if (lobby.players.size >= lobby.maxPlayers) {
    return {
      success: false,
      error: "lobby full",
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

  lobby.createdAt = Date.now();
  lobby.offlineSince = null;

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

function setLobbyClosed(lobbyId, closed) {
  const lobby = lobbies.get(lobbyId);

  if (!lobby) {
    return false;
  }

  lobby.closed = closed;

  return true;
}

function setPlayerConnected(lobbyId, userId, connected) {
  const lobby = lobbies.get(lobbyId);

  if (!lobby) {
    return false;
  }

  const lobbyPlayer = lobby.players.get(userId);
  if (lobbyPlayer) {
    lobbyPlayer.connected = connected;
  }

  const game = getGame(lobbyId);
  if (game) {
    const gamePlayer = game.players.get(userId);
    if (gamePlayer) {
      gamePlayer.connected = connected;
    }
  }

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

function isOwnerOnline(lobbyId) {
  const lobby = lobbies.get(lobbyId);
  if (!lobby) return false;

  const owner = lobby.players.get(lobby.ownerId);
  return owner?.connected ?? false;
}

module.exports = {
  createLobby,
  getLobby,
  getLobbies,
  deleteLobby,
  setLobbyClosed,
  addPlayer,
  removePlayer,
  setLobbyStarted,
  setPlayerConnected,
  isPlayerConnected,
  getLobbyByPlayer,
  isOwnerOnline,
};
