// routes/companies.js
const express = require("express");
const router = express.Router();
const db = require("../database/database");

// =======================
// Helper: normalize company payload -> db columns
// =======================
function mapCompanyPayloadToRow(company) {
  return {
    name: company.name || null,
    domain: company.domain || null,
    industry: company.industry || null,
    website:
      company.website && company.website.length
        ? company.website.startsWith("http")
          ? company.website
          : `https://${company.website}`
        : null,
    company_register_address: company.company_register_address || null,
    gst_number: company.gst_number || null,
    pan_number: company.pan_number || null,
    contact_number: company.contact_number || null,
    linkedin: company.linkedin || null,
    social_media: company.social_media || null,
    status: company.status || "Active",
    updated_at: new Date(),
  };
}

// =======================
// Helper: insert customer_services rows
// =======================
async function insertCustomerServicesForCompany(
  companyId,
  services,
  client = db
) {
  if (!Array.isArray(services) || services.length === 0) return [];

  const values = [];
  const placeholders = services.map((s, i) => {
    const baseIndex = i * 5;
    values.push(
      companyId,
      s.service_key,
      s.service_label,
      s.price ?? 0,
      new Date()
    );
    return `($${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3}, $${baseIndex + 4}, $${baseIndex + 5})`;
  });

  const result = await client.query(
    `
    INSERT INTO customer_services (
      company_id, service_key, service_label, price, created_at
    )
    VALUES ${placeholders.join(",")}
    RETURNING *
    `,
    values
  );

  return result.rows;
}

// =======================
// Create company + employees + customer_services
// POST /api/companies
// =======================
router.post("/", async (req, res) => {
  const { employees = [], customer_services = [], ...company } = req.body;
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const companyRow = mapCompanyPayloadToRow(company);

    const companyResult = await client.query(
      `
      INSERT INTO companies (
        name, domain, industry, website, company_register_address,
        gst_number, pan_number, contact_number, linkedin,
        social_media, status, updated_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      RETURNING *
      `,
      [
        companyRow.name,
        companyRow.domain,
        companyRow.industry,
        companyRow.website,
        companyRow.company_register_address,
        companyRow.gst_number,
        companyRow.pan_number,
        companyRow.contact_number,
        companyRow.linkedin,
        companyRow.social_media,
        companyRow.status,
        companyRow.updated_at,
      ]
    );

    const newCompany = companyResult.rows[0];

    if (employees.length) {
      for (const emp of employees) {
        await client.query(
          `
          INSERT INTO company_employees (
            company_id, first_name, last_name, email,
            designation, phone, linkedin_url,
            is_primary, created_at, updated_at
          )
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
          `,
          [
            newCompany.id,
            emp.first_name ?? emp.firstName ?? "",
            emp.last_name ?? emp.lastName ?? "",
            emp.email ?? "",
            emp.designation ?? "",
            emp.phone ?? "",
            emp.linkedin_url ?? emp.linkedin ?? "",
            typeof emp.is_primary !== "undefined"
              ? emp.is_primary
              : (emp.isPrimary ?? false),
            new Date(),
            new Date(),
          ]
        );
      }
    }

    if (customer_services.length) {
      await insertCustomerServicesForCompany(
        newCompany.id,
        customer_services,
        client
      );
    }

    await client.query("COMMIT");

    const fullCompany = await db.query(
      `
      SELECT c.*,
        COALESCE(
          json_agg(DISTINCT ce.*) FILTER (WHERE ce.id IS NOT NULL),
          '[]'
        ) AS company_employees,
        COALESCE(
          json_agg(DISTINCT cs.*) FILTER (WHERE cs.id IS NOT NULL),
          '[]'
        ) AS customer_services
      FROM companies c
      LEFT JOIN company_employees ce ON ce.company_id = c.id
      LEFT JOIN customer_services cs ON cs.company_id = c.id
      WHERE c.id = $1
      GROUP BY c.id
      `,
      [newCompany.id]
    );

    res.json({ company: fullCompany.rows[0] });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Create company error:", err);
    res.status(500).json({ error: "Failed to create company", details: err });
  } finally {
    client.release();
  }
});
// =======================
// PUT / PATCH company update
// =======================
async function handleCompanyUpdate(req, res) {
  const companyId = req.params.id;
  const { company = {}, employees = [], customer_services = [] } = req.body;
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    if (Object.keys(company).length) {
      const row = mapCompanyPayloadToRow(company);
      const fields = Object.keys(row);
      const values = Object.values(row);

      const setClause = fields.map((f, i) => `${f} = $${i + 1}`).join(", ");

      await client.query(
        `UPDATE companies SET ${setClause} WHERE id = $${fields.length + 1}`,
        [...values, companyId]
      );
    }

    for (const emp of employees) {
      if (emp.id) {
        await client.query(
          `
          UPDATE company_employees
          SET first_name=$1,last_name=$2,email=$3,designation=$4,
              phone=$5,linkedin_url=$6,updated_at=$7
          WHERE id=$8
          `,
          [
            emp.firstName ?? emp.first_name,
            emp.lastName ?? emp.last_name,
            emp.email,
            emp.designation,
            emp.phone,
            emp.linkedin_url ?? emp.linkedin ?? "",
            new Date(),
            emp.id,
          ]
        );
      } else {
        await client.query(
          `
          INSERT INTO company_employees (
            company_id, first_name, last_name, email,
            designation, phone, linkedin_url, created_at, updated_at
          )
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
          `,
          [
            companyId,
            emp.firstName ?? emp.first_name,
            emp.lastName ?? emp.last_name,
            emp.email,
            emp.designation,
            emp.phone,
            emp.linkedin_url ?? emp.linkedin ?? "",
            new Date(),
            new Date(),
          ]
        );
      }
    }

    await client.query(`DELETE FROM customer_services WHERE company_id = $1`, [
      companyId,
    ]);

    if (customer_services.length) {
      await insertCustomerServicesForCompany(
        companyId,
        customer_services,
        client
      );
    }

    await client.query("COMMIT");

    const result = await db.query(
      `
      SELECT c.*,
        COALESCE(json_agg(DISTINCT ce.*) FILTER (WHERE ce.id IS NOT NULL),'[]') AS company_employees,
        COALESCE(json_agg(DISTINCT cs.*) FILTER (WHERE cs.id IS NOT NULL),'[]') AS customer_services
      FROM companies c
      LEFT JOIN company_employees ce ON ce.company_id = c.id
      LEFT JOIN customer_services cs ON cs.company_id = c.id
      WHERE c.id = $1
      GROUP BY c.id
      `,
      [companyId]
    );

    res.json({ company: result.rows[0] });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Update company error:", err);
    res.status(500).json({ error: "Failed to update company", details: err });
  } finally {
    client.release();
  }
}

