require("dotenv").config();

const db = require("./db");

async function init() {
  await db.query(`
    CREATE EXTENSION IF NOT EXISTS "pgcrypto";

    DROP TABLE IF EXISTS users CASCADE;

    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      username VARCHAR(30) UNIQUE NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  console.log("Database initialized");

  process.exit();
}

init();
