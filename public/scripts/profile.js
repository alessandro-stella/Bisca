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

  displayProfileInfo(user);
  showMatchHistory(games);
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

function displayProfileInfo(userInfo) {
  const usernameInfo = document.getElementById("usernameInfo");
  const emailInfo = document.getElementById("emailInfo");
  const eloInfo = document.getElementById("eloInfo");

  usernameInfo.innerHTML = `${userInfo.username}`;
  emailInfo.innerHTML = `${userInfo.email}`;
  eloInfo.innerHTML = `${userInfo.elo}`;
}

function showMatchHistory(gamesHistory) {
  const totalMatches = document.getElementById("totalMatches");
  totalMatches.innerHTML = gamesHistory.length;

  let won = 0;

  const tbody = document.getElementById("matchHistoryBody");
  tbody.innerHTML = "";

  for (const game of gamesHistory) {
    if (game.position === 1) won++;

    const tr = document.createElement("tr");

    if (game.left_early) {
      tr.setAttribute("data-quit", "true");
    }

    const badge = game.left_early
      ? `<span class="quit-badge" title="Hai abbandonato">Abbandonata</span>`
      : "";
    const eloColor = game.elo_change < 0 ? "#ff5555" : "var(--brand-green)";
    const eloSign = game.elo_change > 0 ? "+" : "";

    tr.innerHTML = `
      <td>${formatDate(game.created_at)}</td>
      <td>${game.position}° ${badge}</td>
      <td style="color: ${eloColor}; font-weight: bold;">${eloSign}${game.elo_change}</td>
      <td>${game.opponents_count}</td>
      <td>${game.duration}</td>
    `;

    tbody.appendChild(tr);
  }

  const winRate = document.getElementById("winRate");
  if (gamesHistory.length > 0) {
    winRate.innerHTML = ((won / gamesHistory.length) * 100).toFixed(2) + "%";
  } else {
    winRate.innerHTML = "0.00%";
  }
}
