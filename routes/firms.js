// api/routes/firms.js
const express = require('express');
const Joi = require('joi');
const pool = require('../database/database');
const { validateRequest, validateQuery } = require('../middleware/validation');

const router = express.Router();

/* ----------------------------------------------------
   VALIDATION SCHEMAS
---------------------------------------------------- */
const createFirmSchema = Joi.object({
  name: Joi.string().required(),
  type: Joi.string()
    .valid(
      'VC',
      'PE',
      'Corporate VC',
      'Angel Group',
      'Family Office',
      'Hedge Fund',
      'Investment Bank'
    )
    .required(),
  website: Joi.string().uri().optional(),
  description: Joi.string().optional(),
  logoUrl: Joi.string().uri().optional(),
  headquarters: Joi.string().optional(),
  foundedYear: Joi.number().integer().min(1800).max(new Date().getFullYear()).optional(),
  aum: Joi.number().min(0).optional(),
  portfolioSize: Joi.number().integer().min(0).optional(),
  investmentStages: Joi.array().items(Joi.string()).optional(),
  sectorFocus: Joi.array().items(Joi.string()).optional(),
  geographicFocus: Joi.array().items(Joi.string()).optional(),
  minInvestment: Joi.number().min(0).optional(),
  maxInvestment: Joi.number().min(0).optional(),
  typicalInvestment: Joi.number().min(0).optional(),
  linkedinUrl: Joi.string().uri().optional(),
  twitterUrl: Joi.string().uri().optional(),
  crunchbaseUrl: Joi.string().uri().optional(),
});

const updateFirmSchema = createFirmSchema.fork(['name', 'type'], (schema) =>
  schema.optional()
);

const querySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  search: Joi.string().optional(),
  type: Joi.string().optional(),
  sortBy: Joi.string()
    .valid('name', 'type', 'aum', 'portfolioSize', 'createdAt')
    .default('name'),
  sortOrder: Joi.string().valid('asc', 'desc').default('asc'),
});

/* ----------------------------------------------------
   GET ALL INVESTMENT FIRMS
---------------------------------------------------- */
router.get('/', validateQuery(querySchema), async (req, res) => {
  try {
    const { page, limit, search, type, sortBy, sortOrder } = req.query;
    const offset = (page - 1) * limit;

    let whereConditions = ['is_active = true'];
    let queryParams = [];
    let paramCount = 0;

    if (search) {
      paramCount++;
      whereConditions.push(`(name ILIKE $${paramCount} OR description ILIKE $${paramCount})`);
      queryParams.push(`%${search}%`);
    }

    if (type) {
      paramCount++;
      whereConditions.push(`type = $${paramCount}`);
      queryParams.push(type);
    }

    let sortClause = `name ${sortOrder.toUpperCase()}`;
    if (sortBy === 'type') sortClause = `type ${sortOrder.toUpperCase()}`;
    if (sortBy === 'aum') sortClause = `aum ${sortOrder.toUpperCase()} NULLS LAST`;
    if (sortBy === 'portfolioSize')
      sortClause = `portfolio_size ${sortOrder.toUpperCase()} NULLS LAST`;
    if (sortBy === 'createdAt')
      sortClause = `created_at ${sortOrder.toUpperCase()}`;

    const query = `
      SELECT 
        id, name, type, website, description, logo_url, headquarters,
        founded_year, aum, portfolio_size, investment_stages, sector_focus,
        geographic_focus, min_investment, max_investment, typical_investment,
        linkedin_url, twitter_url, crunchbase_url, created_at, updated_at,
        COUNT(*) OVER() AS total_count
      FROM investment_firms
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY ${sortClause}
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `;

    queryParams.push(limit, offset);

    const result = await pool.query(query, queryParams);
    const totalCount =
      result.rows.length > 0 ? parseInt(result.rows[0].total_count) : 0;

    const firms = result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      type: row.type,
      website: row.website,
      description: row.description,
      logoUrl: row.logo_url,
      headquarters: row.headquarters,
      foundedYear: row.founded_year,
      aum: row.aum ? parseFloat(row.aum) : null,
      portfolioSize: row.portfolio_size,
      investmentStages: row.investment_stages,
      sectorFocus: row.sector_focus,
      geographicFocus: row.geographic_focus,
      minInvestment: row.min_investment ? parseFloat(row.min_investment) : null,
      maxInvestment: row.max_investment ? parseFloat(row.max_investment) : null,
      typicalInvestment: row.typical_investment
        ? parseFloat(row.typical_investment)
        : null,
      linkedinUrl: row.linkedin_url,
      twitterUrl: row.twitter_url,
      crunchbaseUrl: row.crunchbase_url,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    res.json({
      firms,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount,
        pages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error) {
    console.error('Get investment firms error:', error);
    res.status(500).json({ error: 'Failed to fetch investment firms' });
  }
});

/* ----------------------------------------------------
   GET INVESTMENT FIRM BY ID
---------------------------------------------------- */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const firmResult = await pool.query(
      `SELECT * FROM investment_firms WHERE id = $1 AND is_active = true`,
      [id]
    );

    if (firmResult.rows.length === 0) {
      return res.status(404).json({ error: 'Investment firm not found' });
    }

    const firm = firmResult.rows[0];

    const investorsResult = await pool.query(
      `
      SELECT 
        id, first_name, last_name, job_title, email, status
      FROM investors
      WHERE firm_id = $1 AND is_active = true
      ORDER BY first_name, last_name
      `,
      [id]
    );

    res.json({
      id: firm.id,
      name: firm.name,
      type: firm.type,
      website: firm.website,
      description: firm.description,
      logoUrl: firm.logo_url,
      headquarters: firm.headquarters,
      foundedYear: firm.founded_year,
      aum: firm.aum ? parseFloat(firm.aum) : null,
      portfolioSize: firm.portfolio_size,
      investmentStages: firm.investment_stages,
      sectorFocus: firm.sector_focus,
      geographicFocus: firm.geographic_focus,
      minInvestment: firm.min_investment ? parseFloat(firm.min_investment) : null,
      maxInvestment: firm.max_investment ? parseFloat(firm.max_investment) : null,
      typicalInvestment: firm.typical_investment
        ? parseFloat(firm.typical_investment)
        : null,
      linkedinUrl: firm.linkedin_url,
      twitterUrl: firm.twitter_url,
      crunchbaseUrl: firm.crunchbase_url,
      createdAt: firm.created_at,
      updatedAt: firm.updated_at,
      investors: investorsResult.rows.map((inv) => ({
        id: inv.id,
        firstName: inv.first_name,
        lastName: inv.last_name,
        jobTitle: inv.job_title,
        email: inv.email,
        status: inv.status,
      })),
    });
  } catch (error) {
    console.error('Get investment firm error:', error);
    res.status(500).json({ error: 'Failed to fetch investment firm' });
  }
});

