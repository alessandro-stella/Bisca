const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");

const db = require("../db");

// registrazione
router.post("/register", async (req, res) => {
  const { username, email, password } = req.body;

  try {
    const passwordHash = await bcrypt.hash(password, 10);

    const result = await db.query(
      `
            INSERT INTO users(username, email, password_hash)
            VALUES ($1, $2, $3)
            RETURNING id, username, email, created_at
            `,
      [username, email, passwordHash],
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Registration failed",
    });
  }
});

module.exports = router;
