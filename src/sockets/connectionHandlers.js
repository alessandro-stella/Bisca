const {
  getLobbyByPlayer,
  setPlayerConnected,
  removePlayer,
  deleteLobby,
} = require("../game/lobbyManager");

const {
  getGame,
  deleteGame,
  removePlayerFromGame,
} = require("../game/gameManager");

const { broadcastGameState } = require("./gameHandlers");

const RECONNECT_TIMEOUT = 60 * 1000;

function createConnectionHandlers() {
  const deviceReconnectTimers = new Map();

  function clearReconnectTimer(userId, deviceId) {
    const key = `${userId}_${deviceId}`;
    const timer = deviceReconnectTimers.get(key);

    if (!timer) {
      return;
    }

    clearTimeout(timer);
    deviceReconnectTimers.delete(key);
  }

  function isUserOnline(socket, io, lobby) {
    const userId = socket.user?.id;
    const currentDeviceId = socket.deviceId;

    for (const otherSocket of io.sockets.sockets.values()) {
      if (
        otherSocket.user?.id === userId &&
        otherSocket.deviceId !== currentDeviceId &&
        otherSocket.connected
      ) {
        if (lobby.started) {
          if (otherSocket.rooms.has(`lobby:${lobby.id}`)) {
            return true;
          }
        } else {
          return true;
        }
      }
    }

    return false;
  }

  function handleDisconnect(socket, io, broadcastLobbies) {
    const userId = socket.user?.id;
    const deviceId = socket.deviceId;

    const lobby = getLobbyByPlayer(userId);

    if (!lobby) {
      return;
    }

    const activeGame = getGame(lobby.id);

    if (activeGame && activeGame.status === "finished") {
      if (!isUserOnline(socket, io, lobby)) {
        removePlayer(lobby.id, userId);

        if (lobby.players.size === 0) {
          const room = `lobby:${lobby.id}`;
          io.to(room).emit("lobby:deleted");
          io.in(room).socketsLeave(room);
          deleteLobby(lobby.id);
          deleteGame(lobby.id);
        }
      }

      broadcastLobbies(io);
      return;
    }

    if (!isUserOnline(socket, io, lobby)) {
      setPlayerConnected(lobby.id, userId, false);
    }

    broadcastLobbies(io);

    if (activeGame) {
      broadcastGameState(io, lobby.id);
    }

    const key = `${userId}_${deviceId}`;
    const timer = setTimeout(() => {
      const currentLobby = getLobbyByPlayer(userId);

      if (!currentLobby) {
        deviceReconnectTimers.delete(key);
        return;
      }

      let thisDeviceReconnected = false;
      for (const s of io.sockets.sockets.values()) {
        if (s.user?.id === userId && s.deviceId === deviceId && s.connected) {
          thisDeviceReconnected = true;
          break;
        }
      }

      if (thisDeviceReconnected) {
        deviceReconnectTimers.delete(key);
        return;
      }

      if (isUserOnline(socket, io, currentLobby)) {
        deviceReconnectTimers.delete(key);
        return;
      }

      const game = getGame(currentLobby.id);

      if (game) {
        const result = removePlayerFromGame(game, userId);

        if (result.action === "finished") {
          game.turnPhase = "finished";
          broadcastGameState(io, currentLobby.id);

          const winner = game.players.get(result.winnerId);
          io.to(`lobby:${currentLobby.id}`).emit("game:finished", {
            winnerId: result.winnerId,
            winnerUsername: winner?.username,
          });
        } else {
          broadcastGameState(io, currentLobby.id);
        }
      }

      removePlayer(currentLobby.id, userId);
      deviceReconnectTimers.delete(key);

      if (currentLobby.players.size === 0) {
        const room = `lobby:${currentLobby.id}`;
        io.to(room).emit("lobby:deleted");
        io.in(room).socketsLeave(room);
        deleteLobby(currentLobby.id);
        deleteGame(currentLobby.id);
      }

      broadcastLobbies(io);
    }, RECONNECT_TIMEOUT);

    deviceReconnectTimers.set(key, timer);
  }

  function handleReconnect(socket, io, broadcastLobbies) {
    const userId = socket.user?.id;
    const deviceId = socket.deviceId;

    const lobby = getLobbyByPlayer(userId);

    if (!lobby) {
      return;
    }

    clearReconnectTimer(userId, deviceId);
    socket.join(`lobby:${lobby.id}`);

    setPlayerConnected(lobby.id, userId, true);

    if (lobby.started) {
      socket.emit("game:reconnect");
    }

    broadcastLobbies(io);
  }

  return {
    deviceReconnectTimers,
    clearReconnectTimer,
    handleDisconnect,
    handleReconnect,
  };
}

module.exports = createConnectionHandlers;
