const games = new Map();

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

function getPublicGameState(game) {
  return {
    lobbyId: game.lobbyId,
    status: game.status,
    remainingCards: game.deck.length,
    currentPlayer: game.currentPlayer,
  };
}

module.exports = {
  createGame,
  getGame,
  deleteGame,
  getPublicGameState,
};
