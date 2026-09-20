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
  socket.emit("game:get-state");
  startHeartbeat();
});

socket.on("connect_error", () => {
  window.location.replace("/lobbies.html");
});

socket.on("disconnect", (reason) => {
  stopHeartbeat();

  if (reason === "io server disconnect") {
    socket.connect();
  }
});

socket.on("pong", () => {
  console.log("Heartbeat received");
});

socket.on("game:reconnect", () => {
  socket.emit("game:get-state");
});

socket.on("game:not-found", () => {
  window.location.replace("/lobbies.html");
});

socket.on("game:state", (game) => {
  renderGameState(game);
});

socket.on("game:state:sync", (game) => {
  renderGameState(game);
});

socket.on("lobbies:update:sync", () => {
  socket.emit("game:get-state");
});

socket.on("lobby:deleted", () => {
  window.location.replace("/lobbies.html");
});

document.addEventListener("visibilitychange", () => {
  if (!document.hidden && socket.connected) {
    socket.emit("game:get-state");
  }
});

// =================
// Game UI functions
// =================

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
  newMessage.innerHTML = `<strong>${data.senderUsername}: </strong>${data.text}`;

  if (data.isMe) {
    newMessage.classList.add("isMe");
  } else {
    chatButton.classList.add("newMessage");
  }

  const previousMessage = messagesContainer.firstElementChild;

  let previousSender = null;
  if (previousMessage) {
    const strongTag = previousMessage.querySelector("strong");
    if (strongTag) {
      previousSender = strongTag.textContent.replace(":", "").trim();
    }
  }

  if (data.senderUsername !== previousSender) {
    newMessage.classList.add("firstInGroup");
  }

  messagesContainer.prepend(newMessage);
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

const centerPopup = document.getElementById("centerPopup");
let popupTimeout;

function showCenterPopup(text) {
  if (popupTimeout) {
    clearTimeout(popupTimeout);
  }

  centerPopup.classList.remove("hidden");
  centerPopup.innerHTML = text;

  popupTimeout = setTimeout(() => {
    centerPopup.classList.add("hidden");
  }, 2000);
}

let announcedBids = {};
let currentTurnPhase = null;
let isFirstLoad = true;

function showBidPopup(game, allPlayers) {
  if (isFirstLoad) {
    allPlayers.forEach((p) => {
      if (p.bid !== -1 && p.bid !== null && p.bid !== undefined) {
        announcedBids[p.playerId] = p.bid;
      }
    });
    isFirstLoad = false;
  } else {
    allPlayers.forEach((p) => {
      if (p.bid !== -1 && p.bid !== null && p.bid !== undefined) {
        if (announcedBids[p.playerId] !== p.bid) {
          const isMe = p.playerId === game.me.playerId;
          let popupText = "";

          if (game.showdown) {
            if (isMe) {
              popupText = p.bid === 1 ? "Vincerò!" : "Perderò!";
            } else {
              popupText =
                p.bid === 1
                  ? `${p.username} vincerà...`
                  : `${p.username} perderà...`;
            }
          } else {
            const name = isMe ? "Hai" : p.username;
            const verb = isMe ? "scommesso" : "scommette";
            popupText = `${name} ${verb} ${p.bid} prese`;
          }

          showCenterPopup(popupText);
          announcedBids[p.playerId] = p.bid;
        }
      } else {
        delete announcedBids[p.playerId];
      }
    });
  }
}

