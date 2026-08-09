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
  for (const [playerId, playerValues] of players.entries()) {
    playerValues.bid = -1;
    playerValues.lives = lives;
    playerValues.won = 0;

    players.set(playerId, playerValues);
  }

  const firstPlayer = Array.from(players.keys())[0];

  const game = {
    lobbyId,
    status: "playing",
    turnPhase: "bidding",

    initialCards,
    turn: 1,
    playedHands: 0,

    players,
    playedCards: new Map(),

    turnStarter: firstPlayer,
    currentPlayer: firstPlayer,

    lastPlayer: null,

    hands: dealCards(players, initialCards),

    totalBids: 0,
  };

  game.lastPlayer = getLastBidder(game);

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
  return {
    lobbyId: game.lobbyId,
    turnPhase: game.turnPhase,
    totalBids: game.totalBids,

    players: Array.from(game.players.values()),
    playedCards: Array.from(game.playedCards.values()),

    currentPlayer: game.players.get(game.currentPlayer).username,

    hand: game.hands.get(playerId),

    myUsername: game.players.get(playerId).username,
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

// The last player to bid in a round is whoever comes right before
// turnStarter in the (alive-player) speaking order.
function getLastBidder(game) {
  return getPreviousAlivePlayer(game, game.turnStarter);
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

  if (playerId === game.lastPlayer) {
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

  if (!hand || !hand.includes(card)) {
    return;
  }

  const newHand = hand.filter((handCard) => handCard !== card);

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

    case "asso-prende":
      return 10000;

    case "asso-lascia":
      return -1;

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

  const cardsThisTurn = game.initialCards - (game.turn - 1);

  if (game.playedHands >= cardsThisTurn) {
    return endTurn(game);
  }
}

function endTurn(game) {
  const newLives = new Map();

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
  }

  const survivors = Array.from(newLives.entries()).filter(
    ([, lives]) => lives > 0,
  );

  if (survivors.length === 0) {
    console.log("PAREGGIO!");

    game.playedHands = 0;
    game.playedCards.clear();

    for (const [playerId, playerValues] of game.players) {
      playerValues.bid = -1;
      playerValues.won = 0;

      game.players.set(playerId, playerValues);
    }

    game.turnPhase = "bidding";
    game.totalBids = 0;

    game.currentPlayer = game.turnStarter;
    game.lastPlayer = getLastBidder(game);

    const cardsToReplay =
      game.initialCards - ((game.turn - 1) % game.initialCards);

    game.hands = dealCards(game.players, cardsToReplay);

    return {
      finished: false,
      draw: true,
    };
  }

  for (const [playerId, lives] of newLives) {
    game.players.get(playerId).lives = lives;
  }

  if (survivors.length === 1) {
    const [winnerId] = survivors;

    console.log("VINCITORE!", winnerId);

    game.status = "finished";
    game.winnerId = winnerId;

    return {
      finished: true,
      winnerId,
    };
  }

  console.log("Più di un vivo, si continua!");

  for (const [playerId] of survivors) {
    const playerData = game.players.get(playerId);

    playerData.bid = -1;
    playerData.won = 0;

    game.players.set(playerId, playerData);
  }

  const nextStarter = getNextTurnStarter(game);

  if (nextStarter === null) {
    throw new Error("Could not determine next turn starter");
  }

  game.turnStarter = nextStarter;
  game.currentPlayer = nextStarter;
  game.lastPlayer = getPreviousAlivePlayer(game, nextStarter);

  game.turn++;

  game.turnPhase = "bidding";
  game.totalBids = 0;
  game.playedHands = 0;
  game.playedCards.clear();

  const alivePlayers = new Map(
    survivors.map(([playerId]) => [playerId, game.players.get(playerId)]),
  );

  const cardsToDeal = game.initialCards - ((game.turn - 1) % game.initialCards);

  game.hands = dealCards(alivePlayers, cardsToDeal);

  return {
    finished: false,
    draw: false,
  };
}

module.exports = {
  initGameState,
  createGame,
  getGame,
  deleteGame,
  getPlayerGameState,
  placeBid,
  playCard,
};
