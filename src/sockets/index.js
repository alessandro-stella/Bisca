const { v4: uuidv4 } = require("uuid");
const authenticateSocket = require("./auth");

const { createLobby, getLobbies } = require("../lobbies/manager");

function setupSockets(io) {
  io.use(authenticateSocket);

  io.on("connection", (socket) => {
    console.log("Socket connected:", socket.id);
    console.log("Authenticated user:", socket.user);

    socket.on("lobby:create", () => {
      const lobby = {
        id: uuidv4(),
        ownerId: socket.user.id,
        ownerUsername: socket.user.username,
        players: 1,
      };

      createLobby(lobby);

      console.log("Lobby created:", lobby);

      io.emit("lobbies:update", getLobbies());
    });

    socket.on("disconnect", () => {
      console.log("Socket disconnected:", socket.id);
    });
  });
}

module.exports = setupSockets;
