const { randomUUID: uuidv4 } = require("crypto");
const bcrypt = require("bcrypt");

const {
  createLobby,
  getLobbies,
  addPlayer,
  removePlayer,
  getLobbyByPlayer,
  getLobby,
  deleteLobby,
} = require("../game/lobbyManager");

const {
  deleteGame,
  getGame,
  removePlayerFromGame,
} = require("../game/gameManager");

const { broadcastGameState } = require("./gameHandlers");

const BCRYPT_SALT_ROUNDS = 10;

function sendLobbies(socket) {
  const lobbies = getLobbies();
  const currentLobby = getLobbyByPlayer(socket.user.id);

  const lobbiesForUser = lobbies
    .map((lobby) => ({
      ...lobby,
      isMember: currentLobby?.id === lobby.id,
      isOwner: lobby.ownerId === socket.user.id,
      isConnected:
        currentLobby?.id === lobby.id
          ? (currentLobby.players.get(socket.user.id)?.connected ?? false)
          : false,
    }))
    .filter((lobby) => lobby.players > 0 && !lobby.closed);

  socket.emit("lobbies:update", lobbiesForUser);
}

function broadcastLobbies(io) {
  console.log("Broadcasting lobbies");

  for (const socket of io.sockets.sockets.values()) {
    sendLobbies(socket);
  }
}

async function handleCreateLobby(
  socket,
  io,
  name,
  maxPlayers,
  lives,
  cards,
  password,
) {
  try {
    let passwordHash = null;
    if (password && password.trim() !== "") {
      passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
    }

    const lobby = {
      id: uuidv4(),
      name,
      ownerId: socket.user.id,
      ownerUsername: socket.user.username,
      started: false,
      closed: false,

      players: new Map([
        [
          socket.user.id,
          {
            connected: true,
            username: socket.user.username,
          },
        ],
      ]),

      maxPlayers,
      startingLives: lives,
      initialCards: cards,
      passwordHash,
    };

    createLobby(lobby);

    socket.join(`lobby:${lobby.id}`);

    console.log(`Lobby ${lobby.id} created by ${socket.user.username}`);

    broadcastLobbies(io);
  } catch (error) {
    console.error("Error creating lobby:", error);
    socket.emit("lobby:create:error", {
      message: "An error occurred while creating the lobby",
    });
  }
}

async function joinLobby(lobbyId, socket, io, password) {
  try {
    const lobby = getLobby(lobbyId);

    if (!lobby) {
      socket.emit("lobby:join:error", { message: "Lobby not found" });
      return;
    }

    // Verifica password se presente
    if (lobby.passwordHash) {
      if (!password) {
        socket.emit("lobby:join:error", {
          message: "This lobby requires a password",
        });
        return;
      }

      const passwordMatch = await bcrypt.compare(password, lobby.passwordHash);
      if (!passwordMatch) {
        socket.emit("lobby:join:error", { message: "Incorrect password" });
        return;
      }
    }

    // Verifica se la lobby è piena
    if (lobby.players.size >= lobby.maxPlayers) {
      socket.emit("lobby:join:error", { message: "Lobby is full" });
      return;
    }

    const result = addPlayer(lobbyId, socket.user.id, socket.user.username);

    if (!result.success) {
      socket.emit("lobby:join:error", { message: result.error });
      return;
    }

    socket.join(`lobby:${lobbyId}`);

    console.log(`${socket.user.username} joined lobby ${lobbyId}`);

    broadcastLobbies(io);
  } catch (error) {
    console.error("Error joining lobby:", error);
    socket.emit("lobby:join:error", {
      message: "An error occurred while joining the lobby",
    });
  }
}

function leaveLobby(socket, io, reconnectTimers) {
  clearReconnectTimer(socket.user.id, reconnectTimers);

  const lobby = getLobbyByPlayer(socket.user.id);

  if (!lobby) {
    return;
  }

  const game = getGame(lobby.id);

  removePlayer(lobby.id, socket.user.id);
  socket.leave(`lobby:${lobby.id}`);

  if (game) {
    const result = removePlayerFromGame(game, socket.user.id);

    if (result.action === "finished") {
      game.turnPhase = "finished";
      broadcastGameState(io, lobby.id);

      const winner = game.players.get(result.winnerId);
      io.to(`lobby:${lobby.id}`).emit("game:finished", {
        winnerId: result.winnerId,
        winnerUsername: winner?.username,
      });
    } else {
      broadcastGameState(io, lobby.id);
    }
  }

  if (lobby.players.size === 0) {
    const room = `lobby:${lobby.id}`;

    io.to(room).emit("lobby:deleted");
    io.in(room).socketsLeave(room);

    deleteLobby(lobby.id);
    deleteGame(lobby.id);

    console.log(`Lobby ${lobby.id} deleted because it's empty`);
  }

  broadcastLobbies(io);
}

function handleDeleteLobby(lobbyId, socket, io, reconnectTimers) {
  const lobby = getLobby(lobbyId);

  if (!lobby) {
    socket.emit("lobby:delete:error", { message: "Lobby not found" });
    return;
  }

  if (lobby.ownerId !== socket.user.id) {
    socket.emit("lobby:delete:error", {
      message: "Only the owner can delete the lobby",
    });
    return;
  }

  if (lobby.started) {
    socket.emit("lobby:delete:error", {
      message: "Cannot delete a lobby that has already started",
    });
    return;
  }

  const room = `lobby:${lobbyId}`;

  for (const userId of lobby.players.keys()) {
    clearReconnectTimer(userId, reconnectTimers);
  }

  io.to(room).emit("lobby:deleted");
  io.in(room).socketsLeave(room);

  deleteLobby(lobbyId);
  deleteGame(lobbyId);

  console.log(`Lobby ${lobbyId} deleted by owner ${socket.user.username}`);

  broadcastLobbies(io);
}

function clearReconnectTimer(userId, reconnectTimers) {
  const timer = reconnectTimers.get(userId);

  if (!timer) {
    return;
  }

  clearTimeout(timer);
  reconnectTimers.delete(userId);
}

module.exports = {
  sendLobbies,
  broadcastLobbies,
  handleCreateLobby,
  joinLobby,
  leaveLobby,
  handleDeleteLobby,
  clearReconnectTimer,
};
