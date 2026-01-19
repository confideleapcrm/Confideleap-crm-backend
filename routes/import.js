// // api/routes/import.js
// const express = require('express');
// const Joi = require('joi');
// const multer = require('multer');
// const csv = require('csv-parser');
// const XLSX = require('xlsx');
// const fs = require('fs');
// const path = require('path');
// const pool = require('../database/database');
// const { validateRequest, validateQuery } = require('../middleware/validation');

// const router = express.Router();

// // Configure multer for file uploads
// const storage = multer.diskStorage({
//   destination: (req, file, cb) => {
//     const uploadDir = process.env.UPLOAD_DIR || './uploads';
//     if (!fs.existsSync(uploadDir)) {
//       fs.mkdirSync(uploadDir, { recursive: true });
//     }
//     cb(null, uploadDir);
//   },
//   filename: (req, file, cb) => {
//     const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
//     cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
//   }
// });

// const upload = multer({
//   storage: storage,
//   limits: {
//     fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10485760 // 10MB default
//   },
//   fileFilter: (req, file, cb) => {
//     const allowedTypes = ['.csv', '.xlsx', '.xls', '.json'];
//     const ext = path.extname(file.originalname).toLowerCase();
//     if (allowedTypes.includes(ext)) {
//       cb(null, true);
//     } else {
//       cb(new Error('Invalid file type. Only CSV, Excel, and JSON files are allowed.'));
//     }
//   }
// });

// // Validation schemas
// const createImportJobSchema = Joi.object({
//   jobName: Joi.string().required(),
//   importType: Joi.string().valid('file_upload', 'api_sync', 'manual_entry').required(),
//   importMethod: Joi.string().valid('csv', 'excel', 'json', 'linkedin', 'crm').required(),
//   fieldMapping: Joi.object().optional(),
//   validationRules: Joi.object().optional(),
//   importSettings: Joi.object().optional()
// });

// const updateImportJobSchema = Joi.object({
//   status: Joi.string().valid('pending', 'processing', 'completed', 'failed', 'cancelled').optional(),
//   fieldMapping: Joi.object().optional(),
//   validationRules: Joi.object().optional(),
//   importSettings: Joi.object().optional()
// });

// // Get all import jobs
// router.get('/', async (req, res) => {
//   try {
//     const { page = 1, limit = 20, status, importType } = req.query;
//     const offset = (page - 1) * limit;

//     let whereConditions = ['created_by = $1'];
//     let queryParams = [req.user.id];
//     let paramCount = 1;

//     if (status) {
//       paramCount++;
//       whereConditions.push(`status = $${paramCount}`);
//       queryParams.push(status);
//     }

//     if (importType) {
//       paramCount++;
//       whereConditions.push(`import_type = $${paramCount}`);
//       queryParams.push(importType);
//     }

//     const query = `
//       SELECT 
//         id, job_name, import_type, import_method, status, file_name, file_size,
//         total_records, processed_records, successful_records, failed_records,
//         processing_start, processing_end, created_at, updated_at,
//         COUNT(*) OVER() as total_count
//       FROM import_jobs
//       WHERE ${whereConditions.join(' AND ')}
//       ORDER BY created_at DESC
//       LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
//     `;

//     queryParams.push(limit, offset);

//     const result = await pool.query(query, queryParams);
//     const totalCount = result.rows.length > 0 ? parseInt(result.rows[0].total_count) : 0;

//     const importJobs = result.rows.map(row => ({
//       id: row.id,
//       jobName: row.job_name,
//       importType: row.import_type,
//       importMethod: row.import_method,
//       status: row.status,
//       fileName: row.file_name,
//       fileSize: row.file_size,
//       totalRecords: row.total_records,
//       processedRecords: row.processed_records,
//       successfulRecords: row.successful_records,
//       failedRecords: row.failed_records,
//       processingStart: row.processing_start,
//       processingEnd: row.processing_end,
//       createdAt: row.created_at,
//       updatedAt: row.updated_at
//     }));

