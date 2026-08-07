const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");

const db = require("../db");

// Error codes from PostgreSQL
const UNIQUE_CONSTRAINT = "23505";

router.post("/checkUser", async (req, res) => {
  const { username, email } = req.body;

  if (!username || !email) {
    return res.status(400).json({
      error: "Missing fields",
    });
  }

  try {
    const result = await db.query(
      `
        SELECT
          EXISTS(
            SELECT 1
            FROM users
            WHERE username = $1
          ) AS username_exists,
          EXISTS(
            SELECT 1
            FROM users
            WHERE email = $2
          ) AS email_exists;
      `,
      [username, email],
    );

    const { username_exists, email_exists } = result.rows[0];

    if (username_exists || email_exists) {
      return res.status(409).json({
        errors: {
          username: username_exists,
          email: email_exists,
        },
      });
    }

    return res.sendStatus(200);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Internal server error",
    });
  }
});

router.post("/register", async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({
      error: "Missing fields",
    });
  }

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
    if (error.code === UNIQUE_CONSTRAINT) {
      if (error.constraint === "users_username_key") {
        return res.status(409).json({
          errors: {
            username: true,
            email: false,
          },
        });
      }

      if (error.constraint === "users_email_key") {
        return res.status(409).json({
          errors: {
            username: false,
            email: true,
          },
        });
      }
    }

    console.error(error);

    res.status(500).json({
      error: "Internal server error",
    });
  }
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      error: "Missing fields",
    });
  }

  try {
    const result = await db.query(
      `
        SELECT *
        FROM users
        WHERE email=$1
      `,
      [email],
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        error: "Invalid email or password",
      });
    }
    const user = result.rows[0];

    const passwordCorrect = await bcrypt.compare(password, user.password_hash);

    if (!passwordCorrect) {
      return res.status(401).json({
        error: "Invalid email or password",
      });
    }

    res.json({
      id: user.id,
      username: user.username,
      email: user.email,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Internal server error",
    });
  }
});

module.exports = router;
