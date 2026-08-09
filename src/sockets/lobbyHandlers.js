const { v4: uuidv4 } = require("uuid");

const {
  createLobby,
  getLobbies,
  addPlayer,
  removePlayer,
  getLobbyByPlayer,
  getLobby,
  deleteLobby,
  setLobbyStarted,
} = require("../game/lobbyManager");

const { deleteGame } = require("../game/gameManager");

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
  console.log({ lives, cards });
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

  console.log("Lobby created:", lobby);

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

  console.log(`${socket.user.username} joined lobby ${lobbyId}`);

  broadcastLobbies(io);
}

function leaveLobby(socket, io, reconnectTimers) {
  const lobby = getLobbyByPlayer(socket.user.id);

  if (!lobby) {
    return;
  }

  clearReconnectTimer(socket.user.id, reconnectTimers);

  if (lobby.ownerId === socket.user.id) {
    const room = `lobby:${lobby.id}`;

    deleteGame(lobby.id);

    io.to(room).emit("lobby:deleted");
    io.in(room).socketsLeave(room);

    deleteLobby(lobby.id);

    console.log(
      `Lobby deleted because owner ` +
        `${socket.user.username} left: ${lobby.id}`,
    );

    broadcastLobbies(io);

    return;
  }

  removePlayer(lobby.id, socket.user.id);

  socket.leave(`lobby:${lobby.id}`);

  console.log(`${socket.user.username} left lobby ${lobby.id}`);

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

  const room = `lobby:${lobbyId}`;

  for (const userId of lobby.players.keys()) {
    clearReconnectTimer(userId, reconnectTimers);
  }

  deleteGame(lobbyId);

  io.to(room).emit("lobby:deleted");
  io.in(room).socketsLeave(room);

  deleteLobby(lobbyId);

  console.log(`Lobby ${lobbyId} deleted by owner ` + `${socket.user.username}`);

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
