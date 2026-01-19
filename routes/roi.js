// routes/roi.js
const express = require('express');
const Joi = require('joi');
const pool = require('../database/database');
const { validateRequest, validateQuery } = require('../middleware/validation');

const router = express.Router();

// Validation schemas
const createROIAnalysisSchema = Joi.object({
  analysisType: Joi.string().valid('campaign', 'investor', 'channel', 'overall').required(),
  entityId: Joi.string().uuid().optional(),
  entityType: Joi.string().valid('campaign', 'investor', 'channel').optional(),
  timePeriod: Joi.string().valid('daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'custom').required(),
  periodStart: Joi.date().required(),
  periodEnd: Joi.date().required(),
  totalInvestment: Joi.number().min(0).required(),
  totalReturn: Joi.number().min(0).required()
});

const querySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  analysisType: Joi.string().valid('campaign', 'investor', 'channel', 'overall').optional(),
  timePeriod: Joi.string().valid('daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'custom').optional(),
  sortBy: Joi.string().valid('roi_percentage', 'total_return', 'total_investment', 'calculated_at').default('calculated_at'),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc')
});

// Get ROI analysis data
router.get('/', validateQuery(querySchema), async (req, res) => {
  try {
    const { page, limit, analysisType, timePeriod, sortBy, sortOrder } = req.query;
    const offset = (page - 1) * limit;

    let whereConditions = ['1=1']; // Base condition
    let queryParams = [];
    let paramCount = 0;

    if (analysisType) {
      paramCount++;
      whereConditions.push(`analysis_type = $${paramCount}`);
      queryParams.push(analysisType);
    }

    if (timePeriod) {
      paramCount++;
      whereConditions.push(`time_period = $${paramCount}`);
      queryParams.push(timePeriod);
    }

    const query = `
      SELECT 
        ra.*, 
        CASE 
          WHEN ra.entity_type = 'campaign' THEN c.name
          WHEN ra.entity_type = 'investor' THEN CONCAT(i.first_name, ' ', i.last_name)
          ELSE ra.entity_type
        END as entity_name,
        COUNT(*) OVER() as total_count
      FROM roi_analysis ra
      LEFT JOIN campaigns c ON ra.entity_id = c.id AND ra.entity_type = 'campaign'
      LEFT JOIN investors i ON ra.entity_id = i.id AND ra.entity_type = 'investor'
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY ${sortBy} ${sortOrder.toUpperCase()}
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `;

    queryParams.push(limit, offset);

    const result = await pool.query(query, queryParams);
    const totalCount = result.rows.length > 0 ? parseInt(result.rows[0].total_count) : 0;

    const roiAnalysis = result.rows.map(row => ({
      id: row.id,
      analysisType: row.analysis_type,
      entityId: row.entity_id,
      entityType: row.entity_type,
      entityName: row.entity_name,
      timePeriod: row.time_period,
      periodStart: row.period_start,
      periodEnd: row.period_end,
      totalInvestment: parseFloat(row.total_investment),
      totalReturn: parseFloat(row.total_return),
      roiPercentage: parseFloat(row.roi_percentage),
      costPerLead: row.cost_per_lead ? parseFloat(row.cost_per_lead) : null,
      costPerMeeting: row.cost_per_meeting ? parseFloat(row.cost_per_meeting) : null,
      costPerInvestment: row.cost_per_investment ? parseFloat(row.cost_per_investment) : null,
      ltvCacRatio: row.ltv_cac_ratio ? parseFloat(row.ltv_cac_ratio) : null,
      paybackPeriodMonths: row.payback_period_months ? parseFloat(row.payback_period_months) : null,
      breakEvenPoint: row.break_even_point,
      investmentBreakdown: row.investment_breakdown,
      returnBreakdown: row.return_breakdown,
      calculatedAt: row.calculated_at,
      createdAt: row.created_at
    }));

    res.json({
      roiAnalysis,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount,
        pages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error) {
    console.error('Get ROI analysis error:', error);
    res.status(500).json({ error: 'Failed to fetch ROI analysis' });
  }
});

// Get ROI analysis by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(`
      SELECT ra.*, 
        CASE 
          WHEN ra.entity_type = 'campaign' THEN c.name
          WHEN ra.entity_type = 'investor' THEN CONCAT(i.first_name, ' ', i.last_name)
          ELSE ra.entity_type
        END as entity_name
      FROM roi_analysis ra
      LEFT JOIN campaigns c ON ra.entity_id = c.id AND ra.entity_type = 'campaign'
      LEFT JOIN investors i ON ra.entity_id = i.id AND ra.entity_type = 'investor'
      WHERE ra.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'ROI analysis not found' });
    }

    const analysis = result.rows[0];
    res.json({
      id: analysis.id,
      analysisType: analysis.analysis_type,
      entityId: analysis.entity_id,
      entityType: analysis.entity_type,
      entityName: analysis.entity_name,
      timePeriod: analysis.time_period,
      periodStart: analysis.period_start,
      periodEnd: analysis.period_end,
      totalInvestment: parseFloat(analysis.total_investment),
      totalReturn: parseFloat(analysis.total_return),
      roiPercentage: parseFloat(analysis.roi_percentage),
      costPerLead: analysis.cost_per_lead ? parseFloat(analysis.cost_per_lead) : null,
      costPerMeeting: analysis.cost_per_meeting ? parseFloat(analysis.cost_per_meeting) : null,
      costPerInvestment: analysis.cost_per_investment ? parseFloat(analysis.cost_per_investment) : null,
      ltvCacRatio: analysis.ltv_cac_ratio ? parseFloat(analysis.ltv_cac_ratio) : null,
      paybackPeriodMonths: analysis.payback_period_months ? parseFloat(analysis.payback_period_months) : null,
      breakEvenPoint: analysis.break_even_point,
      investmentBreakdown: analysis.investment_breakdown,
      returnBreakdown: analysis.return_breakdown,
      calculatedAt: analysis.calculated_at,
      createdAt: analysis.created_at
    });
  } catch (error) {
    console.error('Get ROI analysis error:', error);
    res.status(500).json({ error: 'Failed to fetch ROI analysis' });
  }
});

