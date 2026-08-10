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

  if (game.turnPhase === "finished") {
    console.log("Finished!");
    return;
  }

  document.getElementById("gameStatus").textContent = game.showdown
    ? `Stato corrente: ${game.turnPhase} (showdown - guarda le carte degli avversari)`
    : `Stato corrente: ${game.turnPhase}`;

  document.getElementById("myUsername").textContent = `Tu: ${game.myUsername}`;

  document.getElementById("currentPlayer").textContent = game.isMyTurn
    ? `Current player: ${game.currentPlayer} (tu)`
    : `Current player: ${game.currentPlayer}`;

  createLivesCounter(game);

  createCards(game.hand, "myCardsContainer", !game.showdown);
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

socket.on("game:finished", ({ winnerId }) => {
  console.log("Partita terminata. Vincitore:", winnerId);
});

function createLivesCounter(game) {
  const container = document.getElementById("livesContainer");
  container.innerHTML = "";

  for (const player of game.players) {
    const row = document.createElement("div");
    row.classList.add("livesRow");

    const isMe = player.username === game.myUsername;

    if (isMe) {
      row.classList.add("own-player");
    }

    row.textContent = isMe
      ? `${player.username} (tu): ${player.lives} vite`
      : `${player.username}: ${player.lives} vite`;

    container.appendChild(row);
  }
}

function createBidButtons(game, container) {
  container.innerHTML = "";

  if (game.showdown) {
    createShowdownButtons(container);
    return;
  }

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

function createShowdownButtons(container) {
  const options = [
    { label: "Vincerò", bid: 1 },
    { label: "Perderò", bid: 0 },
  ];

  for (const { label, bid } of options) {
    const bidButton = document.createElement("button");

    bidButton.innerHTML = label;
    bidButton.classList.add("bidButton");

    bidButton.addEventListener("click", () => {
      socket.emit("game:place-bid", bid);
      document.getElementById("bidButtonsContainer").innerHTML = "";
    });

    container.appendChild(bidButton);
  }
}

function parseCard(card) {
  if (card === "asso-prende" || card === "asso-lascia")
    return { suit: "denari", number: "1" };

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

    if (eventListener) {
      if (card !== "denari1") {
        newCard.addEventListener("click", () => {
          socket.emit("game:play-card", card);
        });
      } else {
        newCard.addEventListener("click", () => {
          const popup = document.createElement("div");
          popup.id = "acePopup";

          const title = document.createElement("div");
          title.innerHTML =
            "Scegli se sarà la carta più alta o più bassa della mano:";

          const higher = document.createElement("button");
          higher.innerHTML = "Più alta";

          higher.addEventListener("click", () => {
            socket.emit("game:play-card", "asso-prende");
            document.getElementById("acePopup").remove();
          });

          const lower = document.createElement("button");
          lower.innerHTML = "Più bassa";

          lower.addEventListener("click", () => {
            socket.emit("game:play-card", "asso-lascia");
            document.getElementById("acePopup").remove();
          });

          popup.appendChild(higher);
          popup.appendChild(lower);

          document.body.appendChild(popup);
        });
      }
    }

    cardsContainer.appendChild(newCard);
  }
}
