const urlParams = new URLSearchParams(window.location.search);
const token = urlParams.get("token");

const loadingState = document.getElementById("loadingState");
const successState = document.getElementById("successState");
const errorState = document.getElementById("errorState");
const invalidTokenState = document.getElementById("invalidTokenState");
const errorMessage = document.getElementById("errorMessage");

async function verifyEmail() {
  if (!token || token.length < 20) {
    showState("invalid");
    return;
  }

  try {
    const response = await fetch("/api/auth/verify-email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ token }),
      credentials: "include",
    });

    const data = await response.json();

    if (response.ok && data.authenticated) {
      showState("success");

      setTimeout(() => {
        window.location.replace("/lobbies.html");
      }, 3000);
    } else {
      const error = data.error || "Errore sconosciuto";

      if (
        error.includes("non valido") ||
        error.includes("scaduto") ||
        error.includes("verificato")
      ) {
        showState("invalid");
      } else {
        showState("error", error);
      }
    }
  } catch (error) {
    console.error("Verification error:", error);
    showState("error", "Errore di connessione. Riprova più tardi.");
  }
}

function showState(state, message = "") {
  loadingState.hidden = true;
  successState.hidden = true;
  errorState.hidden = true;
  invalidTokenState.hidden = true;

  switch (state) {
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

verifyEmail();
