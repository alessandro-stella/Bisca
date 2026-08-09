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
const {
  getLobby,
  createLobby,
  setPlayerConnected,
  setLobbyStarted,
} = require("../game/lobbyManager");
const { getGame, initGameState, createGame } = require("../game/gameManager");

const TEST_GAME = process.env.NODE_ENV !== "production";
const TEST_LOBBY_ID = "TEST-GAME";

const reconnect = createConnectionHandlers();

function setupTestGame(socket, io) {
  if (!TEST_GAME) {
    return;
  }

  let lobby = getLobby(TEST_LOBBY_ID);

  if (!lobby) {
    lobby = {
      id: TEST_LOBBY_ID,
      ownerId: socket.user.id,
      ownerUsername: socket.user.username,
      started: false,
      players: new Map(),
    };

    createLobby(lobby);
  }

  if (!lobby.players.has(socket.user.id)) {
    if (lobby.players.size >= 2) {
      console.log("TEST GAME: already has two players");
      return;
    }

    lobby.players.set(socket.user.id, {
      connected: true,
      username: socket.user.username,
    });
  } else {
    setPlayerConnected(lobby.id, socket.user.id, true);
  }

  socket.join(`lobby:${lobby.id}`);

  console.log(
    `TEST GAME: ${socket.user.username} connected ` +
      `(${lobby.players.size}/2)`,
  );

  if (lobby.players.size < 2) {
    return;
  }

  let game = getGame(TEST_LOBBY_ID);

  if (!game) {
    game = initGameState(TEST_LOBBY_ID, lobby.players, 3, 6);

    createGame(game);

    setLobbyStarted(TEST_LOBBY_ID, true);

    console.log("TEST GAME CREATED");

    io.to(`lobby:${TEST_LOBBY_ID}`).emit("game:started");
  }
}

function setupSockets(io) {
  io.use(authenticateSocket);

  io.on("connection", (socket) => {
    console.log("Socket connected:", socket.id);
    console.log("Authenticated user:", socket.user);

    reconnect.handleReconnect(socket, io, broadcastLobbies);

    setupTestGame(socket, io);

    sendLobbies(socket);

    // -------------------------
    // Lobby
    // -------------------------

    socket.on("lobby:create", () => {
      handleCreateLobby(socket, io);
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