//     res.json({
//       importJobs,
//       pagination: {
//         page: parseInt(page),
//         limit: parseInt(limit),
//         total: totalCount,
//         pages: Math.ceil(totalCount / limit)
//       }
//     });
//   } catch (error) {
//     console.error('Get import jobs error:', error);
//     res.status(500).json({ error: 'Failed to fetch import jobs' });
//   }
// });

// // Get import job by ID
// router.get('/:id', async (req, res) => {
//   try {
//     const { id } = req.params;

//     const result = await pool.query(`
//       SELECT * FROM import_jobs 
//       WHERE id = $1 AND created_by = $2
//     `, [id, req.user.id]);

//     if (result.rows.length === 0) {
//       return res.status(404).json({ error: 'Import job not found' });
//     }

//     const job = result.rows[0];
    
//     // Get logs for this job
//     const logsResult = await pool.query(`
//       SELECT * FROM import_job_logs 
//       WHERE import_job_id = $1 
//       ORDER BY logged_at DESC
//     `, [id]);

//     res.json({
//       id: job.id,
//       jobName: job.job_name,
//       importType: job.import_type,
//       importMethod: job.import_method,
//       status: job.status,
//       fileName: job.file_name,
//       fileSize: job.file_size,
//       filePath: job.file_path,
//       totalRecords: job.total_records,
//       processedRecords: job.processed_records,
//       successfulRecords: job.successful_records,
//       failedRecords: job.failed_records,
//       duplicateRecords: job.duplicate_records,
//       fieldMapping: job.field_mapping,
//       validationRules: job.validation_rules,
//       importSettings: job.import_settings,
//       errorSummary: job.error_summary,
//       processingStart: job.processing_start,
//       processingEnd: job.processing_end,
//       createdAt: job.created_at,
//       updatedAt: job.updated_at,
//       logs: logsResult.rows.map(log => ({
//         id: log.id,
//         logLevel: log.log_level,
//         logMessage: log.log_message,
//         recordNumber: log.record_number,
//         fieldName: log.field_name,
//         fieldValue: log.field_value,
//         errorCode: log.error_code,
//         errorDetails: log.error_details,
//         loggedAt: log.logged_at
//       }))
//     });
//   } catch (error) {
//     console.error('Get import job error:', error);
//     res.status(500).json({ error: 'Failed to fetch import job' });
//   }
// });

// // Create import job
// router.post('/', validateRequest(createImportJobSchema), async (req, res) => {
//   try {
//     const {
//       jobName, importType, importMethod, fieldMapping, validationRules, importSettings
//     } = req.body;

//     const result = await pool.query(`
//       INSERT INTO import_jobs (
//         job_name, import_type, import_method, field_mapping, 
//         validation_rules, import_settings, created_by
//       ) VALUES ($1, $2, $3, $4, $5, $6, $7)
//       RETURNING *
//     `, [
//       jobName, importType, importMethod, fieldMapping, 
//       validationRules, importSettings, req.user.id
//     ]);

//     const job = result.rows[0];
//     res.status(201).json({
//       message: 'Import job created successfully',
//       importJob: {
//         id: job.id,
//         jobName: job.job_name,
//         importType: job.import_type,
//         importMethod: job.import_method,
//         status: job.status,
//         createdAt: job.created_at
//       }
//     });
//   } catch (error) {
//     console.error('Create import job error:', error);
//     res.status(500).json({ error: 'Failed to create import job' });
//   }
// });

// // Upload file for import
// router.post('/:id/upload', upload.single('file'), async (req, res) => {
//   try {
//     const { id } = req.params;
//     const file = req.file;

//     if (!file) {
//       return res.status(400).json({ error: 'No file uploaded' });
//     }

//     // Verify job ownership
//     const jobResult = await pool.query(
//       'SELECT id, status FROM import_jobs WHERE id = $1 AND created_by = $2',
//       [id, req.user.id]
//     );

//     if (jobResult.rows.length === 0) {
//       return res.status(404).json({ error: 'Import job not found' });
//     }

//     if (jobResult.rows[0].status !== 'pending') {
//       return res.status(400).json({ error: 'Cannot upload file to non-pending job' });
//     }