// Create ROI analysis
router.post('/', validateRequest(createROIAnalysisSchema), async (req, res) => {
  try {
    const {
      analysisType, entityId, entityType, timePeriod, periodStart, periodEnd,
      totalInvestment, totalReturn
    } = req.body;

    // Calculate ROI percentage
    const roiPercentage = totalInvestment > 0 
      ? ((totalReturn - totalInvestment) / totalInvestment) * 100 
      : 0;

    const result = await pool.query(`
      INSERT INTO roi_analysis (
        analysis_type, entity_id, entity_type, time_period,
        period_start, period_end, total_investment, total_return, roi_percentage
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [
      analysisType, entityId, entityType, timePeriod,
      periodStart, periodEnd, totalInvestment, totalReturn, roiPercentage
    ]);

    const analysis = result.rows[0];
    res.status(201).json({
      message: 'ROI analysis created successfully',
      roiAnalysis: {
        id: analysis.id,
        analysisType: analysis.analysis_type,
        roiPercentage: parseFloat(analysis.roi_percentage),
        createdAt: analysis.created_at
      }
    });
  } catch (error) {
    console.error('Create ROI analysis error:', error);
    res.status(500).json({ error: 'Failed to create ROI analysis' });
  }
});

// Calculate ROI for specific entity
router.post('/calculate', async (req, res) => {
  try {
    const { entityType, entityId, periodStart, periodEnd } = req.body;

    if (!entityType || !periodStart || !periodEnd) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    // Call the database function to calculate ROI
    const result = await pool.query(`
      SELECT calculate_roi_analysis($1, $2, $3, $4) as roi_percentage
    `, [entityType, entityId, periodStart, periodEnd]);

    const roiPercentage = parseFloat(result.rows[0].roi_percentage);

    res.json({
      message: 'ROI calculated successfully',
      entityType,
      entityId,
      periodStart,
      periodEnd,
      roiPercentage
    });
  } catch (error) {
    console.error('Calculate ROI error:', error);
    res.status(500).json({ error: 'Failed to calculate ROI' });
  }
});

// Get cost tracking data
router.get('/costs/tracking', async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      category, 
      startDate, 
      endDate,
      campaignId 
    } = req.query;
    const offset = (page - 1) * limit;

    let whereConditions = ['created_by = $1'];
    let queryParams = [req.user.id];
    let paramCount = 1;

    if (category) {
      paramCount++;
      whereConditions.push(`cost_category = $${paramCount}`);
      queryParams.push(category);
    }

    if (startDate && endDate) {
      paramCount++;
      whereConditions.push(`cost_date BETWEEN $${paramCount} AND $${paramCount + 1}`);
      queryParams.push(startDate, endDate);
      paramCount++;
    }

    if (campaignId) {
      paramCount++;
      whereConditions.push(`campaign_id = $${paramCount}`);
      queryParams.push(campaignId);
    }

    const query = `
      SELECT 
        ct.*, c.name as campaign_name,
        COUNT(*) OVER() as total_count
      FROM cost_tracking ct
      LEFT JOIN campaigns c ON ct.campaign_id = c.id
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY ct.cost_date DESC, ct.amount DESC
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `;

    queryParams.push(limit, offset);

    const result = await pool.query(query, queryParams);
    const totalCount = result.rows.length > 0 ? parseInt(result.rows[0].total_count) : 0;

    const costs = result.rows.map(row => ({
      id: row.id,
      costCategory: row.cost_category,
      costSubcategory: row.cost_subcategory,
      costDescription: row.cost_description,
      amount: parseFloat(row.amount),
      currency: row.currency,
      costDate: row.cost_date,
      campaignId: row.campaign_id,
      campaignName: row.campaign_name,
      vendor: row.vendor,
      invoiceNumber: row.invoice_number,
      isRecurring: row.is_recurring,
      recurringFrequency: row.recurring_frequency,
      tags: row.tags,
      createdAt: row.created_at
    }));

    res.json({
      costs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount,
        pages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error) {
    console.error('Get cost tracking error:', error);
    res.status(500).json({ error: 'Failed to fetch cost tracking data' });
  }
});

// Create cost tracking entry
router.post('/costs', async (req, res) => {
  try {
    const {
      costCategory, costSubcategory, costDescription, amount, currency = 'USD',
      costDate, campaignId, investorId, vendor, invoiceNumber,
      isRecurring = false, recurringFrequency, tags
    } = req.body;

    const result = await pool.query(`
      INSERT INTO cost_tracking (
        cost_category, cost_subcategory, cost_description, amount, currency,
        cost_date, campaign_id, investor_id, vendor, invoice_number,
        is_recurring, recurring_frequency, tags, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *
    `, [
      costCategory, costSubcategory, costDescription, amount, currency,
      costDate, campaignId, investorId, vendor, invoiceNumber,
      isRecurring, recurringFrequency, tags, req.user.id
    ]);

    const cost = result.rows[0];
    res.status(201).json({
      message: 'Cost tracking entry created successfully',
      cost: {
        id: cost.id,
        costCategory: cost.cost_category,
        amount: parseFloat(cost.amount),
        costDate: cost.cost_date,
        createdAt: cost.created_at
      }
    });
  } catch (error) {
    console.error('Create cost tracking error:', error);
    res.status(500).json({ error: 'Failed to create cost tracking entry' });
  }
});

// Get ROI summary by time period
router.get('/summary/:timePeriod', async (req, res) => {
  try {
    const { timePeriod } = req.params;
    const { startDate, endDate } = req.query;

    if (!['daily', 'weekly', 'monthly', 'quarterly', 'yearly'].includes(timePeriod)) {
      return res.status(400).json({ error: 'Invalid time period' });
    }

    let dateFilter = '';
    let queryParams = [];

    if (startDate && endDate) {
      dateFilter = 'AND period_start >= $1 AND period_end <= $2';
      queryParams = [startDate, endDate];
    }

    const query = `
      SELECT 
        time_period,
        period_start,
        period_end,
        SUM(total_investment) as total_investment,
        SUM(total_return) as total_return,
        AVG(roi_percentage) as avg_roi_percentage,
        COUNT(*) as analysis_count
      FROM roi_analysis
      WHERE time_period = '${timePeriod}' ${dateFilter}
      GROUP BY time_period, period_start, period_end
      ORDER BY period_start DESC
    `;

    const result = await pool.query(query, queryParams);

    const summary = result.rows.map(row => ({
      timePeriod: row.time_period,
      periodStart: row.period_start,
      periodEnd: row.period_end,
      totalInvestment: parseFloat(row.total_investment),
      totalReturn: parseFloat(row.total_return),
      avgRoiPercentage: parseFloat(row.avg_roi_percentage),
      analysisCount: parseInt(row.analysis_count)
    }));

    res.json({ summary });
  } catch (error) {
    console.error('Get ROI summary error:', error);
    res.status(500).json({ error: 'Failed to fetch ROI summary' });
  }
});

// Get cost breakdown by category
router.get('/costs/breakdown', async (req, res) => {
  try {
    const { startDate, endDate, groupBy = 'category' } = req.query;

    let dateFilter = '';
    let queryParams = [req.user.id];
    let paramCount = 1;

    if (startDate && endDate) {
      paramCount++;
      dateFilter = `AND cost_date BETWEEN $${paramCount} AND $${paramCount + 1}`;
      queryParams.push(startDate, endDate);
      paramCount++;
    }

    let groupByField = 'cost_category';
    if (groupBy === 'subcategory') {
      groupByField = 'cost_subcategory';
    } else if (groupBy === 'campaign') {
      groupByField = 'campaign_id';
    }

    const query = `
      SELECT 
        ${groupByField} as category,
        SUM(amount) as total_amount,
        COUNT(*) as entry_count,
        AVG(amount) as avg_amount,
        MIN(cost_date) as earliest_date,
        MAX(cost_date) as latest_date
      FROM cost_tracking
      WHERE created_by = $1 ${dateFilter}
      GROUP BY ${groupByField}
      ORDER BY total_amount DESC
    `;

    const result = await pool.query(query, queryParams);

    const breakdown = result.rows.map(row => ({
      category: row.category,
      totalAmount: parseFloat(row.total_amount),
      entryCount: parseInt(row.entry_count),
      avgAmount: parseFloat(row.avg_amount),
      earliestDate: row.earliest_date,
      latestDate: row.latest_date
    }));

    res.json({ breakdown });
  } catch (error) {
    console.error('Get cost breakdown error:', error);
    res.status(500).json({ error: 'Failed to fetch cost breakdown' });
  }
});

module.exports = router;