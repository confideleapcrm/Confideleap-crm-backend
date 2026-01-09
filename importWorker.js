// api/importWorker.js
require("dotenv").config();

const { Worker } = require("bullmq");
const XLSX = require("xlsx");
const path = require("path");
const fs = require("fs");
const pool = require("./database/database"); // pg pool
const { investorMapper } = require("./utils/csvMapper").default;
const { prepareInvestorRecord } = require("./utils/investorService");

// Redis connection
// const connection = { host: "127.0.0.1", port: 6379 };

// Worker
new Worker(
  "investor-import",
  async (job) => {
    const { userId, filePath } = job.data;
    console.log("Processing job:", job.id);

    try {
      const resolvedPath = path.resolve(filePath);

      // Check file existence
      if (!fs.existsSync(resolvedPath)) {
        throw new Error(`File does not exist: ${resolvedPath}`);
      }

      // Parse Excel
      const workbook = XLSX.readFile(resolvedPath);
      const sheetData = XLSX.utils.sheet_to_json(
        workbook.Sheets[workbook.SheetNames[0]]
      );

      // Map records
      const records = sheetData.map(investorMapper);

      // --------------------------------------------
      // Deduplication (email-based)
      // --------------------------------------------
      const emails = records.map((r) => r.email).filter(Boolean);
      const existingEmails = new Set();

      const chunkSize = 500;
      for (let i = 0; i < emails.length; i += chunkSize) {
        const chunk = emails.slice(i, i + chunkSize);

        const result = await pool.query(
          `SELECT email FROM investors WHERE email = ANY($1::text[])`,
          [chunk]
        );

        result.rows.forEach((r) => existingEmails.add(r.email));
      }

      const newRecordsRaw = records.filter((r) => !existingEmails.has(r.email));

      // --------------------------------------------
      // Prepare investor records
      // --------------------------------------------
      let preparedRecords = [];
      for (const rawRecord of newRecordsRaw) {
        const prepared = await prepareInvestorRecord(rawRecord, userId);
        preparedRecords.push(prepared);
      }

      // Ensure names fallback to email
      preparedRecords = preparedRecords.map((r) => ({
        ...r,
        first_name: r.first_name || r.email,
        last_name: r.last_name || r.email,
      }));

      // --------------------------------------------
      // Bulk insert investors
      // --------------------------------------------
      const failedRecords = [];
      const insertChunkSize = 50;

      for (let i = 0; i < preparedRecords.length; i += insertChunkSize) {
        const batch = preparedRecords.slice(i, i + insertChunkSize);

        try {
          const values = [];
          const placeholders = [];

          batch.forEach((r, idx) => {
            const baseIndex = idx * 22;
            placeholders.push(`(
              $${baseIndex + 1},  $${baseIndex + 2},  $${baseIndex + 3},
              $${baseIndex + 4},  $${baseIndex + 5},  $${baseIndex + 6},
              $${baseIndex + 7},  $${baseIndex + 8},  $${baseIndex + 9},
              $${baseIndex + 10}, $${baseIndex + 11}, $${baseIndex + 12},
              $${baseIndex + 13}, $${baseIndex + 14}, $${baseIndex + 15},
              $${baseIndex + 16}, $${baseIndex + 17}, $${baseIndex + 18},
              $${baseIndex + 19}, $${baseIndex + 20}, $${baseIndex + 21},
              $${baseIndex + 22}
            )`);

            values.push(
              r.first_name,
              r.last_name,
              r.email,
              r.phone,
              r.job_title,
              r.seniority_level,
              r.bio,
              r.avatar_url,
              r.linkedin_url,
              r.twitter_url,
              r.personal_website,
              r.location,
              r.firm_id,
              r.investment_stages,
              r.sector_preferences,
              r.geographic_preferences,
              r.min_check_size,
              r.max_check_size,
              r.portfolio_companies,
              r.notable_investments,
              r.created_by,
              r.status
            );
          });

          await pool.query(
            `
            INSERT INTO investors (
              first_name, last_name, email, phone, job_title,
              seniority_level, bio, avatar_url, linkedin_url, twitter_url,
              personal_website, location, firm_id,
              investment_stages, sector_preferences, geographic_preferences,
              min_check_size, max_check_size,
              portfolio_companies, notable_investments,
              created_by, status
            ) VALUES ${placeholders.join(",")}
            `,
            values
          );
        } catch (err) {
          console.error("Batch insert failed:", err);
          failedRecords.push(...batch);
        }
      }

      // --------------------------------------------
      // Save failed records to Excel
      // --------------------------------------------
      if (failedRecords.length > 0) {
        const worksheet = XLSX.utils.json_to_sheet(failedRecords);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "FailedRecords");

        const failedFilePath = path.resolve(
          `uploads/failed_investors_${Date.now()}.xlsx`
        );
        XLSX.writeFile(workbook, failedFilePath);
      }

      // Cleanup uploaded file
      fs.unlink(resolvedPath, () => {});

      return {
        total: records.length,
        imported: newRecordsRaw.length,
        skipped: records.length - newRecordsRaw.length,
      };
    } catch (error) {
      console.error("Worker job failed:", error);
      throw error;
    }
  },
  { connection }
);