//     // Update job with file information
//     await pool.query(`
//       UPDATE import_jobs 
//       SET file_name = $1, file_size = $2, file_path = $3, updated_at = NOW()
//       WHERE id = $4
//     `, [file.originalname, file.size, file.path, id]);

//     // Parse file to get record count
//     let totalRecords = 0;
//     const ext = path.extname(file.originalname).toLowerCase();

//     try {
//       if (ext === '.csv') {
//         totalRecords = await countCSVRecords(file.path);
//       } else if (ext === '.xlsx' || ext === '.xls') {
//         totalRecords = await countExcelRecords(file.path);
//       } else if (ext === '.json') {
//         totalRecords = await countJSONRecords(file.path);
//       }

//       await pool.query(
//         'UPDATE import_jobs SET total_records = $1 WHERE id = $2',
//         [totalRecords, id]
//       );
//     } catch (parseError) {
//       console.error('File parsing error:', parseError);
//       // Continue without record count
//     }

//     res.json({
//       message: 'File uploaded successfully',
//       fileName: file.originalname,
//       fileSize: file.size,
//       totalRecords: totalRecords
//     });
//   } catch (error) {
//     console.error('File upload error:', error);
//     res.status(500).json({ error: 'Failed to upload file' });
//   }
// });

// // Process import job
// router.post('/:id/process', async (req, res) => {
//   try {
//     const { id } = req.params;

//     // Verify job ownership and status
//     const jobResult = await pool.query(
//       'SELECT * FROM import_jobs WHERE id = $1 AND created_by = $2',
//       [id, req.user.id]
//     );

//     if (jobResult.rows.length === 0) {
//       return res.status(404).json({ error: 'Import job not found' });
//     }

//     const job = jobResult.rows[0];

//     if (job.status !== 'pending') {
//       return res.status(400).json({ error: 'Job is not in pending status' });
//     }

//     // Update status to processing
//     await pool.query(`
//       UPDATE import_jobs 
//       SET status = 'processing', processing_start = NOW(), updated_at = NOW()
//       WHERE id = $1
//     `, [id]);

//     // Process the file asynchronously
//     processImportFile(job)
//       .then(() => {
//         console.log(`Import job ${id} completed successfully`);
//       })
//       .catch((error) => {
//         console.error(`Import job ${id} failed:`, error);
//       });

//     res.json({
//       message: 'Import processing started',
//       jobId: id,
//       status: 'processing'
//     });
//   } catch (error) {
//     console.error('Process import job error:', error);
//     res.status(500).json({ error: 'Failed to start import processing' });
//   }
// });

// // Get import templates
// router.get('/templates/list', async (req, res) => {
//   try {
//     const result = await pool.query(`
//       SELECT id, template_name, template_description, import_type, 
//              is_default, is_public, download_count, created_at
//       FROM import_templates
//       WHERE is_public = true OR created_by = $1
//       ORDER BY is_default DESC, template_name ASC
//     `, [req.user.id]);

//     const templates = result.rows.map(row => ({
//       id: row.id,
//       templateName: row.template_name,
//       templateDescription: row.template_description,
//       importType: row.import_type,
//       isDefault: row.is_default,
//       isPublic: row.is_public,
//       downloadCount: row.download_count,
//       createdAt: row.created_at
//     }));

//     res.json({ templates });
//   } catch (error) {
//     console.error('Get import templates error:', error);
//     res.status(500).json({ error: 'Failed to fetch import templates' });
//   }
// });

// // Download import template
// router.get('/templates/:id/download', async (req, res) => {
//   try {
//     const { id } = req.params;

//     const result = await pool.query(`
//       SELECT template_name, field_mapping, sample_data
//       FROM import_templates
//       WHERE id = $1 AND (is_public = true OR created_by = $2)
//     `, [id, req.user.id]);

//     if (result.rows.length === 0) {
//       return res.status(404).json({ error: 'Template not found' });
//     }

//     const template = result.rows[0];
    
//     // Increment download count
//     await pool.query(
//       'UPDATE import_templates SET download_count = download_count + 1 WHERE id = $1',
//       [id]
//     );

//     // Generate CSV content
//     const fieldMapping = template.field_mapping;
//     const sampleData = template.sample_data;
    
