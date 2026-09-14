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

socket.on("game:state", (game) => {
  console.log("Game state:", game);

  renderGameState(game);
});

socket.on("game:state:sync", (game) => {
  console.log("Game state sync from another device:", game);

  renderGameState(game);
});

function handleGameFinishedUI(isWinner, position) {
  closePopup();

  const esito = isWinner ? "hai vinto!" : "hai perso.";
  const posText = position ? ` (${position}° posto)` : "";
  const testo = `Partita terminata, ${esito}${posText}`;

  const statusEl =
    document.getElementById("gameStatus") ||
    document.querySelector(".statusBar") ||
    document.querySelector("footer p") ||
    document.querySelector(".statusText");

  if (statusEl) {
    statusEl.textContent = testo;
  }
}

socket.on("game:finished", ({ isWinner, position }) => {
  handleGameFinishedUI(isWinner, position);
});

socket.on("game:finished:sync", ({ isWinner, position }) => {
  handleGameFinishedUI(isWinner, position);
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

const loader = document.getElementById("loadingCover");
const backdrop = document.getElementById("backdrop");
const bidsContainer = document.getElementById("bidsContainer");

function openPopup() {
  if (backdrop) {
    backdrop.classList.remove("hidden");
  }
}

function closePopup() {
  if (backdrop) {
    backdrop.classList.add("hidden");
  }
}

function renderGameState(game) {
  if (game.turnPhase === "finished") {
    console.log("Partita terminata");
    return;
  }

  console.log(game);

  const table = document.getElementById("table");
  table.innerHTML = "";

  createMySeat(
    table,
    game.players.find((player) => player.playerId === game.myPlayerId),
    game.currentPlayerId,
  );

  createOpponents(
    table,
    game.turnPhase,
    game.players.filter((player) => player.playerId !== game.myPlayerId),
    game.currentPlayerId,
  );

  createPlayedCards(game.playedCards, game.highestPlay);

  const canPlay = game.turnPhase === "play" && game.isMyTurn && !game.showdown;
  createCards(game.hand, "myCards", canPlay);

  if (game.turnPhase === "bidding" && game.isMyTurn) {
    createBidButtons(game);
    openPopup();
  } else {
    closePopup();
  }

  if (loader) {
    loader.classList.add("hidden");
  }
}

function createMySeat(table, myData, currentPlayerId) {
  const mySeat = document.createElement("div");
  mySeat.id = myData.playerId;
  mySeat.classList.add("tableSeat");
  mySeat.style.setProperty("--angle", "-90deg");

  table.appendChild(mySeat);

  const usernameDiv = document.getElementById("myUsername");
  const livesDiv = document
    .getElementById("myLives")
    .getElementsByClassName("value")[0];
  const bidsDiv = document
    .getElementById("myBids")
    .getElementsByClassName("value")[0];

  usernameDiv.innerHTML = myData.username;
  livesDiv.innerHTML = myData.lives;
  bidsDiv.innerHTML = `${myData.won}/${myData.bid}`;

  const cards = document.getElementById("myCards");

  if (myData.playerId === currentPlayerId) {
    cards.classList.add("currentPlayer");
  } else {
    cards.classList.remove("currentPlayer");
  }
}

function createOpponents(table, turnPhase, opponents, currentPlayerId) {
  const anglePhase = 360 / (opponents.length + 1);
  let currentAngle = -90;

  for (const opponent of opponents) {
    const isCurrentPlayer = opponent.playerId === currentPlayerId;
    currentAngle += anglePhase;

    const tableSeat = document.createElement("div");
    tableSeat.id = opponent.playerId;
    tableSeat.classList.add("tableSeat", "opponentSeat");
    tableSeat.style.setProperty("--angle", `${currentAngle}deg`);

    const opponentInfo = document.createElement("div");
    opponentInfo.classList.add("opponentInfo");

    if (isCurrentPlayer) {
      opponentInfo.classList.add("currentPlayer");
    }

    const username = document.createElement("div");
    username.classList.add("username");
    username.innerHTML = opponent.username;

    const stats = document.createElement("div");
    stats.classList.add("stats");

    if (!opponent.connected) {
      console.log("Adding disconnected to ", opponent.username);
      opponentInfo.classList.add("disconnected");
    }

    if (opponent.position !== null) {
      stats.innerHTML = `Posto: ${opponent.position}°`;
    } else {
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

      if (turnPhase === "bidding") {
        if (isCurrentPlayer) {
          bidsText.innerHTML = '<i class="fa-solid fa-spinner"></i>';
        } else {
          bidsText.innerHTML = opponent.bid === -1 ? "In attesa" : opponent.bid;
        }
      } else {
        bidsText.innerHTML = `${opponent.won} / ${opponent.bid}`;
      }

      bids.appendChild(bidsIcon);
      bids.appendChild(bidsText);

      stats.appendChild(lives);
      stats.appendChild(bids);
    }

    opponentInfo.appendChild(username);
    opponentInfo.appendChild(stats);

    tableSeat.appendChild(opponentInfo);
    table.appendChild(tableSeat);
  }
}

function createPlayedCards(cards, highestPlay) {
  if (!Array.isArray(cards)) return;

  for (const card of cards) {
    if (!card || !card.card) continue;

    const cardElement = createSingleCard(card.card, false);
    cardElement.classList.add("playedCard");

    const playerSeat = document.getElementById(card.playerId);
    if (playerSeat) {
      playerSeat.appendChild(cardElement);

      if (highestPlay && card.playerId === highestPlay.playerId) {
        playerSeat.classList.add("highestPlay");
      }
    }
  }
}

function createBidButtons(game) {
  bidsContainer.innerHTML = "";

  if (game.showdown) {
    createShowdownButtons(bidsContainer);
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

    bidButton.innerHTML = `<p>${bid}</p>`;
    bidButton.classList.add("bidButton", "primaryButton");

    bidButton.addEventListener("click", () => {
      socket.emit("game:place-bid", bid);
      closePopup();
    });

    bidsContainer.appendChild(bidButton);
  }
}

function createShowdownButtons(container) {
  const options = [
    { label: "Vincerò", bid: 1 },
    { label: "Perderò", bid: 0 },
  ];

  for (const { label, bid } of options) {
    const bidButton = document.createElement("button");

    bidButton.innerHTML = `<p>${label}</p>`;
    bidButton.classList.add("bidButton", "primaryButton");

    bidButton.addEventListener("click", () => {
      socket.emit("game:place-bid", bid);
      closePopup();
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
