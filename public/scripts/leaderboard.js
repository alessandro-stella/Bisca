async function getLeaderboardData() {
  try {
    const response = await fetch("/api/user/leaderboard/global", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    const data = await response.json();

    if (response.ok) {
      return data;
    } else {
      console.log("Response not ok:", response);
      return null;
    }
  } catch (error) {
    console.error("Error:", error);
    return null;
  }
}

async function getCurrentUserId() {
  try {
    const response = await fetch("/api/session/me", {
      method: "GET",
      credentials: "include",
    });

    if (response.ok) {
      const data = await response.json();
      return data.user ? data.user.id : null;
    }
  } catch (error) {
    console.error("Error fetching session:", error);
  }

  return null;
}

function formatMemberSince(rawDate) {
  return new Intl.DateTimeFormat(navigator.language, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(rawDate));
}

let allPlayers = [];
let currentUserId = null;

function createLeaderboard(players) {
  const loader = document.getElementById("loadingCover");
  loader.classList.add("hidden");

  setTimeout(() => {
    loader.hidden = true;
  }, 1000);

  allPlayers = players || [];
  renderLeaderboard(allPlayers);
}

function renderLeaderboard(players) {
  const tbody = document.getElementById("leaderboardBody");
  const noResults = document.getElementById("noResults");

  tbody.innerHTML = "";

  if (!players || players.length === 0) {
    noResults.hidden = false;
    return;
  }

  noResults.hidden = true;

  for (const player of players) {
    const tr = document.createElement("tr");
    tr.dataset.userId = player.id;

    const placementNum = parseInt(player.placement, 10);
    if (placementNum === 1) tr.classList.add("gold");
    else if (placementNum === 2) tr.classList.add("silver");
    else if (placementNum === 3) tr.classList.add("bronze");

    const isMe = player.id === currentUserId;
    if (isMe) tr.classList.add("isMe");

    const placementCell = document.createElement("td");
    const placementBadge = document.createElement("span");
    placementBadge.classList.add("placementBadge");
    placementBadge.textContent = `${player.placement}°`;
    placementCell.appendChild(placementBadge);

    const nameCell = document.createElement("td");
    const nameWrapper = document.createElement("div");
    nameWrapper.classList.add("playerNameCell");

    const nameText = document.createElement("span");
    nameText.textContent = player.username;
    nameWrapper.appendChild(nameText);

    if (isMe) {
      const meBadge = document.createElement("span");
      meBadge.classList.add("meBadge");
      meBadge.textContent = "Tu";
      nameWrapper.appendChild(meBadge);
    }

    nameCell.appendChild(nameWrapper);

    const eloCell = document.createElement("td");
    eloCell.textContent = player.elo;

    const gamesCell = document.createElement("td");
    gamesCell.textContent = player.total_games;

    const memberSinceCell = document.createElement("td");
    memberSinceCell.textContent = formatMemberSince(player.created_at);

    tr.append(placementCell, nameCell, eloCell, gamesCell, memberSinceCell);

    tr.addEventListener("click", () => {
      window.location.href = `/profile.html?id=${player.id}`;
    });

    tbody.appendChild(tr);
  }
}

const searchInput = /** @type {HTMLInputElement} */ (
  document.getElementById("searchInput")
);
searchInput.addEventListener("input", () => {
  const query = searchInput.value.trim().toLowerCase();

  const filtered = query
    ? allPlayers.filter((player) =>
        player.username.toLowerCase().includes(query),
      )
    : allPlayers;

  renderLeaderboard(filtered);
});

const playerFilter = document.getElementById("playerFilter");
playerFilter.addEventListener("click", () => {
  searchInput.focus();
});

(async () => {
  currentUserId = await getCurrentUserId();

  const players = await getLeaderboardData();
  createLeaderboard(players);
})();
