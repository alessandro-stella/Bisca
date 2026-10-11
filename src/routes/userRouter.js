const express = require("express");
const router = express.Router();
const db = require("../db");
const { getUserFromSession } = require("./sessionRouter");
const { isProfane } = require("../profanityFilter");
const { USERNAME_REGEX } = require("../validation");
const { getLobbyByPlayer } = require("../game/lobbyManager");
const { getGame } = require("../game/gameManager");

// Error code from PostgreSQL
const UNIQUE_CONSTRAINT = "23505";

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

    if (!USERNAME_REGEX.test(newUsername)) {
      return res.status(400).json({ error: "Lo username può contenere solo lettere, numeri, _ . -" });
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

    const lobby = getLobbyByPlayer(user.id);

    if (lobby) {
      lobby.players.get(user.id).username = newUsername;
      if (lobby.ownerId === user.id) lobby.ownerUsername = newUsername;

      const game = getGame(lobby.id);
      if (game?.players.has(user.id)) game.players.get(user.id).username = newUsername;
    }

    const io = req.app.get("io");
    for (const s of io.sockets.sockets.values()) {
      if (s.user?.id === user.id) s.user.username = newUsername;
    }

    return res.status(200).json({
      message: "Profile updated successfully",
      username: newUsername,
    });
  } catch (error) {
    if (error.code === UNIQUE_CONSTRAINT) {
      return res.status(409).json({ error: "Username già in uso" });
    }

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
      WITH ranked_users AS (
        SELECT
          u.id,
          u.username,
          u.elo,
          u.created_at,
          RANK() OVER (
            ORDER BY u.elo DESC, 
                     COUNT(eh.game_id) DESC, 
                     u.created_at ASC
          )::int AS placement
        FROM users u
        LEFT JOIN elo_history eh ON u.id = eh.user_id AND eh.new_elo IS NOT NULL
        WHERE u.email_verified = TRUE
        GROUP BY u.id, u.username, u.elo, u.created_at
      )
      SELECT id, username, elo, placement
      FROM ranked_users
      WHERE id = $1;
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
        eh.placement,
        eh.left_early,
        eh.old_elo,
        eh.elo_change,
        eh.new_elo,
        g.player_count - 1 AS opponents_count
      FROM elo_history eh
      JOIN games g ON g.id = eh.game_id
      WHERE eh.user_id = $1 AND eh.new_elo IS NOT NULL
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
        eh.placement,
        eh.elo_change,
        eh.new_elo
      FROM elo_history eh
      JOIN users u ON u.id = eh.user_id
      WHERE eh.game_id = $1
      ORDER BY eh.placement ASC;
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

router.get("/leaderboard/global", async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();

    const query = `
      WITH ranked AS (
        SELECT
          u.id, u.username, u.elo, u.created_at,
          COUNT(eh.game_id)::int AS total_games,
          RANK() OVER (
            ORDER BY u.elo DESC, COUNT(eh.game_id) DESC, u.created_at ASC
          )::int AS placement
        FROM users u
        LEFT JOIN elo_history eh ON eh.user_id = u.id AND eh.new_elo IS NOT NULL
        WHERE u.email_verified = TRUE
        GROUP BY u.id, u.username, u.elo, u.created_at
      )
      SELECT * FROM ranked
      WHERE $1 = '' OR username ILIKE '%' || $1 || '%'
      ORDER BY placement ASC, created_at ASC
      LIMIT 100
    `;

    const result = await db.query(query, [q]);

    return res.status(200).json(result.rows);
  } catch (error) {
    console.error("Error fetching leaderboard:", error);

    return res.status(500).json({
      error: "Internal server error",
    });
  }
});

module.exports = router;