/* ----------------------------------------------------
   CREATE INVESTMENT FIRM
---------------------------------------------------- */
router.post('/', validateRequest(createFirmSchema), async (req, res) => {
  try {
    const {
      name,
      type,
      website,
      description,
      logoUrl,
      headquarters,
      foundedYear,
      aum,
      portfolioSize,
      investmentStages,
      sectorFocus,
      geographicFocus,
      minInvestment,
      maxInvestment,
      typicalInvestment,
      linkedinUrl,
      twitterUrl,
      crunchbaseUrl,
    } = req.body;

    const result = await pool.query(
      `
      INSERT INTO investment_firms (
        name, type, website, description, logo_url, headquarters,
        founded_year, aum, portfolio_size, investment_stages,
        sector_focus, geographic_focus, min_investment,
        max_investment, typical_investment,
        linkedin_url, twitter_url, crunchbase_url
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
        $11,$12,$13,$14,$15,$16,$17,$18
      )
      RETURNING *
      `,
      [
        name,
        type,
        website,
        description,
        logoUrl,
        headquarters,
        foundedYear,
        aum,
        portfolioSize,
        investmentStages,
        sectorFocus,
        geographicFocus,
        minInvestment,
        maxInvestment,
        typicalInvestment,
        linkedinUrl,
        twitterUrl,
        crunchbaseUrl,
      ]
    );

    const firm = result.rows[0];

    res.status(201).json({
      message: 'Investment firm created successfully',
      firm: {
        id: firm.id,
        name: firm.name,
        type: firm.type,
        createdAt: firm.created_at,
      },
    });
  } catch (error) {
    console.error('Create investment firm error:', error);
    res.status(500).json({ error: 'Failed to create investment firm' });
  }
});

