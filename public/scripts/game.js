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
  socket?.disconnect();
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
  document.getElementById("gameStatus").textContent =
    "Errore di connessione... Riprovo...";
});

socket.on("disconnect", (reason) => {
  console.log("Disconnected from game:", reason);
  stopHeartbeat();
  document.getElementById("gameStatus").textContent =
    "Connessione persa... Riconnessione in corso...";

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

  const testGameBid = {
    turnPhase: "bidding",
    totalBids: 0,
    showdown: false,
    me: {
      playerId: "ce9c65a7-4318-4c81-b519-7299b5124e22",
      connected: true,
      username: "ale",
      bid: -1,
      lives: 2,
      won: 0,
      placement: null,
    },
    opponents: [
      {
        playerId: "06e688b2-9ce7-4798-a519-261336e1b8d1",
        connected: true,
        username: "test",
        bid: -1,
        lives: 3,
        won: 0,
        placement: null,
      },
      {
        playerId: "06e688b2-9ce7-4798-a519-261336e1b8d1",
        connected: true,
        username: "testasudhasiudhaiudhasiudhasiudasiuh",
        bid: -1,
        lives: 3,
        won: 0,
        placement: null,
      },
      {
        playerId: "06e688b2-9ce7-4798-a519-261336e1b8d1",
        connected: true,
        username: "test",
        bid: -1,
        lives: 3,
        won: 0,
        placement: null,
      },
      {
        playerId: "06e688b2-9ce7-4798-a519-261336e1b8d1",
        connected: true,
        username: "test",
        bid: -1,
        lives: 3,
        won: 0,
        placement: null,
      },
      {
        playerId: "06e688b2-9ce7-4798-a519-261336e1b8d1",
        connected: true,
        username: "test",
        bid: -1,
        lives: 3,
        won: 0,
        placement: null,
      },
    ],
    playedCards: [],
    currentPlayerId: "ce9c65a7-4318-4c81-b519-7299b5124e22",
    hand: ["spade4", "bastoni5"],
    isMyTurn: true,
    lastPlayer: false,
    highestPlay: null,
  };

  const testGamePlay = {
    turnPhase: "play",
    totalBids: 3,
    showdown: false,
    me: {
      playerId: "caaae1b4-58fc-49be-9bb3-59e0f778d39d",
      connected: true,
      username: "Sup3r_",
      bid: 1,
      lives: 2,
      won: 0,
      placement: null,
    },
    opponents: [
      {
        playerId: "6af2957e-d66a-4b98-a8ce-78b61ddb8ba0",
        connected: true,
        username: "Nuthe",
        bid: 2,
        lives: 2,
        won: 0,
        placement: null,
      },
    ],
    playedCards: [
      {
        playerId: "caaae1b4-58fc-49be-9bb3-59e0f778d39d",
        card: "denari4",
      },
    ],
    currentPlayerId: "6af2957e-d66a-4b98-a8ce-78b61ddb8ba0",
    hand: ["coppe7"],
    isMyTurn: false,
    lastPlayer: false,
    highestPlay: {
      playerId: "caaae1b4-58fc-49be-9bb3-59e0f778d39d",
      card: "denari4",
      value: 404,
    },
  };

  // renderGameState(testGameBid);
  renderGameState(testGamePlay);
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

const sendMessageButton = document.getElementById("sendMessage");
const messageContentInput =
  /** @type {HTMLInputElement} */
  (document.getElementById("messageContent"));
const chatButton = document.getElementById("openChat");
const expandChatButton = document.getElementById("expandChat");

function sendChatMessage() {
  const text = messageContentInput.value.trim();
  if (!text) return;

  socket.emit("game:chat-message", text);

  messageContentInput.value = "";
}

sendMessageButton.addEventListener("click", sendChatMessage);

messageContentInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    sendChatMessage();
  }
});

const messagesContainer = document.getElementById("oldMessages");

socket.on("game:chat-message", (data) => {
  const newMessage = document.createElement("div");

  newMessage.classList.add("message");
  newMessage.innerHTML = `<strong>${data.senderUsername}</strong>: ${data.text}`;

  if (data.isMe) {
    newMessage.classList.add("isMe");
  }

  messagesContainer.prepend(newMessage);

  chatButton.classList.add("newMessage");
});

