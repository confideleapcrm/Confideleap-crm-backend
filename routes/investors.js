// backend/routes/investors.js
const express = require("express");
const Joi = require("joi");
const db = require("../database/database");
const { validateRequest, validateQuery } = require("../middleware/validation");
const { investorMapper } = require("../utils/csvMapper");
const multer = require("multer");
const { v4: uuidv4 } = require("uuid");
const path = require("path");
const XLSX = require("xlsx");
const { Queue } = require("bullmq");
const { URL } = require("url");

const toPgArray = (val) => {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  return [val]; // wrap single string safely
};

/* ======================================================
   REDIS / QUEUE CONFIG (UNCHANGED)
====================================================== */
// let connection;
// if (process.env.REDIS_URL) {
//   const redisUrl = new URL(process.env.REDIS_URL);
//   connection = {
//     host: redisUrl.hostname,
//     port: Number(redisUrl.port),
//     password: redisUrl.password || undefined,
//     tls: redisUrl.protocol === "rediss:" ? {} : undefined,
//   };
// } else {
//   connection = { host: "127.0.0.1", port: 6379 };
// }

const router = express.Router();

/* ======================================================
   MULTER CONFIG
====================================================== */
const storage = multer.diskStorage({
  destination: "uploads/",
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});
const upload = multer({ storage });
// const importQueue = new Queue("investor-import", { connection });

/* ======================================================
   VALIDATION SCHEMAS (UNCHANGED)
====================================================== */
const createInvestorSchema = Joi.object({
  firstName: Joi.string().required(),
  lastName: Joi.string().required(),
  email: Joi.string().email().required(),
  phone: Joi.string().allow("", null),
  jobTitle: Joi.string().required(),
  seniorityLevel: Joi.string().allow("", null),
  bio: Joi.string().allow("", null),
  avatarUrl: Joi.string().uri().allow("", null),
  linkedinUrl: Joi.string().uri().allow("", null),
  twitterUrl: Joi.string().uri().allow("", null),
  buySellSide: Joi.string().allow("", null),
  aum: Joi.string().allow("", null),
  personalWebsite: Joi.string().uri().allow("", null),
  firmWebsite: Joi.string().uri().allow("", null),
  location: Joi.string().allow("", null),
  firmId: Joi.string().uuid().allow("", null),
  firmName: Joi.string().required(),
  firmType: Joi.string().allow("", null),
  investmentStages: Joi.array().items(Joi.string()),
  sectorPreferences: Joi.array().items(Joi.string()),
  geographicPreferences: Joi.array().items(Joi.string()),
  minCheckSize: Joi.number().min(0),
  maxCheckSize: Joi.number().min(0),
  portfolioCompanies: Joi.array().items(Joi.string()),
  portfolioFitScore: Joi.number().min(0),
  notableInvestments: Joi.array().items(Joi.string()),
  education: Joi.array(),
  experience: Joi.array(),
  status: Joi.string()
    .valid("hot", "warm", "cold", "contacted", "unresponsive")
    .default("cold"),
  tags: Joi.array().items(Joi.string()),
  notes: Joi.string().allow("", null),
  createdAt: Joi.date().required(),
});

const updateInvestorSchema = createInvestorSchema
  .fork(Object.keys(createInvestorSchema.describe().keys), (s) => s.optional())
  .options({ stripUnknown: true });

const querySchema = Joi.object({
  page: Joi.number().min(1).default(1),
  limit: Joi.number().min(1).max(100).default(20),
  search: Joi.string().optional(),
  status: Joi.string()
    .valid("hot", "warm", "cold", "contacted", "unresponsive", "all")
    .optional(),
  firmId: Joi.string().uuid().optional(),
  minPortfolioFit: Joi.number().min(0).max(100).optional(),
  sectors: Joi.array().items(Joi.string()).optional(),
  stages: Joi.array().items(Joi.string()).optional(),
  sortBy: Joi.string()
    .valid(
      "name",
      "firm",
      "status",
      "portfolioFit",
      "engagementScore",
      "createdAt"
    )
    .default("createdAt"),
  sortOrder: Joi.string().valid("asc", "desc").default("desc"),
});

