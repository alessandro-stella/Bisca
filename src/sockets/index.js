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
  setLobbyStarted,
  setPlayerConnected,
  isPlayerConnected,
} = require("../game/lobbyManager");

const {
  createGame,
  getGame,
  deleteGame,
  getPublicGameState,
} = require("../game/gameManager");

const reconnectTimers = new Map();
const RECONNECT_TIMEOUT = 60 * 1000;

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

function handleCreateLobby(socket, io) {
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
        },
      ],
    ]),
  };

  createLobby(lobby);

  socket.join(`lobby:${lobby.id}`);

  console.log("Lobby created:", lobby);

  broadcastLobbies(io);
}

function joinLobby(lobbyId, socket, io) {
  const result = addPlayer(lobbyId, socket.user.id);

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

function leaveLobby(socket, io) {
  const lobby = getLobbyByPlayer(socket.user.id);

  if (!lobby) {
    return;
  }

  const timer = reconnectTimers.get(socket.user.id);

  if (timer) {
    clearTimeout(timer);
    reconnectTimers.delete(socket.user.id);
  }

  if (lobby.ownerId === socket.user.id) {
    const room = `lobby:${lobby.id}`;

    deleteGame(lobby.id);

    io.to(room).emit("lobby:deleted");

    io.in(room).socketsLeave(room);

    deleteLobby(lobby.id);

    console.log(
      `Lobby deleted because owner ${socket.user.username} left: ${lobby.id}`,
    );

    broadcastLobbies(io);

    return;
  }

  removePlayer(lobby.id, socket.user.id);

  socket.leave(`lobby:${lobby.id}`);

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

  const room = `lobby:${lobbyId}`;

  for (const userId of lobby.players.keys()) {
    const timer = reconnectTimers.get(userId);

    if (timer) {
      clearTimeout(timer);
      reconnectTimers.delete(userId);
    }
  }

  deleteGame(lobbyId);

  io.to(room).emit("lobby:deleted");

  io.in(room).socketsLeave(room);

  deleteLobby(lobbyId);

  console.log(`Lobby ${lobbyId} deleted by owner ${socket.user.username}`);

  broadcastLobbies(io);
}

function startGame(socket, io) {
  const lobby = getLobbyByPlayer(socket.user.id);

  if (!lobby) {
    console.log("START GAME: lobby not found");
    return;
  }

  if (lobby.ownerId !== socket.user.id) {
    console.log("START GAME: user is not owner");
    return;
  }

  if (getGame(lobby.id)) {
    console.log("START GAME: game already exists");
    return;
  }

  const game = {
    lobbyId: lobby.id,
    status: "playing",
    deck: [],
    currentPlayer: null,
  };

  createGame(game);

  console.log("GAME CREATED:", game);

  setLobbyStarted(lobby.id, true);
  io.to(`lobby:${lobby.id}`).emit("game:started");
}

function sendGameState(socket) {
  const lobby = getLobbyByPlayer(socket.user.id);

  if (!lobby) {
    console.log("GAME STATE: lobby not found");

    socket.emit("game:not-found");

    return;
  }

  socket.join(`lobby:${lobby.id}`);

  const game = getGame(lobby.id);

  if (!game) {
    console.log("GAME STATE: game not found");

    socket.emit("game:not-found");

    return;
  }

  console.log(`Sending game state to ${socket.user.username}`);

  socket.emit("game:state", getPublicGameState(game));
}

function checkCurrentGame(socket) {
  const lobby = getLobbyByPlayer(socket.user.id);

  if (!lobby || !lobby.started) {
    return;
  }

  socket.emit("game:reconnect");
}

function handleDisconnect(socket, io) {
  const userId = socket.user.id;

  const lobby = getLobbyByPlayer(userId);

  if (!lobby) {
    return;
  }

  setPlayerConnected(lobby.id, userId, false);

  console.log(`${socket.user.username} disconnected from lobby ${lobby.id}`);

  broadcastLobbies(io);

  const timer = setTimeout(() => {
    const currentLobby = getLobbyByPlayer(userId);

    if (!currentLobby) {
      reconnectTimers.delete(userId);
      return;
    }

    if (isPlayerConnected(currentLobby.id, userId)) {
      reconnectTimers.delete(userId);
      return;
    }

    if (currentLobby.ownerId === userId) {
      const room = `lobby:${currentLobby.id}`;

      deleteGame(currentLobby.id);

      io.to(room).emit("lobby:deleted");

      io.in(room).socketsLeave(room);

      deleteLobby(currentLobby.id);

      console.log(
        `Lobby deleted because owner ${socket.user.username} did not reconnect within 60 seconds: ${currentLobby.id}`,
      );

      reconnectTimers.delete(userId);

      broadcastLobbies(io);

      return;
    }

    removePlayer(currentLobby.id, userId);

    reconnectTimers.delete(userId);

    console.log(
      `${socket.user.username} removed from lobby ${currentLobby.id} after 60 seconds`,
    );

    broadcastLobbies(io);
  }, RECONNECT_TIMEOUT);

  reconnectTimers.set(userId, timer);
}

function handleReconnect(socket, io) {
  const userId = socket.user.id;

  const lobby = getLobbyByPlayer(userId);

  if (!lobby) {
    return;
  }

  setPlayerConnected(lobby.id, userId, true);

  const timer = reconnectTimers.get(userId);

  if (timer) {
    clearTimeout(timer);
    reconnectTimers.delete(userId);
  }

  socket.join(`lobby:${lobby.id}`);

  console.log(`${socket.user.username} reconnected to lobby ${lobby.id}`);

  broadcastLobbies(io);

  if (lobby.started) {
    socket.emit("game:reconnect");
  }
}

function setupSockets(io) {
  io.use(authenticateSocket);

  io.on("connection", (socket) => {
    console.log("Socket connected:", socket.id);
    console.log("Authenticated user:", socket.user);

    handleReconnect(socket, io);

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

    socket.on("game:start", () => {
      console.log("GAME START requested by:", socket.user.username);

      startGame(socket, io);
    });

    socket.on("game:get-state", () => {
      sendGameState(socket);
    });

    socket.on("lobbies:check", () => {
      checkCurrentGame(socket);
    });

    socket.on("disconnect", () => {
      console.log("Socket disconnected:", socket.id);

      handleDisconnect(socket, io);
    });
  });
}

module.exports = setupSockets;
