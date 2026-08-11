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
    const lives = parseInt(document.getElementById("livesInput").value, 10);
    const cards = parseInt(document.getElementById("cardsInput").value, 10);

    socket.emit("lobby:create", lives, cards);
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

function renderLobbies(lobbies) {
  const lobbiesList = document.getElementById("lobbies");
  lobbiesList.innerHTML = "";

  for (const lobby of lobbies) {
    const item = document.createElement("li");

    const info = document.createElement("span");
    info.textContent = `${lobby.ownerUsername} - ${lobby.players} giocatori (${lobby.playersConnected} connessi)`;

    if (lobby.started) {
      info.textContent += " [IN CORSO]";
      info.style.fontWeight = "bold";
      item.style.opacity = "0.6";
      item.classList.add("lobby-closed");
    }

    item.appendChild(info);

    if (!lobby.started) {
      if (lobby.isOwner) {
        const startButton = document.createElement("button");
        startButton.textContent = "Start Game";
        startButton.addEventListener("click", () => {
          socket.emit("game:start");
        });
        item.appendChild(startButton);

        const deleteButton = document.createElement("button");
        deleteButton.textContent = "Delete";
        deleteButton.addEventListener("click", () => {
          socket.emit("lobby:delete", lobby.id);
        });
        item.appendChild(deleteButton);
      } else if (!lobby.isMember) {
        const joinButton = document.createElement("button");
        joinButton.textContent = "Join";
        joinButton.addEventListener("click", () => {
          socket.emit("lobby:join", lobby.id);
        });
        item.appendChild(joinButton);
      } else {
        const leaveButton = document.createElement("button");
        leaveButton.textContent = "Leave";
        leaveButton.addEventListener("click", () => {
          socket.emit("lobby:leave");
        });
        item.appendChild(leaveButton);
      }
    }

    lobbiesList.appendChild(item);
  }
}
async function init() {
  const authenticated = await checkSession();

  if (!authenticated) {
    return;
  }

  setupSocket();
}

init();
