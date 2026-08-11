// middleware.js
const { getLobbyByPlayer } = require("../game/lobbyManager");
const { getGame } = require("../game/gameManager");

// Funzione helper per eseguire i tuoi middleware come controlli sincroni
function runMiddleware(middlewareFn, socket) {
  let passed = true;
  const mockNext = (err) => {
    if (err) passed = false;
  };

  middlewareFn(socket, mockNext);
  return passed;
}

function requireAuth(socket, next) {
  if (!socket.user) {
    return next(new Error("Not authenticated"));
  }
  next();
}

function requireInLobby(socket, next) {
  const lobby = getLobbyByPlayer(socket.user.id);
  if (!lobby) {
    socket.emit("error", { message: "Not in a lobby" });
    return next(new Error("Not in a lobby"));
  }
  next();
}

function requireLobbyOwner(socket, next) {
  const lobby = getLobbyByPlayer(socket.user.id);
  if (!lobby) {
    socket.emit("error", { message: "Not in a lobby" });
    return next(new Error("Not in a lobby"));
  }

  if (lobby.ownerId !== socket.user.id) {
    socket.emit("error", { message: "Only lobby owner can do this" });
    return next(new Error("Not lobby owner"));
  }

  next();
}

function requireActiveGame(socket, next) {
  const lobby = getLobbyByPlayer(socket.user.id);
  if (!lobby) {
    socket.emit("error", { message: "Not in a lobby" });
    return next(new Error("Not in a lobby"));
  }

  const game = getGame(lobby.id);
  if (!game || game.status !== "playing") {
    socket.emit("error", { message: "No active game" });
    return next(new Error("No active game"));
  }

  next();
}

function requireIsYourTurn(socket, next) {
  const lobby = getLobbyByPlayer(socket.user.id);
  if (!lobby) {
    socket.emit("error", { message: "Not in a lobby" });
    return next(new Error("Not in a lobby"));
  }

  const game = getGame(lobby.id);
  if (!game) {
    socket.emit("error", { message: "No active game" });
    return next(new Error("No active game"));
  }

  if (game.currentPlayer !== socket.user.id) {
    socket.emit("error", { message: "Not your turn" });
    return next(new Error("Not your turn"));
  }

  next();
}

function requireLobbyNotStarted(socket, next) {
  const lobby = getLobbyByPlayer(socket.user.id);
  if (!lobby) {
    socket.emit("error", { message: "Not in a lobby" });
    return next(new Error("Not in a lobby"));
  }

  if (lobby.started) {
    socket.emit("error", { message: "Game already started" });
    return next(new Error("Game already started"));
  }

  next();
}

const validators = {
  validateBid(bid, max) {
    if (!Number.isInteger(bid)) {
      return { valid: false, message: "Bid must be an integer" };
    }
    if (bid < 0 || bid > max) {
      return { valid: false, message: `Bid must be between 0 and ${max}` };
    }
    return { valid: true };
  },

  validateCard(card) {
    const VALID_CARDS = [
      "denari1",
      "denari2",
      "denari3",
      "denari4",
      "denari5",
      "denari6",
      "denari7",
      "denari8",
      "denari9",
      "denari10",
      "coppe1",
      "coppe2",
      "coppe3",
      "coppe4",
      "coppe5",
      "coppe6",
      "coppe7",
      "coppe8",
      "coppe9",
      "coppe10",
      "spade1",
      "spade2",
      "spade3",
      "spade4",
      "spade5",
      "spade6",
      "spade7",
      "spade8",
      "spade9",
      "spade10",
      "bastoni1",
      "bastoni2",
      "bastoni3",
      "bastoni4",
      "bastoni5",
      "bastoni6",
      "bastoni7",
      "bastoni8",
      "bastoni9",
      "bastoni10",
      "asso-prende",
      "asso-lascia",
    ];

    if (!VALID_CARDS.includes(card)) {
      return { valid: false, message: "Invalid card" };
    }
    return { valid: true };
  },

  validateLobbyId(lobbyId) {
    if (!lobbyId || typeof lobbyId !== "string") {
      return { valid: false, message: "Invalid lobby ID" };
    }
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(lobbyId)) {
      return { valid: false, message: "Invalid lobby ID format" };
    }
    return { valid: true };
  },

  validateLobbyParams(lives, cards) {
    if (!Number.isInteger(lives) || lives < 1 || lives > 10) {
      return { valid: false, message: "Lives must be between 1 and 10" };
    }
    if (!Number.isInteger(cards) || cards < 1 || cards > 10) {
      return { valid: false, message: "Cards must be between 1 and 10" };
    }
    return { valid: true };
  },
};

module.exports = {
  runMiddleware,
  requireAuth,
  requireInLobby,
  requireLobbyOwner,
  requireActiveGame,
  requireIsYourTurn,
  requireLobbyNotStarted,
  validators,
};
