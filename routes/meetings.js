// api/routes/meetings.js  (PostgreSQL / Express)
const express = require("express");
const router = express.Router();
const { createCalendarEventWithMeet } = require("../services/googleCalendarService");

// PostgreSQL db (pg Pool)
const db = require("../database/database");

/* ======================================================
   Helper functions
====================================================== */
async function getMeetingById(meetingId) {
  const result = await db.query(
    `
    SELECT *
    FROM meetings
    WHERE id = $1
    LIMIT 1
    `,
    [meetingId]
  );
  return result.rows[0] || null;
}

async function getUserById(userId) {
  const result = await db.query(
    `
    SELECT *
    FROM users
    WHERE id = $1
    LIMIT 1
    `,
    [userId]
  );
  return result.rows[0] || null;
}

async function updateMeeting(meetingId, updates) {
  const keys = Object.keys(updates);
  if (!keys.length) return null;

  const fields = [];
  const values = [];
  let i = 0;

  for (const key of keys) {
    fields.push(`${key} = $${++i}`);
    values.push(updates[key]);
  }

  const result = await db.query(
    `
    UPDATE meetings
    SET ${fields.join(", ")}
    WHERE id = $${++i}
    RETURNING *
    `,
    [...values, meetingId]
  );

  return result.rows[0] || null;
}

/* ======================================================
   GET /api/meetings?investor_id=...
====================================================== */
router.get("/", async (req, res) => {
  try {
    const investor_id = req.query.investor_id || req.body.investor_id;
    if (!investor_id) {
      return res.status(400).json({ error: "investor_id required" });
    }

    const result = await db.query(
      `
      SELECT *
      FROM meetings
      WHERE investor_id = $1
      ORDER BY created_at DESC
      `,
      [String(investor_id)]
    );

    return res.json({ items: result.rows || [] });
  } catch (err) {
    console.error("meetings.get error", err);
    return res.status(500).json({
      error: "meetings_get_failed",
      detail: err.message || String(err),
    });
  }
});

