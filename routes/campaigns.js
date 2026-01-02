// api/routes/campaigns.js
const express = require('express');
const Joi = require('joi');
const db = require('../database/database');
const { validateRequest, validateQuery } = require('../middleware/validation');

const router = express.Router();

// =======================
// Validation schemas
// =======================
const createCampaignSchema = Joi.object({
  name: Joi.string().required(),
  description: Joi.string().optional(),
  type: Joi.string().valid('email', 'linkedin', 'phone', 'multi-channel').required(),
  channels: Joi.array().items(Joi.string()).required(),
  templateId: Joi.string().uuid().optional(),
  targetAudience: Joi.object().optional(),
  subjectLine: Joi.string().optional(),
  messageContent: Joi.string().optional(),
  followUpSequence: Joi.array().optional(),
  sendSchedule: Joi.object().optional(),
  budget: Joi.number().min(0).optional(),
  priority: Joi.string().valid('high', 'medium', 'low').default('medium'),
  tags: Joi.array().items(Joi.string()).optional(),
  settings: Joi.object().optional()
});

const updateCampaignSchema = createCampaignSchema.fork(
  ['name', 'type', 'channels'],
  schema => schema.optional()
);

const querySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  search: Joi.string().optional(),
  status: Joi.string().valid('draft', 'active', 'paused', 'completed', 'archived').optional(),
  type: Joi.string().valid('email', 'linkedin', 'phone', 'multi-channel').optional(),
  sortBy: Joi.string().valid('name', 'status', 'type', 'createdAt', 'responseRate').default('createdAt'),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc')
});

