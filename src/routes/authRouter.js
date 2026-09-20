const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const { handleSession } = require("./sessionRouter");
const { sendEmail } = require("../email/mailService");
const {
  generateVerificationToken,
  verifyEmailToken,
  cleanupExpiredUnverifiedAccounts,
  createPasswordResetToken,
  verifyPasswordResetToken,
} = require("../email/verificationUtils");

const db = require("../db");

// Error code from PostgreSQL
const UNIQUE_CONSTRAINT = "23505";

setInterval(
  () => {
    cleanupExpiredUnverifiedAccounts();
  },
  1 * 60 * 1000,
);

// Utility for registration (check existing credentials)
router.post("/checkUser", async (req, res) => {
  const username = req.body.username?.trim();
  const email = req.body.email?.trim().toLowerCase();

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
          ...(username_exists && { username: { msg: "Username già in uso" } }),
          ...(email_exists && { email: { msg: "Email già in uso" } }),
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
  const username = req.body.username?.trim();
  const email = req.body.email?.trim().toLowerCase();
  const password = req.body.password;

  if (!username || !email || !password) {
    return res
      .status(400)
      .json({ errors: { missingData: { msg: "Compilare l'intero form" } } });
  }

  if (username.length < 3 || username.length > 30) {
    return res.status(400).json({
      errors: {
        username: { msg: "Lo username deve essere lungo tra 3 e 30 caratteri" },
      },
    });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res
      .status(400)
      .json({ errors: { email: { msg: "Formato email non valido" } } });
  }

  if (password.length < 8) {
    return res.status(400).json({
      errors: {
        password: { msg: "La password deve essere lunga almeno 8 caratteri" },
      },
    });
  }

  const dbClient = await db.connect();

  try {
    await dbClient.query("BEGIN");
    const passwordHash = await bcrypt.hash(password, 10);
    const verificationToken = generateVerificationToken();

    const result = await dbClient.query(
      `
        INSERT INTO users(username, email, password_hash, email_verification_token, email_verification_expires_at)
        VALUES ($1, $2, $3, $4, NOW() + INTERVAL '5 minutes')
        RETURNING id, username, email, created_at
      `,
      [username, email, passwordHash, verificationToken],
    );

    const user = result.rows[0];

    await dbClient.query("COMMIT");

    const verificationLink = `${process.env.CLIENT_URL}/verify-email.html?token=${verificationToken}`;
    sendEmail(user.email, "Verifica il tuo account BISCA", "verify_email", {
      username: user.username,
      verificationLink,
      expirationMinutes: 5,
    }).catch((error) => {
      console.error("Failed to send verification email:", error);
    });

    return res.status(201).json({
      message:
        "Account creato! Hai 5 minuti per verificare l'account cliccando sul link che ti abbiamo inviato. Se non vedi l'email, controlla la cartella Spam.",
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
      },
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
            username: { msg: "Username già in uso" },
          },
        });
      }

      if (error.constraint === "users_email_key") {
        return res.status(409).json({
          errors: {
            email: { msg: "Email già in uso" },
          },
        });
      }
    }

    console.error("Registration error: ", error);

    res.status(500).json({
      errors: {
        general: { msg: "Errore interno del server. Riprova più tardi." },
      },
    });
  } finally {
    dbClient.release();
  }
});

// Email verification endpoint
router.post("/verify-email", async (req, res) => {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({
      error: "Token mancante",
    });
  }

  const verificationResult = await verifyEmailToken(token);

  if (!verificationResult.success) {
    return res.status(400).json({
      error: verificationResult.error,
    });
  }

  const user = verificationResult.user;

  try {
    const session = await handleSession(user.id);

    res.cookie("sessionId", session.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      expires: session.expiresAt,
    });

    sendEmail(user.email, "Benvenuto su BISCA!", "welcome", {
      username: user.username,
    }).catch((error) => {
      console.error("Failed to send welcome email:", error);
    });

    return res.status(200).json({
      authenticated: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
      },
      message: "Email verificata! Sei stato autenticato.",
    });
  } catch (error) {
    console.error("Error during email verification:", error);
    res.status(500).json({
      error: "Errore durante la verifica. Riprova più tardi.",
    });
  }
});

