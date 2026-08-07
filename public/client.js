const PORT = 8000;
const serverUrl = `http://localhost:${PORT}/api/lobby`;

async function createLobby() {
  const name = document.getElementById("lobbyName").value;

  try {
    const rawRes = await fetch(serverUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name }),
    });

    if (!rawRes.ok) {
      throw new Error(`Server error: ${rawRes.status}`);
    }

    const content = await rawRes.json();
    console.log(content);
  } catch (e) {
    console.log({ e });
  }
}

async function getLobbies() {
  const lobbiesContainer = document.getElementById("lobbies");

  try {
    const rawRes = await fetch(serverUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!rawRes.ok) {
      throw new Error(`Server error: ${rawRes.status}`);
    }

    const { lobbies } = await rawRes.json();

    lobbiesContainer.innerHTML = "";

    for (const lobby of lobbies) {
      const li = document.createElement("li");
      li.id = lobby.id;
      li.textContent = lobby.name || "undefined";

      lobbiesContainer.appendChild(li);
    }
  } catch (e) {
    console.log({ e });
  }
}
