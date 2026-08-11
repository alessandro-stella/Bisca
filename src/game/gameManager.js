const { v4: uuidv4 } = require("uuid");
const db = require("../db");
const { calculateAndUpdateElo } = require("./eloManager");

const games = new Map();

function getRandomizedDeck() {
  const deck = [];
  const suits = ["denari", "coppe", "spade", "bastoni"];

  for (const suit of suits) {
    for (let i = 1; i <= 10; i++) {
      deck.push(`${suit}${i}`);
    }
  }

  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));

    [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  return deck;
}

function dealCards(players, cardsToDeal) {
  const shuffledDeck = getRandomizedDeck();
  const hands = new Map();

  for (const player of players.keys()) {
    hands.set(player, shuffledDeck.splice(0, cardsToDeal));
  }

  return hands;
}

function initGameState(lobbyId, players, lives, initialCards) {
  const gamePlayers = new Map();

  for (const [playerId, playerValues] of players.entries()) {
    const newPlayerState = {
      ...playerValues,
      bid: -1,
      lives: lives,
      won: 0,
      position: null,
    };

    gamePlayers.set(playerId, newPlayerState);
  }

  const firstPlayer = Array.from(gamePlayers.keys())[0];

  const game = {
    lobbyId,
    status: "playing",
    turnPhase: "bidding",
    showdown: initialCards === 1,

    initialCards,
    turn: 1,
    playedHands: 0,

    players: gamePlayers,
    playedCards: new Map(),
    nextPosition: gamePlayers.size,

    turnStarter: firstPlayer,
    currentPlayer: firstPlayer,

    lastPlayer: null,

    hands: dealCards(gamePlayers, initialCards),

    totalBids: 0,
  };

  game.lastPlayer = getPreviousAlivePlayer(game, game.turnStarter);

  return game;
}

function createGame(game) {
  if (games.has(game.lobbyId)) {
    throw new Error("Game already exists for this lobby");
  }

  games.set(game.lobbyId, game);

  return game;
}

function getGame(lobbyId) {
  return games.get(lobbyId);
}

function deleteGame(lobbyId) {
  return games.delete(lobbyId);
}

function getPlayerGameState(game, playerId) {
  let hand = game.hands.get(playerId);

  if (game.showdown) {
    hand = [];

    for (const [opponentId, opponentHand] of game.hands.entries()) {
      if (opponentId === playerId) continue;

      hand.push(opponentHand[0]);
    }
  }

  return {
    turnPhase: game.turnPhase,
    totalBids: game.totalBids,
    showdown: game.showdown,

    players: Array.from(game.players.values()),
    playedCards: Array.from(game.playedCards.values()),

    currentPlayer: game.players.get(game.currentPlayer)?.username || "",

    myUsername: game.players.get(playerId).username,
    hand,

    isMyTurn: game.currentPlayer === playerId,
    lastPlayer: game.lastPlayer === playerId,
  };
}

function getAlivePlayers(game) {
  return Array.from(game.players.entries()).filter(
    ([, playerValues]) => playerValues.lives > 0,
  );
}

function getNextAlivePlayer(game, playerId) {
  const players = Array.from(game.players.keys());

  if (players.length === 0) {
    return null;
  }

  const currentIndex = players.indexOf(playerId);

  if (currentIndex === -1) {
    return null;
  }

  let nextIndex = currentIndex;

  do {
    nextIndex = (nextIndex + 1) % players.length;
  } while (game.players.get(players[nextIndex]).lives === 0);

  return players[nextIndex];
}

function nextPlayer(game, playerId) {
  const nextPlayerId = getNextAlivePlayer(game, playerId);

  if (nextPlayerId !== null) {
    game.currentPlayer = nextPlayerId;
  }
}

function getPreviousAlivePlayer(game, playerId) {
  const players = Array.from(game.players.keys());

  if (players.length === 0) {
    return null;
  }

  const currentIndex = players.indexOf(playerId);

  if (currentIndex === -1) {
    return null;
  }

  let prevIndex = currentIndex;

  do {
    prevIndex = (prevIndex - 1 + players.length) % players.length;
  } while (game.players.get(players[prevIndex]).lives === 0);

  return players[prevIndex];
}

function getNextTurnStarter(game) {
  const players = Array.from(game.players.keys());

  const currentIndex = players.indexOf(game.turnStarter);

  if (currentIndex === -1) {
    return null;
  }

  let nextIndex = currentIndex;

  do {
    nextIndex = (nextIndex + 1) % players.length;
  } while (game.players.get(players[nextIndex]).lives === 0);

  return players[nextIndex];
}

