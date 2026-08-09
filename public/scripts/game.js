const socket = io();

// socket.on("connect", () => {
//   console.log("Connected to game:", socket.id);
//
//   socket.emit("game:get-state");
// });
//
// socket.on("connect_error", (error) => {
//   console.error("Socket connection error:", error.message);
// });
//
// socket.on("game:not-found", () => {
//   console.log("Game not found");
//
//   window.location.replace("/lobbies.html");
// });
//
// socket.on("game:state", (game) => {
//   console.log("Game state:", game);
//
//   document.getElementById("game-status").textContent =
//     `Partita: ${game.status}`;
//
//   document.getElementById("lobby-id").textContent = `Lobby: ${game.lobbyId}`;
//
//   document.getElementById("remaining-cards").textContent =
//     `Carte rimanenti: ${game.remainingCards}`;
//
//   if (game.currentPlayer) {
//     document.getElementById("current-player").textContent =
//       `Turno: ${game.currentPlayer}`;
//   } else {
//     document.getElementById("current-player").textContent =
//       "Turno: non ancora assegnato";
//   }
// });

function supportsWebP() {
  const canvas = document.createElement("canvas");
  return canvas.toDataURL("image/webp").startsWith("data:image/webp");
}

function createCards() {
  const cardsContainer = document.getElementById("cardsContainer");

  const suits = ["denari", "coppe", "spade", "bastoni"];
  const format = supportsWebP() ? "webp" : "jpg";

  for (const suit of suits) {
    for (let i = 1; i <= 10; i++) {
      const newCard = document.createElement("img");
      newCard.setAttribute("src", `media/${format}/${suit}${i}.${format}`);
      newCard.classList.add("card");
      cardsContainer.appendChild(newCard);
    }
  }
}

createCards();
