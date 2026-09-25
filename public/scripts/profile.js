const logoutButton = document.getElementById("logout");

logoutButton.addEventListener("click", async () => {
  const response = await fetch("/api/session/logout", {
    method: "POST",
    credentials: "include",
  });

  if (response.ok) {
    window.location.replace("login.html");
  }
});

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
  const deleteButton = document.getElementById("deleteProfileButton");

  usernameInfo.dataset.username = userInfo.username;
  eloInfo.innerHTML = `${userInfo.elo}`;

  if (isOwnProfile) {
    usernameInfo.classList.add("isMe");
    usernameInfo.innerHTML = `Bentornato, ${userInfo.username}!`;
    emailInfo.innerHTML = `${userInfo.email}`;
    emailInfo.hidden = false;
    editButton.hidden = false;
    deleteButton.hidden = false;
  } else {
    usernameInfo.innerHTML = `${userInfo.username}`;
    emailInfo.hidden = true;
    deleteButton.hidden = true;
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

    tr.dataset.gameId = game.id;

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

  const tableRows = document.querySelectorAll("#matchHistoryBody tr");
  tableRows.forEach((row) => {
    row.addEventListener("click", async () => {
      const gameId = row.dataset.gameId;
      await fetchGamePlayers(gameId);
    });
  });

  const winRate = document.getElementById("winRate");
  if (gamesHistory.length > 0) {
    winRate.innerHTML = ((won / gamesHistory.length) * 100).toFixed(2) + "%";
  } else {
    winRate.innerHTML = "0.00%";
  }
}

const opponentsContainer = document.getElementById("opponentsContainer");
console.log(opponentsContainer);

async function fetchGamePlayers(gameId) {
  try {
    const response = await fetch(`/api/user/game/${gameId}/players`, {
      credentials: "include",
    });

    if (!response.ok) {
      console.error("Errore nel fetch dei giocatori della partita");
      return;
    }

    const players = await response.json();
  } catch (error) {
    console.error("Errore durante il fetch:", error);
  }
}

// ============
// Close modals
// ============

const editProfileModal = document.getElementById("editProfileModal");
const deleteProfileModal = document.getElementById("deleteProfileModal");
const gameOpponentsModal = document.getElementById("gameOpponentsModal");

editProfileModal.addEventListener("click", (event) => {
  const target = /** @type {HTMLElement} */ (event.target);

  if (target.id === "editProfileModal") {
    editProfileModal.hidden = true;
  }
});

deleteProfileModal.addEventListener("click", (event) => {
  const target = /** @type {HTMLElement} */ (event.target);

  if (target.id === "deleteProfileModal") {
    deleteProfileModal.hidden = true;
    clearDeleteModal();
  }
});

gameOpponentsModal.addEventListener("click", (event) => {
  const target = /** @type {HTMLElement} */ (event.target);

  if (target.id === "gameOpponentsModal") {
    gameOpponentsModal.hidden = true;
  }
});

const closeModalButtons = document.getElementsByClassName("closeModalButton");

for (const button of closeModalButtons) {
  button.addEventListener("click", () => {
    editProfileModal.hidden = true;
    deleteProfileModal.hidden = true;
    gameOpponentsModal.hidden = true;

    clearDeleteModal();
  });
}

// ============
// Edit profile
// ============

const editProfileButton = document.getElementById("editProfileButton");
const saveProfileButton = document.getElementById("saveProfileButton");

const editUsernameContainer = document.getElementById("usernameInputContainer");
const editUsernameInput = /** @type {HTMLInputElement} */ (
  document.getElementById("editUsernameInput")
);
const editError = document.getElementById("editError");