router.put("/:id", handleCompanyUpdate);
router.patch("/:id", handleCompanyUpdate);

// =======================
// Replace customer services
// =======================
router.post("/:id/customer_services", async (req, res) => {
  const companyId = req.params.id;
  const services = Array.isArray(req.body) ? req.body : [];

  try {
    await db.query(`DELETE FROM customer_services WHERE company_id = $1`, [
      companyId,
    ]);

    if (services.length) {
      const inserted = await insertCustomerServicesForCompany(
        companyId,
        services
      );
      return res.status(201).json(inserted);
    }

    res.json({ success: true });
  } catch (err) {
    console.error("Replace customer services error:", err);
    res.status(500).json({ error: "Failed to replace services", details: err });
  }
});

// =======================
// Get companies (pagination + search)
// =======================
router.get("/", async (req, res) => {
  try {
    const { page = 1, limit = 20, search = "", status } = req.query;
    const offset = (page - 1) * limit;

    const where = [];
    const values = [];
    let i = 1;

    if (search) {
      where.push(
        `(name ILIKE $${i} OR domain ILIKE $${i} OR industry ILIKE $${i} OR website ILIKE $${i} OR contact_number ILIKE $${i})`
      );
      values.push(`%${search}%`);
      i++;
    }

    if (status) {
      where.push(`status = $${i}`);
      values.push(status);
      i++;
    }

    // const query = `
    //   SELECT *, COUNT(*) OVER() AS total_count
    //   FROM companies
    //   ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
    //   ORDER BY created_at DESC
    //   LIMIT $${i} OFFSET $${i + 1}
    // `;

    const query = `
  SELECT
    c.*,
    COUNT(*) OVER() AS total_count,
    COALESCE(
      json_agg(DISTINCT ce.*) FILTER (WHERE ce.id IS NOT NULL),
      '[]'
    ) AS company_employees,
    COALESCE(
      json_agg(DISTINCT cs.*) FILTER (WHERE cs.id IS NOT NULL),
      '[]'
    ) AS customer_services
  FROM companies c
  LEFT JOIN company_employees ce ON ce.company_id = c.id
  LEFT JOIN customer_services cs ON cs.company_id = c.id
  ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
  GROUP BY c.id
  ORDER BY c.created_at DESC
  LIMIT $${i} OFFSET $${i + 1}
`;

    const result = await db.query(query, [...values, limit, offset]);

    const total = result.rows.length ? result.rows[0].total_count : 0;

    res.json({
      companies: result.rows,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error("Get companies error:", err);
    res.status(500).json({ error: "Failed to fetch companies", details: err });
  }
});

// =======================
// Get single company
// =======================
router.get("/:id", async (req, res) => {
  try {
    const result = await db.query(
      `
      SELECT c.*,
        COALESCE(json_agg(DISTINCT ce.*) FILTER (WHERE ce.id IS NOT NULL),'[]') AS company_employees,
        COALESCE(json_agg(DISTINCT cs.*) FILTER (WHERE cs.id IS NOT NULL),'[]') AS customer_services
      FROM companies c
      LEFT JOIN company_employees ce ON ce.company_id = c.id
      LEFT JOIN customer_services cs ON cs.company_id = c.id
      WHERE c.id = $1
      GROUP BY c.id
      `,
      [req.params.id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: "Company not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Get company error:", err);
    res.status(500).json({ error: "Failed to fetch company", details: err });
  }
});

module.exports = router;

