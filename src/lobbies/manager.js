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
  return Array.from(lobbies.values()).map((lobby) => ({
    id: lobby.id,
    ownerId: lobby.ownerId,
    ownerUsername: lobby.ownerUsername,
    players: lobby.players.size,
  }));
}

function deleteLobby(lobbyId) {
  return lobbies.delete(lobbyId);
}

function addPlayer(lobbyId, userId) {
  const lobby = lobbies.get(lobbyId);

  if (!lobby) {
    return false;
  }

  const currentLobby = getLobbyByPlayer(userId);

  if (currentLobby) {
    return false;
  }

  lobby.players.add(userId);

  return true;
}

function removePlayer(lobbyId, userId) {
  const lobby = lobbies.get(lobbyId);

  if (!lobby) {
    return false;
  }

  lobby.players.delete(userId);

  return true;
}

function getLobbyByPlayer(userId) {
  for (const lobby of lobbies.values()) {
    if (lobby.players.has(userId)) {
      return lobby;
    }
  }

  return null;
}

module.exports = {
  createLobby,
  getLobby,
  getLobbies,
  deleteLobby,
  addPlayer,
  removePlayer,
  getLobbyByPlayer,
};