function placeBid(game, playerId, bid) {
  const playerState = game.players.get(playerId);

  if (!playerState || playerState.lives === 0) {
    return false;
  }

  if (game.turnPhase !== "bidding") {
    return false;
  }

  if (playerState.bid !== -1) {
    return false;
  }

  const hand = game.hands.get(playerId);
  const handSize = hand ? hand.length : 0;

  if (!Number.isInteger(bid) || bid < 0 || bid > handSize) {
    return false;
  }

  // Skip denied bidding rule when in showdown
  if (!game.showdown && playerId === game.lastPlayer) {
    const forbiddenBid = handSize - game.totalBids;

    if (bid === forbiddenBid) {
      return false;
    }
  }

  playerState.bid = bid;
  game.totalBids += bid;

  game.players.set(playerId, playerState);

  const alivePlayers = getAlivePlayers(game);

  const allBidsPlaced = alivePlayers.every(([, player]) => player.bid !== -1);

  if (allBidsPlaced) {
    game.turnPhase = "play";

    game.currentPlayer = game.turnStarter;

    return true;
  }

  nextPlayer(game, playerId);

  return true;
}

function playCard(game, playerId, card) {
  if (game.turnPhase !== "play") {
    return;
  }

  const playerState = game.players.get(playerId);

  if (!playerState || playerState.lives === 0) {
    return;
  }

  const hand = game.hands.get(playerId);

  if (!hand) {
    return;
  }

  const isAce = card === "asso-prende" || card === "asso-lascia";

  if (!game.showdown && card === "denari1") {
    return;
  }

  if (game.showdown && isAce) {
    return;
  }

  const physicalCard = isAce ? "denari1" : card;

  if (!hand.includes(physicalCard)) {
    return;
  }

  const newHand = hand.filter((handCard) => handCard !== physicalCard);

  game.hands.set(playerId, newHand);

  game.playedCards.set(playerId, {
    card,
    value: getCardValue(card),
  });

  const alivePlayers = getAlivePlayers(game);

  if (game.playedCards.size === alivePlayers.length) {
    return updateScore(game);
  }

  nextPlayer(game, playerId);
}

function getCardValue(card) {
  if (card === "asso-prende") return 10000;
  if (card === "asso-lascia") return -10000;

  const match = card.match(/^([a-z]+)(\d+)$/);

  if (!match) {
    throw new Error(`Invalid card: ${card}`);
  }

  const suit = match[1];
  const number = Number(match[2]);

  switch (suit) {
    case "denari":
      return number + 400;

    case "coppe":
      return number + 300;

    case "spade":
      return number + 200;

    case "bastoni":
      return number + 100;

    default:
      throw new Error(`Unknown card suit: ${suit}`);
  }
}

function updateScore(game) {
  const playedCards = Array.from(game.playedCards.entries());

  if (playedCards.length === 0) {
    return;
  }

  let highestCard = playedCards[0];

  for (let i = 1; i < playedCards.length; i++) {
    if (playedCards[i][1].value > highestCard[1].value) {
      highestCard = playedCards[i];
    }
  }

  const winnerId = highestCard[0];

  game.playedCards.clear();
  game.currentPlayer = winnerId;

  const winnerValues = game.players.get(winnerId);
  winnerValues.won++;

  game.players.set(winnerId, winnerValues);

  game.playedHands++;

  const cardsThisTurn =
    game.initialCards - ((game.turn - 1) % game.initialCards);

  if (game.playedHands >= cardsThisTurn) {
    return endTurn(game);
  }
}

function endTurn(game) {
  const newLives = new Map();
  const deadThisTurn = [];

  for (const [playerId, playerValues] of game.players) {
    if (playerValues.lives === 0) {
      newLives.set(playerId, 0);
      continue;
    }

    const lives = Math.max(
      playerValues.lives - Math.abs(playerValues.bid - playerValues.won),
      0,
    );

    newLives.set(playerId, lives);

    if (lives === 0) {
      deadThisTurn.push(playerId);
    }
  }

  const survivors = Array.from(newLives.entries()).filter(
    ([, lives]) => lives > 0,
  );

  game.turn++;

  const isDraw = survivors.length === 0;

  if (!isDraw) {
    for (const [playerId, lives] of newLives) {
      game.players.get(playerId).lives = lives;
    }

    if (deadThisTurn.length > 0) {
      assignPlayersPosition(game, deadThisTurn);
    }
  }

  if (survivors.length === 1) {
    const winnerId = survivors[0][0];

    console.log("VINCITORE!", winnerId);

    game.status = "finished";
    game.winnerId = winnerId;

    game.players.get(winnerId).position = 1;

    return {
      finished: true,
      winnerId,
    };
  }

  const alivePlayers = new Map(
    Array.from(game.players.entries()).filter(([, player]) => player.lives > 0),
  );

  for (const [, playerData] of alivePlayers) {
    playerData.bid = -1;
    playerData.won = 0;
  }

  game.turnPhase = "bidding";
  game.totalBids = 0;
  game.playedHands = 0;
  game.playedCards.clear();

  const nextStarter = getNextTurnStarter(game);

  if (nextStarter === null) {
    throw new Error("Could not determine next turn starter");
  }

  game.turnStarter = nextStarter;
  game.currentPlayer = nextStarter;
  game.lastPlayer = getPreviousAlivePlayer(game, nextStarter);

  const cardsToDeal = game.initialCards - ((game.turn - 1) % game.initialCards);

  game.hands = dealCards(alivePlayers, cardsToDeal);
  game.showdown = cardsToDeal === 1;

  return {
    finished: false,
    draw: isDraw,
  };
}