// Login handler
router.post("/login", async (req, res) => {
  const email = req.body.email?.trim().toLowerCase();
  const password = req.body.password;

  if (!email || !password) {
    return res.status(400).json({
      error: "Missing fields",
    });
  }

  try {
    const result = await db.query(
      `
        SELECT id, username, email, password_hash, email_verified
        FROM users
        WHERE email=$1
      `,
      [email],
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        error: "Email o password non valida",
      });
    }

    const user = result.rows[0];

    if (!user.email_verified) {
      return res.status(403).json({
        error: "Verifica il tuo account tramite il link ricevuto via email",
      });
    }

    const passwordCorrect = await bcrypt.compare(password, user.password_hash);

    if (!passwordCorrect) {
      return res.status(401).json({
        error: "Email o password non valida",
      });
    }

    const session = await handleSession(user.id);

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

// Forgot password handler
router.post("/forgot-password", async (req, res) => {
  const email = req.body.email?.trim().toLowerCase();

  if (!email) {
    return res.status(400).json({
      error: "Email richiesta",
    });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({
      error: "Formato email non valido",
    });
  }

  try {
    const tokenResult = await createPasswordResetToken(email, 5);

    if (!tokenResult.success) {
      return res.status(200).json({
        success: true,
        message: "Se l'email è registrata, riceverai un link di reset",
      });
    }

    const baseUrl = process.env.CLIENT_URL;
    const resetLink = `${baseUrl}/reset-password.html?token=${tokenResult.token}`;

    sendEmail(email, "Reset Password BISCA", "reset_password", {
      username: tokenResult.username,
      resetLink,
      expirationMinutes: 5,
    }).catch((error) => {
      console.error("Failed to send reset email:", error);
    });

    return res.status(200).json({
      success: true,
      message: "Se l'email è registrata, riceverai un link di reset",
    });
  } catch (error) {
    console.error("Forgot password error:", error);

    return res.status(500).json({
      error: "Errore durante la richiesta. Riprova più tardi.",
    });
  }
});

// Verify password reset token
router.post("/verify-password-reset-token", async (req, res) => {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({
      success: false,
      error: "Token mancante",
    });
  }

  const verificationResult = await verifyPasswordResetToken(token);

  if (!verificationResult.success) {
    return res.status(400).json({
      success: false,
      error: verificationResult.error,
    });
  }

  return res.status(200).json({
    success: true,
    user: {
      id: verificationResult.user.id,
      username: verificationResult.user.username,
      email: verificationResult.user.email,
    },
  });
});

// Reset password handler
router.post("/reset-password", async (req, res) => {
  const { token, password } = req.body;

  if (!token || !password) {
    return res.status(400).json({
      success: false,
      error: "Token e password richiesti",
    });
  }

  if (password.length < 8) {
    return res.status(400).json({
      success: false,
      error: "La password deve essere lunga almeno 8 caratteri",
    });
  }

  try {
    // Verifica il token
    const verificationResult = await verifyPasswordResetToken(token);

    if (!verificationResult.success) {
      return res.status(400).json({
        success: false,
        error: verificationResult.error,
      });
    }

    const user = verificationResult.user;
    const passwordHash = await bcrypt.hash(password, 10);

    // Aggiorna la password e cancella i token di reset
    await db.query(
      `
        UPDATE users
        SET 
          password_hash = $1,
          password_reset_token = NULL,
          password_reset_expires_at = NULL
        WHERE id = $2
      `,
      [passwordHash, user.id],
    );

    return res.status(200).json({
      success: true,
      message: "Password aggiornata con successo",
    });
  } catch (error) {
    console.error("Reset password error:", error);

    res.status(500).json({
      success: false,
      error: "Errore durante il reset della password. Riprova più tardi.",
    });
  }
});

module.exports = router;
