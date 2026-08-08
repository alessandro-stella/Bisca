let currentUser = null;
let socket = null;

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
  socket = io();

  const createLobbyButton = document.getElementById("createLobby");

  createLobbyButton.addEventListener("click", () => {
    socket.emit("lobby:create");
  });

  socket.on("connect_error", (error) => {
    console.error("Socket connection error:", error.message);
  });

  socket.on("disconnect", () => {
    console.log("Socket disconnected");
  });

  socket.on("lobbies:update", (lobbies) => {
    renderLobbies(lobbies);
  });

  socket.on("lobby:join:error", (data) => {
    console.error("Cannot join lobby:", data.message);
  });

  socket.on("game:started", () => {
    window.location.replace("/game.html");
  });
}

function renderLobbies(lobbies) {
  const lobbiesList = document.getElementById("lobbies");

  lobbiesList.innerHTML = "";

  for (const lobby of lobbies) {
    const item = document.createElement("li");

    const info = document.createElement("span");

    info.textContent = `${lobby.ownerUsername} - ${lobby.players} giocatori`;

    item.appendChild(info);

    if (lobby.isOwner) {
      const deleteButton = document.createElement("button");

      deleteButton.textContent = "Delete";

      deleteButton.addEventListener("click", () => {
        socket.emit("lobby:delete", lobby.id);
      });

      item.appendChild(deleteButton);
    } else if (lobby.isMember) {
      const leaveButton = document.createElement("button");

      leaveButton.textContent = "Leave";

      leaveButton.addEventListener("click", () => {
        socket.emit("lobby:leave");
      });

      item.appendChild(leaveButton);
    } else {
      const joinButton = document.createElement("button");

      joinButton.textContent = "Join";

      joinButton.addEventListener("click", () => {
        socket.emit("lobby:join", lobby.id);
      });

      item.appendChild(joinButton);
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
