// routes/customers.js  
const express = require("express");
const Joi = require("joi");
const pool = require("../database/database"); // pg Pool
const router = express.Router();

/* ----------------------------------------------------
   Validation middleware
---------------------------------------------------- */
const validateRequest = (schema, property = "body") => (req, res, next) => {
  const { error, value } = schema.validate(req[property], {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    return res.status(400).json({
      error: "Validation error",
      details: error.details.map((d) => d.message),
    });
  }

  req[property] = value;
  next();
};

/* ----------------------------------------------------
   Joi Schemas
---------------------------------------------------- */
const createCustomerSchema = Joi.object({
  firstName: Joi.string().required(),
  lastName: Joi.string().allow("", null),
  email: Joi.string().email().required(),
  phone: Joi.string().allow("", null),
  title: Joi.string().allow("", null),
  companyId: Joi.string().uuid().allow("", null),

  company: Joi.object({
    id: Joi.string().uuid().allow("", null),
    name: Joi.string().required(),
    website: Joi.string().allow("", null),
    register_address: Joi.string().allow("", null),
    gst_number: Joi.string().allow("", null),
    pan_number: Joi.string().allow("", null),
    contact_number: Joi.string().allow("", null),
    linkedin_url: Joi.string().allow("", null),
    social_media: Joi.any().optional(),
    youtube_url: Joi.string().allow("", null),
    domain: Joi.string().allow("", null),
    industry: Joi.string().allow("", null),
  }).optional(),

  companyEmployees: Joi.array()
    .items(
      Joi.object({
        id: Joi.string().uuid().allow("", null),
        firstName: Joi.string().required(),
        lastName: Joi.string().allow("", null),
        email: Joi.string().email().allow("", null),
        designation: Joi.string().allow("", null),
        phone: Joi.string().allow("", null),
        linkedinUrl: Joi.string().allow("", null),
        isPrimary: Joi.boolean().optional(),
      })
    )
    .optional(),

  customerType: Joi.string()
    .valid("prospect", "client", "lead")
    .default("prospect"),
  aum: Joi.string().allow("", null),
  buySellSide: Joi.string().allow("", null),
  status: Joi.string().valid("active", "inactive").default("active"),
  notes: Joi.string().allow("", null),
});

const updateCustomerSchema = createCustomerSchema.fork(
  Object.keys(createCustomerSchema.describe().keys),
  (schema) => schema.optional()
);

const querySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  search: Joi.string().optional(),
  status: Joi.string()
    .valid(
      "hot",
      "warm",
      "cold",
      "contacted",
      "unresponsive",
      "all",
      "active",
      "inactive"
    )
    .optional(),
  sortBy: Joi.string()
    .valid("name", "createdAt", "company")
    .default("createdAt"),
  sortOrder: Joi.string().valid("asc", "desc").default("desc"),
});

