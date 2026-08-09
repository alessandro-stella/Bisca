const authenticateSocket = require("./auth");

const {
  sendLobbies,
  broadcastLobbies,
  handleCreateLobby,
  joinLobby,
  leaveLobby,
  handleDeleteLobby,
} = require("./lobbyHandlers");

const {
  startGame,
  sendGameState,
  handlePlaceBid,
  handlePlayCard,
  checkCurrentGame,
} = require("./gameHandlers");

const createConnectionHandlers = require("./connectionHandlers");
const reconnect = createConnectionHandlers();

function setupSockets(io) {
  io.use(authenticateSocket);

  io.on("connection", (socket) => {
    console.log("Socket connected:", socket.id);
    console.log("Authenticated user:", socket.user);

    reconnect.handleReconnect(socket, io, broadcastLobbies);

    sendLobbies(socket);

    // -------------------------
    // Lobby
    // -------------------------

    socket.on("lobby:create", (lives, cards) => {
      handleCreateLobby(socket, io, lives, cards);
    });

    socket.on("lobby:join", (lobbyId) => {
      joinLobby(lobbyId, socket, io);
    });

    socket.on("lobby:leave", () => {
      leaveLobby(socket, io, reconnect.reconnectTimers);
    });

    socket.on("lobby:delete", (lobbyId) => {
      handleDeleteLobby(lobbyId, socket, io, reconnect.reconnectTimers);
    });

    // -------------------------
    // Game
    // -------------------------

    socket.on("game:start", () => {
      startGame(socket, io);
    });

    socket.on("game:get-state", () => {
      sendGameState(socket);
    });

    socket.on("game:place-bid", (bid) => {
      handlePlaceBid(io, socket, bid);
    });

    socket.on("game:play-card", (card) => {
      handlePlayCard(io, socket, card);
    });

    socket.on("lobbies:check", () => {
      checkCurrentGame(socket);
    });

    // -------------------------
    // Connection
    // -------------------------

    socket.on("disconnect", () => {
      console.log("Socket disconnected:", socket.id);

      reconnect.handleDisconnect(socket, io, broadcastLobbies);
    });
  });
}

module.exports = setupSockets;
