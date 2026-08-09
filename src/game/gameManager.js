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

  console.log(players);

  const game = {
    lobbyId,
    status: "playing",
    turnPhase: "bidding",
    initialCards,
    turn: 1,
    players,
    currentPlayer: Array.from(players.keys())[0],
    hands: dealCards(deck, players, initialCards),
  };

  console.log(game);

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
  console.log({ game, playerId });

  return {
    lobbyId: game.lobbyId,
    status: game.status,
    players: game.players,
    currentPlayer: game.currentPlayer,
    hand: game.hands.get(playerId),
    isMyTurn: game.currentPlayer == playerId,
  };
}

module.exports = {
  initGameState,
  createGame,
  getGame,
  deleteGame,
  getPlayerGameState,
};