function renderGameState(game) {
  currentTurnPhase = game.turnPhase;
  if (currentTurnPhase === "finished") {
    showScoreboard([game.me, ...game.opponents]);
    return;
  }

  if (currentTurnPhase === "resolving") acePlayed = false;

  const allPlayers = [game.me, ...(game.opponents || [])];

  showBidPopup(game, allPlayers);

  selectedCardData = null;

  const table = document.getElementById("table");
  table.innerHTML = "";

  createMySeat(
    table,
    game.me,
    game.currentPlayerId,
    currentTurnPhase,
    game.showdown,
  );

  createOpponents(
    table,
    currentTurnPhase,
    game.opponents || [],
    game.currentPlayerId,
    game.showdown,
  );

  createPlayedCards(game.playedCards, game.highestPlay);

  const canPlay =
    currentTurnPhase === "play" && game.isMyTurn && !game.showdown;
  createMyCards(game.hand, canPlay, currentTurnPhase, game.showdown);

  if (currentTurnPhase === "bidding" && game.isMyTurn) {
    createBidButtons(game);
  } else {
    resetBottomActions();
  }

  if (!loader.classList.contains("hidden")) {
    loader.classList.add("hidden");
    setTimeout(() => {
      loader.hidden = true;
    }, 2000);
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

  const isEliminated = myData.placement !== null;
  const myLivesContainer = document.getElementById("myLives");

  if (isEliminated && myLivesContainer.classList.contains("gameEnded")) return;

  const usernameDiv = document.getElementById("myUsername");
  const livesDiv = myLivesContainer.querySelector(".value");
  const myBidsContainer = document.getElementById("myBids");
  const bidsDiv = myBidsContainer.querySelector(".value");
  const bottomButton = /** @type {HTMLButtonElement} */ (
    document.getElementById("bottomButton")
  );

  if (isEliminated) {
    myLivesContainer.classList.add("gameEnded");
    myLivesContainer.innerHTML = `Piazzamento: ${myData.placement}°`;
    myBidsContainer.remove();
  } else {
    livesDiv.innerHTML = myData.lives;

    if (turnPhase === "resolving" && isShowdown) {
      livesDiv.innerHTML += " - Rivelando...";
    }

    myBidsContainer.hidden = isShowdown;
  }

  const isMyTurn = myData.playerId === currentPlayerId;
  const hasBid =
    myData.bid !== -1 && myData.bid !== null && myData.bid !== undefined;

  const updateBottomButtonDefault = () => {
    bottomButton.hidden = false;
    bottomButton.disabled = true;
    bottomButton.className = "secondaryButton disabled";

    const label = bottomButton.querySelector("p");
    let text;

    if (isEliminated) {
      text = "Stai assistendo";
    } else if (isMyTurn && turnPhase === "play") {
      text = "Seleziona una carta";
    } else {
      text = "Attendi il tuo turno";
    }

    if (label) {
      label.textContent = text;
    } else {
      bottomButton.textContent = text;
    }
  };

  if (turnPhase !== "resolving") {
    myLivesContainer.classList.remove("showdown");
  }

  if (isShowdown) {
    if (turnPhase === "bidding") {
      if (!hasBid) {
        usernameDiv.innerHTML = "Showdown";
        livesDiv.innerHTML += " - Come andrà?";
        myLivesContainer.classList.add("showdown");

        if (!isMyTurn) updateBottomButtonDefault();
      } else {
        usernameDiv.innerHTML = myData.username;
        const predictionText = myData.bid > 0 ? " - Vincerai" : " - Perderai";
        livesDiv.innerHTML += predictionText;
        myLivesContainer.classList.add("showdown");

        updateBottomButtonDefault();
      }
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

    if (!isEliminated) {
      bidsDiv.innerHTML = `${myData.won}/${myData.bid}`;

      if (turnPhase === "play" && myData.won === myData.bid) {
        myBidsContainer.classList.add("reached");
      } else {
        myBidsContainer.classList.remove("reached");
      }
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
      opponentInfo.classList.add("disconnected");
    }

    if (opponent.placement !== null) {
      stats.innerHTML = `Posto: ${opponent.placement}°`;
    } else if (!opponent.connected) {
      stats.innerHTML = "Disconnesso...";
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

let acePlayed = false;

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

    if (card.card.includes("asso")) {
      showCenterPopup(
        card.card === "asso-prende" ? "Asso prende!" : "Asso non prende!",
      );

      acePlayed = true;
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

const cardsContainer = document.getElementById("myCards");
cardsContainer.addEventListener("click", (event) => {
  const target = /** @type {HTMLElement} */ (event.target);

  if (target.id === "myCards" && selectedCardData) {
    resetBottomButton();
  }
});

function createMyCards(
  cards,
  eventListener = false,
  turnPhase,
  isShowdown = false,
) {
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

  if (!cards || cards.length === 0) return;

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