//     const headers = Object.keys(fieldMapping);
//     const csvContent = [
//       headers.join(','),
//       ...sampleData.map(row => 
//         headers.map(header => `"${row[header] || ''}"`).join(',')
//       )
//     ].join('\n');

//     res.setHeader('Content-Type', 'text/csv');
//     res.setHeader('Content-Disposition', `attachment; filename="${template.template_name}.csv"`);
//     res.send(csvContent);
//   } catch (error) {
//     console.error('Download template error:', error);
//     res.status(500).json({ error: 'Failed to download template' });
//   }
// });

// // Helper functions
// async function countCSVRecords(filePath) {
//   return new Promise((resolve, reject) => {
//     let count = 0;
//     fs.createReadStream(filePath)
//       .pipe(csv())
//       .on('data', () => count++)
//       .on('end', () => resolve(count))
//       .on('error', reject);
//   });
// }

// async function countExcelRecords(filePath) {
//   try {
//     const workbook = XLSX.readFile(filePath);
//     const sheetName = workbook.SheetNames[0];
//     const worksheet = workbook.Sheets[sheetName];
//     const data = XLSX.utils.sheet_to_json(worksheet);
//     return data.length;
//   } catch (error) {
//     throw new Error('Failed to parse Excel file');
//   }
// }

// async function countJSONRecords(filePath) {
//   try {
//     const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
//     return Array.isArray(data) ? data.length : 1;
//   } catch (error) {
//     throw new Error('Failed to parse JSON file');
//   }
// }

// async function processImportFile(job) {
//   const client = await pool.connect();
  
//   try {
//     await client.query('BEGIN');

//     let records = [];
//     const ext = path.extname(job.file_name).toLowerCase();

//     // Parse file based on type
//     if (ext === '.csv') {
//       records = await parseCSVFile(job.file_path);
//     } else if (ext === '.xlsx' || ext === '.xls') {
//       records = await parseExcelFile(job.file_path);
//     } else if (ext === '.json') {
//       records = await parseJSONFile(job.file_path);
//     }

//     let processedRecords = 0;
//     let successfulRecords = 0;
//     let failedRecords = 0;
//     let duplicateRecords = 0;

//     const fieldMapping = job.field_mapping || {};

//     for (const [index, record] of records.entries()) {
//       try {
//         processedRecords++;

//         // Map fields according to field mapping
//         const mappedRecord = {};
//         Object.keys(fieldMapping).forEach(sourceField => {
//           const targetField = fieldMapping[sourceField];
//           if (record[sourceField] !== undefined) {
//             mappedRecord[targetField] = record[sourceField];
//           }
//         });

//         // Validate required fields
//         if (!mappedRecord.firstName || !mappedRecord.lastName || !mappedRecord.email) {
//           throw new Error('Missing required fields: firstName, lastName, or email');
//         }

//         // Check for duplicates
//         const existingInvestor = await client.query(
//           'SELECT id FROM investors WHERE email = $1 AND created_by = $2',
//           [mappedRecord.email, job.created_by]
//         );

//         if (existingInvestor.rows.length > 0) {
//           duplicateRecords++;
//           await logImportError(client, job.id, 'warning', 'Duplicate email found', index + 1, 'email');
//           continue;
//         }

//         // Create investor record
//         await client.query(`
//           INSERT INTO investors (
//             first_name, last_name, email, phone, job_title, 
//             location, linkedin_url, investment_stages, sector_preferences,
//             min_check_size, max_check_size, status, created_by
//           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
//         `, [
//           mappedRecord.firstName,
//           mappedRecord.lastName,
//           mappedRecord.email,
//           mappedRecord.phone,
//           mappedRecord.jobTitle,
//           mappedRecord.location,
//           mappedRecord.linkedinUrl,
//           mappedRecord.investmentStages ? mappedRecord.investmentStages.split(',').map(s => s.trim()) : null,
//           mappedRecord.sectorPreferences ? mappedRecord.sectorPreferences.split(',').map(s => s.trim()) : null,
//           mappedRecord.minCheckSize ? parseFloat(mappedRecord.minCheckSize) : null,
//           mappedRecord.maxCheckSize ? parseFloat(mappedRecord.maxCheckSize) : null,
//           mappedRecord.status || 'cold',
//           job.created_by
//         ]);

