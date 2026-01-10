// api/database/database.js
const { Pool } = require("pg");

const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,

  ssl: process.env.DB_SSL === "true"
    ? { rejectUnauthorized: false }
    : false,

  max: 10,                    // max connections
  idleTimeoutMillis: 30000,   // close idle clients after 30s
  connectionTimeoutMillis: 5000, // fail fast if DB unreachable

  options: "-c search_path=public"
});

/* ---- Connection sanity check ---- */
(async () => {
  try {
    const client = await pool.connect();
    console.log("PostgreSQL connected successfully");
    client.release();
  } catch (err) {
    console.error("PostgreSQL connection failed:", err.message);
    process.exit(1); // crash fast (important in containers)
  }
})();

/* ---- Global pool error handler ---- */
pool.on("error", (err) => {
  console.error("❌ Unexpected PostgreSQL error", err);
  process.exit(1);
});

module.exports = pool;
