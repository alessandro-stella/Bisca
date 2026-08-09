const { getLobbyByPlayer, getLobby } = require("../game/lobbyManager");

const {
  initGameState,
  createGame,
  getGame,
  getPlayerGameState,
  placeBid,
  playCard,
} = require("../game/gameManager");

function broadcastGameState(io, lobbyId) {
  const lobby = getLobby(lobbyId);
  const game = getGame(lobbyId);

  if (!lobby || !game) {
    return;
  }

  for (const socket of io.sockets.sockets.values()) {
    if (!socket.rooms.has(`lobby:${lobbyId}`)) {
      continue;
    }

    const playerId = socket.user.id;

    socket.emit("game:state", getPlayerGameState(game, playerId));
  }
}

function sendGameState(socket) {
  const lobby = getLobbyByPlayer(socket.user.id);

  if (!lobby) {
    socket.emit("game:not-found");
    return;
  }

  const game = getGame(lobby.id);

  if (!game) {
    socket.emit("game:not-found");
    return;
  }

  const playerId = socket.user.id;

  socket.emit("game:state", getPlayerGameState(game, playerId));
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

  const players = lobby.players;

  const game = initGameState(lobby.id, players, 3, 6);

  createGame(game);

  console.log("GAME CREATED:", game);

  const room = `lobby:${lobby.id}`;

  io.to(room).emit("game:started");
}

function handlePlaceBid(io, socket, bid) {
  const lobby = getLobbyByPlayer(socket.user.id);

  if (!lobby) {
    socket.emit("game:not-found");
    return;
  }

  const game = getGame(lobby.id);

  if (!game) {
    socket.emit("game:not-found");
    return;
  }

  const playerId = socket.user.id;

  if (playerId !== game.currentPlayer) {
    return;
  }

  placeBid(game, playerId, bid);

  broadcastGameState(io, lobby.id);
}

function handlePlayCard(io, socket, card) {
  const lobby = getLobbyByPlayer(socket.user.id);

  if (!lobby) {
    socket.emit("game:not-found");
    return;
  }

  const game = getGame(lobby.id);

  if (!game) {
    socket.emit("game:not-found");
    return;
  }

  const playerId = socket.user.id;

  if (playerId !== game.currentPlayer) {
    return;
  }

  playCard(game, playerId, card);

  broadcastGameState(io, lobby.id);
}

function checkCurrentGame(socket) {
  const lobby = getLobbyByPlayer(socket.user.id);

  if (!lobby || !lobby.started) {
    return;
  }

  socket.emit("game:reconnect");
}

module.exports = {
  broadcastGameState,
  sendGameState,
  startGame,
  handlePlaceBid,
  handlePlayCard,
  checkCurrentGame,
};