/* ----------------------------------------------------
   Helper: map DB row → frontend shape
---------------------------------------------------- */
const mapCustomerRow = (row) => ({
  id: row.id,
  firstName: row.first_name,
  lastName: row.last_name,
  email: row.email,
  phone: row.phone,
  role: row.role,
  company: row.company_name || null,
  companyDetails: row.company_details || null,
  industry: row.industry,
  location: row.location,
  avatarUrl: row.avatar_url,
  customerScore: row.customer_score,
  status: row.status,
  tags: row.tags,
  notes: row.notes,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

/* ----------------------------------------------------
   GET ALL CUSTOMERS (with company + employee count)
---------------------------------------------------- */
router.get("/", validateRequest(querySchema, "query"), async (req, res) => {
  try {
    const { page, limit, search, status, sortBy, sortOrder } = req.query;
    const offset = (page - 1) * limit;

    const whereClauses = [
      "c.created_by = $1",
      "c.is_active = true",
    ];
    const values = [req.user.id];
    let idx = values.length;

    /* -------- Search -------- */
    if (search) {
      idx++;
      values.push(`%${search}%`);
      whereClauses.push(`
        (
          c.first_name ILIKE $${idx}
          OR c.last_name ILIKE $${idx}
          OR c.email ILIKE $${idx}
          OR co.name ILIKE $${idx}
          OR co.domain ILIKE $${idx}
          OR co.website ILIKE $${idx}
          OR co.contact_number ILIKE $${idx}
        )
      `);
    }

    /* -------- Status -------- */
    if (status && status !== "all") {
      idx++;
      values.push(status);
      whereClauses.push(`c.status = $${idx}`);
    }

    /* -------- Sorting -------- */
    const sortMap = {
      name: "c.first_name",
      company: "co.name",
      createdAt: "c.created_at",
    };
    const orderBy = sortMap[sortBy] || "c.created_at";
    const orderDirection = sortOrder.toUpperCase() === "ASC" ? "ASC" : "DESC";

    /* -------- Main Query -------- */
    const query = `
      SELECT
        c.*,
        co.id            AS company_id,
        co.name          AS company_name,
        co.domain        AS company_domain,
        co.website       AS company_website,
        co.industry      AS company_industry,
        COUNT(ce.id)     AS company_employee_count,
        COUNT(*) OVER()  AS total_count
      FROM customers c
      LEFT JOIN companies co ON co.id = c.company_id
      LEFT JOIN company_employees ce ON ce.company_id = co.id
      WHERE ${whereClauses.join(" AND ")}
      GROUP BY c.id, co.id
      ORDER BY ${orderBy} ${orderDirection}
      LIMIT $${idx + 1} OFFSET $${idx + 2}
    `;

    values.push(limit, offset);

    const result = await pool.query(query, values);

    const total =
      result.rows.length > 0
        ? parseInt(result.rows[0].total_count, 10)
        : 0;

    const customers = result.rows.map((row) => {
      const mapped = mapCustomerRow(row);
      mapped.companyEmployeeCount = parseInt(row.company_employee_count, 10);
      return mapped;
    });

    res.json({
      customers,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get customers error:", error);
    res.status(500).json({ error: "Failed to fetch customers" });
  }
});

/* ----------------------------------------------------
   GET CUSTOMER BY ID (company + employees)
---------------------------------------------------- */
router.get("/:id", async (req, res) => {
  try {
    const customerId = req.params.id;

    /* -------- Fetch customer + company -------- */
    const customerQuery = `
      SELECT
        c.*,
        co.id     AS company_id,
        co.name   AS company_name,
        co.website,
        co.domain,
        co.industry,
        co.register_address,
        co.gst_number,
        co.pan_number,
        co.contact_number,
        co.linkedin_url,
        co.social_media,
        co.youtube_url
      FROM customers c
      LEFT JOIN companies co ON co.id = c.company_id
      WHERE c.id = $1
      LIMIT 1
    `;

    const customerResult = await pool.query(customerQuery, [customerId]);
    if (customerResult.rows.length === 0) {
      return res.status(404).json({ error: "Customer not found" });
    }

    const customer = customerResult.rows[0];

    /* -------- Fetch company employees -------- */
    let employees = [];
    if (customer.company_id) {
      const empResult = await pool.query(
        `
        SELECT
          id,
          first_name,
          last_name,
          email,
          designation,
          phone,
          linkedin_url,
          is_primary,
          created_at,
          updated_at
        FROM company_employees
        WHERE company_id = $1
        ORDER BY is_primary DESC, created_at ASC
        `,
        [customer.company_id]
      );

      employees = empResult.rows.map((emp) => ({
        id: emp.id,
        firstName: emp.first_name,
        lastName: emp.last_name,
        email: emp.email,
        designation: emp.designation,
        phone: emp.phone,
        linkedinUrl: emp.linkedin_url,
        isPrimary: emp.is_primary,
        createdAt: emp.created_at,
        updatedAt: emp.updated_at,
      }));
    }

    /* -------- Response -------- */
    res.json({
      id: customer.id,
      firstName: customer.first_name,
      lastName: customer.last_name,
      email: customer.email,
      phone: customer.phone,
      title: customer.title,
      companyId: customer.company_id,
      companyName: customer.company_name,
      companyDetails: customer.company_id
        ? {
            id: customer.company_id,
            name: customer.company_name,
            website: customer.website,
            domain: customer.domain,
            industry: customer.industry,
            register_address: customer.register_address,
            gst_number: customer.gst_number,
            pan_number: customer.pan_number,
            contact_number: customer.contact_number,
            linkedin_url: customer.linkedin_url,
            social_media: customer.social_media,
            youtube_url: customer.youtube_url,
          }
        : null,
      companyEmployees: employees,
      customerType: customer.customer_type,
      aum: customer.aum,
      buySellSide: customer.buy_sell_side,
      status: customer.status,
      tags: customer.tags,
      notes: customer.notes,
      location: customer.location,
      jobTitle: customer.job_title,
      avatarUrl: customer.avatar_url,
      createdAt: customer.created_at,
      updatedAt: customer.updated_at,
    });
  } catch (err) {
    console.error("Get customer by ID error:", err);
    res.status(500).json({ error: "Failed to fetch customer" });
  }
});

/* ----------------------------------------------------
   CREATE CUSTOMER (company + employees supported)
---------------------------------------------------- */
router.post("/", validateRequest(createCustomerSchema), async (req, res) => {
  const client = await pool.connect();
  try {
    const {
      firstName,
      lastName,
      email,
      phone,
      title,
      companyId,
      company,
      companyEmployees,
      customerType,
      aum,
      buySellSide,
      status,
      notes,
    } = req.body;

    await client.query("BEGIN");

    let finalCompanyId = companyId || null;

    /* -------- Create company if provided -------- */
    if (company && !finalCompanyId) {
      const compRes = await client.query(
        `
        INSERT INTO companies (
          name, website, register_address, gst_number, pan_number,
          contact_number, linkedin_url, social_media, youtube_url,
          domain, industry, created_at, updated_at
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW(),NOW())
        RETURNING id
        `,
        [
          company.name,
          company.website,
          company.register_address,
          company.gst_number,
          company.pan_number,
          company.contact_number,
          company.linkedin_url,
          company.social_media,
          company.youtube_url,
          company.domain,
          company.industry,
        ]
      );
      finalCompanyId = compRes.rows[0].id;
    }

    /* -------- Insert customer -------- */
    const customerRes = await client.query(
      `
      INSERT INTO customers (
        first_name, last_name, email, phone, title,
        company_id, customer_type, aum, buy_sell_side,
        status, notes, created_by, created_at, updated_at, is_active
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW(),NOW(),true)
      RETURNING id
      `,
      [
        firstName,
        lastName,
        email,
        phone,
        title,
        finalCompanyId,
        customerType,
        aum,
        buySellSide,
        status,
        notes,
        req.user.id,
      ]
    );

    const customerId = customerRes.rows[0].id;

    /* -------- Insert / Update company employees -------- */
    if (companyEmployees && Array.isArray(companyEmployees) && finalCompanyId) {
      for (const emp of companyEmployees) {
        const payload = [
          finalCompanyId,
          emp.firstName,
          emp.lastName,
          emp.email,
          emp.designation,
          emp.phone,
          emp.linkedinUrl,
          !!emp.isPrimary,
        ];

        if (emp.id) {
          await client.query(
            `
            UPDATE company_employees
            SET
              first_name = $2,
              last_name = $3,
              email = $4,
              designation = $5,
              phone = $6,
              linkedin_url = $7,
              is_primary = $8,
              updated_at = NOW()
            WHERE id = $1
            `,
            [emp.id, ...payload]
          );
        } else {
          await client.query(
            `
            INSERT INTO company_employees (
              company_id, first_name, last_name, email,
              designation, phone, linkedin_url, is_primary,
              created_at, updated_at
            )
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW(),NOW())
            `,
            payload
          );
        }
      }
    }

    await client.query("COMMIT");

    /* -------- Return created customer -------- */
    const result = await pool.query(
      `
      SELECT
        c.*,
        co.name AS company_name
      FROM customers c
      LEFT JOIN companies co ON co.id = c.company_id
      WHERE c.id = $1
      `,
      [customerId]
    );

    res.status(201).json({
      message: "Customer created successfully",
      customer: result.rows[0],
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Create customer error:", err);
    res.status(500).json({ error: "Failed to create customer" });
  } finally {
    client.release();
  }
});

/* ----------------------------------------------------
   UPDATE CUSTOMER
---------------------------------------------------- */
router.put("/:id", validateRequest(updateCustomerSchema), async (req, res) => {
  const client = await pool.connect();
  try {
    const customerId = req.params.id;
    const updates = req.body;

    await client.query("BEGIN");

    const check = await client.query(
      `SELECT * FROM customers WHERE id = $1`,
      [customerId]
    );
    if (check.rows.length === 0) {
      return res.status(404).json({ error: "Customer not found" });
    }

    const fieldMap = {
      firstName: "first_name",
      lastName: "last_name",
      email: "email",
      phone: "phone",
      title: "title",
      jobTitle: "job_title",
      notes: "notes",
      tags: "tags",
      customerType: "customer_type",
      aum: "aum",
      buySellSide: "buy_sell_side",
      status: "status",
      location: "location",
      avatarUrl: "avatar_url",
      companyId: "company_id",
    };

    const sets = [];
    const values = [];
    let idx = 0;

    Object.entries(fieldMap).forEach(([key, col]) => {
      if (updates[key] !== undefined) {
        idx++;
        sets.push(`${col} = $${idx}`);
        values.push(updates[key]);
      }
    });

    if (sets.length > 0) {
      idx++;
      values.push(customerId);
      await client.query(
        `
        UPDATE customers
        SET ${sets.join(", ")}, updated_at = NOW()
        WHERE id = $${idx}
        `,
        values
      );
    }

    /* -------- Company update/create -------- */
    if (updates.company) {
      if (updates.company.id) {
        await client.query(
          `
          UPDATE companies
          SET name=$1, website=$2, domain=$3, industry=$4, updated_at=NOW()
          WHERE id=$5
          `,
          [
            updates.company.name,
            updates.company.website,
            updates.company.domain,
            updates.company.industry,
            updates.company.id,
          ]
        );
      } else {
        const comp = await client.query(
          `
          INSERT INTO companies (name, website, domain, industry, created_at, updated_at)
          VALUES ($1,$2,$3,$4,NOW(),NOW())
          RETURNING id
          `,
          [
            updates.company.name,
            updates.company.website,
            updates.company.domain,
            updates.company.industry,
          ]
        );
        await client.query(
          `UPDATE customers SET company_id=$1 WHERE id=$2`,
          [comp.rows[0].id, customerId]
        );
      }
    }

    /* -------- Company employees -------- */
    if (updates.companyEmployees && Array.isArray(updates.companyEmployees)) {
      const companyId =
        updates.company?.id || updates.companyId || check.rows[0].company_id;

      if (companyId) {
        for (const emp of updates.companyEmployees) {
          if (emp.id) {
            await client.query(
              `
              UPDATE company_employees
              SET first_name=$1,last_name=$2,email=$3,designation=$4,
                  phone=$5,linkedin_url=$6,is_primary=$7,updated_at=NOW()
              WHERE id=$8
              `,
              [
                emp.firstName,
                emp.lastName,
                emp.email,
                emp.designation,
                emp.phone,
                emp.linkedinUrl,
                !!emp.isPrimary,
                emp.id,
              ]
            );
          } else {
            await client.query(
              `
              INSERT INTO company_employees (
                company_id, first_name, last_name, email,
                designation, phone, linkedin_url, is_primary,
                created_at, updated_at
              )
              VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW(),NOW())
              `,
              [
                companyId,
                emp.firstName,
                emp.lastName,
                emp.email,
                emp.designation,
                emp.phone,
                emp.linkedinUrl,
                !!emp.isPrimary,
              ]
            );
          }
        }
      }
    }

    await client.query("COMMIT");

    res.json({ message: "Customer updated successfully" });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Update customer error:", err);
    res.status(500).json({ error: "Failed to update customer" });
  } finally {
    client.release();
  }
});

/* ----------------------------------------------------
   SOFT DELETE CUSTOMER
---------------------------------------------------- */
router.delete("/:id", async (req, res) => {
  try {
    const result = await pool.query(
      `
      UPDATE customers
      SET is_active = false, updated_at = NOW()
      WHERE id = $1 AND created_by = $2
      RETURNING *
      `,
      [req.params.id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Customer not found" });
    }

    res.json({
      message: "Customer deleted successfully",
      customer: result.rows[0],
    });
  } catch (err) {
    console.error("Delete customer error:", err);
    res.status(500).json({ error: "Failed to delete customer" });
  }
});

/* ----------------------------------------------------
   EXPORT
---------------------------------------------------- */
module.exports = router;