/* ======================================================
   POST /api/meetings
====================================================== */
router.post("/", async (req, res) => {
  try {
    const body = req.body || {};
    const {
      investor_id,
      company_id,
      meeting_type,
      meeting_datetime,
      location,
      notes,
      generate_google_meet,
      created_by: bodyCreatedBy,
    } = body;

    if (!investor_id) {
      return res.status(400).json({ error: "investor_id required" });
    }

    const currentUserId =
      (req.user && req.user.id) ||
      bodyCreatedBy ||
      req.query.userId ||
      req.body.userId ||
      null;

    const insertObj = {
      investor_id: String(investor_id),
      company_id: company_id || null,
      meeting_type: meeting_type || null,
      meeting_status: "scheduled",
      meeting_datetime: meeting_datetime || null,
      location: location || null,
      notes: notes || null,
      created_by: currentUserId,
      created_at: new Date().toISOString(),
    };

    let meetPayload = null;
    let googleErrorFlag = null;

    /* ---------- Google Meet creation ---------- */
    if (generate_google_meet && meeting_type === "virtual") {
      try {
        if (!currentUserId) {
          googleErrorFlag = "no_user_for_calendar";
        } else {
          const user = await getUserById(currentUserId);
          const refreshToken =
            user?.google_refresh_token || user?.googleRefreshToken || null;

          if (!refreshToken) {
            googleErrorFlag = "NO_REFRESH_TOKEN";
          } else {
            const startTime = meeting_datetime
              ? new Date(meeting_datetime)
              : new Date();
            const endTime = new Date(startTime.getTime() + 30 * 60000);

            meetPayload = await createCalendarEventWithMeet({
              refreshToken,
              summary: `Meeting with investor ${investor_id}`,
              description: notes || "",
              start: startTime.toISOString(),
              end: endTime.toISOString(),
              attendees: [],
            });

            const meetLink =
              meetPayload?.hangoutLink ||
              meetPayload?.htmlLink ||
              meetPayload?.conferenceData?.entryPoints?.find(
                (ep) => ep.entryPointType === "video"
              )?.uri ||
              null;

            if (!meetLink) {
              googleErrorFlag = "no_meet_link_returned";
            } else {
              insertObj.meet_link = meetLink;
              if (meetPayload.id) {
                insertObj.google_event_id = meetPayload.id;
              }
            }
          }
        }
      } catch (err) {
        console.error("createCalendarEventWithMeet error", err);
        return res.status(502).json({
          error: "google_meet_creation_failed",
          detail: err.message || String(err),
        });
      }
    }

    /* ---------- Insert meeting ---------- */
    const insertRes = await db.query(
      `
      INSERT INTO meetings (
        investor_id,
        company_id,
        meeting_type,
        meeting_status,
        meeting_datetime,
        location,
        notes,
        created_by,
        created_at,
        meet_link,
        google_event_id
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      RETURNING *
      `,
      [
        insertObj.investor_id,
        insertObj.company_id,
        insertObj.meeting_type,
        insertObj.meeting_status,
        insertObj.meeting_datetime,
        insertObj.location,
        insertObj.notes,
        insertObj.created_by,
        insertObj.created_at,
        insertObj.meet_link || null,
        insertObj.google_event_id || null,
      ]
    );

    const inserted = insertRes.rows[0];
    const out = { ...inserted };
    if (googleErrorFlag) out.google_create_status = googleErrorFlag;

    /* ---------- Create interaction (best-effort) ---------- */
    try {
      if (inserted?.id) {
        await db.query(
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
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
          `,
          [
            inserted.investor_id,
            inserted.created_by || currentUserId,
            inserted.company_id,
            "meeting",
            "interested",
            inserted.notes,
            inserted.id,
            new Date().toISOString(),
          ]
        );
      }
    } catch (ixErr) {
      console.warn("interaction create failed (meeting):", ixErr);
    }

    return res.json(out);
  } catch (err) {
    console.error("meetings.create error", err);
    return res.status(500).json({
      error: "meeting_create_failed",
      detail: err.message || String(err),
    });
  }
});

/* ======================================================
   PUT /api/meetings/:id
   Update meeting fields (status, datetime, notes, etc.)
====================================================== */
router.put("/:id", async (req, res) => {
  try {
    const meetingId = req.params.id;
    if (!meetingId) {
      return res.status(400).json({ error: "meeting id required" });
    }

    const allowedFields = [
      "meeting_status",
      "meeting_datetime",
      "meeting_type",
      "location",
      "notes",
      "meet_link",
      "google_event_id",
      "company_id",
      "meeting_external_id",
    ];

    const updates = {};
    for (const key of allowedFields) {
      if (Object.prototype.hasOwnProperty.call(req.body, key)) {
        updates[key] = req.body[key];
      }
    }

    if (updates.meeting_status) {
      const allowedStatus = ["scheduled", "confirmed", "cancelled", "completed"];
      if (!allowedStatus.includes(String(updates.meeting_status))) {
        return res.status(400).json({
          error: "invalid_meeting_status",
          allowed: allowedStatus,
        });
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: "no_updatable_fields_provided" });
    }

    updates.updated_at = new Date().toISOString();

    const existing = await getMeetingById(meetingId);
    if (!existing) {
      return res.status(404).json({ error: "meeting_not_found" });
    }

    const updated = await updateMeeting(meetingId, updates);
    if (!updated) {
      return res.status(500).json({ error: "meeting_update_failed" });
    }

    return res.json({ meeting: updated });
  } catch (err) {
    console.error("meetings.update error", err);
    return res.status(500).json({
      error: "meeting_update_failed",
      detail: err.message || String(err),
    });
  }
});

/* ======================================================
   POST /api/meetings/:id/generate_meet
   Create Google Meet for existing meeting
====================================================== */
router.post("/:id/generate_meet", async (req, res) => {
  try {
    const meetingId = req.params.id;
    if (!meetingId) {
      return res.status(400).json({ error: "meeting id required" });
    }

    const meeting = await getMeetingById(meetingId);
    if (!meeting) {
      return res.status(404).json({ error: "meeting not found" });
    }

    const userId =
      meeting.created_by ||
      (req.user && req.user.id) ||
      req.query.userId ||
      req.body.userId ||
      null;

    if (!userId) {
      return res.status(400).json({
        error: "no_user_for_calendar",
        message: "Meeting has no user to create calendar event",
      });
    }

    const user = await getUserById(userId);
    if (!user) {
      return res.status(404).json({ error: "user_not_found" });
    }

    const refreshToken =
      user.google_refresh_token || user.googleRefreshToken || null;

    if (!refreshToken) {
      return res.status(200).json({
        google_create_status: "NO_REFRESH_TOKEN",
        message: "User has not connected Google",
      });
    }

    const start = meeting.meeting_datetime || new Date().toISOString();
    const end =
      meeting.end_at ||
      new Date(new Date(start).getTime() + 30 * 60000).toISOString();

    let event;
    try {
      event = await createCalendarEventWithMeet({
        refreshToken,
        summary:
          meeting.summary ||
          `Meeting with ${meeting.investor_id || "Investor"}`,
        description:
          meeting.notes ||
          `Meeting scheduled from app (id: ${meetingId})`,
        start,
        end,
        attendees: [],
      });
    } catch (gErr) {
      console.error("Google create event failed", gErr);
      return res.status(500).json({
        error: "google_event_creation_failed",
        detail: gErr.message || String(gErr),
      });
    }

    const googleEventId = event?.id || null;
    const meetLink =
      event?.hangoutLink ||
      event?.htmlLink ||
      event?.conferenceData?.entryPoints?.find(
        (ep) => ep.entryPointType === "video"
      )?.uri ||
      null;

    const updates = {};
    if (meetLink) updates.meet_link = meetLink;
    if (googleEventId) updates.google_event_id = googleEventId;

    const updatedMeeting = await updateMeeting(meetingId, updates);

    return res.status(200).json({
      meeting: updatedMeeting || { ...meeting, ...updates },
      google_event: event,
    });
  } catch (err) {
    console.error("generate_meet error", err);
    return res.status(500).json({
      error: "internal_server_error",
      detail: String(err),
    });
  }
});

module.exports = router;
