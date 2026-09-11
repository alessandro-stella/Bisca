function getOrCreateDeviceId() {
  let id = localStorage.getItem("bisca_device_id");
  if (!id) {
    id =
      (typeof crypto !== "undefined" &&
        crypto.randomUUID &&
        crypto.randomUUID()) ||
      "dev_" + Math.random().toString(36).substring(2, 11);
    localStorage.setItem("bisca_device_id", id);
  }
  return id;
}

const socket = io({
  auth: {
    deviceId: getOrCreateDeviceId(),
  },
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 10000,
  reconnectionAttempts: Infinity,
  transports: ["websocket", "polling"],
});

window.addEventListener("beforeunload", () => {
  if (socket) {
    socket.disconnect();
  }
});

let heartbeatInterval;

function startHeartbeat() {
  stopHeartbeat();
  heartbeatInterval = setInterval(() => {
    if (socket.connected) {
      socket.emit("ping");
    }
  }, 20000);
}

function stopHeartbeat() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
}

socket.on("connect", () => {
  console.log("Connected to game:", socket.id);
  socket.emit("game:get-state");
  startHeartbeat();
});

socket.on("connect_error", (error) => {
  console.error("Socket connection error:", error.message);
  const statusEl = document.getElementById("gameStatus");
  if (statusEl) {
    statusEl.textContent = "Errore di connessione... Riprovo...";
  }
});

socket.on("disconnect", (reason) => {
  console.log("Disconnected from game:", reason);
  stopHeartbeat();

  const statusEl = document.getElementById("gameStatus");
  if (statusEl) {
    statusEl.textContent = "Connessione persa... Riconnessione in corso...";
  }

  if (reason === "io server disconnect") {
    socket.connect();
  }
});

socket.on("pong", () => {
  console.log("Heartbeat received");
});

socket.on("game:reconnect", () => {
  console.log("Game reconnect signal received");
  socket.emit("game:get-state");
});

socket.on("game:not-found", () => {
  console.log("Game not found");
  window.location.replace("/lobbies.html");
});

function renderGameState(game) {
  if (game.turnPhase === "finished") {
    document.getElementById("gameStatus").textContent =
      "La partita è conclusa!";
    return;
  }

  document.getElementById("cardsTitle").textContent = game.showdown
    ? "Carte degli avversari"
    : "Le mie carte";

  document.getElementById("gameStatus").textContent = game.showdown
    ? `Stato corrente: ${game.turnPhase} (showdown - guarda le carte degli avversari)`
    : `Stato corrente: ${game.turnPhase}`;

  document.getElementById("myUsername").textContent = `Tu: ${game.myUsername}`;

  document.getElementById("currentPlayer").textContent = game.isMyTurn
    ? `Current player: ${game.currentPlayer} (tu)`
    : `Current player: ${game.currentPlayer}`;

  createPlayerInfo(game);

  createCards(game.hand, "myCardsContainer", !game.showdown);
  createCards(
    game.playedCards.map((cardValues) => cardValues.card),
    "playedCardsContainer",
  );

  const bidButtonsContainer = document.getElementById("bidButtonsContainer");

  if (game.turnPhase === "bidding" && game.isMyTurn) {
    createBidButtons(game, bidButtonsContainer);
  }
}

socket.on("game:state", (game) => {
  console.log("Game state:", game);
  renderGameState(game);
});

socket.on("game:state:sync", (game) => {
  console.log("Game state sync from another device:", game);
  renderGameState(game);
});

function handleGameFinishedUI(winnerUsername) {
  document.getElementById("gameStatus").textContent =
    `Partita terminata! Il vincitore è ${winnerUsername}!`;

  document.getElementById("bidButtonsContainer").innerHTML = "";
  document.getElementById("myCardsContainer").innerHTML = "";
  document.getElementById("livesContainer").innerHTML = "";
}

socket.on("game:finished", ({ winnerId, winnerUsername }) => {
  console.log("Partita terminata. Vincitore:", winnerId);
  handleGameFinishedUI(winnerUsername);
});

socket.on("game:finished:sync", ({ winnerId, winnerUsername }) => {
  console.log("Game finished sync from another device:", winnerId);
  handleGameFinishedUI(winnerUsername);
});

socket.on("lobbies:update:sync", (data) => {
  console.log("Lobby action from another device:", data);
  socket.emit("game:get-state");
});

document.addEventListener("visibilitychange", () => {
  if (!document.hidden && socket.connected) {
    console.log("App tornata in primo piano, richiedo stato");
    socket.emit("game:get-state");
  }
});

function createPlayerInfo(game) {
  const container = document.getElementById("livesContainer");
  container.innerHTML = "";

  for (const player of game.players) {
    const row = document.createElement("div");
    row.classList.add("playerInfo");

    const isMe = player.username === game.myUsername;

    if (isMe) {
      row.classList.add("myInfo");
    }

    let text = `${isMe ? "* " : ""}${player.username}: ${player.lives} vite`;

    if (player.bid === -1) {
      if (isMe) {
        text +=
          game.currentPlayer === player.username
            ? " - Scegli quanto scommettere"
            : " - Attendi il tuo turno";
      } else {
        text +=
          game.currentPlayer === player.username
            ? " - Sta decidendo quanto scommettere"
            : " - Attende il suo turno";
      }
    } else {
      text += ` - ${isMe ? "hai scommesso" : "scommette"} ${player.bid} prese`;
    }

    if (game.turnPhase === "play") {
      text += ` - vinte ${player.won} mani finora`;
    }

    if (!player.connected) {
      if (player.lives > 0) {
        text += " [Disconnesso in attesa...]";
      } else {
        text += " [Disconnesso]";
      }
      row.style.opacity = "0.5";
      row.style.fontStyle = "italic";
    }

    row.textContent = text;
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

socket.on("lobby:deleted", () => {
  window.location.replace("/lobbies.html");
});
