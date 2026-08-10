const { v4: uuidv4 } = require("uuid");

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

function sendLobbies(socket) {
  const lobbies = getLobbies();
  const currentLobby = getLobbyByPlayer(socket.user.id);

  const lobbiesForUser = lobbies.map((lobby) => ({
    ...lobby,
    isMember: currentLobby?.id === lobby.id,
    isOwner: lobby.ownerId === socket.user.id,
    isConnected:
      currentLobby?.id === lobby.id
        ? (currentLobby.players.get(socket.user.id)?.connected ?? false)
        : false,
  }));

  socket.emit("lobbies:update", lobbiesForUser);
}

function broadcastLobbies(io) {
  for (const socket of io.sockets.sockets.values()) {
    sendLobbies(socket);
  }
}

function handleCreateLobby(socket, io, lives, cards) {
  const currentLobby = getLobbyByPlayer(socket.user.id);

  if (currentLobby) {
    return;
  }

  const lobby = {
    id: uuidv4(),
    ownerId: socket.user.id,
    ownerUsername: socket.user.username,
    started: false,

    players: new Map([
      [
        socket.user.id,
        {
          connected: true,
          username: socket.user.username,
        },
      ],
    ]),

    startingLives: lives,
    initialCards: cards,
  };

  createLobby(lobby);

  socket.join(`lobby:${lobby.id}`);

  broadcastLobbies(io);
}

function joinLobby(lobbyId, socket, io) {
  const result = addPlayer(lobbyId, socket.user.id, socket.user.username);

  if (!result.success) {
    socket.emit("lobby:join:error", {
      message: result.error,
    });

    return;
  }

  socket.join(`lobby:${lobbyId}`);

  broadcastLobbies(io);
}

function leaveLobby(socket, io, reconnectTimers) {
  const lobby = getLobbyByPlayer(socket.user.id);

  if (!lobby) {
    return;
  }

  clearReconnectTimer(socket.user.id, reconnectTimers);

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
    return;
  }

  if (lobby.ownerId !== socket.user.id) {
    return;
  }

  if (lobby.started) {
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