// =======================
// Get all campaigns
// =======================
router.get('/', validateQuery(querySchema), async (req, res) => {
  try {
    const { page, limit, search, status, type, sortBy, sortOrder } = req.query;
    const offset = (page - 1) * limit;

    let whereConditions = ['created_by = $1'];
    let queryParams = [req.user.id];
    let paramCount = 1;

    if (search) {
      paramCount++;
      whereConditions.push(`(name ILIKE $${paramCount} OR description ILIKE $${paramCount})`);
      queryParams.push(`%${search}%`);
    }

    if (status) {
      paramCount++;
      whereConditions.push(`status = $${paramCount}`);
      queryParams.push(status);
    }

    if (type) {
      paramCount++;
      whereConditions.push(`type = $${paramCount}`);
      queryParams.push(type);
    }

    let sortClause = 'created_at DESC';
    switch (sortBy) {
      case 'name':
        sortClause = `name ${sortOrder.toUpperCase()}`;
        break;
      case 'status':
        sortClause = `status ${sortOrder.toUpperCase()}`;
        break;
      case 'type':
        sortClause = `type ${sortOrder.toUpperCase()}`;
        break;
      case 'responseRate':
        sortClause = `response_rate ${sortOrder.toUpperCase()}`;
        break;
      default:
        sortClause = `created_at ${sortOrder.toUpperCase()}`;
    }

    const query = `
      SELECT 
        id, name, description, type, status, channels, subject_line,
        total_recipients, sent_count, delivered_count, opened_count, clicked_count,
        replied_count, bounced_count, unsubscribed_count, meeting_count,
        conversion_rate, open_rate, response_rate, meeting_rate,
        budget, spent, priority, tags, started_at, completed_at,
        created_at, updated_at,
        COUNT(*) OVER() AS total_count
      FROM campaigns
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY ${sortClause}
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `;

    queryParams.push(limit, offset);

    const result = await db.query(query, queryParams);
    const totalCount = result.rows.length ? parseInt(result.rows[0].total_count) : 0;

    res.json({
      campaigns: result.rows.map(row => ({
        id: row.id,
        name: row.name,
        description: row.description,
        type: row.type,
        status: row.status,
        channels: row.channels,
        subjectLine: row.subject_line,
        totalRecipients: row.total_recipients,
        sentCount: row.sent_count,
        deliveredCount: row.delivered_count,
        openedCount: row.opened_count,
        clickedCount: row.clicked_count,
        repliedCount: row.replied_count,
        bouncedCount: row.bounced_count,
        unsubscribedCount: row.unsubscribed_count,
        meetingCount: row.meeting_count,
        conversionRate: row.conversion_rate ? parseFloat(row.conversion_rate) : null,
        openRate: row.open_rate ? parseFloat(row.open_rate) : null,
        responseRate: row.response_rate ? parseFloat(row.response_rate) : null,
        meetingRate: row.meeting_rate ? parseFloat(row.meeting_rate) : null,
        budget: row.budget ? parseFloat(row.budget) : null,
        spent: row.spent ? parseFloat(row.spent) : null,
        priority: row.priority,
        tags: row.tags,
        startedAt: row.started_at,
        completedAt: row.completed_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount,
        pages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error) {
    console.error('Get campaigns error:', error);
    res.status(500).json({ error: 'Failed to fetch campaigns' });
  }
});
// =======================
// Get campaign by ID
// =======================
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const campaignResult = await db.query(
      'SELECT * FROM campaigns WHERE id = $1 AND created_by = $2',
      [id, req.user.id]
    );

    if (!campaignResult.rows.length) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    const campaign = campaignResult.rows[0];

    const recipientsResult = await db.query(`
      SELECT 
        cr.*, i.first_name, i.last_name, i.email, i.status AS investor_status,
        f.name AS firm_name
      FROM campaign_recipients cr
      JOIN investors i ON cr.investor_id = i.id
      LEFT JOIN investment_firms f ON i.firm_id = f.id
      WHERE cr.campaign_id = $1
      ORDER BY cr.created_at DESC
    `, [id]);

    const metricsResult = await db.query(`
      SELECT * FROM campaign_performance_metrics
      WHERE campaign_id = $1
      ORDER BY metric_date DESC
      LIMIT 30
    `, [id]);

    res.json({
      ...campaign,
      recipients: recipientsResult.rows,
      performanceMetrics: metricsResult.rows
    });
  } catch (error) {
    console.error('Get campaign error:', error);
    res.status(500).json({ error: 'Failed to fetch campaign' });
  }
});

// =======================
// Create campaign
// =======================
router.post('/', validateRequest(createCampaignSchema), async (req, res) => {
  try {
    const {
      name, description, type, channels, templateId, targetAudience,
      subjectLine, messageContent, followUpSequence, sendSchedule,
      budget, priority, tags, settings
    } = req.body;

    const result = await db.query(`
      INSERT INTO campaigns (
        name, description, type, channels, template_id, target_audience,
        subject_line, message_content, follow_up_sequence, send_schedule,
        budget, priority, tags, settings, created_by
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
      RETURNING *
    `, [
      name, description, type, channels, templateId, targetAudience,
      subjectLine, messageContent, followUpSequence, sendSchedule,
      budget, priority, tags, settings, req.user.id
    ]);

    res.status(201).json({
      message: 'Campaign created successfully',
      campaign: {
        id: result.rows[0].id,
        name: result.rows[0].name,
        status: result.rows[0].status,
        createdAt: result.rows[0].created_at
      }
    });
  } catch (error) {
    console.error('Create campaign error:', error);
    res.status(500).json({ error: 'Failed to create campaign' });
  }
});

// =======================
// Update campaign
// =======================
router.put('/:id', validateRequest(updateCampaignSchema), async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const existingCampaign = await db.query(
      'SELECT id, status FROM campaigns WHERE id = $1 AND created_by = $2',
      [id, req.user.id]
    );

    if (existingCampaign.rows.length === 0) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    if (existingCampaign.rows[0].status === 'active') {
      return res.status(400).json({ error: 'Cannot edit active campaign' });
    }

    const updateFields = [];
    const values = [];
    let paramCount = 0;

    const fieldMapping = {
      name: 'name',
      description: 'description',
      type: 'type',
      channels: 'channels',
      templateId: 'template_id',
      targetAudience: 'target_audience',
      subjectLine: 'subject_line',
      messageContent: 'message_content',
      followUpSequence: 'follow_up_sequence',
      sendSchedule: 'send_schedule',
      budget: 'budget',
      priority: 'priority',
      tags: 'tags',
      settings: 'settings'
    };

    Object.keys(updates).forEach(key => {
      if (fieldMapping[key] && updates[key] !== undefined) {
        paramCount++;
        updateFields.push(`${fieldMapping[key]} = $${paramCount}`);
        values.push(updates[key]);
      }
    });

    if (!updateFields.length) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    paramCount++;
    updateFields.push(`updated_at = $${paramCount}`);
    values.push(new Date());

    paramCount++;
    values.push(id);
    paramCount++;
    values.push(req.user.id);

    const query = `
      UPDATE campaigns
      SET ${updateFields.join(', ')}
      WHERE id = $${paramCount - 1} AND created_by = $${paramCount}
      RETURNING *
    `;

    const result = await db.query(query, values);
    const campaign = result.rows[0];

    res.json({
      message: 'Campaign updated successfully',
      campaign: {
        id: campaign.id,
        name: campaign.name,
        status: campaign.status,
        updatedAt: campaign.updated_at
      }
    });
  } catch (error) {
    console.error('Update campaign error:', error);
    res.status(500).json({ error: 'Failed to update campaign' });
  }
});

// =======================
// Delete campaign
// =======================
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const campaign = await db.query(
      'SELECT id, status FROM campaigns WHERE id = $1 AND created_by = $2',
      [id, req.user.id]
    );

    if (!campaign.rows.length) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    if (campaign.rows[0].status === 'active') {
      return res.status(400).json({ error: 'Cannot delete active campaign' });
    }

    await db.query(
      'DELETE FROM campaigns WHERE id = $1 AND created_by = $2',
      [id, req.user.id]
    );

    res.json({ message: 'Campaign deleted successfully' });
  } catch (error) {
    console.error('Delete campaign error:', error);
    res.status(500).json({ error: 'Failed to delete campaign' });
  }
});

