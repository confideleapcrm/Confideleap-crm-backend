// api/routes/users.js
const express = require('express');
const bcrypt = require('bcryptjs');
const Joi = require('joi');
const pool = require('../database/database');
const { validateRequest } = require('../middleware/validation');

const router = express.Router();

/* ======================================================
   Validation Schemas
====================================================== */
const updateProfileSchema = Joi.object({
  firstName: Joi.string().optional(),
  lastName: Joi.string().optional(),
  phone: Joi.string().optional(),
  jobTitle: Joi.string().optional(),
  department: Joi.string().optional(),
  bio: Joi.string().optional(),
  avatarUrl: Joi.string().uri().optional(),
  timezone: Joi.string().optional(),
  language: Joi.string().optional(),
  theme: Joi.string().valid('light', 'dark').optional()
});

const updatePasswordSchema = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: Joi.string().min(8).required(),
  confirmPassword: Joi.string().valid(Joi.ref('newPassword')).required()
});

const updateNotificationPreferencesSchema = Joi.object({
  emailEnabled: Joi.boolean().optional(),
  pushEnabled: Joi.boolean().optional(),
  smsEnabled: Joi.boolean().optional(),
  desktopEnabled: Joi.boolean().optional(),
  quietHoursStart: Joi.string().optional(),
  quietHoursEnd: Joi.string().optional(),
  frequency: Joi.string().valid('immediate', 'hourly', 'daily', 'weekly').optional(),
  categories: Joi.object().optional()
});

const createUserSchema = Joi.object({
  firstName: Joi.string().required(),
  lastName: Joi.string().required(),
  email: Joi.string().email().required(),
  phone: Joi.string().allow('', null).optional(),
  avatarUrl: Joi.string().uri().allow('', null).optional(),
  jobTitle: Joi.string().allow('', null).optional(),
  department: Joi.string().allow('', null).optional(),
  bio: Joi.string().allow('', null).optional(),
  timezone: Joi.string().required(),
  language: Joi.string().required(),
  theme: Joi.string().valid('light', 'dark').default('light'),
  password: Joi.string().min(8).required(),
  confirmPassword: Joi.string().valid(Joi.ref('password')).required(),
  role: Joi.string().required(),
  isActive: Joi.boolean().default(true),
  emailVerified: Joi.boolean().default(false),
  twoFactorEnabled: Joi.boolean().default(false),
  emailNotifications: Joi.object().required(),
  pushNotifications: Joi.object().required(),
  permissions: Joi.object().required(),
  mappedCustomers: Joi.array().items(Joi.string().uuid()).optional(),
});