const chatContainer = document.getElementById("chatContainer");

chatButton.addEventListener("click", () => {
  chatContainer.classList.toggle("open");
  chatButton.classList.remove("newMessage");
});

expandChatButton.addEventListener("click", () => {
  chatContainer.classList.toggle("open");
  chatButton.classList.remove("newMessage");
});

const loader = document.getElementById("loadingCover");

function clearBottomCustomActions() {
  document.getElementById("bidsContainer")?.remove();
  document.getElementById("acePlayActions")?.remove();
}

function resetBottomActions() {
  clearBottomCustomActions();
  const bottomButton = /** @type {HTMLButtonElement} */ (
    document.getElementById("bottomButton")
  );
  bottomButton.hidden = false;
}

let selectedCardData = null;

function resetBottomButton() {
  selectedCardData = null;

  document.querySelectorAll(".card.selected").forEach((el) => {
    el.classList.remove("selected");
  });

  clearBottomCustomActions();

  const btn = /** @type {HTMLButtonElement} */ (
    document.getElementById("bottomButton")
  );
  btn.hidden = false;
  btn.disabled = true;
  btn.className = "secondaryButton disabled";

  const label = btn.querySelector("p");
  const text =
    currentTurnPhase === "play"
      ? "Seleziona una carta"
      : "Attendi il tuo turno";

  if (label) {
    label.textContent = text;
  } else {
    btn.textContent = text;
  }
}

const mainPlayBtn = /** @type {HTMLButtonElement} */ (
  document.getElementById("bottomButton")
);
mainPlayBtn.addEventListener("click", () => {
  if (!selectedCardData) return;
  socket.emit("game:play-card", selectedCardData.card);
  resetBottomButton();
});

function updateBottomButton(card, cardElement) {
  const bottomContainer = document.getElementById("bottom");
  const btn = /** @type {HTMLButtonElement} */ (
    document.getElementById("bottomButton")
  );

  if (selectedCardData && selectedCardData.card === card) {
    resetBottomButton();
    return;
  }

  document.querySelectorAll(".card.selected").forEach((el) => {
    el.classList.remove("selected");
  });

  clearBottomCustomActions();

  cardElement.classList.add("selected");
  selectedCardData = { card, element: cardElement };

  if (card === "denari1") {
    btn.hidden = true;

    const aceActions = document.createElement("div");
    aceActions.id = "acePlayActions";
    aceActions.className = "bidsWrapper";

    const btnHigher = document.createElement("button");
    btnHigher.className = "bidButton primaryButton";
    btnHigher.innerHTML = "<p>Alto</p>";
    btnHigher.addEventListener("click", () => {
      socket.emit("game:play-card", "asso-prende");
      resetBottomButton();
    });

    const btnLower = document.createElement("button");
    btnLower.className = "bidButton primaryButton";
    btnLower.innerHTML = "<p>Basso</p>";
    btnLower.addEventListener("click", () => {
      socket.emit("game:play-card", "asso-lascia");
      resetBottomButton();
    });

    aceActions.appendChild(btnHigher);
    aceActions.appendChild(btnLower);
    bottomContainer.appendChild(aceActions);
  } else {
    btn.hidden = false;
    btn.disabled = false;
    btn.className = "primaryButton";

    const label = btn.querySelector("p");
    if (label) {
      label.textContent = "Gioca carta";
    } else {
      btn.textContent = "Gioca carta";
    }
  }
}

let currentTurnPhase = null;

