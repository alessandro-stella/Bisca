const form = document.getElementById("loginForm");

const emailInput = document.getElementById("emailInput");
const passwordInput = document.getElementById("passwordInput");
const loginError = document.getElementById("loginError");

function setReadonly(blockInput) {
  const inputs = [emailInput, passwordInput];

  inputs.forEach((input) => {
    input.readOnly = blockInput;
  });
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  console.log("Trying to login...");
  setReadonly(true);
  loginError.style.display = "none";

  const email = emailInput.value.trim();
  const password = passwordInput.value;

  try {
    console.log("Entering try");
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
    console.log("After fetch");

    const loginResponse = await res.json();
    console.log("Login response: ", loginResponse);

    if (!res.ok) {
      loginError.style.display = "block";
    } else {
      console.log(loginResponse);

      // TODO: add way to save user data
      // window.location.replace("index.html");
    }
  } catch (e) {
    console.log("Internal server error");
    console.log(e);
  }

  setReadonly(false);
});
