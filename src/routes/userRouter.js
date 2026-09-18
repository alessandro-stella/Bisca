const express = require("express");
const router = express.Router();
const db = require("../db");

// Utility function
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

// Fetch user games
router.get("/:userId/games", async (req, res) => {
  const { userId } = req.params;

  if (!userId) {
    return res.status(400).json({
      error: "Missing userId parameter",
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

module.exports = router;
