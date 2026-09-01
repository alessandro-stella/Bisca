const form = document.getElementById("loginForm");

const emailInput = document.getElementById("emailInput");
const passwordInput = document.getElementById("passwordInput");
const loginError = document.getElementById("loginError");

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

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  setReadonly(true);
  loginError.style.display = "none";

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

    const loginResponse = await res.json();

    if (!res.ok) {
      loginError.style.display = "block";
    } else {
      // console.log({ loginResponse });
      window.location.replace("lobbies.html");
    }
  } catch (error) {
    console.log("Internal server error: ", error);
  }

  setReadonly(false);
});
