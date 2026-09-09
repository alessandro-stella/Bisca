const { getLobbyByPlayer } = require("../game/lobbyManager");
const { getGame } = require("../game/gameManager");

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

  validateLobbyParams(name, maxPlayers, lives, cards) {
    let errors = [];

    if (typeof name !== "string" || name.trim() === "") {
      errors.push({
        field: "name",
        message: "Dai un nome alla lobby",
      });
    } else {
      if (name.length < 3) {
        errors.push({
          field: "name",
          message: "Nome della lobby troppo corto",
        });
      }

      if (name.length > 30) {
        errors.push({
          field: "name",
          message: "Nome della lobby troppo lungo",
        });
      }
    }

    if (!Number.isInteger(maxPlayers)) {
      errors.push({
        field: "players",
        message: "Numero di giocatori non valido",
      });
    } else {
      if (maxPlayers < 2 || maxPlayers > 6) {
        errors.push({
          field: "players",
          message:
            "Il numero massimo di giocatori deve essere compreso tra 2 e 6",
        });
      }
    }

    if (!Number.isInteger(lives) || lives < 1) {
      errors.push({
        field: "lives",
        message: "Numero di vite non valido",
      });
    }

    const maxCards = Math.floor(40 / maxPlayers);

    if (!Number.isInteger(cards) || cards < 1) {
      errors.push({
        field: "cards",
        message: "Numero di carte non valido",
      });
    }

    if (cards > maxCards) {
      errors.push({
        field: "cards",
        message: "Troppe carte per ogni giocatore",
      });
    }

    if (errors.length !== 0) return { valid: false, errors };

    return { valid: true };
  },

  validateLobbyUpdateParams(lives, cards, maxPlayers) {
    console.log("Valori di validateLobbyParams:", { lives, cards, maxPlayers });

    let errors = [];

    if (!Number.isInteger(lives) || lives < 1) {
      errors.push({
        field: "lives",
        message: "Numero di vite non valido",
      });
    }

    const maxCards = Math.floor(40 / maxPlayers);

    if (!Number.isInteger(cards) || cards < 1) {
      errors.push({
        field: "cards",
        message: "Numero di carte non valido",
      });
    }

    if (cards > maxCards) {
      errors.push({
        field: "cards",
        message: "Troppe carte per ogni giocatore",
      });
    }

    if (errors.length !== 0) return { valid: false, errors };

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
