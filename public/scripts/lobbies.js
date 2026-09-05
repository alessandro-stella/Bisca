// ==========
// Game logic
// ==========

let currentUser = null;
let socket = null;

window.addEventListener("pageshow", () => {
  if (socket?.connected) {
    socket.emit("lobbies:check");
  }
});

async function checkSession() {
  const response = await fetch("/api/session/me", {
    method: "GET",
    credentials: "include",
  });

  if (!response.ok) {
    window.location.replace("/login.html");
    return false;
  }

  const data = await response.json();

  currentUser = data.user;

  return true;
}

function setupSocket() {
  socket = io({
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 5,

    transports: ["websocket", "polling"],
  });

  const createLobbyButton = document.getElementById("createLobby");

  createLobbyButton.addEventListener("click", () => {
    console.log("CREATING LOBBY");
    const name = /** @type {HTMLInputElement} */ (
      document.getElementById("nameInput")
    ).value;

    const players = parseInt(
      /** @type {HTMLInputElement} */ (document.getElementById("playersInput"))
        .value,
      10,
    );

    const lives = parseInt(
      /** @type {HTMLInputElement} */ (document.getElementById("livesInput"))
        .value,
      10,
    );
    const cards = parseInt(
      /** @type {HTMLInputElement} */ (document.getElementById("cardsInput"))
        .value,
      10,
    );
    const password = /** @type {HTMLInputElement} */ (
      document.getElementById("passwordInput")
    ).value;

    console.log({ name, players, lives, cards, password });

    socket.emit("lobby:create", name, players, lives, cards, password);
  });

  socket.on("lobby:create:error", (data) => {
    console.error("Errore di validazione:", data.message);
  });

  socket.on("connect_error", (error) => {
    console.error("Socket connection error:", error.message);
  });

  socket.on("disconnect", () => {
    console.log("Socket disconnected");
  });

  socket.on("lobbies:update", (lobbies) => {
    console.log("Receiving lobbies:update");
    renderLobbies(lobbies);
  });

  socket.on("lobby:join:error", (data) => {
    console.error("Cannot join lobby:", data.message);
  });

  socket.on("game:started", () => {
    window.location.href = "/game.html";
  });

  socket.on("game:reconnect", () => {
    const reconnect = window.confirm(
      "Hai una partita in corso! Vuoi rientrare nel gioco?",
    );

    if (reconnect) {
      window.location.href = "/game.html";
    } else {
      socket.emit("lobby:leave");
    }
  });
}

async function init() {
  const authenticated = await checkSession();

  if (!authenticated) {
    return;
  }

  setupSocket();
}

init();

// =========
// GUI logic
// =========

function renderLobbies(lobbies) {
  const lobbiesList = document.getElementById("lobbies");
  lobbiesList.innerHTML = "";

  for (const lobby of lobbies) {
    console.log(lobby);
    const tr = document.createElement("tr");

    if (lobby.started) {
      tr.style.opacity = "0.6";
      tr.classList.add("lobby-closed");
    }

    const nameTd = document.createElement("td");
    nameTd.textContent = lobby.name;

    const ownerTd = document.createElement("td");
    ownerTd.textContent = lobby.ownerUsername;

    const livesTd = document.createElement("td");
    livesTd.textContent = lobby.startingLives;
    livesTd.classList.add("mobileHidden");

    const cardsTd = document.createElement("td");
    cardsTd.textContent = lobby.initialCards;
    cardsTd.classList.add("mobileHidden");

    const playersTd = document.createElement("td");
    if (lobby.started) {
      playersTd.textContent = `${lobby.playersConnected} / ${lobby.players}`;
    } else {
      playersTd.textContent = `${lobby.playersConnected} / ${lobby.maxPlayers}`;
    }

    const statusTd = document.createElement("td");
    if (lobby.started) {
      statusTd.textContent = "IN CORSO";
      statusTd.style.fontWeight = "bold";
    } else {
      statusTd.textContent = "In attesa";
    }

    const actionsTd = document.createElement("td");
    actionsTd.classList.add("mobileHidden");

    if (!lobby.started) {
      if (lobby.isOwner) {
        const startButton = document.createElement("button");
        startButton.textContent = "Start Game";
        startButton.addEventListener("click", () => {
          socket.emit("game:start");
        });
        actionsTd.appendChild(startButton);

        const deleteButton = document.createElement("button");
        deleteButton.textContent = "Delete";
        deleteButton.addEventListener("click", () => {
          socket.emit("lobby:delete", lobby.id);
        });
        actionsTd.appendChild(deleteButton);
      } else if (!lobby.isMember) {
        const joinButton = document.createElement("button");
        joinButton.textContent = "Join";
        joinButton.addEventListener("click", () => {
          socket.emit("lobby:join", lobby.id);
        });
        actionsTd.appendChild(joinButton);
      } else {
        const leaveButton = document.createElement("button");
        leaveButton.textContent = "Leave";
        leaveButton.addEventListener("click", () => {
          socket.emit("lobby:leave");
        });
        actionsTd.appendChild(leaveButton);
      }
    }

    tr.appendChild(nameTd);
    tr.appendChild(ownerTd);
    tr.appendChild(livesTd);
    tr.appendChild(cardsTd);
    tr.appendChild(playersTd);
    tr.appendChild(statusTd);
    tr.appendChild(actionsTd);

    lobbiesList.appendChild(tr);
  }
}

const leftColumn = document.getElementById("leftColumn");
const backdrop = document.getElementById("backdrop");
backdrop.addEventListener("click", closePopup);

const filterSection = document.getElementById("filterLobbies");
const createSection = document.getElementById("createLobbyContainer");

const createPopupButton = document.getElementById("createLobbyPopupButton");
createPopupButton.addEventListener("click", openCreatePopup);

const filterPopupButton = document.getElementById("filterLobbiesPopupButton");
filterPopupButton.addEventListener("click", openFilterPopup);

function openPopup() {
  leftColumn.classList.add("shown");
  backdrop.classList.add("shown");
}

function closePopup() {
  leftColumn.classList.remove("shown");
  backdrop.classList.remove("shown");

  filterSection.classList.add("hidden");
  createSection.classList.add("hidden");
}

function openCreatePopup() {
  openPopup();

  filterSection.classList.add("hidden");
  createSection.classList.remove("hidden");
}

function openFilterPopup() {
  openPopup();

  createSection.classList.add("hidden");
  filterSection.classList.remove("hidden");
}
