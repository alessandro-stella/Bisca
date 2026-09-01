const form = document.getElementById("registrationForm");

const usernameInputContainer = document.getElementById(
  "usernameInputContainer",
);
const usernameInput = /** @type {HTMLInputElement} */ (
  document.getElementById("usernameInput")
);
const usernameInputError = document.getElementById("usernameInputError");

const emailInputContainer = document.getElementById("emailInputContainer");
const emailInput = /** @type {HTMLInputElement} */ (
  document.getElementById("emailInput")
);
const emailInputError = document.getElementById("emailInputError");

const passwordInput = /** @type {HTMLInputElement} */ (
  document.getElementById("passwordInput")
);
const passwordInputError = document.getElementById("passwordInputError");
const passwordInputContainer = document.getElementById(
  "passwordInputContainer",
);

const repeatedPasswordInputContainer = document.getElementById(
  "repeatedPasswordInputContainer",
);
const repeatedPasswordInput = /** @type {HTMLInputElement} */ (
  document.getElementById("repeatedPasswordInput")
);
const repeatedPasswordInputError = document.getElementById(
  "repeatedPasswordInputError",
);

const missingData = document.getElementById("missingData");
const registerGeneralError = document.getElementById("registerGeneralError");

const registerButton = document.getElementById("registerButton");

const inputs = document.getElementsByClassName("inputWithIcon");

for (const input of inputs) {
  const inputField = input.getElementsByTagName("input")[0];
  input.addEventListener("click", () => inputField.focus());
}

const showPassword = document.getElementById("showPassword");
const showPasswordRepeat = document.getElementById("showPasswordRepeat");

showPassword.addEventListener("click", () => {
  const icon = showPassword.getElementsByTagName("svg")[0];
  icon.classList.toggle("fa-eye-slash");
  icon.classList.toggle("fa-eye");
  passwordInput.type = passwordInput.type === "password" ? "text" : "password";
});

showPasswordRepeat.addEventListener("click", () => {
  const icon = showPasswordRepeat.getElementsByTagName("svg")[0];
  icon.classList.toggle("fa-eye-slash");
  icon.classList.toggle("fa-eye");
  repeatedPasswordInput.type =
    repeatedPasswordInput.type === "password" ? "text" : "password";
});

function setReadonly(blockInput) {
  const inputsList = [
    usernameInput,
    emailInput,
    passwordInput,
    repeatedPasswordInput,
  ];

  inputsList.forEach((input) => {
    input.readOnly = blockInput;
  });
}

function addErrors(errors) {
  errors = errors || {};

  console.log({ errors });

  if (errors.username) {
    usernameInputError.hidden = false;
    usernameInputError.innerHTML = errors.username.msg;
    usernameInputContainer.classList.add("error");
  }

  if (errors.email) {
    emailInputError.hidden = false;
    emailInputError.innerHTML = errors.email.msg;
    emailInputContainer.classList.add("error");
  }

  if (errors.password) {
    passwordInputError.hidden = false;
    passwordInputError.innerHTML = errors.password.msg;
    passwordInputContainer.classList.add("error");
  }

  if (errors.repeatedPassword) {
    repeatedPasswordInputError.hidden = false;
    repeatedPasswordInputError.innerHTML = errors.repeatedPassword.msg;
    repeatedPasswordInputContainer.classList.add("error");
  }

  if (errors.missingData) {
    missingData.hidden = false;
  }

  const knownKeys = [
    "username",
    "email",
    "password",
    "repeatedPassword",
    "missingData",
  ];
  const hasKnownError = knownKeys.some((key) => errors[key]);

  if (errors.general || !hasKnownError) {
    registerGeneralError.hidden = false;
    registerGeneralError.innerHTML =
      (errors.general && errors.general.msg) ||
      "Errore interno del server. Riprova più tardi.";
  }
}

function resetErrors() {
  const inputErrors = [
    usernameInputError,
    emailInputError,
    passwordInputError,
    repeatedPasswordInputError,
    registerGeneralError,
  ];

  inputErrors.forEach((error) => {
    error.hidden = true;
  });

  const errorInputs = Array.from(document.getElementsByClassName("error"));
  errorInputs.forEach((input) => {
    input.classList.remove("error");
  });

  missingData.hidden = true;
}

const emailFormatRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function checkAvailability() {
  const username = usernameInput.value.trim();
  const email = emailInput.value.trim().toLowerCase();

  if (username.length < 3 || !emailFormatRegex.test(email)) {
    return;
  }

  try {
    const res = await fetch("/api/user/checkUser", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username, email }),
    });

    if (res.status === 409) {
      const body = await res.json();
      addErrors(body.errors);
    }
  } catch (error) {
    console.log("Availability check failed: ", error);
  }
}

usernameInput.addEventListener("blur", checkAvailability);
emailInput.addEventListener("blur", checkAvailability);

usernameInput.addEventListener("input", () => {
  usernameInputError.hidden = true;
  usernameInputContainer.classList.remove("error");
});

emailInput.addEventListener("input", () => {
  emailInputError.hidden = true;
  emailInputContainer.classList.remove("error");
});

function setLoading(loading) {
  if (loading) {
    registerButton.innerHTML = '<i class="fa-solid fa-spinner"></i>';
  } else {
    registerButton.innerHTML = "Registrati";
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  resetErrors();
  setReadonly(true);
  setLoading(true);

  const username = usernameInput.value.trim();
  const email = emailInput.value.trim();
  const password = passwordInput.value;
  const repeatedPassword = repeatedPasswordInput.value;

  let hasFrontendErrors = false;
  const errors = {};

  if (!username || !email || !password) {
    errors.missingData = { msg: "Compilare l'intero form" };
    hasFrontendErrors = true;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (email && !emailRegex.test(email)) {
    errors.email = { msg: "Formato email non valido" };
    hasFrontendErrors = true;
  }

  if (password && password.length < 8) {
    errors.password = {
      msg: "La password deve essere lunga almeno 8 caratteri",
    };
    hasFrontendErrors = true;
  }

  if (password && repeatedPassword && password !== repeatedPassword) {
    errors.repeatedPassword = { msg: "Le password non coincidono" };
    hasFrontendErrors = true;
  }

  if (hasFrontendErrors) {
    addErrors(errors);
    setReadonly(false);
    setLoading(false);
    return;
  }

  await registerUser(username, email, password);
  setReadonly(false);
  setLoading(false);
});

async function registerUser(username, email, password) {
  try {
    const res = await fetch("/api/user/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username,
        email,
        password,
      }),
    });

    let registrationResponse = null;
    try {
      registrationResponse = await res.json();
    } catch (parseError) {
      registrationResponse = null;
    }

    console.log({ registrationResponse });

    if (!res.ok) {
      addErrors(registrationResponse && registrationResponse.errors);
    } else {
      window.location.replace("lobbies.html");
    }
  } catch (error) {
    console.log("Internal server error: ", error);
    addErrors({
      general: { msg: "Errore di connessione. Riprova più tardi." },
    });
  }
}
