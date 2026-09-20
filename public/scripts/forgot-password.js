const forgotPasswordForm = document.getElementById("forgotPasswordForm");

const emailContainer = document.getElementById("emailContainer");
const emailInput = /** @type {HTMLInputElement} */ (
  document.getElementById("emailInput")
);
const emailError = document.getElementById("emailError");
const retryButton = document.getElementById("retryButton");

const loadingState = document.getElementById("loadingState");
const successState = document.getElementById("successState");
const errorState = document.getElementById("errorState");
const errorMessage = document.getElementById("errorMessage");

const inputs = document.getElementsByClassName("inputWithIcon");

for (const input of inputs) {
  const inputField = input.getElementsByTagName("input")[0];
  input.addEventListener("click", () => inputField.focus());
}

let currentEmail = "";

forgotPasswordForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  emailContainer.classList.remove("error");
  emailError.hidden = true;

  const email = emailInput.value.trim().toLowerCase();

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    emailContainer.classList.add("error");
    emailError.textContent = "Formato email non valido";
    emailError.hidden = false;
    return;
  }

  currentEmail = email;

  showState("loading");
  await sendResetLink(email);
});

retryButton.addEventListener("click", () => {
  showState("form");
  emailInput.value = currentEmail;
});

async function sendResetLink(email) {
  try {
    const response = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email }),
      credentials: "include",
    });

    const data = await response.json();

    if (response.ok && data.success) {
      showState("success");
    } else {
      showState("error", data.error || "Errore durante l'invio del link");
    }
  } catch (error) {
    showState("error", "Errore di connessione. Riprova più tardi.");
  }
}

function showState(state, message = "") {
  forgotPasswordForm.hidden = true;
  loadingState.hidden = true;
  successState.hidden = true;
  errorState.hidden = true;

  switch (state) {
    case "form":
      forgotPasswordForm.hidden = false;
      break;
    case "loading":
      loadingState.hidden = false;
      break;
    case "success":
      successState.hidden = false;
      break;
    case "error":
      errorState.hidden = false;
      if (message) {
        errorMessage.textContent = message;
      }
      break;
  }
}
