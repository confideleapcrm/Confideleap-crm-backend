// api/routes/investorList.js
const express = require("express");
const router = express.Router();
const db = require("../database/database");

/* ======================================================
   Helpers
====================================================== */
const mapFrontendToDbList = (list) => {
  if (!list) return list;
  if (list === "followups" || list === "maybe") return "followups";
  if (list === "interested" || list === "shortlist") return "interested";
  if (list === "not_interested" || list === "reject") return "not_interested";
  return list;
};

const mapDbToFrontendList = (list) => {
  if (!list) return list;
  if (list === "followups") return "followups";
  if (list === "interested") return "interested";
  if (list === "not_interested") return "not_interested";
  return list;
};

// resolve user (backend-authenticated)
const resolveUser = (req) => {
  if (req.user && req.user.id) return req.user.id;
  if (req.query.user) return req.query.user;
  if (req.body && req.body.created_by) return req.body.created_by;
  return null;
};

/* Utility: safely parse snapshot (JSON string | object) */
function parseSnapshot(snapshot) {
  if (!snapshot) return {};
  if (typeof snapshot === "string") {
    try {
      return JSON.parse(snapshot);
    } catch {
      return {};
    }
  }
  if (typeof snapshot === "object") return snapshot;
  return {};
}

/* ======================================================
   GET investor lists
====================================================== */
router.get("/", async (req, res) => {
  try {
    const listRaw = req.query.list;
    if (!listRaw) {
      return res.status(400).json({ error: "list param required" });
    }

    const list = mapFrontendToDbList(listRaw);
    const user = resolveUser(req);

    if (!user) {
      return res.status(400).json({ error: "user (created_by) required" });
    }

    const rowsRes = await db.query(
      `
      SELECT
        id,
        investor_id,
        list_type,
        snapshot,
        created_by,
        created_at,
        company_id
      FROM investor_lists
      WHERE list_type = $1
        AND created_by = $2
      ORDER BY created_at DESC
      `,
      [list, user]
    );

    const rows = rowsRes.rows || [];

    /* --------------------------------------------------
       NOT INTERESTED LIST (merge snapshot + investor data)
    --------------------------------------------------- */
    if (list === "not_interested") {
      const items = await Promise.all(
        rows.map(async (row) => {
          let storedSnapshot = parseSnapshot(row.snapshot);

          const note =
            storedSnapshot.notInterestedNote ||
            storedSnapshot.not_interested_note ||
            null;

          storedSnapshot.notInterestedNote = note;

          try {
            const invRes = await db.query(
              `SELECT * FROM investors WHERE id = $1`,
              [row.investor_id]
            );

            if (invRes.rows.length) {
              storedSnapshot = {
                ...invRes.rows[0],
                ...storedSnapshot,
              };
            }
          } catch (e) {
            console.warn("investor fetch error (not_interested GET):", e);
          }

          if (row.company_id && !storedSnapshot.company_id) {
            storedSnapshot.company_id = row.company_id;
          }

          return {
            ...row,
            list_type: mapDbToFrontendList(row.list_type),
            snapshot: storedSnapshot,
          };
        })
      );

      return res.json({ items, total: items.length });
    }

    /* --------------------------------------------------
       FETCH latest status, meeting, followup
    --------------------------------------------------- */
    const statuses = await Promise.all(
      rows.map(async (row) => {
        const r = await db.query(
          `
          SELECT *
          FROM investor_contact_statuses
          WHERE investor_id = $1
            AND created_by = $2
          ORDER BY created_at DESC
          LIMIT 1
          `,
          [row.investor_id, user]
        );
        return r.rows[0] || null;
      })
    );

    const meetings = await Promise.all(
      rows.map(async (row) => {
        const r = await db.query(
          `
          SELECT *
          FROM meetings
          WHERE investor_id = $1
            AND created_by = $2
          ORDER BY created_at DESC
          LIMIT 1
          `,
          [row.investor_id, user]
        );
        return r.rows[0] || null;
      })
    );

    const followups = await Promise.all(
      rows.map(async (row) => {
        const r = await db.query(
          `
          SELECT *
          FROM followups
          WHERE investor_id = $1
            AND created_by = $2
          ORDER BY created_at DESC
          LIMIT 1
          `,
          [row.investor_id, user]
        );
        return r.rows[0] || null;
      })
    );

    const items = rows.map((row, i) => {
      const snap = parseSnapshot(row.snapshot);

      if (!snap.scheduling) snap.scheduling = {};

      if (meetings[i]) {
        snap.scheduling.meet_link =
          meetings[i].meet_link || snap.scheduling.meet_link;
        snap.scheduling.meeting_datetime =
          meetings[i].meeting_datetime ||
          snap.scheduling.meeting_datetime;
        snap.scheduling.meetingType =
          meetings[i].meeting_type || snap.scheduling.meetingType;
      }

      if (followups[i]) {
        snap.scheduling.followup_id = followups[i].id;
        snap.scheduling.followup_datetime =
          followups[i].followup_datetime;
        snap.scheduling.followup_notes = followups[i].notes;
      }

      if (row.company_id && !snap.company_id) {
        snap.company_id = row.company_id;
      } else if (!row.company_id && snap.company?.id) {
        snap.company_id = snap.company.id;
      }

      return {
        ...row,
        list_type: mapDbToFrontendList(row.list_type),
        snapshot: snap,
      };
    });

    return res.json({ items, total: items.length });
  } catch (err) {
    console.error("investor_lists GET exception", err);
    return res.status(500).json({ error: "server error" });
  }
});