/* ======================================================
   GET CURRENT USER PROFILE
====================================================== */
router.get('/profile', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT 
        u.id, u.email, u.first_name, u.last_name, u.avatar_url, u.phone,
        u.job_title, u.department, u.bio, u.timezone, u.language, u.theme,
        u.is_active, u.email_verified, u.two_factor_enabled, u.last_login_at,
        u.created_at, u.updated_at,
        np.email_enabled, np.push_enabled, np.sms_enabled, np.desktop_enabled,
        np.quiet_hours_start, np.quiet_hours_end, np.frequency, np.categories
      FROM users u
      LEFT JOIN notification_preferences np ON np.user_id = u.id
      WHERE u.id = $1
    `, [req.user.id]);

    if (!rows.length) {
      return res.status(404).json({ error: 'User not found' });
    }

    const u = rows[0];
    res.json({
      user: {
        id: u.id,
        email: u.email,
        firstName: u.first_name,
        lastName: u.last_name,
        avatarUrl: u.avatar_url,
        phone: u.phone,
        jobTitle: u.job_title,
        department: u.department,
        bio: u.bio,
        timezone: u.timezone,
        language: u.language,
        theme: u.theme,
        isActive: u.is_active,
        emailVerified: u.email_verified,
        twoFactorEnabled: u.two_factor_enabled,
        lastLoginAt: u.last_login_at,
        createdAt: u.created_at,
        updatedAt: u.updated_at,
        notificationPreferences: {
          emailEnabled: u.email_enabled,
          pushEnabled: u.push_enabled,
          smsEnabled: u.sms_enabled,
          desktopEnabled: u.desktop_enabled,
          quietHoursStart: u.quiet_hours_start,
          quietHoursEnd: u.quiet_hours_end,
          frequency: u.frequency,
          categories: u.categories
        }
      }
    });
  } catch (err) {
    console.error('Get profile error:', err);
    res.status(500).json({ error: 'Failed to fetch user profile' });
  }
});

/* ======================================================
   UPDATE PROFILE
====================================================== */
router.put('/profile', validateRequest(updateProfileSchema), async (req, res) => {
  try {
    const updates = req.body;
    const fields = [];
    const values = [];
    let i = 0;

    const map = {
      firstName: 'first_name',
      lastName: 'last_name',
      phone: 'phone',
      jobTitle: 'job_title',
      department: 'department',
      bio: 'bio',
      avatarUrl: 'avatar_url',
      timezone: 'timezone',
      language: 'language',
      theme: 'theme'
    };

    for (const key of Object.keys(updates)) {
      if (map[key] !== undefined) {
        i++;
        fields.push(`${map[key]} = $${i}`);
        values.push(updates[key]);
      }
    }

    if (!fields.length) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    i++;
    fields.push(`updated_at = $${i}`);
    values.push(new Date());

    i++;
    values.push(req.user.id);

    const { rows } = await pool.query(`
      UPDATE users
      SET ${fields.join(', ')}
      WHERE id = $${i}
      RETURNING id, first_name, last_name, updated_at
    `, values);

    const u = rows[0];
    res.json({
      message: 'Profile updated successfully',
      user: {
        id: u.id,
        firstName: u.first_name,
        lastName: u.last_name,
        updatedAt: u.updated_at
      }
    });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

/* ======================================================
   UPDATE PASSWORD
====================================================== */
router.put('/password', validateRequest(updatePasswordSchema), async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const { rows } = await pool.query(
      'SELECT password_hash FROM users WHERE id = $1',
      [req.user.id]
    );

    if (!rows.length) {
      return res.status(404).json({ error: 'User not found' });
    }

    const isValid = await bcrypt.compare(currentPassword, rows[0].password_hash);
    if (!isValid) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    const hashed = await bcrypt.hash(newPassword, 12);

    await pool.query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [hashed, req.user.id]
    );

    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    console.error('Update password error:', err);
    res.status(500).json({ error: 'Failed to update password' });
  }
});

/* ======================================================
   UPDATE NOTIFICATION PREFERENCES
====================================================== */
router.put(
  '/notifications',
  validateRequest(updateNotificationPreferencesSchema),
  async (req, res) => {
    try {
      const p = req.body;

      const { rows } = await pool.query(
        `
        INSERT INTO notification_preferences (
          user_id, email_enabled, push_enabled, sms_enabled, desktop_enabled,
          quiet_hours_start, quiet_hours_end, frequency, categories
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        ON CONFLICT (user_id)
        DO UPDATE SET
          email_enabled = COALESCE(EXCLUDED.email_enabled, notification_preferences.email_enabled),
          push_enabled = COALESCE(EXCLUDED.push_enabled, notification_preferences.push_enabled),
          sms_enabled = COALESCE(EXCLUDED.sms_enabled, notification_preferences.sms_enabled),
          desktop_enabled = COALESCE(EXCLUDED.desktop_enabled, notification_preferences.desktop_enabled),
          quiet_hours_start = COALESCE(EXCLUDED.quiet_hours_start, notification_preferences.quiet_hours_start),
          quiet_hours_end = COALESCE(EXCLUDED.quiet_hours_end, notification_preferences.quiet_hours_end),
          frequency = COALESCE(EXCLUDED.frequency, notification_preferences.frequency),
          categories = COALESCE(EXCLUDED.categories, notification_preferences.categories),
          updated_at = NOW()
        RETURNING *
      `,
        [
          req.user.id,
          p.emailEnabled,
          p.pushEnabled,
          p.smsEnabled,
          p.desktopEnabled,
          p.quietHoursStart,
          p.quietHoursEnd,
          p.frequency,
          p.categories,
        ]
      );

      const r = rows[0];
      res.json({
        message: 'Notification preferences updated successfully',
        preferences: {
          emailEnabled: r.email_enabled,
          pushEnabled: r.push_enabled,
          smsEnabled: r.sms_enabled,
          desktopEnabled: r.desktop_enabled,
          quietHoursStart: r.quiet_hours_start,
          quietHoursEnd: r.quiet_hours_end,
          frequency: r.frequency,
          categories: r.categories,
          updatedAt: r.updated_at,
        },
      });
    } catch (err) {
      console.error('Update notification preferences error:', err);
      res.status(500).json({ error: 'Failed to update notification preferences' });
    }
  }
);

/* ======================================================
   USER STATISTICS
====================================================== */
router.get('/statistics', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `
      SELECT
        (SELECT COUNT(*) FROM campaigns WHERE created_by = $1) AS campaigns_created,
        (SELECT COUNT(*) FROM investors WHERE created_by = $1) AS investors_added,
        (SELECT COUNT(*) FROM reports WHERE created_by = $1) AS reports_generated,
        (SELECT COUNT(*) FROM communications WHERE user_id = $1) AS communications_sent,
        (SELECT COUNT(*) FROM meetings WHERE created_by = $1) AS meetings_scheduled,
        (SELECT COALESCE(AVG(response_rate),0) FROM campaigns WHERE created_by = $1) AS avg_response_rate
    `,
      [req.user.id]
    );

    const s = rows[0];
    res.json({
      statistics: {
        campaignsCreated: Number(s.campaigns_created),
        investorsAdded: Number(s.investors_added),
        reportsGenerated: Number(s.reports_generated),
        communicationsSent: Number(s.communications_sent),
        meetingsScheduled: Number(s.meetings_scheduled),
        avgResponseRate: Number(s.avg_response_rate),
      },
    });
  } catch (err) {
    console.error('Get statistics error:', err);
    res.status(500).json({ error: 'Failed to fetch user statistics' });
  }
});

/* ======================================================
   USER ACTIVITY LOG
====================================================== */
router.get('/activity', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const eventType = req.query.eventType;

    const params = [req.user.id];
    let where = 'user_id = $1';

    if (eventType) {
      params.push(eventType);
      where += ` AND event_type = $${params.length}`;
    }

    params.push(limit, offset);

    const { rows } = await pool.query(
      `
      SELECT
        id, event_type, event_data, occurred_at,
        COUNT(*) OVER() AS total_count
      FROM analytics_events
      WHERE ${where}
      ORDER BY occurred_at DESC
      LIMIT $${params.length - 1}
      OFFSET $${params.length}
    `,
      params
    );

    const total = rows.length ? Number(rows[0].total_count) : 0;

    res.json({
      activities: rows.map((r) => ({
        id: r.id,
        eventType: r.event_type,
        eventData: r.event_data,
        occurredAt: r.occurred_at,
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error('Get activity error:', err);
    res.status(500).json({ error: 'Failed to fetch user activity' });
  }
});

/* ======================================================
   GET USER SESSIONS
====================================================== */
router.get('/sessions', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `
      SELECT
        id,
        session_token,
        device_info,
        ip_address,
        location,
        expires_at,
        created_at
      FROM user_sessions
      WHERE user_id = $1
        AND expires_at > NOW()
      ORDER BY created_at DESC
    `,
      [req.user.id]
    );

    const sessions = rows.map((r) => ({
      id: r.id,
      sessionToken: r.session_token.slice(0, 8) + '...',
      deviceInfo: r.device_info,
      ipAddress: r.ip_address,
      location: r.location,
      expiresAt: r.expires_at,
      createdAt: r.created_at,
    }));

    res.json({ sessions });
  } catch (err) {
    console.error('Get user sessions error:', err);
    res.status(500).json({ error: 'Failed to fetch user sessions' });
  }
});

/* ======================================================
   REVOKE USER SESSION
====================================================== */
router.delete('/sessions/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;

    const { rowCount } = await pool.query(
      `
      DELETE FROM user_sessions
      WHERE id = $1 AND user_id = $2
    `,
      [sessionId, req.user.id]
    );

    if (!rowCount) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.json({ message: 'Session revoked successfully' });
  } catch (err) {
    console.error('Revoke session error:', err);
    res.status(500).json({ error: 'Failed to revoke session' });
  }
});

/* ======================================================
   EXPORT USER DATA
====================================================== */
router.get('/export', async (req, res) => {
  try {
    const userRes = await pool.query(
      `
      SELECT
        id, email, first_name, last_name, phone,
        job_title, department, bio,
        timezone, language, theme, created_at
      FROM users
      WHERE id = $1
    `,
      [req.user.id]
    );

    if (!userRes.rows.length) {
      return res.status(404).json({ error: 'User not found' });
    }

    const investorsRes = await pool.query(
      `SELECT * FROM investors WHERE created_by = $1`,
      [req.user.id]
    );

    const campaignsRes = await pool.query(
      `SELECT * FROM campaigns WHERE created_by = $1`,
      [req.user.id]
    );

    const communicationsRes = await pool.query(
      `SELECT * FROM communications WHERE user_id = $1`,
      [req.user.id]
    );

    const exportPayload = {
      user: userRes.rows[0],
      investors: investorsRes.rows,
      campaigns: campaignsRes.rows,
      communications: communicationsRes.rows,
      exportedAt: new Date().toISOString(),
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="user-data-export.json"'
    );
    res.json(exportPayload);
  } catch (err) {
    console.error('Export user data error:', err);
    res.status(500).json({ error: 'Failed to export user data' });
  }
});

/* ======================================================
   CREATE USER
====================================================== */
router.post('/', validateRequest(createUserSchema), async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      email,
      phone,
      avatarUrl,
      jobTitle,
      department,
      bio,
      timezone,
      language,
      theme,
      password,
      role,
      isActive,
      emailVerified,
      twoFactorEnabled,
      emailNotifications,
      pushNotifications,
      permissions,
      mappedCustomers,
    } = req.body;

    // check existing email
    const exists = await pool.query(
      `SELECT id FROM users WHERE email = $1`,
      [email]
    );
    if (exists.rows.length) {
      return res.status(400).json({ error: 'Email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const userRes = await pool.query(
      `
      INSERT INTO users (
        email, first_name, last_name, phone, avatar_url,
        job_title, department, bio,
        timezone, language, theme,
        password_hash,
        is_active, email_verified, two_factor_enabled,
        mapped_customers,
        created_at, updated_at
      )
      VALUES (
        $1,$2,$3,$4,$5,
        $6,$7,$8,
        $9,$10,$11,
        $12,
        $13,$14,$15,
        $16,
        NOW(), NOW()
      )
      RETURNING *
    `,
      [
        email,
        firstName,
        lastName,
        phone,
        avatarUrl,
        jobTitle,
        department,
        bio,
        timezone,
        language,
        theme,
        passwordHash,
        isActive,
        emailVerified,
        twoFactorEnabled,
        mappedCustomers,
      ]
    );

    const user = userRes.rows[0];

    // assign role
    const roleRes = await pool.query(
      `SELECT id FROM roles WHERE name = $1`,
      [role]
    );
    if (!roleRes.rows.length) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    await pool.query(
      `INSERT INTO user_roles (user_id, role_id) VALUES ($1,$2)`,
      [user.id, roleRes.rows[0].id]
    );

    // notification preferences
    await pool.query(
      `
      INSERT INTO notification_preferences (
        user_id, email_enabled, push_enabled, sms_enabled,
        desktop_enabled, categories, created_at, updated_at
      )
      VALUES ($1,true,true,false,false,$2,NOW(),NOW())
    `,
      [
        user.id,
        {
          email: emailNotifications,
          push: pushNotifications,
        },
      ]
    );

    res.status(201).json({
      message: 'User created successfully',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role,
        isActive,
        emailVerified,
        twoFactorEnabled,
        mappedCustomers,
      },
    });
  } catch (err) {
    console.error('Create user error:', err);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

/* ======================================================
   UPDATE USER BY ID
====================================================== */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const fields = [];
    const values = [];
    let idx = 1;

    const map = {
      firstName: 'first_name',
      lastName: 'last_name',
      email: 'email',
      phone: 'phone',
      avatarUrl: 'avatar_url',
      jobTitle: 'job_title',
      department: 'department',
      bio: 'bio',
      timezone: 'timezone',
      language: 'language',
      theme: 'theme',
      isActive: 'is_active',
      emailVerified: 'email_verified',
      twoFactorEnabled: 'two_factor_enabled',
      mappedCustomers: 'mapped_customers',
    };

    for (const key in map) {
      if (req.body[key] !== undefined) {
        fields.push(`${map[key]} = $${idx++}`);
        values.push(req.body[key]);
      }
    }

    if (!fields.length) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    fields.push(`updated_at = NOW()`);

    values.push(id);

    const result = await pool.query(
      `
      UPDATE users
      SET ${fields.join(', ')}
      WHERE id = $${idx}
      RETURNING *
    `,
      values
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      message: 'User updated successfully',
      user: result.rows[0],
    });
  } catch (err) {
    console.error('Update user error:', err);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

/* ======================================================
   GET USER BY ID
====================================================== */
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `
      SELECT
        u.*,
        r.id as role_id,
        r.name as role_name,
        r.description as role_description,
        r.permissions
      FROM users u
      LEFT JOIN user_roles ur ON ur.user_id = u.id
      LEFT JOIN roles r ON r.id = ur.role_id
      WHERE u.id = $1
    `,
      [req.params.id]
    );

    if (!rows.length) {
      return res.status(404).json({ error: 'User not found' });
    }

    const u = rows[0];

    res.json({
      id: u.id,
      email: u.email,
      firstName: u.first_name,
      lastName: u.last_name,
      avatarUrl: u.avatar_url,
      phone: u.phone,
      jobTitle: u.job_title,
      department: u.department,
      bio: u.bio,
      timezone: u.timezone,
      language: u.language,
      theme: u.theme,
      isActive: u.is_active,
      emailVerified: u.email_verified,
      twoFactorEnabled: u.two_factor_enabled,
      mappedCustomers: u.mapped_customers || [],
      createdAt: u.created_at,
      updatedAt: u.updated_at,
      role: u.role_id
        ? {
            id: u.role_id,
            name: u.role_name,
            description: u.role_description,
            permissions: u.permissions,
          }
        : null,
    });
  } catch (err) {
    console.error('Get user by ID error:', err);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

/* ======================================================
   LIST USERS (PAGINATED)
====================================================== */
router.get('/', async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = (page - 1) * limit;

    const dataRes = await pool.query(
      `
      SELECT
        u.id, u.email, u.first_name, u.last_name,
        u.job_title, u.department,
        u.is_active, u.created_at, u.updated_at,
        r.id as role_id, r.name as role_name
      FROM users u
      LEFT JOIN user_roles ur ON ur.user_id = u.id
      LEFT JOIN roles r ON r.id = ur.role_id
      ORDER BY u.created_at DESC
      LIMIT $1 OFFSET $2
    `,
      [limit, offset]
    );

    const countRes = await pool.query(`SELECT COUNT(*) FROM users`);
    const total = parseInt(countRes.rows[0].count);

    res.json({
      users: dataRes.rows,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error('List users error:', err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

module.exports = router;
