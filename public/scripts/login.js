const form = document.getElementById("loginForm");

const emailInput = /** @type {HTMLInputElement} */ (
  document.getElementById("emailInput")
);
const passwordInput = /** @type {HTMLInputElement} */ (
  document.getElementById("passwordInput")
);
const inputPasswordContainer =
  document.getElementsByClassName("inputPassword")[0];

const loginError = document.getElementById("loginError");

const loginButton = document.getElementById("loginButton");

const inputs = document.getElementsByClassName("inputWithIcon");

for (const input of inputs) {
  const inputField = input.getElementsByTagName("input")[0];

  input.addEventListener("click", () => inputField.focus());
}

function setReadonly(blockInput) {
  const inputs = [emailInput, passwordInput];

  inputs.forEach((input) => {
    input.readOnly = blockInput;
  });
}

const showPassword = document.getElementById("showPassword");

showPassword.addEventListener("click", () => {
  const showPasswordIcon = showPassword.getElementsByTagName("svg")[0];
  showPasswordIcon.classList.toggle("fa-eye-slash");
  showPasswordIcon.classList.toggle("fa-eye");

  passwordInput.type = passwordInput.type === "password" ? "text" : "password";
});

function showError(show, message, highlightPasswordField = true) {
  loginError.hidden = !show;

  if (show) {
    loginError.textContent = message || "Email o password non valida";
  }

  if (show && highlightPasswordField) {
    inputPasswordContainer.classList.add("error");
  } else {
    inputPasswordContainer.classList.remove("error");
  }
}

function setLoading(loading) {
  if (loading) {
    loginButton.innerHTML = '<i class="fa-solid fa-spinner"></i>';
  } else {
    loginButton.innerHTML = "Accedi";
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  setReadonly(true);
  showError(false);
  setLoading(true);

  const email = emailInput.value.trim();
  const password = passwordInput.value;

  try {
    const res = await fetch("/api/user/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        password,
      }),
    });

    let loginResponse = null;
    try {
      loginResponse = await res.json();
    } catch (parseError) {
      loginResponse = null;
    }

    if (!res.ok) {
      showError(
        true,
        loginResponse?.error || "Invalid email or password",
        res.status === 401,
      );
    } else {
      // console.log({ loginResponse });
      window.location.replace("lobbies.html");
    }
  } catch (error) {
    console.log("Internal server error: ", error);
    showError(true, "Errore di connessione. Riprova più tardi.", false);
  }

  setReadonly(false);
  setLoading(false);
});