function assignPlayersPosition(game, playerIds) {
  const players = playerIds
    .map((playerId) => game.players.get(playerId))
    .filter((player) => player && player.position == null);

  if (players.length === 0) {
    return;
  }

  for (const player of players) {
    player.position = game.nextPosition;
  }

  game.nextPosition -= players.length;
}

function resolveShowdown(game) {
  if (!game.showdown || game.turnPhase !== "play") {
    return null;
  }

  const alivePlayers = getAlivePlayers(game);
  let result = { finished: false };

  for (const [playerId] of alivePlayers) {
    const hand = game.hands.get(playerId);

    if (!hand || hand.length === 0) {
      continue;
    }

    const card = hand[0];
    const stepResult = playCard(game, playerId, card);

    if (stepResult) {
      result = stepResult;
    }
  }

  return result;
}

function restartCurrentTurn(game) {
  console.log("Calling restartCurrentTurn");

  const alivePlayers = new Map(
    Array.from(game.players.entries()).filter(([, player]) => player.lives > 0),
  );

  for (const [, playerData] of alivePlayers) {
    playerData.bid = -1;
    playerData.won = 0;
  }

  game.turnPhase = "bidding";
  game.totalBids = 0;
  game.playedHands = 0;
  game.playedCards.clear();

  if (
    !game.players.has(game.turnStarter) ||
    game.players.get(game.turnStarter).lives === 0
  ) {
    game.turnStarter = Array.from(alivePlayers.keys())[0];
  }

  game.currentPlayer = game.turnStarter;
  game.lastPlayer = getPreviousAlivePlayer(game, game.turnStarter);

  const cardsToDeal = game.initialCards - ((game.turn - 1) % game.initialCards);

  game.hands = dealCards(alivePlayers, cardsToDeal);
  game.showdown = cardsToDeal === 1;
}

function removePlayerFromGame(game, playerId) {
  const playerState = game.players.get(playerId);

  if (!playerState) {
    return { action: "none" };
  }

  const wasAlive = playerState.lives > 0;
  playerState.lives = 0;

  if (wasAlive) {
    playerState.leftEarly = true;
    playerState.connected = false;
  }

  assignPlayersPosition(game, [playerId]);

  const alivePlayers = Array.from(game.players.entries()).filter(
    ([, p]) => p.lives > 0,
  );

  if (alivePlayers.length < 2) {
    if (alivePlayers.length === 1) {
      const winnerId = alivePlayers[0][0];
      game.status = "finished";
      game.winnerId = winnerId;
      game.players.get(winnerId).position = 1;
      return { action: "finished", winnerId };
    } else {
      game.status = "finished";
      return { action: "finished", winnerId: null };
    }
  }

  if (wasAlive) {
    restartCurrentTurn(game);
    return { action: "restarted" };
  }

  return { action: "none" };
}

async function saveGameData(game) {
  console.log("Saving data of this game:", game);
  const gameId = game.id;

  const dbClient = await db.connect();

  try {
    await dbClient.query("BEGIN");

    await dbClient.query(
      `
        UPDATE games 
        SET winner_id = $1, duration = $2
        WHERE id = $3
      `,
      [game.winner || null, game.duration || 0, gameId],
    );

    for (const p of game.players) {
      await dbClient.query(
        `
          UPDATE game_players 
          SET position = $1, left_early = $2
          WHERE game_id = $3 AND user_id = $4
        `,
        [p.position, p.leftEarly || false, gameId, p.userId],
      );
    }

    await dbClient.query("COMMIT");

    const playersForElo = game.players.map((p) => ({
      id: p.userId,
      position: p.position,
    }));

    await calculateAndUpdateElo(gameId, playersForElo);

    console.log("ELO updated successfully for game:", gameId);
  } catch (error) {
    await dbClient.query("ROLLBACK");

    console.error("Error in saveGameData & ELO calculation:", error);

    throw error;
  } finally {
    dbClient.release();
  }
}

module.exports = {
  initGameState,
  createGame,
  getGame,
  deleteGame,
  getPlayerGameState,
  placeBid,
  playCard,
  resolveShowdown,
  assignPlayersPosition,
  removePlayerFromGame,
  saveGameData,
};
