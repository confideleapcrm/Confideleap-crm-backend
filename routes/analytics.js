// api/routes/analytics.js
const express = require('express');
const Joi = require('joi');
const db = require('../database/database');
const { validateRequest, validateQuery } = require('../middleware/validation');

const router = express.Router();

// Validation schemas
const querySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  metricType: Joi.string().optional(),
  timePeriod: Joi.string().valid('daily', 'weekly', 'monthly', 'quarterly', 'yearly').optional(),
  startDate: Joi.date().optional(),
  endDate: Joi.date().optional(),
  dimensionType: Joi.string().optional(),
  dimensionValue: Joi.string().optional()
});

const createMetricSchema = Joi.object({
  metricType: Joi.string().required(),
  metricName: Joi.string().required(),
  metricValue: Joi.number().required(),
  metricUnit: Joi.string().optional(),
  dimensionType: Joi.string().optional(),
  dimensionValue: Joi.string().optional(),
  timePeriod: Joi.string().valid('daily', 'weekly', 'monthly', 'quarterly', 'yearly').required(),
  periodStart: Joi.date().required(),
  periodEnd: Joi.date().required(),
  metadata: Joi.object().optional()
});

// =======================================================
// Get analytics metrics
// =======================================================
router.get('/metrics', validateQuery(querySchema), async (req, res) => {
  try {
    const { 
      page, limit, metricType, timePeriod, startDate, endDate, 
      dimensionType, dimensionValue 
    } = req.query;

    const offset = (page - 1) * limit;

    let whereConditions = ['1=1'];
    let queryParams = [];
    let paramCount = 0;

    if (metricType) {
      paramCount++;
      whereConditions.push(`metric_type = $${paramCount}`);
      queryParams.push(metricType);
    }

    if (timePeriod) {
      paramCount++;
      whereConditions.push(`time_period = $${paramCount}`);
      queryParams.push(timePeriod);
    }

    if (startDate && endDate) {
      paramCount++;
      whereConditions.push(
        `period_start >= $${paramCount} AND period_end <= $${paramCount + 1}`
      );
      queryParams.push(startDate, endDate);
      paramCount++;
    }

    if (dimensionType) {
      paramCount++;
      whereConditions.push(`dimension_type = $${paramCount}`);
      queryParams.push(dimensionType);
    }

    if (dimensionValue) {
      paramCount++;
      whereConditions.push(`dimension_value = $${paramCount}`);
      queryParams.push(dimensionValue);
    }

    const query = `
      SELECT 
        id, metric_type, metric_name, metric_value, metric_unit,
        dimension_type, dimension_value, time_period, period_start, period_end,
        calculated_at, metadata, created_at,
        COUNT(*) OVER() AS total_count
      FROM analytics_metrics
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY period_start DESC, metric_type ASC
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `;

    queryParams.push(limit, offset);

    const result = await db.query(query, queryParams);
    const totalCount =
      result.rows.length > 0 ? parseInt(result.rows[0].total_count) : 0;

    const metrics = result.rows.map(row => ({
      id: row.id,
      metricType: row.metric_type,
      metricName: row.metric_name,
      metricValue: parseFloat(row.metric_value),
      metricUnit: row.metric_unit,
      dimensionType: row.dimension_type,
      dimensionValue: row.dimension_value,
      timePeriod: row.time_period,
      periodStart: row.period_start,
      periodEnd: row.period_end,
      calculatedAt: row.calculated_at,
      metadata: row.metadata,
      createdAt: row.created_at
    }));

    res.json({
      metrics,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount,
        pages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error) {
    console.error('Get analytics metrics error:', error);
    res.status(500).json({ error: 'Failed to fetch analytics metrics' });
  }
});

// =======================================================
// Create analytics metric
// =======================================================
router.post('/metrics', validateRequest(createMetricSchema), async (req, res) => {
  try {
    const {
      metricType, metricName, metricValue, metricUnit,
      dimensionType, dimensionValue,
      timePeriod, periodStart, periodEnd, metadata
    } = req.body;

    const result = await db.query(
      `
      INSERT INTO analytics_metrics (
        metric_type, metric_name, metric_value, metric_unit,
        dimension_type, dimension_value,
        time_period, period_start, period_end, metadata
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING *
      `,
      [
        metricType, metricName, metricValue, metricUnit,
        dimensionType, dimensionValue,
        timePeriod, periodStart, periodEnd, metadata
      ]
    );

    const metric = result.rows[0];

    res.status(201).json({
      message: 'Analytics metric created successfully',
      metric: {
        id: metric.id,
        metricType: metric.metric_type,
        metricName: metric.metric_name,
        metricValue: parseFloat(metric.metric_value),
        createdAt: metric.created_at
      }
    });
  } catch (error) {
    console.error('Create analytics metric error:', error);
    res.status(500).json({ error: 'Failed to create analytics metric' });
  }
});
// =======================================================
// Get investor engagement scores
// =======================================================
router.get('/engagement', async (req, res) => {
  try {
    const { investorId, limit = 50, sortBy = 'engagement_score', sortOrder = 'desc' } = req.query;

    let whereConditions = ['i.is_active = true'];
    let queryParams = [];
    let paramCount = 0;

    whereConditions.push(`(
      i.created_by = $${++paramCount} OR
      EXISTS (
        SELECT 1 FROM company_users cu
        JOIN company_users cu2 ON cu.company_id = cu2.company_id
        WHERE cu.user_id = i.created_by AND cu2.user_id = $${paramCount}
      )
    )`);
    queryParams.push(req.user.id);

    if (investorId) {
      paramCount++;
      whereConditions.push(`i.id = $${paramCount}`);
      queryParams.push(investorId);
    }

    const query = `
      SELECT 
        ies.*, i.first_name, i.last_name, i.email, i.status,
        f.name AS firm_name, f.type AS firm_type
      FROM investor_engagement_scores ies
      JOIN investors i ON ies.investor_id = i.id
      LEFT JOIN investment_firms f ON i.firm_id = f.id
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY ies.${sortBy} ${sortOrder.toUpperCase()}
      LIMIT $${paramCount + 1}
    `;

    queryParams.push(limit);

    const result = await db.query(query, queryParams);

    const engagementScores = result.rows.map(row => ({
      id: row.id,
      investorId: row.investor_id,
      investorName: `${row.first_name} ${row.last_name}`,
      investorEmail: row.email,
      investorStatus: row.status,
      firmName: row.firm_name,
      firmType: row.firm_type,
      engagementScore: row.engagement_score,
      responseRate: row.response_rate ? parseFloat(row.response_rate) : null,
      avgResponseTimeHours: row.avg_response_time_hours ? parseFloat(row.avg_response_time_hours) : null,
      meetingAcceptanceRate: row.meeting_acceptance_rate ? parseFloat(row.meeting_acceptance_rate) : null,
      emailOpenRate: row.email_open_rate ? parseFloat(row.email_open_rate) : null,
      emailClickRate: row.email_click_rate ? parseFloat(row.email_click_rate) : null,
      totalInteractions: row.total_interactions,
      positiveInteractions: row.positive_interactions,
      lastInteractionDate: row.last_interaction_date,
      scoreCalculatedAt: row.score_calculated_at,
      scoreFactors: row.score_factors
    }));

    res.json({ engagementScores });
  } catch (error) {
    console.error('Get engagement scores error:', error);
    res.status(500).json({ error: 'Failed to fetch engagement scores' });
  }
});

// =======================================================
// Campaign performance, dashboard, benchmarks, events, segmentation
// =======================================================

router.get('/campaigns/performance', async (req, res) => {
  try {
    const { campaignId, startDate, endDate, limit = 100 } = req.query;

    let whereConditions = ['c.created_by = $1'];
    let queryParams = [req.user.id];
    let paramCount = 1;

    if (campaignId) {
      paramCount++;
      whereConditions.push(`cpm.campaign_id = $${paramCount}`);
      queryParams.push(campaignId);
    }

    if (startDate && endDate) {
      paramCount++;
      whereConditions.push(`cpm.metric_date BETWEEN $${paramCount} AND $${paramCount + 1}`);
      queryParams.push(startDate, endDate);
      paramCount++;
    }

    const query = `
      SELECT 
        cpm.*, c.name AS campaign_name, c.type AS campaign_type, c.status AS campaign_status
      FROM campaign_performance_metrics cpm
      JOIN campaigns c ON cpm.campaign_id = c.id
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY cpm.metric_date DESC, c.name ASC
      LIMIT $${paramCount + 1}
    `;

    queryParams.push(limit);

    const result = await db.query(query, queryParams);

    res.json({ performanceMetrics: result.rows });
  } catch (error) {
    console.error('Get campaign performance error:', error);
    res.status(500).json({ error: 'Failed to fetch campaign performance metrics' });
  }
});

// =======================================================
// Get dashboard summary
// =======================================================
router.get('/dashboard/summary', async (req, res) => {
  try {
    const { timePeriod = 'monthly' } = req.query;

    const summary = await db.query(`
      SELECT 
        (SELECT COUNT(*) FROM investors WHERE created_by = $1 AND is_active = true) AS total_investors,
        (SELECT COUNT(*) FROM campaigns WHERE created_by = $1) AS total_campaigns,
        (SELECT COUNT(*) FROM investors WHERE created_by = $1 AND status IN ('hot', 'warm')) AS active_investors,
        (SELECT COALESCE(AVG(response_rate), 0) FROM campaigns WHERE created_by = $1) AS avg_response_rate,
        (SELECT COALESCE(SUM(amount), 0) 
         FROM pipeline_opportunities po
         JOIN investors i ON po.investor_id = i.id
         WHERE i.created_by = $1 AND po.status = 'open') AS pipeline_value,
        (SELECT COUNT(*) FROM meetings 
         WHERE created_by = $1 AND scheduled_start >= CURRENT_DATE) AS upcoming_meetings
    `, [req.user.id]);

    const trendQuery = `
      SELECT 
        metric_type, metric_name, metric_value, period_start
      FROM analytics_metrics
      WHERE time_period = $1 
      AND period_start >= NOW() - INTERVAL '6 months'
      ORDER BY period_start DESC
    `;

    const trendsResult = await db.query(trendQuery, [timePeriod]);

    const summaryData = summary.rows[0];

    const trends = trendsResult.rows.reduce((acc, row) => {
      if (!acc[row.metric_type]) {
        acc[row.metric_type] = [];
      }
      acc[row.metric_type].push({
        name: row.metric_name,
        value: parseFloat(row.metric_value),
        date: row.period_start
      });
      return acc;
    }, {});

    res.json({
      summary: {
        totalInvestors: parseInt(summaryData.total_investors),
        totalCampaigns: parseInt(summaryData.total_campaigns),
        activeInvestors: parseInt(summaryData.active_investors),
        avgResponseRate: parseFloat(summaryData.avg_response_rate),
        pipelineValue: parseFloat(summaryData.pipeline_value),
        upcomingMeetings: parseInt(summaryData.upcoming_meetings)
      },
      trends
    });
  } catch (error) {
    console.error('Get dashboard summary error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard summary' });
  }
});

// =======================================================
// Get performance benchmarks
// =======================================================
router.get('/benchmarks', async (req, res) => {
  try {
    const { metricType, industry = 'VC' } = req.query;

    let whereConditions = ['valid_from <= NOW() AND (valid_to IS NULL OR valid_to >= NOW())'];
    let queryParams = [];
    let paramCount = 0;

    if (metricType) {
      paramCount++;
      whereConditions.push(`metric_type = $${paramCount}`);
      queryParams.push(metricType);
    }

    if (industry) {
      paramCount++;
      whereConditions.push(`(industry = $${paramCount} OR industry IS NULL)`);
      queryParams.push(industry);
    }

    const query = `
      SELECT 
        id, metric_type, benchmark_type, benchmark_value, benchmark_unit,
        industry, company_size, source, confidence_level, valid_from, valid_to
      FROM performance_benchmarks
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY metric_type ASC, benchmark_type ASC
    `;

    const result = await db.query(query, queryParams);

    const benchmarks = result.rows.map(row => ({
      id: row.id,
      metricType: row.metric_type,
      benchmarkType: row.benchmark_type,
      benchmarkValue: parseFloat(row.benchmark_value),
      benchmarkUnit: row.benchmark_unit,
      industry: row.industry,
      companySize: row.company_size,
      source: row.source,
      confidenceLevel: row.confidence_level ? parseFloat(row.confidence_level) : null,
      validFrom: row.valid_from,
      validTo: row.valid_to
    }));

    res.json({ benchmarks });
  } catch (error) {
    console.error('Get benchmarks error:', error);
    res.status(500).json({ error: 'Failed to fetch performance benchmarks' });
  }
});

// =======================================================
// Record analytics event
// =======================================================
router.post('/events', async (req, res) => {
  try {
    const { eventType, eventData, sessionId } = req.body;

    if (!eventType) {
      return res.status(400).json({ error: 'Event type is required' });
    }

    await db.query(`
      INSERT INTO analytics_events (
        user_id, event_type, event_data, session_id, ip_address, user_agent
      ) VALUES ($1, $2, $3, $4, $5, $6)
    `, [
      req.user.id,
      eventType,
      eventData || {},
      sessionId,
      req.ip,
      req.get('User-Agent')
    ]);

    res.status(201).json({ message: 'Analytics event recorded successfully' });
  } catch (error) {
    console.error('Record analytics event error:', error);
    res.status(500).json({ error: 'Failed to record analytics event' });
  }
});

// =======================================================
// Get investor segmentation data
// =======================================================
router.get('/segmentation', async (req, res) => {
  try {
    const segmentsResult = await db.query(`
      SELECT 
        s.id, s.segment_name, s.segment_description, s.segment_criteria, s.segment_color,
        COUNT(ism.investor_id) AS member_count
      FROM investor_segments s
      LEFT JOIN investor_segment_membership ism ON s.id = ism.segment_id
      WHERE s.is_active = true
      GROUP BY s.id, s.segment_name, s.segment_description, s.segment_criteria, s.segment_color
      ORDER BY member_count DESC
    `);

    const geoResult = await db.query(`
      SELECT 
        CASE 
          WHEN location ILIKE '%US%' OR location ILIKE '%United States%' OR location ILIKE '%CA%' OR location ILIKE '%NY%' THEN 'North America'
          WHEN location ILIKE '%UK%' OR location ILIKE '%Europe%' OR location ILIKE '%London%' OR location ILIKE '%Berlin%' THEN 'Europe'
          WHEN location ILIKE '%Asia%' OR location ILIKE '%China%' OR location ILIKE '%Japan%' OR location ILIKE '%Singapore%' THEN 'Asia Pacific'
          ELSE 'Other'
        END AS region,
        COUNT(*) AS investor_count
      FROM investors 
      WHERE created_by = $1 AND is_active = true AND location IS NOT NULL
      GROUP BY region
      ORDER BY investor_count DESC
    `, [req.user.id]);

    const sectorResult = await db.query(`
      SELECT 
        unnest(sector_preferences) AS sector,
        COUNT(*) AS investor_count
      FROM investors 
      WHERE created_by = $1 AND is_active = true AND sector_preferences IS NOT NULL
      GROUP BY sector
      ORDER BY investor_count DESC
      LIMIT 10
    `, [req.user.id]);

    res.json({
      segments: segmentsResult.rows.map(row => ({
        id: row.id,
        segmentName: row.segment_name,
        segmentDescription: row.segment_description,
        segmentCriteria: row.segment_criteria,
        segmentColor: row.segment_color,
        memberCount: parseInt(row.member_count)
      })),
      geographicDistribution: geoResult.rows.map(row => ({
        region: row.region,
        investorCount: parseInt(row.investor_count)
      })),
      sectorDistribution: sectorResult.rows.map(row => ({
        sector: row.sector,
        investorCount: parseInt(row.investor_count)
      }))
    });
  } catch (error) {
    console.error('Get segmentation data error:', error);
    res.status(500).json({ error: 'Failed to fetch segmentation data' });
  }
});

module.exports = router;


module.exports = router;
