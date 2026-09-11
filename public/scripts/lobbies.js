let currentUser = null;
let socket = null;

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

window.addEventListener("beforeunload", () => {
  if (socket) {
    socket.disconnect();
  }
});

const DOM = {
  nameInput: document.getElementById("nameInput"),
  playersInput: document.getElementById("playersInput"),
  livesInput: document.getElementById("livesInput"),
  cardsInput: document.getElementById("cardsInput"),
  passwordInput: document.getElementById("passwordInput"),

  nameInputError: document.getElementById("nameInputError"),
  playersInputError: document.getElementById("playersInputError"),
  livesInputError: document.getElementById("livesInputError"),
  cardsInputError: document.getElementById("cardsInputError"),

  nameInputContainer: document.getElementById("nameInputContainer"),
  playersInputContainer: document.getElementById("playersInputContainer"),
  livesInputContainer: document.getElementById("livesInputContainer"),
  cardsInputContainer: document.getElementById("cardsInputContainer"),

  searchInput: document.getElementById("searchInput"),
  ownerInput: document.getElementById("ownerInput"),

  filterPublic: document.getElementById("onlyPublic"),
  filterPrivate: document.getElementById("onlyPrivate"),
  filterAccessible: document.getElementById("onlyAccessible"),

  createLobbyButton: document.getElementById("createLobby"),
  createLobbyPopupButton: document.getElementById("createLobbyPopupButton"),
  filterLobbyPopupButton: document.getElementById("filterLobbiesPopupButton"),
  startLobbyButton: document.getElementById("startLobbyButton"),
  updateLobbyButton: document.getElementById("updateLobbyButton"),
  deleteLobbyButton: document.getElementById("deleteLobbyButton"),
  applyFiltersButton: document.getElementById("applyFilters"),
  quitLobbyButton: document.getElementById("quitButtonMobile"),

  lobbiesGrid: document.getElementById("lobbiesGrid"),
  createLobbyContainer: document.getElementById("createLobbyContainer"),
  filterLobbiesSection: document.getElementById("filterLobbies"),
  ownerButtonsContainer: document.getElementById("ownerButtonsContainer"),
  leftColumn: document.getElementById("leftColumn"),
  backdrop: document.getElementById("backdrop"),
};

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
    auth: {
      deviceId: getOrCreateDeviceId(),
    },
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 5,
    transports: ["websocket", "polling"],
  });

  socket.on("connect_error", (error) => {
    console.error("Socket connection error:", error.message);
  });

  socket.on("disconnect", () => {
    console.log("Socket disconnected");
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

  DOM.startLobbyButton.addEventListener("click", () =>
    socket.emit("game:start"),
  );

  DOM.updateLobbyButton.addEventListener("click", () => {
    resetErrors();

    const newLives = parseInt(DOM.livesInput.value, 10);
    const newCards = parseInt(DOM.cardsInput.value, 10);

    socket.emit("lobby:update", newLives, newCards);
  });

  DOM.deleteLobbyButton.addEventListener("click", () =>
    socket.emit("lobby:delete"),
  );

  DOM.quitLobbyButton.addEventListener("click", () => {
    socket.emit("lobby:leave");
  });

  socket.on("lobby:create:error", (data) => {
    displayErrors(data.errors);
  });

  socket.on("lobbies:update", (lobbies) => {
    currentLobbies = lobbies;
    updateLobbies();
  });

  socket.on("lobbies:update:sync", () => {
    socket.emit("lobbies:check");
  });

  socket.on("lobby:join:error", (data) => {
    window.alert(data.message);
  });

  socket.on("lobby:update:error", (data) => {
    displayErrors(data.errors);
  });

  socket.on("lobby:delete:error", (data) => {
    window.alert(data.message);
  });

  socket.on("lobby:deleted", () => {
    window.alert("Il tavolo in cui eri è stato eliminato");
  });

  socket.on("game:start:error", (data) => {
    window.alert(data.message);
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

DOM.applyFiltersButton.addEventListener("click", updateLobbies);

let currentLobbies = [];

function updateLobbies() {
  renderLobbies(currentLobbies);
  closePopup();
}

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
    updateButtons(key);
  });
}

function updateButtons(buttonName) {
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
  const nameFilter = DOM.searchInput.value;
  const ownerFilter = DOM.ownerInput.value;

  let filteredLobbies = lobbies.filter((lobby) => {
    if (lobby.isOwner || lobby.isMember) {
      return true;
    }

    if (nameFilter !== "" && !lobby.name.includes(nameFilter)) return false;
    if (ownerFilter !== "" && lobby.ownerUsername !== ownerFilter) return false;
    if (onlyPublic && lobby.hasPassword) return false;
    if (onlyPrivate && !lobby.hasPassword) return false;
    if (onlyAccessible && lobby.started) return false;

    return true;
  });

  filteredLobbies.sort((a, b) => {
    const aIsMine = a.isOwner || a.isMember;
    const bIsMine = b.isOwner || b.isMember;

    if (aIsMine && !bIsMine) return -1;
    if (!aIsMine && bIsMine) return 1;

    return 0;
  });

  return filteredLobbies;
}

function renderLobbies(lobbies) {
  const existingItems = DOM.lobbiesGrid.querySelectorAll(".lobbyItem");
  existingItems.forEach((el) => el.remove());

  if (lobbies.length === 0) {
    switchLobbySettings(false);
    allowCreateTable();
    hideQuitButton();
    return;
  }

  const filteredLobbies = orderAndFilterLobbies(lobbies);

  if (filteredLobbies.length === 0) {
    switchLobbySettings(false);
    return;
  }

  switchLobbySettings(filteredLobbies[0].isOwner);
  let inLobby = false;

  for (const lobby of filteredLobbies) {
    const card = document.createElement("div");
    card.classList.add("lobbyItem");

    if (lobby.started) {
      card.classList.add("lobbyClosed");
    }

    const nameEl = document.createElement("div");
    nameEl.classList.add("lobbyCell", "lobbyName");
    nameEl.textContent = lobby.name;

    const ownerEl = document.createElement("div");
    ownerEl.classList.add("lobbyCell", "lobbyOwner");
    ownerEl.textContent = lobby.ownerUsername;

    const livesEl = document.createElement("div");
    livesEl.classList.add("lobbyCell", "lobbyLives", "mobileHidden");
    livesEl.textContent = lobby.startingLives;

    const cardsEl = document.createElement("div");
    cardsEl.classList.add("lobbyCell", "lobbyCards", "mobileHidden");
    cardsEl.textContent = lobby.initialCards;

    const playersEl = document.createElement("div");
    playersEl.classList.add("lobbyCell", "lobbyPlayers");
    playersEl.textContent = lobby.started
      ? `${lobby.playersConnected} / ${lobby.players}`
      : `${lobby.playersConnected} / ${lobby.maxPlayers}`;

    const statusEl = document.createElement("div");
    statusEl.classList.add("lobbyCell", "lobbyStatus");
    statusEl.textContent = lobby.started ? "IN CORSO" : "In attesa";

    card.appendChild(nameEl);
    card.appendChild(ownerEl);
    card.appendChild(livesEl);
    card.appendChild(cardsEl);
    card.appendChild(playersEl);
    card.appendChild(statusEl);

    if (lobby.isConnected) {
      card.classList.add("joined");
      inLobby = true;

      if (!lobby.isOwner) {
        blockCreateTable();

        const quitButton = document.createElement("button");
        quitButton.id = "quitButtonDesktop";
        quitButton.classList.add("secondaryButton");
        quitButton.addEventListener("click", (e) => {
          e.stopPropagation();
          socket.emit("lobby:leave");
        });
        quitButton.innerHTML =
          '<i class="icon fa-solid fa-arrow-right-from-bracket"></i>';
        statusEl.appendChild(quitButton);

        showQuitButton();
      }
    } else {
      card.addEventListener("click", () => {
        socket.emit("lobby:join", lobby.id);
        blockCreateTable();
      });
    }

    DOM.lobbiesGrid.appendChild(card);
  }

  if (!inLobby) {
    allowCreateTable();
    hideQuitButton();
  }
}

function showQuitButton() {
  DOM.createLobbyPopupButton.hidden = true;
  DOM.quitLobbyButton.hidden = false;
}

function hideQuitButton() {
  DOM.createLobbyPopupButton.hidden = false;
  DOM.quitLobbyButton.hidden = true;
}

function blockCreateTable() {
  DOM.createLobbyButton.classList.add("disabled");

  DOM.nameInput.parentElement.parentElement.classList.add("disabled");
  DOM.playersInput.parentElement.parentElement.classList.add("disabled");
  DOM.livesInput.parentElement.parentElement.classList.add("disabled");
  DOM.cardsInput.parentElement.parentElement.classList.add("disabled");
  DOM.passwordInput.parentElement.parentElement.classList.add("disabled");
}

function allowCreateTable() {
  DOM.createLobbyButton.classList.remove("disabled");

  DOM.nameInput.parentElement.parentElement.classList.remove("disabled");
  DOM.playersInput.parentElement.parentElement.classList.remove("disabled");
  DOM.livesInput.parentElement.parentElement.classList.remove("disabled");
  DOM.cardsInput.parentElement.parentElement.classList.remove("disabled");
  DOM.passwordInput.parentElement.parentElement.classList.remove("disabled");
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
  name: { container: DOM.nameInputContainer, message: DOM.nameInputError },
  players: {
    container: DOM.playersInputContainer,
    message: DOM.playersInputError,
  },
  lives: { container: DOM.livesInputContainer, message: DOM.livesInputError },
  cards: { container: DOM.cardsInputContainer, message: DOM.cardsInputError },
};

function displayErrors(errors) {
  for (const error of errors) {
    errorFields[error.field].message.hidden = false;
    errorFields[error.field].message.innerHTML = error.message;
    errorFields[error.field].container.classList.add("error");
  }
}

function resetErrors() {
  for (const field of Object.values(errorFields)) {
    field.message.hidden = true;
    field.message.innerHTML = "";
    field.container.classList.remove("error");
  }
}
