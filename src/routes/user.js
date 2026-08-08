const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const { handleSession } = require("./session");

const db = require("../db");

// Error code from PostgreSQL
const UNIQUE_CONSTRAINT = "23505";

// Utility for registration (check existing credentials)
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

// Registration handler
router.post("/register", async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({
      error: "Missing fields",
    });
  }

  const dbClient = await db.connect();

  try {
    await dbClient.query("BEGIN");
    const passwordHash = await bcrypt.hash(password, 10);

    const result = await dbClient.query(
      `
        INSERT INTO users(username, email, password_hash)
        VALUES ($1, $2, $3)
        RETURNING id, username, email, created_at
      `,
      [username, email, passwordHash],
    );

    const user = result.rows[0];
    const session = await handleSession(dbClient, user.id);

    if (!session) {
      throw new Error("Couldn't create session");
    }

    await dbClient.query("COMMIT");

    res.cookie("sessionId", session.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      expires: session.expiresAt,
    });

    return res.status(201).json({
      authenticated: true,
      user,
    });
  } catch (error) {
    try {
      await dbClient.query("ROLLBACK");
    } catch (rollbackError) {
      console.error("Rollback error:", rollbackError);
    }

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

    console.error("Registration error: ", error);

    res.status(500).json({
      error: "Internal server error",
    });
  } finally {
    dbClient.release();
  }
});

// Login handler
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
        SELECT id, username, email, password_hash
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

    const session = await handleSession(user.id);

    if (!session) {
      throw new Error("Couldn't create session");
    }

    res.cookie("sessionId", session.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      expires: session.expiresAt,
    });

    return res.status(200).json({
      authenticated: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
      },
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Internal server error",
    });
  }
});

module.exports = router;
