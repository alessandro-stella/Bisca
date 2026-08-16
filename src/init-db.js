require("dotenv").config();

const db = require("./db");

async function init() {
  await db.query(`
    CREATE EXTENSION IF NOT EXISTS "pgcrypto";

    DROP TABLE IF EXISTS users CASCADE;
    DROP TABLE IF EXISTS sessions CASCADE;
    DROP TABLE IF EXISTS games CASCADE;
    DROP TABLE IF EXISTS game_players CASCADE;
    DROP TABLE IF EXISTS elo_history CASCADE;

    CREATE TABLE users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      username VARCHAR(30) UNIQUE NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      elo INT NOT NULL DEFAULT 1000,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE sessions (
      id UUID PRIMARY KEY,
      user_id UUID NOT NULL,
      expires_at TIMESTAMP NOT NULL,

      FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
    );

    CREATE TABLE games (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      winner_id UUID REFERENCES users(id) ON DELETE SET NULL,
      player_count INT NOT NULL, 
      duration INT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE game_players (
      game_id UUID REFERENCES games(id) ON DELETE CASCADE,
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      position INT NOT NULL,
      left_early BOOLEAN DEFAULT FALSE,

      PRIMARY KEY (game_id, user_id)
    );

    CREATE TABLE elo_history (
      game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

      old_elo INTEGER NOT NULL,
      elo_change INTEGER NOT NULL,
      new_elo INTEGER NOT NULL,
      position INTEGER NOT NULL,

      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

      PRIMARY KEY (game_id, user_id)
    );
  `);

  console.log("Database initialized");

  process.exit();
}

init();
