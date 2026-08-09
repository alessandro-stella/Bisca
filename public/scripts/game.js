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

  if (game.currentPlayer) {
    document.getElementById("current-player").textContent =
      `Turno: ${game.currentPlayer}`;
  } else {
    document.getElementById("current-player").textContent =
      "Turno: non ancora assegnato";
  }

  createCards(game.hand);
});

function parseCard(card) {
  const match = card.match(/^([a-z]+)(\d+)$/);

  if (!match) {
    throw new Error(`Invalid card: ${card}`);
  }

  const suit = match[1];
  const number = Number(match[2]);

  return { suit, number };
}

function supportsWebP() {
  const canvas = document.createElement("canvas");
  return canvas.toDataURL("image/webp").startsWith("data:image/webp");
}

function createCards(cards) {
  const cardsContainer = document.getElementById("cardsContainer");
  const format = supportsWebP() ? "webp" : "jpg";

  for (const card of cards) {
    const { suit, number } = parseCard(card);

    const newCard = document.createElement("img");
    newCard.setAttribute("src", `media/${format}/${suit}${number}.${format}`);
    newCard.setAttribute("alt", `${number} di ${suit}`);
    newCard.setAttribute("title", `${number} di ${suit}`);
    newCard.classList.add("card");
    cardsContainer.appendChild(newCard);
  }
}
