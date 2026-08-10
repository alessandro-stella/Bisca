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

    setPlayerConnected(lobby.id, userId, false);

    console.log(
      `${socket.user.username} disconnected ` + `from lobby ${lobby.id}`,
    );

    broadcastLobbies(io);

    const activeGame = getGame(lobby.id);

    if (activeGame) {
      console.log("CALL 3");
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

      console.log(
        `${socket.user.username} removed from lobby ` +
          `${currentLobby.id} after 60 seconds`,
      );

      if (currentLobby.players.size === 0) {
        const room = `lobby:${currentLobby.id}`;
        deleteGame(currentLobby.id);

        io.to(room).emit("lobby:deleted");
        io.in(room).socketsLeave(room);

        deleteLobby(currentLobby.id);

        console.log(`Lobby ${currentLobby.id} deleted because it is empty`);
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
      console.log(`${socket.user.username} online, waiting to join...`);
      socket.emit("game:reconnect");
      broadcastLobbies(io);
    } else {
      setPlayerConnected(lobby.id, userId, true);
      console.log(`${socket.user.username} reconnected to lobby ${lobby.id}`);
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
