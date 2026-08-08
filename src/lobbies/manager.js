const lobbies = new Map();

function createLobby(lobby) {
  if (lobbies.has(lobby.id)) {
    throw new Error("Lobby already exists");
  }

  lobbies.set(lobby.id, lobby);

  return lobby;
}

function getLobby(lobbyId) {
  return lobbies.get(lobbyId);
}

function getLobbies() {
  return Array.from(lobbies.values());
}

function deleteLobby(lobbyId) {
  return lobbies.delete(lobbyId);
}

module.exports = {
  createLobby,
  getLobby,
  getLobbies,
  deleteLobby,
};
