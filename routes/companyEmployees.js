// routes/companyEmployees.js
const express = require("express");
const router = express.Router();
const db = require("../database/database");

// =======================
// Normalize employee input keys
// =======================
function normalizeEmp(emp) {
  return {
    company_id: emp.company_id || emp.companyId || null,
    first_name: emp.first_name ?? emp.firstName ?? "",
    last_name: emp.last_name ?? emp.lastName ?? "",
    email: emp.email ?? "",
    designation: emp.designation ?? "",
    phone: emp.phone ?? emp.contact_number ?? "",
    linkedin_url: emp.linkedin_url ?? emp.linkedin ?? "",
    is_primary:
      typeof emp.is_primary !== "undefined"
        ? emp.is_primary
        : emp.isPrimary ?? false,
    created_at: new Date(),
    updated_at: new Date(),
  };
}

// =======================
// POST /api/company_employees
// Accepts single object or array
// =======================
router.post("/", async (req, res) => {
  try {
    const employees = Array.isArray(req.body) ? req.body : [req.body];

    if (!employees.length) {
      return res.status(400).json({ error: "No employee data provided" });
    }

    for (const emp of employees) {
      const companyId = emp.company_id || emp.companyId || null;
      if (!companyId) {
        return res
          .status(400)
          .json({ error: "Each employee must include company_id" });
      }
    }

    const rows = employees.map(normalizeEmp);

    const values = [];
    const placeholders = rows.map((row, i) => {
      const base = i * 9;
      values.push(
        row.company_id,
        row.first_name,
        row.last_name,
        row.email,
        row.designation,
        row.phone,
        row.linkedin_url,
        row.is_primary,
        row.created_at,
        row.updated_at
      );
      return `(
        $${base + 1}, $${base + 2}, $${base + 3}, $${base + 4},
        $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8},
        $${base + 9}, $${base + 10}
      )`;
    });

    const result = await db.query(
      `
      INSERT INTO company_employees (
        company_id, first_name, last_name, email,
        designation, phone, linkedin_url, is_primary,
        created_at, updated_at
      )
      VALUES ${placeholders.join(",")}
      RETURNING *
      `,
      values
    );

    return res.status(201).json(result.rows);
  } catch (err) {
    console.error("Insert company_employees error:", err);
    return res.status(500).json({
      error: "Failed to insert employees",
      details: err?.message ?? err,
    });
  }
});

// =======================
// GET /api/company_employees?company_id=<id>
// =======================
router.get("/", async (req, res) => {
  try {
    const { company_id } = req.query;

    if (!company_id) {
      return res
        .status(400)
        .json({ error: "company_id query param required" });
    }

    const result = await db.query(
      `
      SELECT *
      FROM company_employees
      WHERE company_id = $1
      ORDER BY created_at DESC
      `,
      [company_id]
    );

    return res.json(result.rows);
  } catch (err) {
    console.error("Get employees error:", err);
    return res.status(500).json({
      error: "Failed to fetch employees",
      details: err?.message ?? err,
    });
  }
});

// =======================
// PATCH /api/company_employees/:id
// Update single employee
// =======================
router.patch("/:id", async (req, res) => {
  try {
    const employeeId = req.params.id;

    const updates = {
      first_name: req.body.first_name ?? req.body.firstName ?? "",
      last_name: req.body.last_name ?? req.body.lastName ?? "",
      email: req.body.email ?? "",
      designation: req.body.designation ?? "",
      phone: req.body.phone ?? "",
      linkedin_url: req.body.linkedin_url ?? req.body.linkedin ?? "",
      updated_at: new Date(),
    };

    const fields = Object.keys(updates);
    const values = Object.values(updates);

    const setClause = fields
      .map((field, i) => `${field} = $${i + 1}`)
      .join(", ");

    const result = await db.query(
      `
      UPDATE company_employees
      SET ${setClause}
      WHERE id = $${fields.length + 1}
      RETURNING *
      `,
      [...values, employeeId]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: "Employee not found" });
    }

    return res.json(result.rows[0]);
  } catch (err) {
    console.error("Update employee error:", err);
    return res.status(500).json({
      error: "Failed to update employee",
      details: err.message,
    });
  }
});

// =======================
// DELETE /api/company_employees/:id
// =======================
router.delete("/:id", async (req, res) => {
  try {
    const employeeId = req.params.id;

    const result = await db.query(
      `
      DELETE FROM company_employees
      WHERE id = $1
      RETURNING id
      `,
      [employeeId]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: "Employee not found" });
    }

    return res.json({ success: true });
  } catch (err) {
    console.error("Delete employee error:", err);
    return res.status(500).json({
      error: "Failed to delete employee",
      details: err.message,
    });
  }
});

module.exports = router;
