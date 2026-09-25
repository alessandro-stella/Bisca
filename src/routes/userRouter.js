const express = require("express");
const router = express.Router();
const db = require("../db");
const { getUserFromSession } = require("./sessionRouter");
const { isProfane } = require("../profanityFilter");

async function checkIfUserExists(userId) {
  const result = await db.query(
    `
      SELECT EXISTS (
        SELECT 1 FROM users WHERE id = $1
      );
    `,
    [userId],
  );

  return result.rows[0].exists;
}

router.put("/update", async (req, res) => {
  const sessionId = req.cookies?.sessionId;

  try {
    const user = await getUserFromSession(sessionId, db, true);
    if (!user) {
      return res.status(401).json({ error: "Non autorizzato" });
    }

    const newUsername = req.body.username?.trim();

    if (!newUsername) {
      return res.status(400).json({ error: "Username richiesto" });
    }

    if (/\s/.test(newUsername)) {
      return res
        .status(400)
        .json({ error: "Lo username non può contenere spazi" });
    }

    if (newUsername.length < 3 || newUsername.length > 30) {
      return res
        .status(400)
        .json({ error: "Lo username deve essere tra 3 e 30 caratteri" });
    }

    if (isProfane(newUsername)) {
      return res
        .status(400)
        .json({ error: "Termini non appropriati rilevati" });
    }

    const checkResult = await db.query(
      "SELECT 1 FROM users WHERE username = $1 AND id != $2",
      [newUsername, user.id],
    );

    if (checkResult.rows.length > 0) {
      return res.status(409).json({ error: "Username già in uso" });
    }

    await db.query("UPDATE users SET username = $1 WHERE id = $2", [
      newUsername,
      user.id,
    ]);

    return res.status(200).json({
      message: "Profile updated successfully",
      username: newUsername,
    });
  } catch (error) {
    console.error("Error during profile update:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:userId", async (req, res) => {
  const { userId } = req.params;

  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  if (!userId || !uuidRegex.test(userId)) {
    return res.status(400).json({ error: "Invalid user ID format" });
  }

  try {
    const query = `
      SELECT id, username, elo
      FROM users
      WHERE id = $1
    `;
    const result = await db.query(query, [userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error("Error fetching user profile:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:userId/games", async (req, res) => {
  const { userId } = req.params;

  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  if (!userId || !uuidRegex.test(userId)) {
    return res.status(400).json({
      error: "Invalid user ID format",
    });
  }

  try {
    const userExists = await checkIfUserExists(userId);

    if (!userExists) {
      return res.status(404).json({
        error: "User not found",
      });
    }

    const query = `
      SELECT
        g.id,
        g.duration,
        g.created_at,
        gp.placement,
        gp.left_early,
        eh.old_elo,
        eh.elo_change,
        eh.new_elo,
        g.player_count - 1 AS opponents_count
      FROM game_players gp
      JOIN games g ON g.id = gp.game_id
      LEFT JOIN elo_history eh
        ON eh.game_id = gp.game_id
       AND eh.user_id = gp.user_id
      WHERE gp.user_id = $1
      ORDER BY g.created_at DESC;
    `;

    const result = await db.query(query, [userId]);

    return res.status(200).json(result.rows);
  } catch (error) {
    console.error("Error fetching user games:", error);

    return res.status(500).json({
      error: "Internal server error",
    });
  }
});

router.get("/game/:gameId/players", async (req, res) => {
  const { gameId } = req.params;

  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  if (!gameId || !uuidRegex.test(gameId)) {
    return res.status(400).json({
      error: "Invalid game ID format",
    });
  }

  try {
    const gameExists = await db.query(`SELECT 1 FROM games WHERE id = $1`, [
      gameId,
    ]);

    if (gameExists.rows.length === 0) {
      return res.status(404).json({
        error: "Game not found",
      });
    }

    const query = `
      SELECT
        u.id,
        u.username,
        gp.placement,
        eh.elo_change,
        eh.new_elo
      FROM game_players gp
      JOIN users u ON u.id = gp.user_id
      LEFT JOIN elo_history eh 
        ON eh.game_id = gp.game_id 
        AND eh.user_id = gp.user_id
      WHERE gp.game_id = $1
      ORDER BY gp.placement ASC;
    `;

    const result = await db.query(query, [gameId]);

    return res.status(200).json(result.rows);
  } catch (error) {
    console.error("Error fetching game players:", error);

    return res.status(500).json({
      error: "Internal server error",
    });
  }
});

module.exports = router;
