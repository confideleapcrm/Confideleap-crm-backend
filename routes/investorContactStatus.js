// routes/investorContactStatus.js
const express = require("express");
const router = express.Router();
const db = require("../database/database");

/* --------------------------------------------------------
   POST record status
   Body: { investor_id, status, notes, created_by (optional) }
--------------------------------------------------------- */
router.post("/", async (req, res) => {
  const { investor_id, status, notes } = req.body;

  // resolve user preference: authenticated user > body.created_by > null
  const user =
    (req.user && req.user.id)
      ? req.user.id
      : (req.body && req.body.created_by)
        ? req.body.created_by
        : null;

  if (!investor_id || !status) {
    return res.status(400).json({
      error: "investor_id and status required",
    });
  }

  try {
    let fields = ["investor_id", "status", "notes", "created_at"];
    let values = [investor_id, status, notes || null, new Date()];
    let placeholders = ["$1", "$2", "$3", "$4"];
    let i = 4;

    // include created_by only if present
    if (user) {
      fields.push("created_by");
      placeholders.push(`$${++i}`);
      values.push(user);
    }

    const result = await db.query(
      `
      INSERT INTO investor_contact_statuses
      (${fields.join(", ")})
      VALUES (${placeholders.join(", ")})
      RETURNING *
      `,
      values
    );

    return res.json(result.rows[0]);
  } catch (err) {
    console.error("investor_contact_status POST error", err);
    return res.status(500).json({ error: "db error" });
  }
});

/* --------------------------------------------------------
   GET latest status
   /api/investor_contact_status/latest?investor_id=123&user=<created_by>
   (scoped to created_by if provided)
--------------------------------------------------------- */
router.get("/latest", async (req, res) => {
  const investor_id = req.query.investor_id;
  const user =
    req.query.user ||
    req.query.created_by ||
    (req.user && req.user.id);

  if (!investor_id) {
    return res.status(400).json({ error: "investor_id required" });
  }

  try {
    let where = ["investor_id = $1"];
    let values = [investor_id];
    let i = 1;

    // scope by created_by if provided
    if (user) {
      where.push(`created_by = $${++i}`);
      values.push(user);
    }

    const result = await db.query(
      `
      SELECT *
      FROM investor_contact_statuses
      WHERE ${where.join(" AND ")}
      ORDER BY created_at DESC
      LIMIT 1
      `,
      values
    );

    return res.json(result.rows[0] || null);
  } catch (err) {
    console.error("investor_contact_status GET latest error", err);
    return res.status(500).json({ error: "db error" });
  }
});

module.exports = router;

