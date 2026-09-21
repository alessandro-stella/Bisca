async function logout() {
  const response = await fetch("/api/session/logout", {
    method: "POST",
    credentials: "include",
  });

  if (response.ok) {
    window.location.replace("login.html");
  }
}

async function loadProfile() {
  const urlParams = new URLSearchParams(window.location.search);
  const targetUserId = urlParams.get("id");

  const sessionResponse = await fetch("/api/session/me", {
    method: "GET",
    credentials: "include",
  });

  let loggedInUser = null;
  if (sessionResponse.ok) {
    const data = await sessionResponse.json();
    loggedInUser = data.user;
  }

  const isOwnProfile =
    !targetUserId || (loggedInUser && targetUserId === loggedInUser.id);
  let userToDisplay = null;

  const loader = document.getElementById("loadingCover");

  if (isOwnProfile) {
    if (!loggedInUser) {
      window.location.replace("/login.html");
      return;
    }

    userToDisplay = loggedInUser;
  } else {
    const userResponse = await fetch(`/api/user/${targetUserId}`);

    if (userResponse.ok) {
      userToDisplay = await userResponse.json();
    } else {
      const userInfo = document.getElementById("userInfo");
      userInfo.hidden = true;

      const matchHistoryContainer = document.getElementById(
        "matchHistoryContainer",
      );
      matchHistoryContainer.hidden = true;

      loader.classList.add("hidden");
      return;
    }
  }

  displayProfileInfo(userToDisplay, isOwnProfile);
  getStats(userToDisplay);

  const userNotFound = document.getElementById("userNotFoundWrapper");
  userNotFound.hidden = true;
  loader.classList.add("hidden");
}

loadProfile();

async function getStats(user) {
  const games = await fetch(`/api/user/${user.id}/games`).then(
    async (res) => await res.json(),
  );

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

function displayProfileInfo(userInfo, isOwnProfile) {
  const usernameInfo = document.getElementById("usernameInfo");
  const emailInfo = document.getElementById("emailInfo");
  const eloInfo = document.getElementById("eloInfo");
  const editButton = document.getElementById("editProfileButton");

  usernameInfo.dataset.username = userInfo.username;
  eloInfo.innerHTML = `${userInfo.elo}`;

  if (isOwnProfile) {
    usernameInfo.classList.add("isMe");
    usernameInfo.innerHTML = `Bentornato, ${userInfo.username}!`;
    emailInfo.innerHTML = `${userInfo.email}`;
    emailInfo.hidden = false;
    if (editButton) editButton.hidden = false;
  } else {
    usernameInfo.innerHTML = `${userInfo.username}`;
    emailInfo.hidden = true;
    if (editButton) editButton.hidden = true;
  }
}

function showMatchHistory(gamesHistory) {
  const totalMatches = document.getElementById("totalMatches");
  totalMatches.innerHTML = gamesHistory.length;

  let won = 0;
  const tbody = document.getElementById("matchHistoryBody");
  tbody.innerHTML = "";

  for (const game of gamesHistory) {
    if (game.placement === 1) won++;

    const tr = document.createElement("tr");

    if (game.left_early) {
      tr.setAttribute("data-quit", "true");
    }

    const badge = game.left_early
      ? `<span class="quit-badge" title="Hai abbandonato">Abbandonata</span>`
      : "";
    const eloColor =
      game.elo_change < 0 ? "var(--accent-red)" : "var(--brand-green)";
    const eloSign = game.elo_change > 0 ? "+" : "";

    tr.innerHTML = `
      <td>${formatDate(game.created_at)}</td>
      <td>${game.placement}° ${badge}</td>
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

const editProfileButton = document.getElementById("editProfileButton");
const editProfileModal = document.getElementById("editProfileModal");
const closeModalButton = document.getElementById("closeModalButton");
const saveProfileButton = document.getElementById("saveProfileButton");

const editUsernameContainer = document.getElementById("usernameInputContainer");
const editUsernameInput = /** @type {HTMLInputElement} */ (
  document.getElementById("editUsernameInput")
);
const editError = document.getElementById("editError");

editUsernameContainer.addEventListener("click", () => {
  editUsernameInput.focus();
});

editProfileModal.addEventListener("click", (event) => {
  const target = /** @type {HTMLElement} */ (event.target);

  if (target.id === "editProfileModal") {
    editProfileModal.hidden = true;
  }
});

closeModalButton.addEventListener("click", () => {
  editProfileModal.hidden = true;
});

editProfileButton.addEventListener("click", () => {
  const currentUsername =
    document.getElementById("usernameInfo").dataset.username;
  editUsernameInput.value = currentUsername;
  editError.hidden = true;
  editProfileModal.hidden = false;
});

saveProfileButton.addEventListener("click", async () => {
  const newUsername = editUsernameInput.value.trim();

  if (!newUsername) {
    editError.innerText = "Inserisci uno username valido";
    editError.hidden = false;
    return;
  }

  try {
    const response = await fetch("/api/user/update", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username: newUsername }),
    });

    const data = await response.json();

    if (response.ok) {
      const usernameInfo = document.getElementById("usernameInfo");
      usernameInfo.classList.add("isMe");
      usernameInfo.dataset.username = data.username;
      usernameInfo.innerHTML = `Bentornato, ${data.username}!`;
      editProfileModal.hidden = true;
    } else {
      editError.innerText = data.error || "Errore durante l'aggiornamento";
      editError.hidden = false;
    }
  } catch (error) {
    editError.innerText = "Errore di connessione";
    editError.hidden = false;
  }
});

const modalResetPasswordButton = document.getElementById(
  "modalResetPasswordButton",
);
const modalPasswordMessage = document.getElementById("modalPasswordMessage");

modalResetPasswordButton.addEventListener("click", async () => {
  const emailInfo = document.getElementById("emailInfo");
  const userEmail = emailInfo.innerText.trim();

  modalResetPasswordButton.disabled = true;
  modalResetPasswordButton.innerHTML =
    '<i class="fa-solid fa-spinner fa-spin"></i> Invio in corso...';
  modalPasswordMessage.hidden = true;

  try {
    const response = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email: userEmail }),
      credentials: "include",
    });

    const data = await response.json();
    modalPasswordMessage.hidden = false;

    if (response.ok && data.success) {
      modalPasswordMessage.textContent =
        "Ti abbiamo inviato un'email! Controlla la posta in arrivo (o lo spam).";
      modalPasswordMessage.style.color = "var(--brand-green)";
      modalResetPasswordButton.innerHTML =
        '<i class="fa-solid fa-check"></i> Email inviata';
    } else {
      modalPasswordMessage.textContent =
        data.error || "C'è stato un problema durante l'invio.";
      modalPasswordMessage.style.color = "var(--accent-red)";
      modalResetPasswordButton.disabled = false;
      modalResetPasswordButton.innerHTML =
        '<i class="fa-solid fa-key"></i> Riprova';
    }
  } catch (error) {
    modalPasswordMessage.hidden = false;
    modalPasswordMessage.textContent =
      "Errore di connessione. Riprova tra poco.";
    modalPasswordMessage.style.color = "var(--accent-red)";
    modalResetPasswordButton.disabled = false;
    modalResetPasswordButton.innerHTML =
      '<i class="fa-solid fa-key"></i> Riprova';
  }
});
