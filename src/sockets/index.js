const authenticateSocket = require("./auth");

function setupSockets(io) {
  io.use(authenticateSocket);

  io.on("connection", (socket) => {
    console.log("Socket connected:", socket.id);
    console.log("Authenticated user:", socket.user);

    socket.on("disconnect", () => {
      console.log("Socket disconnected:", socket.id);
    });
  });
}

module.exports = setupSockets;