/* ----------------------------------------------------
   UPDATE INVESTMENT FIRM
---------------------------------------------------- */
router.put('/:id', validateRequest(updateFirmSchema), async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const existingFirm = await pool.query(
      'SELECT id FROM investment_firms WHERE id = $1 AND is_active = true',
      [id]
    );

    if (existingFirm.rows.length === 0) {
      return res.status(404).json({ error: 'Investment firm not found' });
    }

    const updateFields = [];
    const values = [];
    let paramCount = 0;

    const fieldMapping = {
      name: 'name',
      type: 'type',
      website: 'website',
      description: 'description',
      logoUrl: 'logo_url',
      headquarters: 'headquarters',
      foundedYear: 'founded_year',
      aum: 'aum',
      portfolioSize: 'portfolio_size',
      investmentStages: 'investment_stages',
      sectorFocus: 'sector_focus',
      geographicFocus: 'geographic_focus',
      minInvestment: 'min_investment',
      maxInvestment: 'max_investment',
      typicalInvestment: 'typical_investment',
      linkedinUrl: 'linkedin_url',
      twitterUrl: 'twitter_url',
      crunchbaseUrl: 'crunchbase_url',
    };

    Object.keys(updates).forEach((key) => {
      if (fieldMapping[key] && updates[key] !== undefined) {
        paramCount++;
        updateFields.push(`${fieldMapping[key]} = $${paramCount}`);
        values.push(updates[key]);
      }
    });

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    paramCount++;
    updateFields.push(`updated_at = $${paramCount}`);
    values.push(new Date());

    paramCount++;
    values.push(id);

    const query = `
      UPDATE investment_firms
      SET ${updateFields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await pool.query(query, values);
    const firm = result.rows[0];

    res.json({
      message: 'Investment firm updated successfully',
      firm: {
        id: firm.id,
        name: firm.name,
        type: firm.type,
        updatedAt: firm.updated_at,
      },
    });
  } catch (error) {
    console.error('Update investment firm error:', error);
    res.status(500).json({ error: 'Failed to update investment firm' });
  }
});

/* ----------------------------------------------------
   DELETE INVESTMENT FIRM (SOFT DELETE)
---------------------------------------------------- */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const investorsResult = await pool.query(
      'SELECT COUNT(*) FROM investors WHERE firm_id = $1 AND is_active = true',
      [id]
    );

    const investorCount = parseInt(investorsResult.rows[0].count, 10);

    if (investorCount > 0) {
      return res.status(400).json({
        error: 'Cannot delete firm with associated investors',
        investorCount,
      });
    }

    const result = await pool.query(
      `
      UPDATE investment_firms
      SET is_active = false, updated_at = NOW()
      WHERE id = $1
      RETURNING id
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Investment firm not found' });
    }

    res.json({ message: 'Investment firm deleted successfully' });
  } catch (error) {
    console.error('Delete investment firm error:', error);
    res.status(500).json({ error: 'Failed to delete investment firm' });
  }
});

/* ----------------------------------------------------
   FIRM STATISTICS
---------------------------------------------------- */
router.get('/:id/statistics', async (req, res) => {
  try {
    const { id } = req.params;

    const stats = await pool.query(
      `
      SELECT
        (SELECT COUNT(*) FROM investors WHERE firm_id = $1 AND is_active = true) AS total_investors,
        (SELECT COUNT(*) FROM investors WHERE firm_id = $1 AND status = 'hot') AS hot_investors,
        (SELECT COUNT(*) FROM investors WHERE firm_id = $1 AND status = 'warm') AS warm_investors,
        (SELECT COALESCE(AVG(portfolio_fit_score),0) FROM investors WHERE firm_id = $1) AS avg_portfolio_fit,
        (SELECT COALESCE(AVG(engagement_score),0) FROM investors WHERE firm_id = $1) AS avg_engagement_score,
        (SELECT COUNT(*) FROM communications c
         JOIN investors i ON c.investor_id = i.id
         WHERE i.firm_id = $1) AS total_communications,
        (SELECT COUNT(*) FROM meetings m
         JOIN meeting_participants mp ON m.id = mp.meeting_id
         JOIN investors i ON mp.investor_id = i.id
         WHERE i.firm_id = $1) AS total_meetings
      `,
      [id]
    );

    const s = stats.rows[0];

    res.json({
      statistics: {
        totalInvestors: parseInt(s.total_investors, 10),
        hotInvestors: parseInt(s.hot_investors, 10),
        warmInvestors: parseInt(s.warm_investors, 10),
        avgPortfolioFit: parseFloat(s.avg_portfolio_fit),
        avgEngagementScore: parseFloat(s.avg_engagement_score),
        totalCommunications: parseInt(s.total_communications, 10),
        totalMeetings: parseInt(s.total_meetings, 10),
      },
    });
  } catch (error) {
    console.error('Get firm statistics error:', error);
    res.status(500).json({ error: 'Failed to fetch firm statistics' });
  }
});

