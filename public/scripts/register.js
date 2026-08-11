const form = document.getElementById("registrationForm");

const usernameInput = document.getElementById("usernameInput");
const usernameInputError = document.getElementById("usernameInputError");

const emailInput = document.getElementById("emailInput");
const emailInputError = document.getElementById("emailInputError");

const passwordInput = document.getElementById("passwordInput");

const repeatedPasswordInput = document.getElementById("repeatedPasswordInput");
const repeatedPasswordInputError = document.getElementById(
  "repeatedPasswordInputError",
);

function setReadonly(blockInput) {
  const inputs = [
    usernameInput,
    emailInput,
    passwordInput,
    repeatedPasswordInput,
  ];

  inputs.forEach((input) => {
    input.readOnly = blockInput;
  });
}

function addErrors(errors) {
  if (errors.username) {
    usernameInputError.style.display = "block";
  }

  if (errors.email) {
    emailInputError.style.display = "block";
  }
}

function resetErrors() {
  const inputErrors = [
    usernameInputError,
    emailInputError,
    repeatedPasswordInputError,
  ];

  inputErrors.forEach((error) => {
    error.style.display = "none";
  });
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  resetErrors();

  setReadonly(true);

  const username = usernameInput.value.trim();
  const email = emailInput.value.trim();
  const password = passwordInput.value;
  const repeatedPassword = repeatedPasswordInput.value;

  if (password !== repeatedPassword) {
    repeatedPasswordInputError.style.display = "block";
    setReadonly(false);
    return;
  } else {
    repeatedPasswordInputError.style.display = "none";
  }

  try {
    const res = await fetch("/api/user/checkUser", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username,
        email,
      }),
    });

    if (!res.ok) {
      const checkExistingUser = await res.json();
      addErrors(checkExistingUser.errors);
    } else {
      await registerUser(username, email, password);
    }
  } catch (error) {
    console.log("Internal server error: ", error);
  }

  setReadonly(false);
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

    const registrationResponse = await res.json();
    console.log({ registrationResponse });

    if (!res.ok) {
      addErrors(registrationResponse.errors);
    } else {
      window.location.replace("lobbies.html");
    }
  } catch (error) {
    console.log("Internal server error: ", error);
  }
}
