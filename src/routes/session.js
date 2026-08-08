const express = require("express");
const router = express.Router();
const { v4: uuidv4 } = require("uuid");

const db = require("../db");

// 1 week in milliseconds
const FUTURE_TIME = 7 * 24 * 60 * 60 * 1000;

async function handleSession(userId, client = db) {
  const sessionId = uuidv4();
  const expiresAt = new Date(Date.now() + FUTURE_TIME);

  await client.query(
    `
      INSERT INTO sessions (id, user_id, expires_at)
      VALUES ($1, $2, $3)
    `,
    [sessionId, userId, expiresAt],
  );

  return {
    id: sessionId,
    expiresAt,
  };
}

async function getUserFromSession(sessionId, client = db) {
  if (!sessionId) {
    return null;
  }

  const sessionResult = await client.query(
    `
      SELECT user_id
      FROM sessions
      WHERE id = $1 AND expires_at > NOW()
    `,
    [sessionId],
  );

  if (sessionResult.rows.length === 0) {
    return null;
  }

  const userId = sessionResult.rows[0].user_id;

  const userResult = await client.query(
    `
        SELECT id, username, email
        FROM users
        WHERE id = $1
        `,
    [userId],
  );

  if (userResult.rows.length === 0) {
    return null;
  }

  return userResult.rows[0];
}

// Get the currently authenticated user.
router.get("/me", async (req, res) => {
  const sessionId = req.cookies?.sessionId;

  try {
    const user = await getUserFromSession(sessionId);

    if (!user) {
      if (sessionId) {
        await db.query(
          `
            DELETE FROM sessions
            WHERE id = $1
          `,
          [sessionId],
        );
      }

      res.clearCookie("sessionId");

      return res.sendStatus(401);
    }

    return res.status(200).json({
      authenticated: true,
      user,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "Internal server error",
    });
  }
});

// Logout the current user by deleting the current session.
router.post("/logout", async (req, res) => {
  const sessionId = req.cookies?.sessionId;

  if (!sessionId) {
    return res.sendStatus(204);
  }

  try {
    await db.query(
      `
        DELETE FROM sessions
        WHERE id = $1
      `,
      [sessionId],
    );

    res.clearCookie("sessionId");

    return res.sendStatus(204);
  } catch (error) {
    console.error("Logout error:", error);

    return res.status(500).json({
      error: "Internal server error",
    });
  }
});

module.exports = {
  router,
  handleSession,
  getUserFromSession,
};
