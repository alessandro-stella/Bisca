const authenticateSocket = require("./auth");
const {
  runMiddleware,
  requireLobbyOwner,
  requireLobbyNotStarted,
  requireActiveGame,
  requireIsYourTurn,
  validators,
} = require("./middleware");

const { getLobby, getLobbyByPlayer } = require("../game/lobbyManager");
const { getGame } = require("../game/gameManager");

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

function setupSockets(io) {
  io.use(authenticateSocket);

  io.on("connection", (socket) => {
    const reconnect = createConnectionHandlers();
    reconnect.handleReconnect(socket, io, broadcastLobbies);
    sendLobbies(socket);

    // =============================================
    // LOBBY EVENTS
    // =============================================

    socket.on("lobby:create", (lives, cards) => {
      const validation = validators.validateLobbyParams(lives, cards);
      if (!validation.valid) {
        socket.emit("error", { message: validation.message });
        return;
      }
      handleCreateLobby(socket, io, lives, cards);
    });

    socket.on("lobby:join", (lobbyId) => {
      const validation = validators.validateLobbyId(lobbyId);
      if (!validation.valid) {
        socket.emit("error", { message: validation.message });
        return;
      }
      joinLobby(lobbyId, socket, io);
    });

    socket.on("lobby:leave", () => {
      leaveLobby(socket, io, reconnect.reconnectTimers);
    });

    socket.on("lobby:delete", (lobbyId) => {
      const validation = validators.validateLobbyId(lobbyId);
      if (!validation.valid) {
        socket.emit("error", { message: validation.message });
        return;
      }

      const lobby = getLobby(lobbyId);
      if (!lobby) {
        socket.emit("error", { message: "Lobby not found" });
        return;
      }

      if (
        runMiddleware(requireLobbyOwner, socket) &&
        runMiddleware(requireLobbyNotStarted, socket)
      ) {
        handleDeleteLobby(lobbyId, socket, io, reconnect.reconnectTimers);
      }
    });

    // =============================================
    // GAME EVENTS
    // =============================================

    socket.on("game:start", () => {
      startGame(socket, io);
    });

    socket.on("game:get-state", () => {
      const lobby = getLobbyByPlayer(socket.user.id);
      if (!lobby || !getGame(lobby.id)) {
        socket.emit("game:not-found");
        return;
      }
      sendGameState(socket, io);
    });

    socket.on("game:place-bid", (bid) => {
      if (
        runMiddleware(requireActiveGame, socket) &&
        runMiddleware(requireIsYourTurn, socket)
      ) {
        const lobby = getLobbyByPlayer(socket.user.id);
        const game = getGame(lobby.id);

        if (game.turnPhase !== "bidding") {
          socket.emit("error", { message: "Wrong turn phase" });
          return;
        }

        const maxBid = Array.from(game.hands.values()).length + 1; // Include 0 as bid
        const validation = validators.validateBid(bid, maxBid);
        if (!validation.valid) {
          socket.emit("error", { message: validation.message });
          return;
        }

        handlePlaceBid(io, socket, bid);
      }
    });

    socket.on("game:play-card", (card) => {
      const validation = validators.validateCard(card);
      if (!validation.valid) {
        socket.emit("error", { message: validation.message });
        return;
      }

      if (runMiddleware(requireIsYourTurn, socket)) {
        handlePlayCard(io, socket, card);
      }
    });

    socket.on("lobbies:check", () => {
      checkCurrentGame(socket);
    });

    // =============================================
    // CONNECTION HANDLING
    // =============================================

    socket.on("disconnect", () => {
      reconnect.handleDisconnect(socket, io, broadcastLobbies);
    });
  });
}

module.exports = setupSockets;
