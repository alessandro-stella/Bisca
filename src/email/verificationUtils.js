const crypto = require("crypto");
const db = require("../db");

function generateVerificationToken() {
  return crypto.randomBytes(32).toString("hex");
}

async function createEmailVerificationToken(userId, expirationMinutes = 5) {
  const token = generateVerificationToken();
  const expiresAt = new Date(Date.now() + expirationMinutes * 60 * 1000);

  await db.query(
    `
      UPDATE users
      SET 
        email_verification_token = $1,
        email_verification_expires_at = $2
      WHERE id = $3
    `,
    [token, expiresAt, userId],
  );

  return token;
}

async function verifyEmailToken(token) {
  try {
    const result = await db.query(
      `
        SELECT id, username, email
        FROM users
        WHERE email_verification_token = $1
          AND email_verification_expires_at > NOW()
          AND email_verified = FALSE
      `,
      [token],
    );

    if (result.rows.length === 0) {
      return {
        success: false,
        user: null,
        error: "Token non valido, scaduto o account già verificato",
      };
    }

    const user = result.rows[0];

    await db.query(
      `
        UPDATE users
        SET 
          email_verified = TRUE,
          email_verification_token = NULL,
          email_verification_expires_at = NULL
        WHERE id = $1
      `,
      [user.id],
    );

    return {
      success: true,
      user,
      error: null,
    };
  } catch (error) {
    console.error("Error verifying email token:", error);
    return {
      success: false,
      user: null,
      error: "Errore durante la verifica",
    };
  }
}

async function cleanupExpiredUnverifiedAccounts() {
  try {
    const result = await db.query(
      `
        DELETE FROM users
        WHERE email_verified = FALSE
          AND email_verification_expires_at < NOW()
        RETURNING id
      `,
    );

    const deletedCount = result.rows.length;
    if (deletedCount > 0) {
      console.log(`Cleaned up ${deletedCount} unverified accounts`);
    }
    return deletedCount;
  } catch (error) {
    console.error("Error cleaning up expired accounts:", error);
    return 0;
  }
}

async function createPasswordResetToken(email, expirationMinutes = 5) {
  try {
    const token = generateVerificationToken();
    const expiresAt = new Date(Date.now() + expirationMinutes * 60 * 1000);

    const result = await db.query(
      `
        UPDATE users
        SET 
          password_reset_token = $1,
          password_reset_expires_at = $2
        WHERE email = $3
        RETURNING id, username
      `,
      [token, expiresAt, email],
    );

    if (result.rows.length === 0) {
      return {
        success: false,
        token: null,
        username: null,
        error: "Utente non trovato",
      };
    }

    return {
      success: true,
      token,
      username: result.rows[0].username,
      error: null,
    };
  } catch (error) {
    console.error("Error creating password reset token:", error);
    return {
      success: false,
      token: null,
      username: null,
      error: "Errore durante la creazione del token",
    };
  }
}

async function verifyPasswordResetToken(token) {
  try {
    const result = await db.query(
      `
        SELECT id, username, email
        FROM users
        WHERE password_reset_token = $1
          AND password_reset_expires_at > NOW()
      `,
      [token],
    );

    if (result.rows.length === 0) {
      return {
        success: false,
        user: null,
        error: "Token non valido o scaduto",
      };
    }

    const user = result.rows[0];
    return {
      success: true,
      user,
      error: null,
    };
  } catch (error) {
    console.error("Error verifying password reset token:", error);

    return {
      success: false,
      user: null,
      error: "Errore durante la verifica",
    };
  }
}

module.exports = {
  generateVerificationToken,
  createEmailVerificationToken,
  verifyEmailToken,
  cleanupExpiredUnverifiedAccounts,
  createPasswordResetToken,
  verifyPasswordResetToken,
};
