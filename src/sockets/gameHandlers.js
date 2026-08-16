const {
  getLobbyByPlayer,
  getLobby,
  setLobbyStarted,
  setLobbyClosed,
} = require("../game/lobbyManager");

const {
  initGameState,
  createGame,
  getGame,
  getPlayerGameState,
  placeBid,
  playCard,
  resolveShowdown,
} = require("../game/gameManager");

const db = require("../db");

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

function sendGameState(socket, io) {
  const { setPlayerConnected } = require("../game/lobbyManager");
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

  setPlayerConnected(lobby.id, playerId, true);

  if (io) {
    broadcastGameState(io, lobby.id);
  } else {
    socket.emit("game:state", getPlayerGameState(game, playerId));
  }
}

async function startGame(socket, io) {
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

  if (lobby.players.size < 2) {
    console.log("Too few players!");
    return;
  }

  const game = initGameState(
    lobby.id,
    lobby.players,
    lobby.startingLives,
    lobby.initialCards,
  );

  createGame(game);

  setLobbyStarted(lobby.id, true);

  const client = await db.connect();

  try {
    await client.query("BEGIN");

    await client.query(
      `INSERT INTO games (id, player_count, duration) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING`,
      [lobby.id, lobby.players.size, 0],
    );

    let positionTracker = 1;
    for (const playerId of lobby.players.keys()) {
      await client.query(
        `
          INSERT INTO game_players (game_id, user_id, position, left_early) 
          VALUES ($1, $2, $3, FALSE)
          ON CONFLICT (game_id, user_id) DO NOTHING
        `,
        [lobby.id, playerId, positionTracker],
      );
      positionTracker++;
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");

    console.error(
      "START GAME: Error saving game players to DB, rolled back",
      error,
    );

    return;
  } finally {
    client.release();
  }

  const room = `lobby:${lobby.id}`;

  io.to(room).emit("game:started");
}

function emitGameResult(io, lobbyId, game, result) {
  if (!result?.finished) {
    broadcastGameState(io, lobbyId);
    return;
  }

  game.turnPhase = "finished";

  broadcastGameState(io, lobbyId);

  const winner = game.players.get(result.winnerId);

  for (const socket of io.sockets.sockets.values()) {
    if (!socket.rooms.has(`lobby:${lobbyId}`)) {
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

  setLobbyStarted(lobbyId, false);
  setLobbyClosed(lobbyId, true);
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

  if (game.showdown && game.turnPhase === "play") {
    const result = resolveShowdown(game);

    emitGameResult(io, lobby.id, game, result);

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

  if (game.showdown) {
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

  if (!hand) {
    socket.emit("game:invalid-card");
    return;
  }

  const isAce = card === "asso-prende" || card === "asso-lascia";

  if (isAce) {
    if (!hand.includes("denari1")) {
      socket.emit("game:invalid-card");
      return;
    }
  } else {
    if (!hand.includes(card)) {
      socket.emit("game:invalid-card");
      return;
    }
  }

  const result = playCard(game, playerId, card);

  emitGameResult(io, lobby.id, game, result);
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
