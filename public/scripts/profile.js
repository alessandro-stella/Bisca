async function logout() {
  const response = await fetch("/api/session/logout", {
    method: "POST",
    credentials: "include",
  });

  if (response.ok) {
    console.log("Logout successful");
    window.location.replace("login.html");
  } else {
    console.log("Logout error");
  }
}

async function checkSession() {
  const response = await fetch("/api/session/me", {
    method: "GET",
    credentials: "include",
  });

  if (response.ok) {
    console.log("Session OK");
    const { user } = await response.json();

    getStats(user);
  } else {
    console.log("No session or expired");
    window.location.replace("/login.html");
  }
}

checkSession();

async function getStats(user) {
  const games = await fetch(`/api/user/${user.id}/games`).then(
    async (res) => await res.json(),
  );

  displayProfileInfo(user, games);
}

function formatDate(rawDate) {
  return new Intl.DateTimeFormat(navigator.language, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",

    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(rawDate));
}

function displayProfileInfo(userInfo, gamesHistory) {
  console.log({ userInfo, gamesHistory });

  const usernameInfo = document.getElementById("usernameInfo");
  const emailInfo = document.getElementById("emailInfo");
  const eloInfo = document.getElementById("eloInfo");

  usernameInfo.innerHTML = `Username: ${userInfo.username}`;
  emailInfo.innerHTML = `Email: ${userInfo.email}`;
  eloInfo.innerHTML = `Current elo: ${userInfo.elo}`;

  const gameHistoryContainer = document.getElementById("gameHistoryContainer");

  for (const game of gamesHistory) {
    const gameContainer = document.createElement("div");
    gameContainer.classList.add("gameContainer");

    const opponentsContainer = document.createElement("div");
    opponentsContainer.innerHTML = `Opponents: ${game.opponents_count}`;
    gameContainer.appendChild(opponentsContainer);

    const durationContainer = document.createElement("div");
    durationContainer.innerHTML = `Turns played: ${game.duration}`;
    gameContainer.appendChild(durationContainer);

    const dateContainer = document.createElement("div");
    dateContainer.innerHTML = formatDate(game.created_at);
    gameContainer.appendChild(dateContainer);

    const placementContainer = document.createElement("div");
    placementContainer.innerHTML = `Placement: ${game.position}`;
    gameContainer.appendChild(placementContainer);

    const eloChangeContainer = document.createElement("div");
    eloChangeContainer.classList.add("eloChangeContainer");
    eloChangeContainer.innerHTML = game.elo_change;
    eloChangeContainer.classList.add(
      game.elo_change < 0 ? "negative" : "positive",
    );
    gameContainer.appendChild(eloChangeContainer);

    if (game.left_early === true) {
      const quittedContainer = document.createElement("div");
      quittedContainer.classList.add("quittedContainer");
      quittedContainer.innerHTML = "LEFT EARLY";
      gameContainer.appendChild(quittedContainer);
    }

    gameHistoryContainer.appendChild(gameContainer);
  }
}
