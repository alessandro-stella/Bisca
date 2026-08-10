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