// =======================
// Start campaign
// =======================
router.post('/:id/start', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(`
      UPDATE campaigns
      SET status = 'active', started_at = NOW(), updated_at = NOW()
      WHERE id = $1 AND created_by = $2 AND status = 'draft'
      RETURNING id, name, status, started_at
    `, [id, req.user.id]);

    if (!result.rows.length) {
      return res.status(404).json({ error: 'Campaign not found or cannot be started' });
    }

    res.json({
      message: 'Campaign started successfully',
      campaign: result.rows[0]
    });
  } catch (error) {
    console.error('Start campaign error:', error);
    res.status(500).json({ error: 'Failed to start campaign' });
  }
});

// =======================
// Pause campaign
// =======================
router.post('/:id/pause', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(`
      UPDATE campaigns
      SET status = 'paused', updated_at = NOW()
      WHERE id = $1 AND created_by = $2 AND status = 'active'
      RETURNING id, name, status
    `, [id, req.user.id]);

    if (!result.rows.length) {
      return res.status(404).json({ error: 'Campaign not found or cannot be paused' });
    }

    res.json({
      message: 'Campaign paused successfully',
      campaign: result.rows[0]
    });
  } catch (error) {
    console.error('Pause campaign error:', error);
    res.status(500).json({ error: 'Failed to pause campaign' });
  }
});

// =======================
// Resume campaign
// =======================
router.post('/:id/resume', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(`
      UPDATE campaigns
      SET status = 'active', updated_at = NOW()
      WHERE id = $1 AND created_by = $2 AND status = 'paused'
      RETURNING id, name, status
    `, [id, req.user.id]);

    if (!result.rows.length) {
      return res.status(404).json({ error: 'Campaign not found or cannot be resumed' });
    }

    res.json({
      message: 'Campaign resumed successfully',
      campaign: result.rows[0]
    });
  } catch (error) {
    console.error('Resume campaign error:', error);
    res.status(500).json({ error: 'Failed to resume campaign' });
  }
});

// =======================
// Add recipients to campaign
// =======================
router.post('/:id/recipients', async (req, res) => {
  const { id } = req.params;
  const { investorIds, personalization } = req.body;

  if (!Array.isArray(investorIds)) {
    return res.status(400).json({ error: 'Investor IDs array is required' });
  }

  const client = await db.connect();

  try {
    await client.query('BEGIN');

    let addedCount = 0;
    let skippedCount = 0;

    for (const investorId of investorIds) {
      const exists = await client.query(
        'SELECT id FROM campaign_recipients WHERE campaign_id = $1 AND investor_id = $2',
        [id, investorId]
      );

      if (exists.rows.length) {
        skippedCount++;
        continue;
      }

      await client.query(
        `
        INSERT INTO campaign_recipients (campaign_id, investor_id, personalization)
        VALUES ($1, $2, $3)
        `,
        [id, investorId, personalization || {}]
      );

      addedCount++;
    }

    await client.query(`
      UPDATE campaigns
      SET total_recipients = (
        SELECT COUNT(*) FROM campaign_recipients WHERE campaign_id = $1
      ), updated_at = NOW()
      WHERE id = $1
    `, [id]);

    await client.query('COMMIT');

    res.json({
      message: 'Recipients added successfully',
      addedCount,
      skippedCount
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Add recipients error:', error);
    res.status(500).json({ error: 'Failed to add recipients to campaign' });
  } finally {
    client.release();
  }
});

// =======================
// Campaign analytics
// =======================
router.get('/:id/analytics', async (req, res) => {
  try {
    const { id } = req.params;

    const metricsResult = await db.query(`
      SELECT 
        metric_date,
        emails_sent, emails_delivered, emails_opened, emails_clicked,
        emails_replied, meetings_scheduled, cost_incurred
      FROM campaign_performance_metrics
      WHERE campaign_id = $1
      ORDER BY metric_date DESC
      LIMIT 30
    `, [id]);

    const recipientsResult = await db.query(`
      SELECT status, COUNT(*) AS count
      FROM campaign_recipients
      WHERE campaign_id = $1
      GROUP BY status
    `, [id]);

    const channelResult = await db.query(`
      SELECT channel,
        COUNT(*) AS sent_count,
        COUNT(CASE WHEN status IN ('delivered','opened','replied') THEN 1 END) AS delivered_count,
        COUNT(CASE WHEN status IN ('opened','replied') THEN 1 END) AS opened_count,
        COUNT(CASE WHEN status = 'replied' THEN 1 END) AS replied_count
      FROM campaign_messages
      WHERE campaign_id = $1
      GROUP BY channel
    `, [id]);

    res.json({
      dailyMetrics: metricsResult.rows,
      recipientsSummary: recipientsResult.rows.reduce((acc, r) => {
        acc[r.status] = parseInt(r.count);
        return acc;
      }, {}),
      channelPerformance: channelResult.rows
    });
  } catch (error) {
    console.error('Get campaign analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch campaign analytics' });
  }
});

module.exports = router;