function getStats(user) {
  console.log("Getting user stats...");

  console.log({ user });
}

async function logout() {
  const response = await fetch("/api/session/logout", {
    method: "POST",
    credentials: "include",
  });

  if (response.ok) {
    console.log("Logout successful");
    window.location.replace("login.html");
  } else {
    console.log("Logout error");
  }
}

async function checkSession() {
  const response = await fetch("/api/session/me", {
    method: "GET",
    credentials: "include",
  });

  if (response.ok) {
    console.log("Session OK");
    const { user } = await response.json();

    getStats(user);
  } else {
    console.log("No session or expired");
    window.location.replace("/login.html");
  }
}

checkSession();