//         successfulRecords++;
//       } catch (error) {
//         failedRecords++;
//         await logImportError(client, job.id, 'error', error.message, index + 1);
//       }
//     }

//     // Update job status
//     await client.query(`
//       UPDATE import_jobs 
//       SET status = 'completed', 
//           processed_records = $1,
//           successful_records = $2,
//           failed_records = $3,
//           duplicate_records = $4,
//           processing_end = NOW(),
//           updated_at = NOW()
//       WHERE id = $5
//     `, [processedRecords, successfulRecords, failedRecords, duplicateRecords, job.id]);

//     await client.query('COMMIT');
//   } catch (error) {
//     await client.query('ROLLBACK');
    
//     // Update job status to failed
//     await client.query(`
//       UPDATE import_jobs 
//       SET status = 'failed', 
//           error_summary = $1,
//           processing_end = NOW(),
//           updated_at = NOW()
//       WHERE id = $2
//     `, [{ error: error.message }, job.id]);

//     throw error;
//   } finally {
//     client.release();
//   }
// }

// async function parseCSVFile(filePath) {
//   return new Promise((resolve, reject) => {
//     const records = [];
//     fs.createReadStream(filePath)
//       .pipe(csv())
//       .on('data', (data) => records.push(data))
//       .on('end', () => resolve(records))
//       .on('error', reject);
//   });
// }

// async function parseExcelFile(filePath) {
//   try {
//     const workbook = XLSX.readFile(filePath);
//     const sheetName = workbook.SheetNames[0];
//     const worksheet = workbook.Sheets[sheetName];
//     return XLSX.utils.sheet_to_json(worksheet);
//   } catch (error) {
//     throw new Error('Failed to parse Excel file');
//   }
// }

// async function parseJSONFile(filePath) {
//   try {
//     const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
//     return Array.isArray(data) ? data : [data];
//   } catch (error) {
//     throw new Error('Failed to parse JSON file');
//   }
// }

// async function logImportError(client, jobId, level, message, recordNumber, fieldName = null) {
//   await client.query(`
//     INSERT INTO import_job_logs (
//       import_job_id, log_level, log_message, record_number, field_name
//     ) VALUES ($1, $2, $3, $4, $5)
//   `, [jobId, level, message, recordNumber, fieldName]);
// }

// module.exports = router;















// api/routes/import.js
const express = require("express");
const Joi = require("joi");
const multer = require("multer");
const csv = require("csv-parser");
const XLSX = require("xlsx");
const fs = require("fs");
const path = require("path");
const db = require("../database/database");
const { validateRequest } = require("../middleware/validation");

const router = express.Router();

/* ======================================================
   MULTER CONFIG
====================================================== */
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = process.env.UPLOAD_DIR || "./uploads";
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${file.fieldname}-${unique}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: Number(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    const allowed = [".csv", ".xlsx", ".xls", ".json"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowed.includes(ext)) {
      return cb(new Error("Invalid file type"));
    }
    cb(null, true);
  },
});

/* ======================================================
   VALIDATION
====================================================== */
const createImportJobSchema = Joi.object({
  jobName: Joi.string().required(),
  importType: Joi.string()
    .valid("file_upload", "api_sync", "manual_entry")
    .required(),
  importMethod: Joi.string()
    .valid("csv", "excel", "json", "linkedin", "crm")
    .required(),
  fieldMapping: Joi.object().optional(),
  validationRules: Joi.object().optional(),
  importSettings: Joi.object().optional(),
});

