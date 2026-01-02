
// api/server.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const path = require('path');
require('dotenv').config();

/* =======================
   ROUTE IMPORTS
======================= */
const authRoutes = require('./routes/auth');
const investorRoutes = require('./routes/investors');
const campaignRoutes = require('./routes/campaigns');
const analyticsRoutes = require('./routes/analytics');
const importRoutes = require('./routes/import');
const roiRoutes = require('./routes/roi');
const userRoutes = require('./routes/users');
const firmRoutes = require('./routes/firms');
const customerRoutes = require('./routes/customers');

const companyRoutes = require('./routes/companies');
const companyEmployeeRoutes = require('./routes/companyEmployees');

const investorLists = require('./routes/investorLists');
const investorContactStatus = require('./routes/investorContactStatus');

const meetingsRoutes = require('./routes/meetings');
const followupsRoutes = require('./routes/followups');
const interactionsRoutes = require('./routes/interactions');

const googleAuthRoutes = require('./routes/googleAuth');

/* =======================
   DEBUG LOGS (IMPORTANT)
======================= */
console.log('authRoutes:', typeof authRoutes);
console.log('investorRoutes:', typeof investorRoutes);
console.log('campaignRoutes:', typeof campaignRoutes);
console.log('analyticsRoutes:', typeof analyticsRoutes);
console.log('importRoutes:', typeof importRoutes);
console.log('roiRoutes:', typeof roiRoutes);
console.log('userRoutes:', typeof userRoutes);
console.log('firmRoutes:', typeof firmRoutes);
console.log('customerRoutes:', typeof customerRoutes);
console.log('companyRoutes:', typeof companyRoutes);
console.log('companyEmployeeRoutes:', typeof companyEmployeeRoutes);
console.log('investorLists:', typeof investorLists);
console.log('investorContactStatus:', typeof investorContactStatus);
console.log('meetingsRoutes:', typeof meetingsRoutes);
console.log('followupsRoutes:', typeof followupsRoutes);
console.log('interactionsRoutes:', typeof interactionsRoutes);
console.log('googleAuthRoutes:', typeof googleAuthRoutes);

/* =======================
   MIDDLEWARE
======================= */
const { errorHandler } = require('./middleware/errorHandler');
const { authenticateToken } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3001;

/* =======================
   SECURITY
======================= */
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));

/* =======================
   RATE LIMIT
======================= */
const limiter = rateLimit({
  windowMs: 30 * 60 * 1000,
  max: 200,
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

/* =======================
   GENERAL MIDDLEWARE
======================= */
app.use(compression());
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));

/* =======================
   HEALTH CHECK
======================= */
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

/* =======================
   API ROUTES
======================= */
app.use('/api/auth', authRoutes);

app.use('/api/investors', authenticateToken, investorRoutes);
app.use('/api/campaigns', authenticateToken, campaignRoutes);
app.use('/api/analytics', authenticateToken, analyticsRoutes);
app.use('/api/import', authenticateToken, importRoutes);
app.use('/api/roi', authenticateToken, roiRoutes);
app.use('/api/users', authenticateToken, userRoutes);
app.use('/api/firms', authenticateToken, firmRoutes);
app.use('/api/customers', authenticateToken, customerRoutes);

app.use('/api/companies', authenticateToken, companyRoutes);
app.use('/api/company_employees', authenticateToken, companyEmployeeRoutes);

app.use('/api/investor_lists', authenticateToken, investorLists);
app.use('/api/investor_contact_status', authenticateToken, investorContactStatus);

app.use('/api/meetings', meetingsRoutes);
app.use('/api/followups', authenticateToken, followupsRoutes);
app.use('/api/interactions', authenticateToken, interactionsRoutes);

app.use('/api/googleAuth', googleAuthRoutes);

/* =======================
   404 HANDLER
======================= */
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

/* =======================
   ERROR HANDLER
======================= */
app.use(errorHandler);

/* =======================
   START SERVER
======================= */
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;



