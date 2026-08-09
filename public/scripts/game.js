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

  document.getElementById("gameStatus").textContent =
    `Stato corrente: ${game.turnPhase}`;

  document.getElementById("currentPlayer").textContent =
    `Current player: ${game.currentPlayer}`;

  createCards(game.hand, "myCardsContainer", true);
  createCards(
    game.playedCards.map((cardValues) => cardValues.card),
    "playedCardsContainer",
  );

  const bidButtonsContainer = document.getElementById("bidButtonsContainer");

  if (game.turnPhase == "bidding" && game.isMyTurn) {
    createBidButtons(game, bidButtonsContainer);
  }

  if (!game.isMyTurn) {
    return;
  }
});

function createBidButtons(game, container) {
  let possibleBids = Array.from({ length: game.hand.length + 1 }).map(
    (_, i) => i,
  );

  if (game.lastPlayer) {
    const deniedBid = game.hand.length - game.totalBids;
    possibleBids.splice(deniedBid, 1);
  }

  for (const bid of possibleBids) {
    const bidButton = document.createElement("button");

    bidButton.innerHTML = `${bid}`;
    bidButton.classList.add("bidButton");

    bidButton.addEventListener("click", () => {
      socket.emit("game:place-bid", bid);
      document.getElementById("bidButtonsContainer").innerHTML = "";
    });

    container.appendChild(bidButton);
  }
}

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

function createCards(cards, containerId, eventListener = false) {
  console.log({ cards });
  const cardsContainer = document.getElementById(containerId);
  cardsContainer.innerHTML = "";
  const format = supportsWebP() ? "webp" : "jpg";

  for (const card of cards) {
    const { suit, number } = parseCard(card);

    const newCard = document.createElement("img");
    newCard.setAttribute("src", `media/${format}/${suit}${number}.${format}`);
    newCard.setAttribute("alt", `${number} di ${suit}`);
    newCard.setAttribute("title", `${number} di ${suit}`);
    newCard.classList.add("card");

    if (eventListener)
      newCard.addEventListener("click", () => {
        socket.emit("game:play-card", card);
      });

    cardsContainer.appendChild(newCard);
  }
}
