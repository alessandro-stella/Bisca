const { v4: uuidv4 } = require("uuid");
const authenticateSocket = require("./auth");

const {
  createLobby,
  getLobbies,
  addPlayer,
  removePlayer,
  getLobbyByPlayer,
  getLobby,
  deleteLobby,
} = require("../lobbies/manager");

function sendLobbies(socket) {
  const lobbies = getLobbies();

  const currentLobby = getLobbyByPlayer(socket.user.id);

  const lobbiesForUser = lobbies.map((lobby) => ({
    ...lobby,
    isMember: currentLobby?.id === lobby.id,
    isOwner: lobby.ownerId === socket.user.id,
  }));

  socket.emit("lobbies:update", lobbiesForUser);
}

function broadcastLobbies(io) {
  for (const socket of io.sockets.sockets.values()) {
    sendLobbies(socket);
  }
}

function handleCreateLobby(socket, io) {
  const currentLobby = getLobbyByPlayer(socket.user.id);

  if (currentLobby) {
    return;
  }

  const lobby = {
    id: uuidv4(),
    ownerId: socket.user.id,
    ownerUsername: socket.user.username,
    players: new Set([socket.user.id]),
  };

  createLobby(lobby);

  console.log("Lobby created:", lobby);

  broadcastLobbies(io);
}

function joinLobby(lobbyId, socket, io) {
  const response = addPlayer(lobbyId, socket.user.id);

  if (!response.success) {
    socket.emit("lobby:join:error", {
      message: response.error,
    });

    return;
  }

  console.log(`${socket.user.username} joined lobby ${lobbyId}`);

  broadcastLobbies(io);
}

function leaveLobby(socket, io) {
  const lobby = getLobbyByPlayer(socket.user.id);

  if (!lobby) {
    return;
  }

  if (lobby.ownerId === socket.user.id) {
    deleteLobby(lobby.id);

    console.log(
      `Lobby deleted because owner ${socket.user.username} left: ${lobby.id}`,
    );

    broadcastLobbies(io);

    return;
  }

  removePlayer(lobby.id, socket.user.id);

  console.log(`${socket.user.username} left lobby ${lobby.id}`);

  broadcastLobbies(io);
}

function handleDeleteLobby(lobbyId, socket, io) {
  const lobby = getLobby(lobbyId);

  if (!lobby) {
    return;
  }

  if (lobby.ownerId !== socket.user.id) {
    return;
  }

  deleteLobby(lobbyId);

  console.log(`Lobby ${lobbyId} deleted by owner ${socket.user.username}`);

  broadcastLobbies(io);
}

function setupSockets(io) {
  io.use(authenticateSocket);

  io.on("connection", (socket) => {
    console.log("Socket connected:", socket.id);

    console.log("Authenticated user:", socket.user);

    sendLobbies(socket);

    socket.on("lobby:create", () => {
      handleCreateLobby(socket, io);
    });

    socket.on("lobby:join", (lobbyId) => {
      joinLobby(lobbyId, socket, io);
    });

    socket.on("lobby:leave", () => {
      leaveLobby(socket, io);
    });

    socket.on("lobby:delete", (lobbyId) => {
      handleDeleteLobby(lobbyId, socket, io);
    });

    socket.on("disconnect", () => {
      console.log("Socket disconnected:", socket.id);

      leaveLobby(socket, io);
    });
  });
}

module.exports = setupSockets;