/* ======================================================
   GET ALL IMPORT JOBS
====================================================== */
router.get("/", async (req, res) => {
  try {
    const { page = 1, limit = 20, status, importType } = req.query;
    const offset = (page - 1) * limit;

    let where = ["created_by = $1"];
    let values = [req.user.id];
    let i = 1;

    if (status) {
      where.push(`status = $${++i}`);
      values.push(status);
    }

    if (importType) {
      where.push(`import_type = $${++i}`);
      values.push(importType);
    }

    const result = await db.query(
      `
      SELECT *,
             COUNT(*) OVER() AS total_count
      FROM import_jobs
      WHERE ${where.join(" AND ")}
      ORDER BY created_at DESC
      LIMIT $${i + 1} OFFSET $${i + 2}
      `,
      [...values, limit, offset]
    );

    const total = result.rows[0]?.total_count || 0;

    res.json({
      importJobs: result.rows.map((r) => ({
        id: r.id,
        jobName: r.job_name,
        importType: r.import_type,
        importMethod: r.import_method,
        status: r.status,
        fileName: r.file_name,
        fileSize: r.file_size,
        totalRecords: r.total_records,
        processedRecords: r.processed_records,
        successfulRecords: r.successful_records,
        failedRecords: r.failed_records,
        duplicateRecords: r.duplicate_records,
        processingStart: r.processing_start,
        processingEnd: r.processing_end,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      })),
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error("Get import jobs error:", err);
    res.status(500).json({ error: "Failed to fetch import jobs" });
  }
});

/* ======================================================
   GET IMPORT JOB BY ID
====================================================== */
router.get("/:id", async (req, res) => {
  try {
    const jobRes = await db.query(
      `SELECT * FROM import_jobs WHERE id = $1 AND created_by = $2`,
      [req.params.id, req.user.id]
    );

    if (!jobRes.rows.length) {
      return res.status(404).json({ error: "Import job not found" });
    }

    const logsRes = await db.query(
      `
      SELECT * FROM import_job_logs
      WHERE import_job_id = $1
      ORDER BY logged_at DESC
      `,
      [req.params.id]
    );

    res.json({
      ...jobRes.rows[0],
      jobName: jobRes.rows[0].job_name,
      importType: jobRes.rows[0].import_type,
      importMethod: jobRes.rows[0].import_method,
      logs: logsRes.rows,
    });
  } catch (err) {
    console.error("Get import job error:", err);
    res.status(500).json({ error: "Failed to fetch import job" });
  }
});

/* ======================================================
   CREATE IMPORT JOB
====================================================== */
router.post("/", validateRequest(createImportJobSchema), async (req, res) => {
  try {
    const { jobName, importType, importMethod, fieldMapping, validationRules, importSettings } =
      req.body;

    const result = await db.query(
      `
      INSERT INTO import_jobs (
        job_name, import_type, import_method,
        field_mapping, validation_rules, import_settings, created_by
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      RETURNING *
      `,
      [
        jobName,
        importType,
        importMethod,
        fieldMapping,
        validationRules,
        importSettings,
        req.user.id,
      ]
    );

    res.status(201).json({
      message: "Import job created successfully",
      importJob: result.rows[0],
    });
  } catch (err) {
    console.error("Create import job error:", err);
    res.status(500).json({ error: "Failed to create import job" });
  }
});

/* ======================================================
   UPLOAD FILE
====================================================== */
router.post("/:id/upload", upload.single("file"), async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: "No file uploaded" });

    const jobRes = await db.query(
      `SELECT status FROM import_jobs WHERE id=$1 AND created_by=$2`,
      [req.params.id, req.user.id]
    );

    if (!jobRes.rows.length) {
      return res.status(404).json({ error: "Import job not found" });
    }

    if (jobRes.rows[0].status !== "pending") {
      return res.status(400).json({ error: "Job not in pending state" });
    }

    await db.query(
      `
      UPDATE import_jobs
      SET file_name=$1, file_size=$2, file_path=$3, updated_at=NOW()
      WHERE id=$4
      `,
      [file.originalname, file.size, file.path, req.params.id]
    );

    res.json({ message: "File uploaded successfully" });
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ error: "File upload failed" });
  }
});

