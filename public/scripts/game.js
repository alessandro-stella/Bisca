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
  // window.location.replace("/lobbies.html");
  const testGame = {
    turnPhase: "play",
    totalBids: 4,
    showdown: false,
    players: [
      {
        playerId: "ce9c65a7-4318-4c81-b519-7299b5124e22",
        connected: true,
        username: "ale",
        bid: 2,
        lives: 3,
        won: 0,
        position: null,
        isMe: true,
      },
      {
        playerId: "06e688b2-9ce7-4798-a519-261336e1b8d1",
        connected: true,
        username: "test",
        bid: 2,
        lives: 3,
        won: 0,
        position: null,
        isMe: false,
      },
    ],
    playedCards: [
      {
        playerId: "ce9c65a7-4318-4c81-b519-7299b5124e22",
        card: "coppe10",
      },

      {
        playerId: "06e688b2-9ce7-4798-a519-261336e1b8d1",
        card: "spade7",
      },
    ],
    currentPlayer: "test",
    currentPlayerId: "06e688b2-9ce7-4798-a519-261336e1b8d1",
    myUsername: "ale",
    myPlayerId: "ce9c65a7-4318-4c81-b519-7299b5124e22",
    hand: ["coppe9", "denari10"],
    isMyTurn: false,
    lastPlayer: false,
  };

  renderGameState(testGame);
});

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

socket.on("lobby:deleted", () => {
  window.location.replace("/lobbies.html");
});

document.addEventListener("visibilitychange", () => {
  if (!document.hidden && socket.connected) {
    console.log("App tornata in primo piano, richiedo stato");
    socket.emit("game:get-state");
  }
});

// Game UI functions

function renderGameState(game) {
  console.log(game);

  const table = document.getElementById("table");
  table.innerHTML = "";

  createMySeat(table, game.myPlayerId);

  createOpponents(
    table,
    game.players.filter((player) => player.playerId !== game.myPlayerId),
    game.currentPlayerId,
  );

  createPlayedCards(game.playedCards);

  createCards(game.hand, "myCards", false);
}

function createMySeat(table, id) {
  const mySeat = document.createElement("div");
  mySeat.id = id;
  mySeat.classList.add("tableSeat");
  mySeat.style.setProperty("--angle", "-90deg");

  table.appendChild(mySeat);
}

function createOpponents(table, opponents, currentPlayer) {
  const anglePhase = 360 / (opponents.length + 1);
  let currentAngle = -90;

  for (const opponent of opponents) {
    currentAngle += anglePhase;

    const tableSeat = document.createElement("div");
    tableSeat.id = opponent.playerId;
    tableSeat.classList.add("tableSeat", "opponentSeat");
    tableSeat.style.setProperty("--angle", `${currentAngle}deg`);

    const opponentInfo = document.createElement("div");
    opponentInfo.classList.add("opponentInfo");

    if (opponent.playerId === currentPlayer) {
      opponentInfo.classList.add("currentPlayer");
    }

    const avatar = document.createElement("div");
    avatar.classList.add("avatar");
    avatar.innerHTML = '<i class="icon fa-solid fa-user"></i>';

    const username = document.createElement("div");
    username.classList.add("username");
    username.innerHTML = opponent.username;

    const stats = document.createElement("div");
    stats.classList.add("stats");

    const lives = document.createElement("div");
    lives.classList.add("lives");

    const livesIcon = document.createElement("i");
    livesIcon.classList.add("fa-solid", "fa-heart");

    const livesText = document.createElement("p");
    livesText.innerHTML = opponent.lives;

    lives.appendChild(livesIcon);
    lives.appendChild(livesText);

    const bids = document.createElement("div");
    bids.classList.add("bids");

    const bidsIcon = document.createElement("div");
    bidsIcon.classList.add("bidsIcon");

    const bidsText = document.createElement("p");
    bidsText.innerHTML = `${opponent.won} / ${opponent.bid}`;

    bids.appendChild(bidsIcon);
    bids.appendChild(bidsText);

    stats.appendChild(lives);
    stats.appendChild(bids);

    opponentInfo.appendChild(avatar);
    opponentInfo.appendChild(username);

    opponentInfo.appendChild(stats);

    tableSeat.appendChild(opponentInfo);
    table.appendChild(tableSeat);
  }
}

function createPlayedCards(cards) {
  for (const card of cards) {
    const cardElement = createSingleCard(card.card, false);
    cardElement.classList.add("playedCard");

    const playerSeat = document.getElementById(card.playerId);
    playerSeat.appendChild(cardElement);
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

function createSingleCard(card, eventListener = false) {
  const format = supportsWebP() ? "webp" : "jpg";
  const { suit, number } = parseCard(card);

  const cardElement = document.createElement("img");
  cardElement.setAttribute("src", `media/${format}/${suit}${number}.${format}`);
  cardElement.setAttribute("alt", `${number} di ${suit}`);
  cardElement.setAttribute("title", `${number} di ${suit}`);
  cardElement.classList.add("card");

  if (eventListener) {
    if (card !== "denari1") {
      cardElement.addEventListener("click", () => {
        socket.emit("game:play-card", card);
      });
    } else {
      cardElement.addEventListener("click", () => {
        const existingPopup = document.getElementById("acePopup");
        if (existingPopup) existingPopup.remove();

        const popup = document.createElement("div");
        popup.id = "acePopup";

        const title = document.createElement("div");
        title.innerHTML =
          "Scegli se sarà la carta più alta o più bassa della mano:";

        const higher = document.createElement("button");
        higher.innerHTML = "Più alta";
        higher.addEventListener("click", () => {
          socket.emit("game:play-card", "asso-prende");
          popup.remove();
        });

        const lower = document.createElement("button");
        lower.innerHTML = "Più bassa";
        lower.addEventListener("click", () => {
          socket.emit("game:play-card", "asso-lascia");
          popup.remove();
        });

        popup.appendChild(title);
        popup.appendChild(higher);
        popup.appendChild(lower);

        document.body.appendChild(popup);
      });
    }
  }

  return cardElement;
}

function createCards(cards, containerId, eventListener = false) {
  const cardsContainer = document.getElementById(containerId);
  cardsContainer.innerHTML = "";

  for (const card of cards) {
    const cardElement = createSingleCard(card, eventListener);
    cardsContainer.appendChild(cardElement);
  }
}
