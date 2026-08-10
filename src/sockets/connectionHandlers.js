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

      if (currentLobby.ownerId === userId) {
        const room = `lobby:${currentLobby.id}`;

        deleteGame(currentLobby.id);

        io.to(room).emit("lobby:deleted");
        io.in(room).socketsLeave(room);

        deleteLobby(currentLobby.id);

        console.log(
          `Lobby deleted because owner ` +
            `${socket.user.username} did not reconnect ` +
            `within 60 seconds: ${currentLobby.id}`,
        );

        reconnectTimers.delete(userId);

        broadcastLobbies(io);

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

    setPlayerConnected(lobby.id, userId, true);

    clearReconnectTimer(userId);

    socket.join(`lobby:${lobby.id}`);

    console.log(`${socket.user.username} reconnected to lobby ${lobby.id}`);

    broadcastLobbies(io);

    if (lobby.started) {
      socket.emit("game:reconnect");
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