/* ======================================================
   PROCESS IMPORT JOB
====================================================== */
router.post("/:id/process", async (req, res) => {
  try {
    const jobRes = await db.query(
      `SELECT * FROM import_jobs WHERE id=$1 AND created_by=$2`,
      [req.params.id, req.user.id]
    );

    if (!jobRes.rows.length) {
      return res.status(404).json({ error: "Import job not found" });
    }

    if (jobRes.rows[0].status !== "pending") {
      return res.status(400).json({ error: "Job is not pending" });
    }

    await db.query(
      `
      UPDATE import_jobs
      SET status='processing', processing_start=NOW(), updated_at=NOW()
      WHERE id=$1
      `,
      [req.params.id]
    );

    processImportFile(jobRes.rows[0]).catch(console.error);

    res.json({ status: "processing" });
  } catch (err) {
    console.error("Process job error:", err);
    res.status(500).json({ error: "Failed to process job" });
  }
});

/* ======================================================
   HELPERS
====================================================== */
function parseCSV(filePath) {
  return new Promise((resolve, reject) => {
    const rows = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on("data", (d) => rows.push(d))
      .on("end", () => resolve(rows))
      .on("error", reject);
  });
}

function parseExcel(filePath) {
  const wb = XLSX.readFile(filePath);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet);
}

function parseJSON(filePath) {
  const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
  return Array.isArray(data) ? data : [data];
}

async function logImportError(client, jobId, level, message, record, field = null) {
  await client.query(
    `
    INSERT INTO import_job_logs
    (import_job_id, log_level, log_message, record_number, field_name)
    VALUES ($1,$2,$3,$4,$5)
    `,
    [jobId, level, message, record, field]
  );
}

/* ======================================================
   CORE IMPORT LOGIC (TRANSACTION SAFE)
====================================================== */
async function processImportFile(job) {
  const client = await db.connect();
  try {
    await client.query("BEGIN");

    let records = [];
    const ext = path.extname(job.file_name).toLowerCase();

    if (ext === ".csv") records = await parseCSV(job.file_path);
    if (ext === ".xlsx" || ext === ".xls") records = parseExcel(job.file_path);
    if (ext === ".json") records = parseJSON(job.file_path);

    let processed = 0;
    let success = 0;
    let failed = 0;
    let duplicate = 0;

    const mapping = job.field_mapping || {};

    for (const [idx, rec] of records.entries()) {
      try {
        processed++;

        const mapped = {};
        Object.keys(mapping).forEach((k) => {
          if (rec[k] !== undefined) mapped[mapping[k]] = rec[k];
        });

        if (!mapped.firstName || !mapped.lastName || !mapped.email) {
          throw new Error("Missing required fields");
        }

        const dup = await client.query(
          `SELECT id FROM investors WHERE email=$1 AND created_by=$2`,
          [mapped.email, job.created_by]
        );

        if (dup.rows.length) {
          duplicate++;
          await logImportError(client, job.id, "warning", "Duplicate email", idx + 1, "email");
          continue;
        }

        await client.query(
          `
          INSERT INTO investors (
            first_name,last_name,email,phone,job_title,
            location,linkedin_url,investment_stages,sector_preferences,
            min_check_size,max_check_size,status,created_by
          )
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
          `,
          [
            mapped.firstName,
            mapped.lastName,
            mapped.email,
            mapped.phone,
            mapped.jobTitle,
            mapped.location,
            mapped.linkedinUrl,
            mapped.investmentStages?.split(",").map((s) => s.trim()) || null,
            mapped.sectorPreferences?.split(",").map((s) => s.trim()) || null,
            mapped.minCheckSize ? Number(mapped.minCheckSize) : null,
            mapped.maxCheckSize ? Number(mapped.maxCheckSize) : null,
            mapped.status || "cold",
            job.created_by,
          ]
        );

        success++;
      } catch (err) {
        failed++;
        await logImportError(client, job.id, "error", err.message, idx + 1);
      }
    }

    await client.query(
      `
      UPDATE import_jobs
      SET status='completed',
          processed_records=$1,
          successful_records=$2,
          failed_records=$3,
          duplicate_records=$4,
          processing_end=NOW(),
          updated_at=NOW()
      WHERE id=$5
      `,
      [processed, success, failed, duplicate, job.id]
    );

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    await client.query(
      `
      UPDATE import_jobs
      SET status='failed',
          error_summary=$1,
          updated_at=NOW()
      WHERE id=$2
      `,
      [{ error: err.message }, job.id]
    );
    throw err;
  } finally {
    client.release();
  }
}

module.exports = router;

