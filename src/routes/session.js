const express = require("express");
const router = express.Router();
const { v4: uuidv4 } = require("uuid");

const db = require("../db");

// 1 week in milliseconds
const FUTURE_TIME = 7 * 24 * 60 * 60 * 1000;

async function handleSession(userId) {
  const sessionId = uuidv4();

  const expiresAt = new Date(Date.now() + FUTURE_TIME);

  try {
    await db.query(
      `
        INSERT INTO sessions (id, user_id, expires_at)
        VALUES ($1, $2, $3)
      `,
      [sessionId, userId, expiresAt],
    );
    return { id: sessionId, expiresAt };
  } catch (e) {
    console.log("Session creation error: ", e);
    return null;
  }
}

// Check validity of session
router.get("/checkSession", async (req, res) => {
  const sessionId = req.cookies?.sessionId;

  if (!sessionId) {
    return res.sendStatus(401);
  }

  try {
    const result = await db.query(
      `
        SELECT user_id
        FROM sessions
        WHERE id = $1 AND expires_at > NOW()
      `,
      [sessionId],
    );

    if (result.rows.length === 0) {
      return res.sendStatus(401);
    }

    const userId = result.rows[0].user_id;

    res.status(200).json({
      authenticated: true,
      userId,
    });
  } catch (e) {
    console.error(e);
    res.sendStatus(500);
  }
});

module.exports = { router, handleSession };
