const authenticateSocket = require("./auth");
const {
  runMiddleware,
  requireLobbyOwner,
  requireLobbyNotStarted,
  requireActiveGame,
  requireIsYourTurn,
  validators,
} = require("./middleware");

const { getLobbyByPlayer } = require("../game/lobbyManager");
const { getGame } = require("../game/gameManager");

const {
  sendLobbies,
  broadcastLobbies,
  handleCreateLobby,
  joinLobby,
  leaveLobby,
  handleDeleteLobby,
  handleUpdateLobbySettings,
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

  const reconnect = createConnectionHandlers();

  io.on("connection", (socket) => {
    console.log(
      `User ${socket.user.username} connected on device ${socket.deviceId}`,
    );

    reconnect.handleReconnect(socket, io, broadcastLobbies);
    sendLobbies(socket);

    // =============================================
    // HEARTBEAT - Keep alive mobile
    // =============================================

    socket.on("ping", () => {
      socket.emit("pong");
    });

    // =============================================
    // LOBBY EVENTS
    // =============================================

    socket.on("lobby:create", (name, maxPlayers, lives, cards, password) => {
      const validation = validators.validateLobbyParams(
        name,
        maxPlayers,
        lives,
        cards,
      );

      if (!validation.valid) {
        socket.emit("lobby:create:error", { errors: validation.errors });
        return;
      }

      handleCreateLobby(socket, io, name, maxPlayers, lives, cards, password);
    });

    socket.on("lobby:update", (lives, cards) => {
      const lobby = getLobbyByPlayer(socket.user.id);
      if (!lobby) {
        socket.emit("lobby:update:error", { message: "Non sei in una lobby" });
        return;
      }

      if (
        runMiddleware(requireLobbyOwner, socket) &&
        runMiddleware(requireLobbyNotStarted, socket)
      ) {
        const validation = validators.validateLobbyUpdateParams(
          lives,
          cards,
          lobby.maxPlayers,
        );

        if (!validation.valid) {
          socket.emit("lobby:update:error", { errors: validation.errors });
          return;
        }

        handleUpdateLobbySettings(lobby.id, io, lives, cards);
      }
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
      leaveLobby(socket, io, reconnect.deviceReconnectTimers);
    });

    socket.on("lobby:delete", () => {
      const lobby = getLobbyByPlayer(socket.user.id);
      if (!lobby) {
        socket.emit("lobby:delete:error", { message: "Non sei in una lobby" });
        return;
      }

      if (
        runMiddleware(requireLobbyOwner, socket) &&
        runMiddleware(requireLobbyNotStarted, socket)
      ) {
        handleDeleteLobby(
          lobby.id,
          socket,
          io,
          reconnect.deviceReconnectTimers,
        );
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

        const maxBid = Array.from(game.hands.values()).length + 1;
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
      console.log(
        `User ${socket.user.username} disconnected from device ${socket.deviceId}`,
      );
      reconnect.handleDisconnect(socket, io, broadcastLobbies);
    });
  });
}

module.exports = setupSockets;
