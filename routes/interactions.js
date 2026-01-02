// api/routes/interactions.js
const express = require("express");
const router = express.Router();
const db = require("../database/database");

/* ======================================================
   Resolve user helper
====================================================== */
const resolveUser = (req) => {
  if (req.user && req.user.id) return req.user.id;
  if (req.query && req.query.user) return req.query.user;
  if (req.body && req.body.created_by) return req.body.created_by;
  return null;
};

/**
 * POST /api/interactions
 * body: {
 *   investor_id,
 *   source: 'meeting' | 'followup' | 'manual',
 *   outcome: 'interested' | 'not_interested' | 'follow_up',
 *   notes,
 *   related_id (optional),
 *   company_id (optional)
 * }
 */
router.post("/", async (req, res) => {
  try {
    const user = resolveUser(req);
    const {
      investor_id,
      source = "manual",
      outcome,
      notes = null,
      related_id = null,
      company_id = null,
    } = req.body;

    if (!investor_id || !outcome) {
      return res
        .status(400)
        .json({ error: "investor_id and outcome required" });
    }

    if (!["interested", "not_interested", "follow_up"].includes(outcome)) {
      return res.status(400).json({ error: "invalid outcome" });
    }

    const result = await db.query(
      `
      INSERT INTO interactions (
        investor_id,
        created_by,
        company_id,
        source,
        outcome,
        notes,
        related_id,
        created_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())
      RETURNING *
      `,
      [
        investor_id,
        user || null,
        company_id,
        source,
        outcome,
        notes,
        related_id,
      ]
    );

    return res.json(result.rows[0]);
  } catch (err) {
    console.error("interactions POST error", err);
    return res.status(500).json({ error: "server error" });
  }
});

/**
 * GET /api/interactions
 * query: { investor_id?, user? }
 */
router.get("/", async (req, res) => {
  try {
    const investor_id = req.query.investor_id;
    const user = resolveUser(req);

    let where = [];
    let values = [];
    let i = 0;

    if (investor_id) {
      where.push(`investor_id = $${++i}`);
      values.push(investor_id);
    }

    if (user) {
      where.push(`created_by = $${++i}`);
      values.push(user);
    }

    const query = `
      SELECT *
      FROM interactions
      ${where.length ? "WHERE " + where.join(" AND ") : ""}
      ORDER BY created_at DESC
    `;

    const result = await db.query(query, values);

    return res.json({ items: result.rows || [] });
  } catch (err) {
    console.error("interactions GET error", err);
    return res.status(500).json({ error: "server error" });
  }
});

module.exports = router;