editUsernameContainer.addEventListener("click", () => {
  editUsernameInput.focus();
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

const modalResetPasswordButton = /** @type {HTMLButtonElement} */ (
  document.getElementById("modalResetPasswordButton")
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

// ==============
// Delete profile
// ==============

const deleteProfileButton = document.getElementById("deleteProfileButton");

deleteProfileButton.addEventListener("click", () => {
  deleteProfileModal.hidden = false;
});

const proceedDeleteButton = /** @type {HTMLButtonElement}*/ (
  document.getElementById("proceedDeleteButton")
);
const confirmDeleteButton = /** @type {HTMLButtonElement}*/ (
  document.getElementById("confirmDeleteButton")
);

const deleteProfilePopup = document.getElementById("deleteProfilePopup");
const confirmDeletePopup = document.getElementById("confirmDeletePopup");

/** @type {NodeListOf<HTMLInputElement>} */
const checkDeleteList = document.querySelectorAll(
  'input[type="checkbox"].checkDelete',
);

for (const check of checkDeleteList) {
  check.addEventListener("change", function () {
    if (!this.checked) {
      updateProceedDelete(false);
      return;
    }

    for (const check of checkDeleteList) {
      if (!check.checked) {
        updateProceedDelete(false);
        return;
      }
    }

    updateProceedDelete(true);
  });
}

function clearDeleteModal() {
  deleteProfilePopup.hidden = false;
  confirmDeletePopup.hidden = true;

  for (const check of checkDeleteList) {
    check.checked = false;
  }

  updateProceedDelete(false);

  // Ripristina l'errore del secondo step, se presente
  const deleteErrorContainer = document.getElementById("deleteError");
  if (deleteErrorContainer) {
    deleteErrorContainer.hidden = true;
    deleteErrorContainer.innerHTML = "";
  }

  // Svuota i campi del codice (se già inizializzati)
  if (typeof confirmationCodeDigits !== "undefined") {
    confirmationCodeDigits.forEach((digit) => {
      digit.value = "";
    });
  }

  // Blocca di nuovo il tasto Elimina
  if (typeof updateConfirmDelete === "function") {
    updateConfirmDelete(false);
  }
}

function updateProceedDelete(unlock) {
  if (unlock) {
    proceedDeleteButton.classList.add("unlocked");
    proceedDeleteButton.disabled = false;
  } else {
    proceedDeleteButton.classList.remove("unlocked");
    proceedDeleteButton.disabled = true;
  }
}

function updateConfirmDelete(unlock) {
  if (unlock) {
    confirmDeleteButton.classList.add("unlocked");
    confirmDeleteButton.disabled = false;
  } else {
    confirmDeleteButton.classList.remove("unlocked");
    confirmDeleteButton.disabled = true;
  }
}

const proceedErrorContainer = document.getElementById("proceedError");

proceedDeleteButton.addEventListener("click", async () => {
  const oldText = proceedDeleteButton.innerHTML;

  function resetButton() {
    proceedDeleteButton.disabled = false;
    proceedDeleteButton.innerHTML = oldText;

    proceedErrorContainer.hidden = true;
    proceedErrorContainer.innerHTML = "";

    for (const check of checkDeleteList) {
      check.checked = false;
    }
  }

  function addError(errorText) {
    resetButton();

    proceedErrorContainer.hidden = false;
    proceedErrorContainer.innerHTML = errorText;
  }

  proceedDeleteButton.disabled = true;
  proceedDeleteButton.innerHTML = "Invio in corso...";

  try {
    const response = await fetch("/api/auth/request-account-deletion", {
      method: "POST",
      credentials: "include",
    });

    const data = await response.json();

    if (response.ok && data.success) {
      deleteProfilePopup.hidden = true;
      confirmDeletePopup.hidden = false;

      resetButton();
    } else {
      addError(data.error);
    }
  } catch (error) {
    addError("Errore durante l'invio dell'email, per favore riprova tra poco");
  }
});

/** @type {NodeListOf<HTMLInputElement>} */
const confirmationCodeDigits = document.querySelectorAll(
  'input[type="text"].codeDigit',
);

function checkAllFilled() {
  const allFilled = Array.from(confirmationCodeDigits).every(
    (digit) => digit.value.length > 0,
  );

  if (allFilled) {
    updateConfirmDelete(true);
  } else {
    updateConfirmDelete(false);
  }
}

confirmationCodeDigits.forEach((digit, index) => {
  digit.addEventListener("keydown", (e) => {
    if (e.key === " " || e.code === "Space") {
      e.preventDefault();
      return;
    }

    if (e.key === "Backspace") {
      if (digit.value === "" && index > 0) {
        confirmationCodeDigits[index - 1].focus();
      }
    }
  });

  digit.addEventListener("input", (_) => {
    const cleanedValue = digit.value.toUpperCase().replace(/[^A-Z0-9]/g, "");

    if (cleanedValue.length > 0) {
      digit.value = cleanedValue.slice(-1);

      if (index < confirmationCodeDigits.length - 1) {
        confirmationCodeDigits[index + 1].focus();
      } else {
        digit.blur();
      }
    } else {
      digit.value = "";
    }

    checkAllFilled();
  });

  digit.addEventListener("paste", (e) => {
    e.preventDefault();

    const pasteData = (e.clipboardData || window.clipboardData).getData("text");

    const chars = pasteData
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 8)
      .split("");

    chars.forEach((char, i) => {
      if (confirmationCodeDigits[i]) {
        confirmationCodeDigits[i].value = char;
      }
    });

    if (chars.length < confirmationCodeDigits.length) {
      confirmationCodeDigits[chars.length].focus();
    } else {
      digit.blur();
    }

    checkAllFilled();
  });
});

const deleteErrorContainer = document.getElementById("deleteError");

confirmDeleteButton.addEventListener("click", async () => {
  const oldText = confirmDeleteButton.innerHTML;

  function resetConfirmButton() {
    confirmDeleteButton.disabled = false;
    confirmDeleteButton.innerHTML = oldText;

    deleteErrorContainer.hidden = true;
    deleteErrorContainer.innerHTML = "";
  }

  function addConfirmError(errorText) {
    resetConfirmButton();

    deleteErrorContainer.hidden = false;
    deleteErrorContainer.innerHTML = errorText;
  }

  confirmDeleteButton.disabled = true;
  confirmDeleteButton.innerHTML = "Eliminazione in corso...";

  const code = Array.from(confirmationCodeDigits)
    .map((digit) => digit.value)
    .join("");

  try {
    const response = await fetch("/api/auth/confirm-account-deletion", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ code }),
      credentials: "include",
    });

    const data = await response.json();
    console.log(data);

    if (response.ok && data.success) {
      window.location.replace("/login.html");
    } else {
      addConfirmError(data.error || "Codice errato o scaduto");
    }
  } catch (error) {
    addConfirmError("Errore di connessione, riprova tra poco");
  }
});
