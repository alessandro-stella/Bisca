const { v4: uuidv4 } = require("uuid");
const authenticateSocket = require("./auth");

const {
  createLobby,
  getLobbies,
  addPlayer,
  removePlayer,
  getLobbyByPlayer,
  deleteLobby,
} = require("../lobbies/manager");

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

  io.emit("lobbies:update", getLobbies());
}

function handleJoinLobby(lobbyId, socket, io) {
  const success = addPlayer(lobbyId, socket.user.id);

  if (!success) {
    return;
  }

  console.log(`${socket.user.username} joined lobby ${lobbyId}`);

  io.emit("lobbies:update", getLobbies());
}

function handleLeaveLobby(socket, io) {
  const lobby = getLobbyByPlayer(socket.user.id);

  if (!lobby) {
    return;
  }

  removePlayer(lobby.id, socket.user.id);

  console.log(`${socket.user.username} left lobby ${lobby.id}`);

  if (lobby.players.size === 0) {
    deleteLobby(lobby.id);

    console.log(`Lobby deleted: ${lobby.id}`);
  }

  io.emit("lobbies:update", getLobbies());
}

function setupSockets(io) {
  io.use(authenticateSocket);

  io.on("connection", (socket) => {
    console.log("Socket connected:", socket.id);
    console.log("Authenticated user:", socket.user);

    socket.emit("lobbies:update", getLobbies());

    socket.on("lobby:create", () => handleCreateLobby(socket, io));

    socket.on("lobby:join", (lobbyId) => handleJoinLobby(lobbyId, socket, io));

    socket.on("lobby:leave", () => {
      handleLeaveLobby(socket, io);
    });

    socket.on("disconnect", () => {
      console.log("Socket disconnected:", socket.id);
      handleLeaveLobby(socket, io);
    });
  });
}

module.exports = setupSockets;
