// routes/reports.js
const express = require("express");
const router = express.Router();
const pool = require("../database/database");
const { authenticateToken } = require("../middleware/auth");

/* =========================================================
   ACTIVITIES
========================================================= */
router.get("/activities", authenticateToken, async (req, res) => {
  try {
    const { entity_type, entity_ids, from_date, to_date, secondary_filters } = req.query;

    if (!entity_type || !entity_ids) {
      return res.status(400).json({ error: "entity_type and entity_ids required" });
    }

    const conditions = [];
    const params = [];

    const addIn = (col, arr) => {
      const placeholders = arr.map(v => {
        params.push(v);
        return `$${params.length}::uuid`;
      });
      conditions.push(`${col} IN (${placeholders.join(",")})`);
    };

    /* PRIMARY */
    if (entity_ids !== "ALL") {
      const ids = Array.isArray(entity_ids) ? entity_ids : [entity_ids];
      if (entity_type === "user") addIn("a.user_id", ids);
      if (entity_type === "investor") addIn("a.investor_id", ids);
      if (entity_type === "company") addIn("a.company_id", ids);
    }

    /* SECONDARY */
    if (secondary_filters) {
      const parsed = JSON.parse(secondary_filters);
      if (parsed.user?.length) addIn("a.user_id", parsed.user);
      if (parsed.investor?.length) addIn("a.investor_id", parsed.investor);
      if (parsed.company?.length) addIn("a.company_id", parsed.company);
    }

    /* DATE */
    if (from_date && to_date) {
      params.push(from_date, to_date);
      conditions.push(`
        a.activity_date >= $${params.length - 1}
        AND a.activity_date < ($${params.length}::date + INTERVAL '1 day')
      `);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const query = `
      SELECT
        a.activity_date,
        a.activity_type,
        CONCAT(u.first_name,' ',u.last_name) AS user_name,
        CONCAT(inv.first_name,' ',inv.last_name) AS investor_name,
        c.name AS company_name
      FROM (
        SELECT
          il.created_at AS activity_date,
          il.created_by::uuid AS user_id,
          il.investor_id::uuid AS investor_id,
          il.company_id::uuid AS company_id,
          il.list_type AS activity_type
        FROM investor_lists il
        WHERE il.list_type <> 'meeting'

        UNION ALL

        SELECT
          COALESCE(m.updated_at, m.created_at),
          m.created_by::uuid,
          m.investor_id::uuid,
          m.company_id::uuid,
          CASE
            WHEN m.meeting_status IN ('completed','done')
              THEN 'meeting_done'
            ELSE 'meeting_scheduled'
          END
        FROM (
          SELECT DISTINCT ON (id) *
          FROM meetings
          ORDER BY id, COALESCE(updated_at, created_at) DESC
        ) m
      ) a
      LEFT JOIN users u ON u.id = a.user_id
      LEFT JOIN investors inv ON inv.id = a.investor_id
      LEFT JOIN companies c ON c.id = a.company_id
      ${whereClause}
      ORDER BY a.activity_date DESC
    `;

    const result = await pool.query(query, params);
    res.json({ activities: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load activities" });
  }
});

/* =========================================================
   ASSOCIATIONS (SINGLE + ALL)
========================================================= */
router.get("/associations", authenticateToken, async (req, res) => {
  const { entity_type, entity_id } = req.query;

  // ALL MODE
  if (entity_id === "ALL") {
    const users = await pool.query(`SELECT id, CONCAT(first_name,' ',last_name) AS label FROM users`);
    const investors = await pool.query(`SELECT id, CONCAT(first_name,' ',last_name) AS label FROM investors`);
    const companies = await pool.query(`SELECT id, name AS label FROM companies`);
    return res.json({ users: users.rows, investors: investors.rows, companies: companies.rows });
  }

  const base = `
    FROM (
      SELECT created_by::uuid AS user_id, investor_id::uuid, company_id::uuid FROM investor_lists
      UNION
      SELECT created_by::uuid, investor_id::uuid, company_id::uuid FROM meetings
    ) a
  `;

  const data = {};

  if (entity_type !== "user") {
    const r = await pool.query(
      `SELECT DISTINCT u.id, CONCAT(u.first_name,' ',u.last_name) AS label
       ${base} JOIN users u ON u.id = a.user_id
       WHERE a.${entity_type}_id = $1::uuid`,
      [entity_id]
    );
    data.users = r.rows;
  }

  if (entity_type !== "investor") {
    const r = await pool.query(
      `SELECT DISTINCT i.id, CONCAT(i.first_name,' ',i.last_name) AS label
       ${base} JOIN investors i ON i.id = a.investor_id
       WHERE a.${entity_type}_id = $1::uuid`,
      [entity_id]
    );
    data.investors = r.rows;
  }

  if (entity_type !== "company") {
    const r = await pool.query(
      `SELECT DISTINCT c.id, c.name AS label
       ${base} JOIN companies c ON c.id = a.company_id
       WHERE a.${entity_type}_id = $1::uuid`,
      [entity_id]
    );
    data.companies = r.rows;
  }

  res.json(data);
});

/* =========================================================
   SEARCH
========================================================= */
router.get("/search/users", authenticateToken, async (req, res) => {
  const { q = "" } = req.query;
  const r = await pool.query(
    `SELECT id, CONCAT(first_name,' ',last_name) AS label
     FROM users WHERE CONCAT(first_name,' ',last_name) ILIKE $1
     ORDER BY label LIMIT 10`,
    [`%${q}%`]
  );
  res.json(r.rows);
});

router.get("/search/investors", authenticateToken, async (req, res) => {
  const { q = "" } = req.query;
  const r = await pool.query(
    `SELECT id, CONCAT(first_name,' ',last_name) AS label
     FROM investors WHERE CONCAT(first_name,' ',last_name) ILIKE $1
     ORDER BY label LIMIT 10`,
    [`%${q}%`]
  );
  res.json(r.rows);
});

router.get("/search/companies", authenticateToken, async (req, res) => {
  const { q = "" } = req.query;
  const r = await pool.query(
    `SELECT id, name AS label
     FROM companies WHERE name ILIKE $1
     ORDER BY label LIMIT 10`,
    [`%${q}%`]
  );
  res.json(r.rows);
});

module.exports = router;





