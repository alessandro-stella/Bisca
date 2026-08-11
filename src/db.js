const { Pool } = require("pg");

const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: process.env.NODE_ENV === "production" },

  query_timeout: 10000,

  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,

  max: 20,
});

module.exports = db;
