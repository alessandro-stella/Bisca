const socket = io();

socket.on("connect", () => {
  console.log("Socket connected:", socket.id);
});

socket.on("connect_error", (error) => {
  console.error("Socket connection error:", error.message);
});

socket.on("disconnect", () => {
  console.log("Socket disconnected");
});

socket.on("lobbies:update", (lobbies) => {
  const lobbiesList = document.getElementById("lobbies");

  lobbiesList.innerHTML = "";

  for (const lobby of lobbies) {
    const item = document.createElement("li");

    item.textContent = `${lobby.ownerUsername} - ${lobby.players} giocatori`;

    lobbiesList.appendChild(item);
  }
});
