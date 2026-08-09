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

function startGame(socket, io, lives, initialCards) {
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

  const game = initGameState(lobby.id, players, lives, initialCards);

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

  const accepted = placeBid(game, playerId, bid);

  if (!accepted) {
    return;
  }

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

  if (game.turnPhase !== "play") {
    return;
  }

  const playerId = socket.user.id;

  if (playerId !== game.currentPlayer) {
    socket.emit("game:not-your-turn");
    return;
  }

  const player = game.players.get(playerId);

  if (!player) {
    socket.emit("game:player-not-found");
    return;
  }

  const hand = game.hands.get(playerId);

  if (!hand || !hand.includes(card)) {
    socket.emit("game:invalid-card");
    return;
  }

  const result = playCard(game, playerId, card);

  if (result?.finished) {
    broadcastGameState(io, lobby.id);

    const winner = game.players.get(result.winnerId);

    for (const socket of io.sockets.sockets.values()) {
      if (!socket.rooms.has(`lobby:${lobby.id}`)) {
        continue;
      }

      const playerId = socket.user.id;
      const isWinner = playerId === result.winnerId;

      socket.emit("game:finished", {
        winnerId: result.winnerId,
        winnerUsername: winner?.username,
        isWinner,
      });
    }

    return;
  }

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
