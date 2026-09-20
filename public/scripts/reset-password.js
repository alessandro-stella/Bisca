const urlParams = new URLSearchParams(window.location.search);
const token = urlParams.get("token");

const loadingState = document.getElementById("loadingState");
const formState = document.getElementById("resetPasswordForm");
const successState = document.getElementById("successState");
const errorState = document.getElementById("errorState");
const invalidTokenState = document.getElementById("invalidTokenState");
const errorMessage = document.getElementById("errorMessage");

const resetPasswordForm = document.getElementById("resetPasswordForm");
const passwordInput = /** @type {HTMLInputElement} */ (
  document.getElementById("passwordInput")
);
const confirmedPasswordInput = /** @type {HTMLInputElement} */ (
  document.getElementById("confirmedPasswordInput")
);
const resetButton = /** @type {HTMLButtonElement} */ (
  document.getElementById("resetButton")
);

const passwordError = document.getElementById("passwordInputError");
const confirmedPasswordError = document.getElementById(
  "confirmedPasswordInputError",
);

const inputs = document.getElementsByClassName("inputWithIcon");

for (const input of inputs) {
  const inputField = input.getElementsByTagName("input")[0];
  input.addEventListener("click", () => inputField.focus());
}

// Toggle password visibility
const showPasswordBtn = document.getElementById("showPassword");
const showConfirmPasswordBtn = document.getElementById("showPasswordConfirm");

showPasswordBtn.addEventListener("click", () => {
  togglePasswordVisibility(passwordInput, showPasswordBtn);
});

showConfirmPasswordBtn.addEventListener("click", () => {
  togglePasswordVisibility(confirmedPasswordInput, showConfirmPasswordBtn);
});

function togglePasswordVisibility(inputElement, toggleButton) {
  const isPassword = inputElement.type === "password";
  inputElement.type = isPassword ? "text" : "password";

  const icon = toggleButton.querySelector(".icon");
  if (isPassword) {
    icon.classList.remove("fa-eye-slash");
    icon.classList.add("fa-eye");
  } else {
    icon.classList.remove("fa-eye");
    icon.classList.add("fa-eye-slash");
  }
}

resetPasswordForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  passwordError.hidden = true;
  confirmedPasswordError.hidden = true;

  const password = passwordInput.value;
  const confirmedPassword = confirmedPasswordInput.value;

  if (password.length < 8) {
    passwordError.textContent =
      "La password deve essere lunga almeno 8 caratteri";
    passwordError.hidden = false;
    return;
  }

  if (password !== confirmedPassword) {
    confirmedPasswordError.textContent = "Le password non coincidono";
    confirmedPasswordError.hidden = false;
    return;
  }

  resetButton.disabled = true;
  resetButton.textContent = "Aggiornamento in corso...";

  await submitPasswordReset(password);

  resetButton.disabled = false;
  resetButton.textContent = "Cambia password";
});

async function verifyToken() {
  if (!token || token.length < 20) {
    showState("invalid");
    return;
  }

  try {
    const response = await fetch("/api/auth/verify-password-reset-token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ token }),
      credentials: "include",
    });

    const data = await response.json();

    if (response.ok && data.success) {
      showState("form");
    } else {
      const error = data.error || "Errore sconosciuto";

      if (error.includes("non valido") || error.includes("scaduto")) {
        showState("invalid");
      } else {
        showState("error", error);
      }
    }
  } catch (error) {
    console.error("Token verification error:", error);
    showState("error", "Errore di connessione. Riprova più tardi.");
  }
}

async function submitPasswordReset(password) {
  try {
    const response = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ token, password }),
      credentials: "include",
    });

    const data = await response.json();

    if (response.ok && data.success) {
      showState("success");
    } else {
      showState(
        "error",
        data.error || "Errore durante il reset della password",
      );
    }
  } catch (error) {
    console.error("Password reset error:", error);
    showState("error", "Errore di connessione. Riprova più tardi.");
  }
}

function showState(state, message = "") {
  loadingState.hidden = true;
  formState.hidden = true;
  successState.hidden = true;
  errorState.hidden = true;
  invalidTokenState.hidden = true;

  switch (state) {
    case "form":
      formState.hidden = false;
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
    case "invalid":
      invalidTokenState.hidden = false;
      break;
    default:
      loadingState.hidden = false;
  }
}

verifyToken();
