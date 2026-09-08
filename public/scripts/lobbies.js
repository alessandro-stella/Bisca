// ==========
// DOM Elements
// ==========

const DOM = {
  // Create Lobby Form
  nameInput: /** @type {HTMLInputElement} */ (
    document.getElementById("nameInput")
  ),
  playersInput: /** @type {HTMLInputElement} */ (
    document.getElementById("playersInput")
  ),
  livesInput: /** @type {HTMLInputElement} */ (
    document.getElementById("livesInput")
  ),
  cardsInput: /** @type {HTMLInputElement} */ (
    document.getElementById("cardsInput")
  ),
  passwordInput: /** @type {HTMLInputElement} */ (
    document.getElementById("passwordInput")
  ),

  // Create Lobby Form Errors
  nameInputError: document.getElementById("nameInputError"),
  playersInputError: document.getElementById("playersInputError"),
  livesInputError: document.getElementById("livesInputError"),
  cardsInputError: document.getElementById("cardsInputError"),

  // Filter Inputs
  searchInput: /** @type {HTMLInputElement} */ (
    document.getElementById("searchInput")
  ),
  ownerInput: /** @type {HTMLInputElement} */ (
    document.getElementById("ownerInput")
  ),

  // Filter Buttons
  filterPublic: document.getElementById("onlyPublic"),
  filterPrivate: document.getElementById("onlyPrivate"),
  filterAccessible: document.getElementById("onlyAccessible"),

  // Buttons
  createLobbyButton: document.getElementById("createLobby"),
  createLobbyPopupButton: document.getElementById("createLobbyPopupButton"),
  filterLobbyPopupButton: document.getElementById("filterLobbiesPopupButton"),

  // Containers & Sections
  lobbiesTable: document.getElementById("lobbies"),
  createLobbyContainer: document.getElementById("createLobbyContainer"),
  filterLobbiesSection: document.getElementById("filterLobbies"),
  ownerButtonsContainer: document.getElementById("ownerButtonsContainer"),
  leftColumn: document.getElementById("leftColumn"),
  backdrop: document.getElementById("backdrop"),
};

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

  DOM.createLobbyButton.addEventListener("click", () => {
    resetErrors();

    const name = DOM.nameInput.value;
    const players = parseInt(DOM.playersInput.value, 10);
    const lives = parseInt(DOM.livesInput.value, 10);
    const cards = parseInt(DOM.cardsInput.value, 10);
    const password = DOM.passwordInput.value;

    closePopup();

    socket.emit("lobby:create", name, players, lives, cards, password);
  });

  socket.on("lobby:create:error", (data) => {
    displayErrors(data.errors);
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

let onlyPublic = false;
let onlyPrivate = false;
let onlyAccessible = false;

const filterButtons = {
  public: DOM.filterPublic,
  private: DOM.filterPrivate,
  accessible: DOM.filterAccessible,
};

for (const [key, button] of Object.entries(filterButtons)) {
  button.addEventListener("click", () => {
    updateButton(key);
  });
}

function updateButton(buttonName) {
  filterButtons[buttonName].classList.toggle("selected");

  switch (buttonName) {
    case "public": {
      onlyPublic = !onlyPublic;

      if (onlyPublic && onlyPrivate) {
        onlyPrivate = false;
        filterButtons.private.classList.remove("selected");
      }

      break;
    }

    case "private": {
      onlyPrivate = !onlyPrivate;

      if (onlyPrivate && onlyPublic) {
        onlyPublic = false;
        filterButtons.public.classList.remove("selected");
      }

      break;
    }

    case "accessible": {
      onlyAccessible = !onlyAccessible;
      break;
    }
  }
}

function orderAndFilterLobbies(lobbies) {
  lobbies.sort((a, b) => {
    if (a.isOwner && !b.isOwner) return -1;
    if (!a.isOwner && b.isOwner) return 1;
    return 0;
  });

  const name = DOM.searchInput.value;
  const owner = DOM.ownerInput.value;

  if (name !== "") {
    lobbies = lobbies.filter((lobby) => lobby.name.includes(name));
  }

  if (owner !== "") {
    lobbies = lobbies.filter((lobby) => lobby.ownerUsername === owner);
  }

  if (onlyPublic) {
    lobbies = lobbies.filter((lobby) => !lobby.hasPassword);
  }

  if (onlyPrivate) {
    lobbies = lobbies.filter((lobby) => lobby.hasPassword);
  }

  if (onlyAccessible) {
    lobbies = lobbies.filter((lobby) => !lobby.started);
  }

  return lobbies;
}

function renderLobbies(lobbies) {
  const filteredLobbies = orderAndFilterLobbies(lobbies);

  DOM.lobbiesTable.innerHTML = "";

  for (const lobby of filteredLobbies) {
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

    tr.appendChild(nameTd);
    tr.appendChild(ownerTd);
    tr.appendChild(livesTd);
    tr.appendChild(cardsTd);
    tr.appendChild(playersTd);
    tr.appendChild(statusTd);

    DOM.lobbiesTable.appendChild(tr);

    if (lobby.isOwner) {
      switchLobbySettings(true);
    }

    if (lobby.isConnected) {
      tr.classList.add("joined");
    }
  }
}

function switchLobbySettings(lobbyCreated) {
  DOM.createLobbyContainer.getElementsByClassName("title")[0].innerHTML =
    lobbyCreated ? "Modifica tavolo" : "Crea tavolo";

  DOM.createLobbyPopupButton.getElementsByTagName("p")[0].innerHTML =
    lobbyCreated ? "Gestisci tavolo" : "Crea tavolo";

  DOM.createLobbyButton.hidden = lobbyCreated;
  DOM.ownerButtonsContainer.hidden = !lobbyCreated;

  DOM.nameInput.parentElement.parentElement.hidden = lobbyCreated;
  DOM.playersInput.parentElement.parentElement.hidden = lobbyCreated;
  DOM.passwordInput.parentElement.parentElement.hidden = lobbyCreated;
}

DOM.backdrop.addEventListener("click", closePopup);
DOM.createLobbyPopupButton.addEventListener("click", openCreatePopup);
DOM.filterLobbyPopupButton.addEventListener("click", openFilterPopup);

function openPopup() {
  DOM.leftColumn.classList.add("shown");
  DOM.backdrop.classList.add("shown");
}

function closePopup() {
  DOM.leftColumn.classList.remove("shown");
  DOM.backdrop.classList.remove("shown");

  DOM.filterLobbiesSection.classList.add("hidden");
  DOM.createLobbyContainer.classList.add("hidden");
}

function openCreatePopup() {
  openPopup();

  DOM.filterLobbiesSection.classList.add("hidden");
  DOM.createLobbyContainer.classList.remove("hidden");
}

function openFilterPopup() {
  openPopup();

  DOM.createLobbyContainer.classList.add("hidden");
  DOM.filterLobbiesSection.classList.remove("hidden");
}

const errorFields = {
  name: DOM.nameInputError,
  players: DOM.playersInputError,
  lives: DOM.livesInputError,
  cards: DOM.cardsInputError,
};

function displayErrors(errors) {
  for (const error of errors) {
    errorFields[error.field].hidden = false;
    errorFields[error.field].innerHTML = error.message;
  }
}

function resetErrors() {
  console.log("Reset error");
}
