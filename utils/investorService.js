// api/utils/investorService.js
const pool = require("../database/database");

/**
 * Resolve firm and prepare investor DB record
 * @param {Object} rawRecord - mapped CSV / request record
 * @param {String} userId - creator user id
 */
async function prepareInvestorRecord(rawRecord, userId) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    let firmId = rawRecord.firmId || null;
    let firmName = rawRecord.firmName || null;

    console.log("Raw firmName:", firmName, "Raw firmId:", firmId);

    const firmTypeDefault = "PMS - Portfolio Management System";

    // ------------------------------------------------------------------
    // Resolve firm_id
    // ------------------------------------------------------------------
    if (!firmId) {
      if (firmName) {
        // 1️⃣ Try finding firm by name
        const findFirmQuery = `
          SELECT id
          FROM investment_firms
          WHERE name = $1
          LIMIT 1
        `;
        const findFirmResult = await client.query(findFirmQuery, [firmName]);

        if (findFirmResult.rows.length > 0) {
          firmId = findFirmResult.rows[0].id;
          console.log("Found existing firm:", firmId);
        } else {
          // 2️⃣ Create new firm
          const insertFirmQuery = `
            INSERT INTO investment_firms (name, type, created_at, updated_at)
            VALUES ($1, $2, NOW(), NOW())
            RETURNING id
          `;
          const insertFirmResult = await client.query(insertFirmQuery, [
            firmName,
            firmTypeDefault,
          ]);

          if (!insertFirmResult.rows[0]?.id) {
            throw new Error("Failed to create new firm");
          }

          firmId = insertFirmResult.rows[0].id;
          console.log("Created new firm:", firmId);
        }
      } else {
        // 3️⃣ Use / create default firm
        const defaultFirmName = "Independent";

        const findDefaultFirmQuery = `
          SELECT id
          FROM investment_firms
          WHERE name = $1
          LIMIT 1
        `;
        const defaultFirmResult = await client.query(findDefaultFirmQuery, [
          defaultFirmName,
        ]);

        if (defaultFirmResult.rows.length > 0) {
          firmId = defaultFirmResult.rows[0].id;
          console.log("Using existing default firm:", firmId);
        } else {
          const insertDefaultFirmQuery = `
            INSERT INTO investment_firms (name, type, created_at, updated_at)
            VALUES ($1, $2, NOW(), NOW())
            RETURNING id
          `;
          const insertDefaultFirmResult = await client.query(
            insertDefaultFirmQuery,
            [defaultFirmName, firmTypeDefault]
          );

          if (!insertDefaultFirmResult.rows[0]?.id) {
            throw new Error("Failed to create default firm");
          }

          firmId = insertDefaultFirmResult.rows[0].id;
          console.log("Created default firm:", firmId);
        }
      }
    }

    await client.query("COMMIT");

    // ------------------------------------------------------------------
    // Return investor record (READY FOR INSERT)
    // ------------------------------------------------------------------
    return {
      first_name: rawRecord.firstName || rawRecord.email,
      last_name: rawRecord.lastName || rawRecord.email,
      email: rawRecord.email,
      phone: rawRecord.phone || null,
      job_title: rawRecord.jobTitle || null,
      seniority_level: rawRecord.seniorityLevel || null,
      bio: rawRecord.bio || null,
      avatar_url: rawRecord.avatarUrl || null,
      linkedin_url: rawRecord.linkedinUrl || null,
      twitter_url: rawRecord.twitterUrl || null,
      personal_website: rawRecord.personalWebsite || null,
      location: rawRecord.location || null,
      firm_id: firmId,
      investment_stages: rawRecord.investmentStages || [],
      sector_preferences: rawRecord.sectorPreferences || [],
      geographic_preferences: rawRecord.geographicPreferences || [],
      min_check_size: rawRecord.minCheckSize || null,
      max_check_size: rawRecord.maxCheckSize || null,
      portfolio_companies: rawRecord.portfolioCompanies || [],
      notable_investments: rawRecord.notableInvestments || [],
      education: rawRecord.education || [],
      experience: rawRecord.experience || [],
      status: rawRecord.status || "cold",
      tags: rawRecord.tags || [],
      notes: rawRecord.notes || null,
      created_by: userId,
      is_active: true,
      created_at: rawRecord.createdAt
        ? new Date(rawRecord.createdAt)
        : new Date(),
      buy_sell_side: rawRecord.buySellSide || null,
      aum: rawRecord.aum || null,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error in prepareInvestorRecord:", error);
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { prepareInvestorRecord };