function renderGameState(game) {
  currentTurnPhase = game.turnPhase;
  if (game.turnPhase === "finished") {
    showScoreboard([game.me, ...game.opponents]);
    return;
  }

  selectedCardData = null;

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

  loader.classList.add("hidden");
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
  const livesDiv = document.getElementById("myLives").querySelector(".value");
  const myBidsContainer = document.getElementById("myBids");
  const bidsDiv = myBidsContainer.querySelector(".value");
  const bottomButton = /** @type {HTMLButtonElement} */ (
    document.getElementById("bottomButton")
  );

  livesDiv.innerHTML = myData.lives;

  const isMyTurn = myData.playerId === currentPlayerId;
  const hasBid =
    myData.bid !== -1 && myData.bid !== null && myData.bid !== undefined;

  const updateBottomButtonDefault = () => {
    console.log(
      "updateBottomButtonDefault - isMyTurn:",
      isMyTurn,
      "turnPhase:",
      turnPhase,
    );
    bottomButton.hidden = false;
    bottomButton.disabled = true;
    bottomButton.className = "secondaryButton disabled";

    const label = bottomButton.querySelector("p");
    const text =
      isMyTurn && turnPhase === "play"
        ? "Seleziona una carta"
        : "Attendi il tuo turno";

    if (label) {
      label.textContent = text;
    } else {
      bottomButton.textContent = text;
    }
  };

  if (isShowdown) {
    if (turnPhase === "bidding" && !hasBid) {
      usernameDiv.innerHTML = "Showdown";
      if (!isMyTurn) updateBottomButtonDefault();
    } else {
      usernameDiv.innerHTML = myData.username;
      updateBottomButtonDefault();
    }
  } else if (turnPhase === "bidding" && !hasBid) {
    usernameDiv.innerHTML = "Quanto scommetti?";
    bidsDiv.innerHTML = "Scegli";

    if (!isMyTurn) updateBottomButtonDefault();
  } else {
    usernameDiv.innerHTML = myData.username;
    bidsDiv.innerHTML = `${myData.won}/${myData.bid}`;

    if (myData.won === myData.bid) {
      myBidsContainer.classList.add("reached");
    } else {
      myBidsContainer.classList.remove("reached");
    }

    updateBottomButtonDefault();
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
          bidsText.innerHTML = "Pensa...";
        } else if (opponent.bid === 1) {
          bidsText.textContent = "Vince";
        } else if (opponent.bid === 0) {
          bidsText.textContent = "Perde";
        } else {
          bidsText.textContent = "In attesa";
        }
      } else if (turnPhase === "bidding") {
        if (isCurrentPlayer) {
          bidsText.innerHTML = "Pensa...";
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

    const wrapper = document.createElement("div");
    wrapper.classList.add("cardWrapper");

    wrapper.classList.add("playedCard");

    wrapper.appendChild(cardElement);

    const playerSeat = document.getElementById(card.playerId);
    playerSeat?.appendChild(wrapper);

    if (highestPlay && card.playerId === highestPlay.playerId) {
      playerSeat?.classList.add("highestPlay");
    }
  }
}

function createBidButtons(game) {
  const bottomContainer = document.getElementById("bottom");
  const bottomButton = /** @type {HTMLButtonElement} */ (
    document.getElementById("bottomButton")
  );

  bottomButton.hidden = true;

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
    /** @type {HTMLButtonElement} */
    const bidButton = document.createElement("button");
    bidButton.innerHTML = `<p>${bid}</p>`;
    bidButton.classList.add("bidButton");

    const isDenied = game.lastPlayer && bid === deniedBid;

    if (isDenied) {
      bidButton.classList.add("secondaryButton", "disabled");
      bidButton.disabled = true;
    } else {
      bidButton.classList.add("primaryButton");
      bidButton.disabled = false;
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
    /** @type {HTMLButtonElement} */
    const bidButton = document.createElement("button");

    bidButton.innerHTML = `<p>${label}</p>`;
    bidButton.classList.add("bidButton", "primaryButton");
    bidButton.disabled = false;

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
    cardElement.addEventListener("click", () => {
      updateBottomButton(card, cardElement);
    });
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
  const scoreboardContainer = document.getElementById("scoreboard");
  scoreboardContainer.innerHTML = "";

  const placements = [...players].sort(
    (a, b) => (a.placement ?? 99) - (b.placement ?? 99),
  );

  for (const player of placements) {
    const row = document.createElement("div");
    row.classList.add("row");

    const placementContainer = document.createElement("div");
    placementContainer.classList.add("placement");
    placementContainer.textContent = `${player.placement}°`;

    const playerContainer = document.createElement("div");
    playerContainer.classList.add("player");
    playerContainer.textContent = player.username;

    row.appendChild(placementContainer);
    row.appendChild(playerContainer);
    scoreboardContainer.appendChild(row);
  }

  document.getElementById("endGameBackdrop").hidden = false;

  const titleElement = document.querySelector("#endGamePopup .title");
  const myData = players[0];
  titleElement.textContent =
    myData && myData.placement === 1 ? "Hai vinto!" : "Partita terminata";
}
