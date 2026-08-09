const games = new Map();

function shuffleDeck(deck) {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));

    [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  return deck;
}

function dealCards(deck, players, cardsToDeal) {
  const shuffledDeck = shuffleDeck(deck);

  const hands = new Map();

  for (const player of players.keys()) {
    hands.set(player, shuffledDeck.splice(0, cardsToDeal));
  }

  return hands;
}

function initGameState(lobbyId, players, lives, initialCards) {
  const deck = [];
  const suits = ["denari", "coppe", "spade", "bastoni"];

  for (const suit of suits) {
    for (let i = 1; i <= 10; i++) {
      deck.push(`${suit}${i}`);
    }
  }

  for (const [player, values] of players.entries()) {
    values.bid = -1;
    values.lives = lives;
    values.won = 0;

    players.set(player, values);
  }

  const game = {
    lobbyId,
    status: "playing",
    turnPhase: "bidding",
    initialCards,
    turn: 1,
    players,
    playedCards: new Map(),
    currentPlayer: Array.from(players.keys())[0],
    lastPlayer: Array.from(players.keys())[players.size - 1],
    hands: dealCards(deck, players, initialCards),
    totalBids: 0,
  };

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
    isMyTurn: game.currentPlayer == playerId,
    lastPlayer: game.lastPlayer == playerId,
  };
}

function nextPlayer(game, playerId) {
  const players = Array.from(game.players.keys());
  const currentIndex = players.indexOf(playerId);
  const nextPlayer = players[(currentIndex + 1) % players.length];
  game.currentPlayer = nextPlayer;
}

function placeBid(game, playerId, bid) {
  const playerState = game.players.get(playerId);
  playerState.bid = bid;
  game.totalBids += bid;

  game.players.set(playerId, playerState);

  nextPlayer(game, playerId);

  if (game.currentPlayer == Array.from(game.players.keys())[0]) {
    game.turnPhase = "play";
  }
}

function playCard(game, playerId, card) {
  const newHand = game.hands
    .get(playerId)
    .filter((handCard) => handCard != card);

  game.hands.set(playerId, newHand);
  game.playedCards.set(playerId, { card, value: getCardValue(card) });

  if (game.playedCards.size === game.players.size) {
    updateScore(game);
  } else {
    nextPlayer(game, playerId);
  }
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

    default:
      return -1;
  }
}

function updateScore(game) {
  const playedCards = [...game.playedCards.entries()];

  let highestCard = playedCards[0];

  for (let i = 1; i < playedCards.length; i++) {
    if (playedCards[i][1].value > highestCard[1].value) {
      highestCard = playedCards[i];
    }
  }

  const winnerId = highestCard[0];

  game.playedCards = new Map();
  game.currentPlayer = winnerId;

  const winnerValues = game.players.get(winnerId);
  winnerValues.won += 1;
  game.players.set(winnerId, winnerValues);
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