/* ======================================================
   GET /investors  (FULL SUPABASE PARITY)
====================================================== */
router.get("/", validateQuery(querySchema), async (req, res) => {
  try {
    const {
      page,
      limit,
      search,
      status,
      firmId,
      minPortfolioFit,
      sectors,
      stages,
      sortBy,
      sortOrder,
    } = req.query;

    const offset = (page - 1) * limit;

    let where = ["i.created_by = $1", "i.is_active = true"];
    let values = [req.user.id];
    let idx = 1;

    if (search) {
      idx++;
      where.push(`
        (
          i.first_name ILIKE $${idx}
          OR i.last_name ILIKE $${idx}
          OR i.email ILIKE $${idx}
        )
      `);
      values.push(`%${search}%`);
    }

    if (status && status !== "all") {
      idx++;
      where.push(`i.status = $${idx}`);
      values.push(status);
    }

    if (firmId) {
      idx++;
      where.push(`i.firm_id = $${idx}`);
      values.push(firmId);
    }

    if (minPortfolioFit !== undefined) {
      idx++;
      where.push(`i.portfolio_fit_score >= $${idx}`);
      values.push(minPortfolioFit);
    }

    if (sectors?.length) {
      idx++;
      where.push(`i.sector_preferences @> $${idx}::text[]`);
      values.push(sectors);
    }

    if (stages?.length) {
      idx++;
      where.push(`i.investment_stages @> $${idx}::text[]`);
      values.push(stages);
    }

    const sortMap = {
      name: "i.first_name",
      firm: "f.name",
      status: "i.status",
      portfolioFit: "i.portfolio_fit_score",
      engagementScore: "es.engagement_score",
      createdAt: "i.created_at",
    };

    const orderBy = sortMap[sortBy] || "i.created_at";

    const result = await db.query(
      `
      SELECT
        i.*,
        jsonb_build_object(
          'id', f.id,
          'name', f.name,
          'type', f.type
        ) AS firm,
        jsonb_build_object(
          'engagement_score', es.engagement_score,
          'response_rate', es.response_rate,
          'avg_response_time_hours', es.avg_response_time_hours,
          'total_interactions', es.total_interactions
        ) AS engagement,
        COUNT(*) OVER() AS total_count
      FROM investors i
      LEFT JOIN investment_firms f ON f.id = i.firm_id
      LEFT JOIN investor_engagement_scores es ON es.investor_id = i.id
      WHERE ${where.join(" AND ")}
      ORDER BY ${orderBy} ${sortOrder.toUpperCase()}
      LIMIT $${++idx} OFFSET $${++idx}
      `,
      [...values, limit, offset]
    );

    const total = result.rows[0]?.total_count || 0;

    res.json({
      investors: result.rows.map((row) => ({
        id: row.id,
        firstName: row.first_name,
        lastName: row.last_name,
        email: row.email,
        phone: row.phone,
        jobTitle: row.job_title,
        seniorityLevel: row.seniority_level,
        bio: row.bio,
        avatarUrl: row.avatar_url,
        linkedinUrl: row.linkedin_url,
        twitterUrl: row.twitter_url,
        personalWebsite: row.personal_website,
        location: row.location,
        investmentStages: row.investment_stages,
        sectorPreferences: row.sector_preferences,
        geographicPreferences: row.geographic_preferences,
        minCheckSize: row.min_check_size,
        maxCheckSize: row.max_check_size,
        portfolioCompanies: row.portfolio_companies,
        notableInvestments: row.notable_investments,
        education: row.education,
        experience: row.experience,
        portfolioFitScore: row.portfolio_fit_score,
        engagementScore: row.engagement?.engagement_score,
        responseRate: row.engagement?.response_rate,
        avgResponseTimeHours: row.engagement?.avg_response_time_hours,
        totalInteractions: row.engagement?.total_interactions,
        status: row.status,
        tags: row.tags,
        notes: row.notes,
        lastContactDate: row.last_contact_date,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        firm: row.firm,
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error("Get investors error:", err);
    res.status(500).json({ error: "Failed to fetch investors" });
  }
});

/* ======================================================
   GET INVESTOR BY ID
====================================================== */
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const investorRes = await db.query(
      `
      SELECT
        i.*,
        jsonb_build_object(
          'id', f.id,
          'name', f.name,
          'type', f.type,
          'website', f.website,
          'headquarters', f.headquarters,
          'aum', f.aum
        ) AS firm,
        jsonb_build_object(
          'engagement_score', es.engagement_score,
          'response_rate', es.response_rate,
          'avg_response_time_hours', es.avg_response_time_hours,
          'meeting_acceptance_rate', es.meeting_acceptance_rate,
          'total_interactions', es.total_interactions,
          'last_interaction_date', es.last_interaction_date,
          'score_calculated_at', es.score_calculated_at
        ) AS engagement
      FROM investors i
      LEFT JOIN investment_firms f ON f.id = i.firm_id
      LEFT JOIN investor_engagement_scores es ON es.investor_id = i.id
      WHERE i.id = $1 AND i.is_active = true
      LIMIT 1
      `,
      [id]
    );

    if (!investorRes.rows.length) {
      return res.status(404).json({ error: "Investor not found" });
    }

    const investor = investorRes.rows[0];

    /* -----------------------------------------------
       Communications (last 10)
    ------------------------------------------------ */
    const commsRes = await db.query(
      `
      SELECT id, type, direction, subject, occurred_at, status
      FROM communications
      WHERE investor_id = $1
      ORDER BY occurred_at DESC
      LIMIT 10
      `,
      [id]
    );

    /* -----------------------------------------------
       Portfolio fit (latest)
    ------------------------------------------------ */
    const fitRes = await db.query(
      `
      SELECT
        overall_fit_score,
        sector_fit_score,
        stage_fit_score,
        geographic_fit_score,
        check_size_fit_score,
        last_calculated
      FROM investor_portfolio_fit
      WHERE investor_id = $1
      ORDER BY last_calculated DESC
      LIMIT 1
      `,
      [id]
    );

    const engagement = investor.engagement || {};
    const firm = investor.firm || null;
    const portfolioFit = fitRes.rows[0] || null;

    res.json({
      id: investor.id,
      firstName: investor.first_name,
      lastName: investor.last_name,
      email: investor.email,
      phone: investor.phone,
      jobTitle: investor.job_title,
      seniorityLevel: investor.seniority_level,
      bio: investor.bio,
      avatarUrl: investor.avatar_url,
      linkedinUrl: investor.linkedin_url,
      twitterUrl: investor.twitter_url,
      personalWebsite: investor.personal_website,
      location: investor.location,
      investmentStages: investor.investment_stages,
      sectorPreferences: investor.sector_preferences,
      geographicPreferences: investor.geographic_preferences,
      minCheckSize: investor.min_check_size,
      maxCheckSize: investor.max_check_size,
      portfolioCompanies: investor.portfolio_companies,
      notableInvestments: investor.notable_investments,
      education: investor.education,
      experience: investor.experience,
      portfolioFitScore: investor.portfolio_fit_score,
      engagementScore: engagement.engagement_score,
      responseRate: engagement.response_rate,
      avgResponseTimeHours: engagement.avg_response_time_hours,
      meetingAcceptanceRate: engagement.meeting_acceptance_rate,
      totalInteractions: engagement.total_interactions,
      lastInteractionDate: engagement.last_interaction_date,
      status: investor.status,
      tags: investor.tags,
      notes: investor.notes,
      lastContactDate: investor.last_contact_date,
      createdAt: investor.created_at,
      updatedAt: investor.updated_at,
      firm: firm
        ? {
            id: firm.id,
            name: firm.name,
            type: firm.type,
            website: firm.website,
            headquarters: firm.headquarters,
            aum: firm.aum !== null ? Number(firm.aum) : null,
          }
        : null,
      portfolioFit: portfolioFit
        ? {
            overallFitScore: portfolioFit.overall_fit_score,
            sectorFitScore: portfolioFit.sector_fit_score,
            stageFitScore: portfolioFit.stage_fit_score,
            geographicFitScore: portfolioFit.geographic_fit_score,
            checkSizeFitScore: portfolioFit.check_size_fit_score,
            lastCalculated: portfolioFit.last_calculated,
          }
        : null,
      recentCommunications: commsRes.rows.map((c) => ({
        id: c.id,
        type: c.type,
        direction: c.direction,
        subject: c.subject,
        occurredAt: c.occurred_at,
        status: c.status,
      })),
    });
  } catch (err) {
    console.error("Get investor error:", err);
    res.status(500).json({ error: "Failed to fetch investor" });
  }
});

/* ======================================================
   CREATE INVESTOR
====================================================== */
router.post("/", validateRequest(createInvestorSchema), async (req, res) => {
  try {
    const body = req.body;
    let finalFirmId = body.firmId || null;

    if (body.firmName && !finalFirmId) {
      const firmRes = await db.query(
        `
        INSERT INTO investment_firms (name, type)
        VALUES ($1,$2)
        RETURNING id
        `,
        [body.firmName, body.firmType || "PMS - Portfolio Management System"]
      );
      finalFirmId = firmRes.rows[0].id;
    }

    const investorRes = await db.query(
      `
      INSERT INTO investors (
        first_name, last_name, email, phone, job_title,
        seniority_level, bio, avatar_url, linkedin_url,
        twitter_url, personal_website, location, firm_id,
        investment_stages, sector_preferences, geographic_preferences,
        min_check_size, max_check_size, portfolio_companies,
        notable_investments, education, experience, status,
        tags, notes, created_by, buy_sell_side, aum
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
        $11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
        $21,$22,$23,$24,$25,$26,$27,$28
      )
      RETURNING *
      `,
      [
        body.firstName,
        body.lastName,
        body.email,
        body.phone,
        body.jobTitle,
        body.seniorityLevel,
        body.bio,
        body.avatarUrl,
        body.linkedinUrl,
        body.twitterUrl,
        body.personalWebsite,
        body.location,
        finalFirmId,

        // 🔒 SAFE ARRAY FIELDS
        toPgArray(body.investmentStages),
        toPgArray(body.sectorPreferences),
        toPgArray(body.geographicPreferences),

        body.minCheckSize,
        body.maxCheckSize,

        toPgArray(body.portfolioCompanies),
        toPgArray(body.notableInvestments),
        toPgArray(body.education),
        toPgArray(body.experience),

        body.status,
        toPgArray(body.tags),

        body.notes,
        req.user.id,
        body.buySellSide,
        body.aum,
      ]
    );

    const investor = investorRes.rows[0];

    /* -----------------------------------------------
       Portfolio fit score (PostgreSQL function)
    ------------------------------------------------ */
    const scoreRes = await db.query(
      `
  SELECT calculate_portfolio_fit_score(
    $1,$2,$3,$4
  ) AS score
  `,
      [
        toPgArray("FinTech"),
        toPgArray("Series B"),
        toPgArray(body.sectorPreferences),
        toPgArray(body.investmentStages),
      ]
    );

    const score = scoreRes.rows[0]?.score ?? null;

    if (score !== null) {
      await db.query(
        `UPDATE investors SET portfolio_fit_score = $1 WHERE id = $2`,
        [score, investor.id]
      );
    }

    res.status(201).json({
      message: "Investor created successfully",
      investor: {
        id: investor.id,
        firstName: investor.first_name,
        lastName: investor.last_name,
        email: investor.email,
        status: investor.status,
        portfolioFitScore: score,
        createdAt: investor.created_at,
      },
    });
  } catch (err) {
    console.error("Create investor error:", err);
    res.status(500).json({ error: "Failed to create investor" });
  }
});

/* ======================================================
   UPDATE INVESTOR
====================================================== */
router.put("/:id", validateRequest(updateInvestorSchema), async (req, res) => {
  try {
    console.log("🔥 HIT UPDATE INVESTOR ROUTE", req.params.id);

    const { id } = req.params;
    const updates = req.body;

    // 1. Check only existence (no ownership)
    const exists = await db.query(
      `
      SELECT id
      FROM investors
      WHERE id = $1 AND is_active = true
      `,
      [id]
    );

    if (!exists.rows.length) {
      return res.status(404).json({ error: "Investor not found" });
    }

    const map = {
      firstName: "first_name",
      lastName: "last_name",
      email: "email",
      phone: "phone",
      jobTitle: "job_title",
      seniorityLevel: "seniority_level",
      bio: "bio",
      avatarUrl: "avatar_url",
      linkedinUrl: "linkedin_url",
      twitterUrl: "twitter_url",
      personalWebsite: "personal_website",
      location: "location",
      firmId: "firm_id",
      investmentStages: "investment_stages",
      sectorPreferences: "sector_preferences",
      geographicPreferences: "geographic_preferences",
      minCheckSize: "min_check_size",
      maxCheckSize: "max_check_size",
      portfolioCompanies: "portfolio_companies",
      notableInvestments: "notable_investments",
      education: "education",
      experience: "experience",
      status: "status",
      tags: "tags",
      notes: "notes",
      buySellSide: "buy_sell_side",
      aum: "aum",
    };

    const arrayFields = [
      "investmentStages",
      "sectorPreferences",
      "geographicPreferences",
      "portfolioCompanies",
      "notableInvestments",
      "education",
      "experience",
      "tags",
    ];

    const fields = [];
    const values = [];
    let i = 0;

    Object.keys(map).forEach((key) => {
      if (updates[key] !== undefined) {
        fields.push(`${map[key]} = $${++i}`);
        values.push(
          arrayFields.includes(key) ? toPgArray(updates[key]) : updates[key]
        );
      }
    });

    if (!fields.length) {
      return res.status(400).json({ error: "No fields to update" });
    }

    // always update timestamp
    fields.push(`updated_at = NOW()`);

    const query = `
      UPDATE investors
      SET ${fields.join(", ")}
      WHERE id = $${++i}
      RETURNING id
    `;

    const result = await db.query(query, [...values, id]);

    if (!result.rows.length) {
      return res.status(404).json({ error: "Investor not found" });
    }

    res.json({ message: "Investor updated successfully" });
  } catch (err) {
    console.error("Update investor error:", err);
    res.status(500).json({ error: "Failed to update investor" });
  }
});

/* ======================================================
   DELETE INVESTOR (SOFT DELETE)
====================================================== */
router.delete("/:id", async (req, res) => {
  try {
    const result = await db.query(
      `
      UPDATE investors
      SET is_active = false, updated_at = NOW()
      WHERE id = $1 AND created_by = $2
      `,
      [req.params.id, req.user.id]
    );

    if (!result.rowCount) {
      return res.status(404).json({ error: "Investor not found" });
    }

    res.json({ message: "Investor deleted successfully" });
  } catch (err) {
    console.error("Delete investor error:", err);
    res.status(500).json({ error: "Failed to delete investor" });
  }
});

/* ======================================================
   FULL /targeting/list (100% PARITY)
====================================================== */
router.get("/targeting/list", async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page || "1", 10));
    const limit = Math.max(1, parseInt(req.query.limit || "10", 10));
    const offset = (page - 1) * limit;

    const toArray = (v) =>
      Array.isArray(v)
        ? v
            .map(String)
            .map((s) => s.trim())
            .filter(Boolean)
        : String(v || "")
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);

    const sectors = toArray(req.query.sectors);
    const firmTypesRaw = toArray(
      req.query.firmTypes || req.query.firm_type || req.query.investorCategory
    );
    const aum = toArray(req.query.aum);
    const buySell = toArray(
      req.query.buySell || req.query.buy_sell || req.query.buy_sell_side
    );
    const rawSearch = String(req.query.search || "").trim();

    const CATEGORY_MAP = {
      pms: "PMS - Portfolio Management System",
      aif: "AIF - Alternate Investment Fund",
      hni: "HNI - High Net Worth Individual",
      mf: "MF - Mutual Fund",
      ii: "II - Institutional Investor",
      fii: "FII - Foreign Institutional Investors",
      sif: "SIF - Specialized Investment Fund",
      ic: "IC - Insurance Company",
      pe: "PE - Private Equity",
      fo: "FO - Family Office",
      bf: "BF - Brokerage Firm",
    };

    const KNOWN_SECTORS = [
      "FinTech",
      "HealthTech",
      "EdTech",
      "SaaS",
      "E-commerce",
      "AI/ML",
      "Biotech",
      "CleanTech",
      "Consumer",
      "Enterprise",
      "Gaming",
      "Media",
      "Real Estate",
      "Transportation",
      "Food & Beverage",
    ];

    let where = ["i.is_active = true"];
    let values = [];
    let idx = 0;

    if (firmTypesRaw.length) {
      const mapped = firmTypesRaw
        .map((f) => CATEGORY_MAP[f.toLowerCase()] || f)
        .filter(Boolean);

      where.push(`i.firm_type = ANY($${++idx}::text[])`);
      values.push(mapped);
    }

    if (sectors.length) {
      where.push(`i.sector_preferences && $${++idx}::text[]`);
      values.push(sectors);
    }

    if (aum.length) {
      where.push(`i.aum = ANY($${++idx}::text[])`);
      values.push(aum);
    }

    if (buySell.length) {
      where.push(`i.buy_sell_side = ANY($${++idx}::text[])`);
      values.push(buySell);
    }

    if (rawSearch) {
      const sectorMatch =
        KNOWN_SECTORS.find(
          (s) => s.toLowerCase() === rawSearch.toLowerCase()
        ) ||
        KNOWN_SECTORS.find((s) =>
          s.toLowerCase().startsWith(rawSearch.toLowerCase())
        );

      if (sectorMatch) {
        where.push(`i.sector_preferences && $${++idx}::text[]`);
        values.push([sectorMatch]);
      } else {
        const like = `%${rawSearch.replace(/%/g, "")}%`;
        where.push(`
          (
            i.first_name ILIKE $${++idx}
            OR i.last_name ILIKE $${idx}
            OR i.email ILIKE $${idx}
            OR i.job_title ILIKE $${idx}
            OR i.location ILIKE $${idx}
          )
        `);
        values.push(like);
      }
    }

    const result = await db.query(
      `
      SELECT
        i.*,
        jsonb_build_object(
          'id', f.id,
          'name', f.name,
          'type', f.type,
          'aum', f.aum
        ) AS firm,
        COUNT(*) OVER() AS total_count
      FROM investors i
      LEFT JOIN investment_firms f ON f.id = i.firm_id
      WHERE ${where.join(" AND ")}
      ORDER BY i.created_at DESC
      LIMIT $${++idx} OFFSET $${++idx}
      `,
      [...values, limit, offset]
    );

    const total = result.rows[0]?.total_count || 0;

    res.json({
      investors: result.rows,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error("/targeting/list error:", err);
    res.status(500).json({ error: "server error" });
  }
});

module.exports = router;
