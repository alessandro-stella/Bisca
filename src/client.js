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

    const content = await rawRes.json();

    console.log(content);
  } catch (e) {
    console.log({ e });
  }
}

async function getLobbies() {}
