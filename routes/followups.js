// api/routes/followups.js
const express = require("express");
const router = express.Router();
const db = require("../database/database");

// =======================
// Resolve user helper
// =======================
const resolveUser = (req) => {
  if (req.user && req.user.id) return req.user.id;
  if (req.query && req.query.user) return req.query.user;
  if (req.body && req.body.created_by) return req.body.created_by;
  return null;
};

// =======================================================
// POST create followup
// body: { investor_id, company_id, followup_datetime, notes }
// =======================================================
router.post("/", async (req, res) => {
  try {
    const user = resolveUser(req);
    const { investor_id, company_id = null, followup_datetime, notes = null } =
      req.body;

    if (!investor_id || !followup_datetime) {
      return res
        .status(400)
        .json({ error: "investor_id and followup_datetime required" });
    }

    const insertResult = await db.query(
      `
      INSERT INTO followups (
        investor_id,
        created_by,
        company_id,
        followup_datetime,
        notes,
        status,
        created_at
      )
      VALUES ($1, $2, $3, $4, $5, 'scheduled', NOW())
      RETURNING *
      `,
      [
        investor_id,
        user || null,
        company_id,
        new Date(followup_datetime),
        notes,
      ]
    );

    const followup = insertResult.rows[0];

    // ===================================================
    // Create interaction (best-effort, same as Supabase)
    // ===================================================
    try {
      if (followup && followup.id) {
        const interactionResult = await db.query(
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
          VALUES ($1, $2, $3, 'followup', 'follow_up', $4, $5, NOW())
          RETURNING *
          `,
          [
            followup.investor_id,
            followup.created_by || user || null,
            followup.company_id || null,
            followup.notes,
            followup.id,
          ]
        );

        return res.json({
          ...followup,
          interaction: interactionResult.rows[0] || null,
        });
      }
    } catch (ixErr) {
      console.warn(
        "interaction create attempt failed (followups route):",
        ixErr
      );
    }

    return res.json(followup);
  } catch (err) {
    console.error("followups POST error", err);
    return res.status(500).json({ error: "server error" });
  }
});

// =======================================================
// GET followups
// ?investor_id=&user=
// =======================================================
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
      FROM followups
      ${where.length ? "WHERE " + where.join(" AND ") : ""}
      ORDER BY created_at DESC
    `;

    const result = await db.query(query, values);

    return res.json({ items: result.rows || [] });
  } catch (err) {
    console.error("followups GET error", err);
    return res.status(500).json({ error: "server error" });
  }
});

// =======================================================
// PUT update followup
// =======================================================
router.put("/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const updateBody = req.body || {};

    const allowed = ["status", "followup_datetime", "notes"];
    const fields = [];
    const values = [];
    let i = 0;

    allowed.forEach((key) => {
      if (updateBody[key] !== undefined) {
        i++;
        fields.push(
          `${key} = $${i}`
        );
        values.push(
          key === "followup_datetime"
            ? new Date(updateBody[key])
            : updateBody[key]
        );
      }
    });

    if (!fields.length) {
      return res
        .status(400)
        .json({ error: "no updatable fields provided" });
    }

    const result = await db.query(
      `
      UPDATE followups
      SET ${fields.join(", ")}
      WHERE id = $${i + 1}
      RETURNING *
      `,
      [...values, id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: "followup not found" });
    }

    return res.json(result.rows[0]);
  } catch (err) {
    console.error("followups PUT error", err);
    return res.status(500).json({ error: "server error" });
  }
});

// =======================================================
// DELETE followup
// =======================================================
router.delete("/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const user = resolveUser(req);

    const fetchResult = await db.query(
      `
      SELECT id, created_by
      FROM followups
      WHERE id = $1
      `,
      [id]
    );

    if (!fetchResult.rows.length) {
      return res.status(404).json({ error: "followup not found" });
    }

    const row = fetchResult.rows[0];

    if (row.created_by && user && row.created_by !== user) {
      return res.status(403).json({ error: "forbidden" });
    }

    await db.query(`DELETE FROM followups WHERE id = $1`, [id]);

    return res.json({ deleted: true });
  } catch (err) {
    console.error("followups DELETE error", err);
    return res.status(500).json({ error: "server error" });
  }
});

module.exports = router;
