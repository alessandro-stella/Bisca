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

    closePopup();

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

const filterName = /** @type {HTMLInputElement} */ (
  document.getElementById("searchInput")
);
const filterOwner = /** @type {HTMLInputElement} */ (
  document.getElementById("ownerInput")
);

let onlyPublic = false;
let onlyPrivate = false;
let onlyAccessible = false;

const filterButtons = {
  public: document.getElementById("onlyPublic"),
  private: document.getElementById("onlyPrivate"),
  accessible: document.getElementById("onlyAccessible"),
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

  const name = filterName.value;
  const owner = filterOwner.value;

  if (name !== "") {
    lobbies = lobbies.filter((lobby) => lobby.name.include(name));
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

  const lobbiesList = document.getElementById("lobbies");
  lobbiesList.innerHTML = "";

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

    lobbiesList.appendChild(tr);

    if (lobby.isOwner) {
      switchLobbySettings(true);
    }

    if (lobby.isConnected) {
      tr.classList.add("joined");
    }
  }
}

function switchLobbySettings(lobbyCreated) {
  document
    .getElementById("createLobbyContainer")
    .getElementsByClassName("title")[0].innerHTML = lobbyCreated
    ? "Modifica tavolo"
    : "Crea tavolo";

  document
    .getElementById("createLobbyPopupButton")
    .getElementsByTagName("p")[0].innerHTML = lobbyCreated
    ? "Modifica tavolo"
    : "Crea tavolo";

  document.getElementById("createLobby").hidden = lobbyCreated;
  document.getElementById("ownerButtonsContainer").hidden = !lobbyCreated;

  document.getElementById("nameInput").parentElement.parentElement.hidden =
    lobbyCreated;
  document.getElementById("playersInput").parentElement.parentElement.hidden =
    lobbyCreated;
  document.getElementById("passwordInput").parentElement.parentElement.hidden =
    lobbyCreated;
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
