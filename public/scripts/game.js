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

const chatButton = document.getElementById("openChat");
chatButton.addEventListener("click", () => alert("Coming soon! (Spero)"));

const loader = document.getElementById("loadingCover");

function resetBottomActions() {
  const bidsWrapper = document.getElementById("bidsContainer");
  if (bidsWrapper) {
    bidsWrapper.remove();
  }

  const bottomButton = document.getElementById("bottomButton");
  if (bottomButton) {
    bottomButton.removeAttribute("hidden");
  }
}

function renderGameState(game) {
  if (game.turnPhase === "finished") {
    showScoreboard([game.me, ...game.opponents]);
    return;
  }

  const table = document.getElementById("table");
  table.innerHTML = "";

  createMySeat(
    table,
    game.me,
    game.currentPlayerId,
    game.turnPhase,
    game.showdown,
  );

  createOpponents(
    table,
    game.turnPhase,
    game.opponents || [],
    game.currentPlayerId,
    game.showdown,
  );

  createPlayedCards(game.playedCards, game.highestPlay);

  const canPlay = game.turnPhase === "play" && game.isMyTurn && !game.showdown;
  createCards(game.hand, "myCards", canPlay, game.turnPhase, game.showdown);

  if (game.turnPhase === "bidding" && game.isMyTurn) {
    createBidButtons(game);
  } else {
    resetBottomActions();
  }

  if (loader) {
    loader.classList.add("hidden");
  }
}

function createMySeat(
  table,
  myData,
  currentPlayerId,
  turnPhase,
  isShowdown = false,
) {
  if (!myData) return;

  const mySeat = document.createElement("div");
  mySeat.id = myData.playerId;
  mySeat.classList.add("tableSeat");
  mySeat.style.setProperty("--angle", "-90deg");

  table.appendChild(mySeat);

  const usernameDiv = document.getElementById("myUsername");
  const livesDiv = document
    .getElementById("myLives")
    .getElementsByClassName("value")[0];
  const myBidsContainer = document.getElementById("myBids");
  const bidsDiv = myBidsContainer.getElementsByClassName("value")[0];
  const bottomButton = document.getElementById("bottomButton");

  livesDiv.innerHTML = myData.lives;

  const isMyTurn = myData.playerId === currentPlayerId;
  const hasBid =
    myData.bid !== -1 && myData.bid !== null && myData.bid !== undefined;

  if (isShowdown) {
    myBidsContainer.style.display = "none";

    if (turnPhase === "bidding" && !hasBid) {
      usernameDiv.innerHTML = "Showdown";
      if (!isMyTurn && bottomButton) {
        bottomButton.removeAttribute("hidden");
        bottomButton.textContent = "Attendi il tuo turno";
        bottomButton.disabled = true;
      }
    } else {
      usernameDiv.innerHTML = myData.username;
      if (bottomButton) {
        bottomButton.removeAttribute("hidden");
        bottomButton.textContent = "Attendi il tuo turno";
        bottomButton.disabled = true;
      }
    }
  } else if (turnPhase === "bidding" && !hasBid) {
    usernameDiv.innerHTML = "Quanto scommetti?";
    myBidsContainer.style.display = "none";

    if (!isMyTurn && bottomButton) {
      bottomButton.removeAttribute("hidden");
      bottomButton.textContent = "Attendi il tuo turno";
      bottomButton.disabled = true;
    }
  } else {
    usernameDiv.innerHTML = myData.username;
    myBidsContainer.style.display = "";
    bidsDiv.innerHTML = `${myData.won}/${myData.bid}`;

    if (bottomButton) {
      bottomButton.removeAttribute("hidden");
      bottomButton.textContent = "Attendi il tuo turno";
      bottomButton.disabled = true;
    }
  }

  const cards = document.getElementById("myCards");
  if (isMyTurn) {
    cards.classList.add("currentPlayer");
  } else {
    cards.classList.remove("currentPlayer");
  }
}

