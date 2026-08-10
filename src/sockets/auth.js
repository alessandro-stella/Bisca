const { getUserFromSession } = require("../routes/sessionRouter");

function parseCookies(cookieHeader) {
  const cookies = {};

  if (!cookieHeader) {
    return cookies;
  }

  for (const part of cookieHeader.split(";")) {
    const index = part.indexOf("=");

    if (index === -1) {
      continue;
    }

    const name = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();

    cookies[name] = decodeURIComponent(value);
  }

  return cookies;
}

async function authenticateSocket(socket, next) {
  try {
    const cookies = parseCookies(socket.handshake.headers.cookie);

    const sessionId = cookies.sessionId;

    const user = await getUserFromSession(sessionId);

    if (!user) {
      return next(new Error("Not authenticated"));
    }

    socket.user = user;

    next();
  } catch (error) {
    console.error("Socket authentication error:", error);
    next(new Error("Authentication failed"));
  }
}

module.exports = authenticateSocket;