/* ----------------------------------------------------
   FIRM METRICS OVER TIME
---------------------------------------------------- */
router.get('/:id/metrics', async (req, res) => {
  try {
    const { id } = req.params;
    const { startDate, endDate } = req.query;

    let dateFilter = '';
    const params = [id];

    if (startDate && endDate) {
      dateFilter = 'AND metric_date BETWEEN $2 AND $3';
      params.push(startDate, endDate);
    }

    const result = await pool.query(
      `
      SELECT
        metric_date,
        total_portfolio_companies,
        active_investments,
        new_investments_this_period,
        avg_investment_size,
        total_aum,
        deployment_rate,
        portfolio_performance_score
      FROM investment_firm_metrics
      WHERE firm_id = $1 ${dateFilter}
      ORDER BY metric_date DESC
      `,
      params
    );

    const metrics = result.rows.map((row) => ({
      metricDate: row.metric_date,
      totalPortfolioCompanies: row.total_portfolio_companies,
      activeInvestments: row.active_investments,
      newInvestmentsThisPeriod: row.new_investments_this_period,
      avgInvestmentSize: row.avg_investment_size
        ? parseFloat(row.avg_investment_size)
        : null,
      totalAum: row.total_aum ? parseFloat(row.total_aum) : null,
      deploymentRate: row.deployment_rate
        ? parseFloat(row.deployment_rate)
        : null,
      portfolioPerformanceScore: row.portfolio_performance_score,
    }));

    res.json({ metrics });
  } catch (error) {
    console.error('Get firm metrics error:', error);
    res.status(500).json({ error: 'Failed to fetch firm metrics' });
  }
});

/* ----------------------------------------------------
   SEARCH FIRMS
---------------------------------------------------- */
router.post('/search', async (req, res) => {
  try {
    const {
      name,
      type,
      investmentStages,
      sectorFocus,
      geographicFocus,
      minAum,
      maxAum,
      minInvestment,
      maxInvestment,
    } = req.body;

    let where = ['is_active = true'];
    let params = [];
    let i = 0;

    if (name) {
      i++;
      where.push(`name ILIKE $${i}`);
      params.push(`%${name}%`);
    }

    if (type) {
      i++;
      where.push(`type = $${i}`);
      params.push(type);
    }

    if (investmentStages?.length) {
      i++;
      where.push(`investment_stages && $${i}`);
      params.push(investmentStages);
    }

    if (sectorFocus?.length) {
      i++;
      where.push(`sector_focus && $${i}`);
      params.push(sectorFocus);
    }

    if (geographicFocus?.length) {
      i++;
      where.push(`geographic_focus && $${i}`);
      params.push(geographicFocus);
    }

    if (minAum) {
      i++;
      where.push(`aum >= $${i}`);
      params.push(minAum);
    }

    if (maxAum) {
      i++;
      where.push(`aum <= $${i}`);
      params.push(maxAum);
    }

    if (minInvestment) {
      i++;
      where.push(`min_investment >= $${i}`);
      params.push(minInvestment);
    }

    if (maxInvestment) {
      i++;
      where.push(`max_investment <= $${i}`);
      params.push(maxInvestment);
    }

    const result = await pool.query(
      `
      SELECT
        id, name, type, website, description, headquarters,
        aum, portfolio_size, investment_stages, sector_focus,
        geographic_focus, min_investment, max_investment, typical_investment
      FROM investment_firms
      WHERE ${where.join(' AND ')}
      ORDER BY name ASC
      LIMIT 100
      `,
      params
    );

    const firms = result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      type: row.type,
      website: row.website,
      description: row.description,
      headquarters: row.headquarters,
      aum: row.aum ? parseFloat(row.aum) : null,
      portfolioSize: row.portfolio_size,
      investmentStages: row.investment_stages,
      sectorFocus: row.sector_focus,
      geographicFocus: row.geographic_focus,
      minInvestment: row.min_investment
        ? parseFloat(row.min_investment)
        : null,
      maxInvestment: row.max_investment
        ? parseFloat(row.max_investment)
        : null,
      typicalInvestment: row.typical_investment
        ? parseFloat(row.typical_investment)
        : null,
    }));

    res.json({ firms });
  } catch (error) {
    console.error('Search firms error:', error);
    res.status(500).json({ error: 'Failed to search investment firms' });
  }
});

module.exports = router;
