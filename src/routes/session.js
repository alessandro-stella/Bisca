const express = require("express");
const router = express.Router();
const { v4: uuidv4 } = require("uuid");

const db = require("../db");

// 1 week in milliseconds
const FUTURE_TIME = 7 * 24 * 60 * 60 * 1000;

async function handleSession(dbClient, userId) {
  const sessionId = uuidv4();

  const expiresAt = new Date(Date.now() + FUTURE_TIME);

  await dbClient.query(
    `
        INSERT INTO sessions (id, user_id, expires_at)
        VALUES ($1, $2, $3)
      `,
    [sessionId, userId, expiresAt],
  );

  return { id: sessionId, expiresAt };
}

// Check validity of session
router.get("/checkSession", async (req, res) => {
  const sessionId = req.cookies?.sessionId;

  if (!sessionId) {
    return res.sendStatus(401);
  }

  try {
    const sessionResult = await db.query(
      `
        SELECT user_id
        FROM sessions
        WHERE id = $1 AND expires_at > NOW()
      `,
      [sessionId],
    );

    // Missing or expired session
    if (sessionResult.rows.length === 0) {
      await db.query(
        `
          DELETE FROM sessions
          WHERE id = $1 AND expires_at <= NOW()
        `,
        [sessionId],
      );

      res.clearCookie("sessionId");

      return res.sendStatus(401);
    }

    const userId = sessionResult.rows[0].user_id;

    // Get session's user
    const userResult = await db.query(
      `
        SELECT id, username, email
        FROM users
        WHERE id = $1
      `,
      [userId],
    );

    // No user associated with the session
    if (userResult.rows.length === 0) {
      await db.query(`DELETE FROM sessions WHERE id = $1`, [sessionId]);

      res.clearCookie("sessionId");

      return res.sendStatus(401);
    }

    const user = userResult.rows[0];

    return res.status(200).json({
      authenticated: true,
      user,
    });
  } catch (e) {
    console.error(e);
    return res.sendStatus(500);
  }
});

module.exports = { router, handleSession };
