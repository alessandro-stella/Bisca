const {
  getLobbyByPlayer,
  setPlayerConnected,
  isPlayerConnected,
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
  const reconnectTimers = new Map();

  function clearReconnectTimer(userId) {
    const timer = reconnectTimers.get(userId);

    if (!timer) {
      return;
    }

    clearTimeout(timer);
    reconnectTimers.delete(userId);
  }

  function handleDisconnect(socket, io, broadcastLobbies) {
    const userId = socket.user.id;

    const lobby = getLobbyByPlayer(userId);

    if (!lobby) {
      return;
    }

    const activeGame = getGame(lobby.id);

    if (activeGame && activeGame.status === "finished") {
      removePlayer(lobby.id, userId);

      if (lobby.players.size === 0) {
        const room = `lobby:${lobby.id}`;

        io.to(room).emit("lobby:deleted");
        io.in(room).socketsLeave(room);

        deleteLobby(lobby.id);
        deleteGame(lobby.id);
      }

      broadcastLobbies(io);
      return;
    }

    setPlayerConnected(lobby.id, userId, false);

    broadcastLobbies(io);

    if (activeGame) {
      broadcastGameState(io, lobby.id);
    }

    const timer = setTimeout(() => {
      const currentLobby = getLobbyByPlayer(userId);

      if (!currentLobby) {
        reconnectTimers.delete(userId);
        return;
      }

      if (isPlayerConnected(currentLobby.id, userId)) {
        reconnectTimers.delete(userId);
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
      reconnectTimers.delete(userId);

      if (currentLobby.players.size === 0) {
        const room = `lobby:${currentLobby.id}`;

        io.to(room).emit("lobby:deleted");
        io.in(room).socketsLeave(room);

        deleteLobby(currentLobby.id);
        deleteGame(currentLobby.id);
      }

      broadcastLobbies(io);
    }, RECONNECT_TIMEOUT);

    reconnectTimers.set(userId, timer);
  }

  function handleReconnect(socket, io, broadcastLobbies) {
    const userId = socket.user.id;
    const lobby = getLobbyByPlayer(userId);

    if (!lobby) {
      return;
    }

    clearReconnectTimer(userId);
    socket.join(`lobby:${lobby.id}`);

    if (lobby.started) {
      setPlayerConnected(lobby.id, userId, true);
      socket.emit("game:reconnect");
      broadcastLobbies(io);
    } else {
      setPlayerConnected(lobby.id, userId, true);
      broadcastLobbies(io);
    }
  }

  return {
    reconnectTimers,
    clearReconnectTimer,
    handleDisconnect,
    handleReconnect,
  };
}

module.exports = createConnectionHandlers;