/* ======================================================
   POST (UPSERT)
====================================================== */
router.post("/", async (req, res) => {
  try {
    const { investor_id, list_type: rawList, snapshot = {} } = req.body;
    const user = resolveUser(req);
    const list_type = mapFrontendToDbList(rawList);

    if (!investor_id || !list_type) {
      return res
        .status(400)
        .json({ error: "investor_id and list_type required" });
    }

    if (!user) {
      return res.status(400).json({ error: "created_by required" });
    }

    let snapshotSanitized = parseSnapshot(snapshot);

    if (list_type === "not_interested") {
      const note =
        snapshotSanitized.notInterestedNote ||
        snapshotSanitized.not_interested_note ||
        null;

      snapshotSanitized = {
        ...snapshotSanitized,
        notInterestedNote: note,
      };

      try {
        const invRes = await db.query(
          `SELECT * FROM investors WHERE id = $1`,
          [investor_id]
        );
        if (invRes.rows.length) {
          snapshotSanitized = {
            ...invRes.rows[0],
            ...snapshotSanitized,
          };
        }
      } catch (e) {
        console.warn("investor fetch error (not_interested POST):", e);
      }
    }

    let companyId =
      req.body.company_id ||
      snapshotSanitized.company_id ||
      snapshotSanitized.company?.id ||
      null;

    if (companyId === "" || companyId === "null") companyId = null;

    const upsertRes = await db.query(
      `
      INSERT INTO investor_lists (
        investor_id,
        list_type,
        snapshot,
        created_by,
        company_id,
        created_at
      )
      VALUES ($1,$2,$3,$4,$5,NOW())
      ON CONFLICT (investor_id, list_type, created_by)
      DO UPDATE SET
        snapshot = EXCLUDED.snapshot,
        company_id = EXCLUDED.company_id,
        created_at = NOW()
      RETURNING *
      `,
      [
        investor_id,
        list_type,
        snapshotSanitized,
        user,
        companyId,
      ]
    );

    const data = upsertRes.rows[0];

    return res.json({
      ...data,
      list_type: mapDbToFrontendList(data.list_type),
      snapshot: data.snapshot || {},
    });
  } catch (err) {
    console.error("investor_lists POST exception", err);
    return res.status(500).json({ error: "server error" });
  }
});

/* ======================================================
   DELETE
====================================================== */
router.delete("/:id", async (req, res) => {
  try {
    const user = resolveUser(req);
    if (!user) return res.status(400).json({ error: "user required" });

    const id = req.params.id;

    const checkRes = await db.query(
      `
      SELECT id
      FROM investor_lists
      WHERE id = $1 AND created_by = $2
      `,
      [id, user]
    );

    if (!checkRes.rows.length) {
      return res.status(404).json({ error: "not found" });
    }

    await db.query(
      `
      DELETE FROM investor_lists
      WHERE id = $1 AND created_by = $2
      `,
      [id, user]
    );

    return res.json({ deleted: true });
  } catch (err) {
    console.error("investor_lists DELETE error:", err);
    return res.status(500).json({ error: "server error" });
  }
});

module.exports = router;

