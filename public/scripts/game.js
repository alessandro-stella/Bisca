const socket = io();

socket.on("connect", () => {
  console.log("Connected to game:", socket.id);

  socket.emit("game:get-state");
});

socket.on("connect_error", (error) => {
  console.error("Socket connection error:", error.message);
});

socket.on("game:not-found", () => {
  console.log("Game not found");

  window.location.replace("/lobbies.html");
});

socket.on("game:state", (game) => {
  console.log("Game state:", game);

  document.getElementById("game-status").textContent =
    `Partita: ${game.status}`;

  document.getElementById("lobby-id").textContent = `Lobby: ${game.lobbyId}`;

  document.getElementById("remaining-cards").textContent =
    `Carte rimanenti: ${game.remainingCards}`;

  if (game.currentPlayer) {
    document.getElementById("current-player").textContent =
      `Turno: ${game.currentPlayer}`;
  } else {
    document.getElementById("current-player").textContent =
      "Turno: non ancora assegnato";
  }
});