function createOpponents(
  table,
  turnPhase,
  opponents,
  currentPlayerId,
  isShowdown = false,
) {
  const anglePhase = 360 / (opponents.length + 1);
  let currentAngle = -90;

  for (const opponent of opponents) {
    const isCurrentPlayer = opponent.playerId === currentPlayerId;
    currentAngle -= anglePhase;

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

    if (opponent.placement !== null) {
      stats.innerHTML = `Posto: ${opponent.placement}°`;
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

      if (isShowdown) {
        if (turnPhase === "bidding" && isCurrentPlayer) {
          bidsText.innerHTML = '<i class="fa-solid fa-spinner"></i>';
        } else if (opponent.bid === 1) {
          bidsText.textContent = "Vince";
        } else if (opponent.bid === 0) {
          bidsText.textContent = "Perde";
        } else {
          bidsText.textContent = "In attesa";
        }
      } else if (turnPhase === "bidding") {
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
  const bottomContainer = document.getElementById("bottom");
  const bottomButton = document.getElementById("bottomButton");

  if (!bottomContainer) return;

  if (bottomButton) {
    bottomButton.setAttribute("hidden", "true");
  }

  let bidsWrapper = document.getElementById("bidsContainer");
  if (!bidsWrapper) {
    bidsWrapper = document.createElement("div");
    bidsWrapper.id = "bidsContainer";
    bottomContainer.appendChild(bidsWrapper);
  }
  bidsWrapper.innerHTML = "";

  if (game.showdown) {
    createShowdownButtons(bidsWrapper);
    return;
  }

  const possibleBids = Array.from({ length: game.hand.length + 1 }).map(
    (_, i) => i,
  );

  const deniedBid = game.lastPlayer ? game.hand.length - game.totalBids : null;

  for (const bid of possibleBids) {
    const bidButton = document.createElement("button");
    bidButton.innerHTML = `<p>${bid}</p>`;
    bidButton.classList.add("bidButton");

    const isDenied = game.lastPlayer && bid === deniedBid;

    if (isDenied) {
      bidButton.classList.add("secondaryButton", "disabled");
      bidButton.disabled = true;
    } else {
      bidButton.classList.add("primaryButton");
      bidButton.addEventListener("click", () => {
        socket.emit("game:place-bid", bid);
        resetBottomActions();
      });
    }

    bidsWrapper.appendChild(bidButton);
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
      resetBottomActions();
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

function createCards(
  cards,
  containerId,
  eventListener = false,
  turnPhase,
  isShowdown = false,
) {
  const cardsContainer = document.getElementById(containerId);
  cardsContainer.innerHTML = "";

  if (isShowdown && turnPhase !== "resolving") {
    const format = supportsWebP() ? "webp" : "jpg";

    const backCard = document.createElement("img");
    backCard.setAttribute("src", `media/${format}/retro.${format}`);
    backCard.setAttribute("alt", `retro`);
    backCard.setAttribute("title", `Carta misteriosa`);
    backCard.classList.add("card");

    cardsContainer.appendChild(backCard);

    return;
  }

  for (const card of cards) {
    const cardElement = createSingleCard(card, eventListener);
    cardsContainer.appendChild(cardElement);
  }
}

function showScoreboard(players) {
  const placements = players
    .map((player) => ({
      username: player.username,
      placement: player.placement,
    }))
    .sort((a, b) => a.placement - b.placement);

  const scoreboardContainer = document.getElementById("scoreboard");

  for (const player of placements) {
    const row = document.createElement("div");
    row.classList.add("row");

    const placementContainer = document.createElement("div");
    placementContainer.classList.add("placement");
    placementContainer.innerHTML = `${player.placement}°`;

    const playerContainer = document.createElement("div");
    playerContainer.classList.add("player");
    playerContainer.innerHTML = player.username;

    row.appendChild(placementContainer);
    row.appendChild(playerContainer);

    scoreboardContainer.appendChild(row);
  }

  const endGameBackdrop = document.getElementById("endGameBackdrop");
  const titleElement = document.querySelector("#endGamePopup .title");

  endGameBackdrop.hidden = false;
  titleElement.innerHTML =
    players[0].placement === 1 ? "Hai vinto!" : "Partita terminata";
}
