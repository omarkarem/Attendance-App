const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const athleteRoutes = require('./routes/athletes');
const sessionRoutes = require('./routes/sessions');
const attendanceRoutes = require('./routes/attendance');
const exportRoutes = require('./routes/export');
const scheduleRoutes = require('./routes/schedules');
const testRoutes = require('./routes/tests');
const cronRoutes = require('./routes/cron');
const adminRoutes = require('./routes/admin');
const teamRoutes = require('./routes/team');
const financeRoutes = require('./routes/finance');
const Payment = require('./models/Payment');

const app = express();

// Middleware
app.use(cors({
  origin: [
    process.env.CLIENT_URL || 'http://localhost:3000',
    'https://attendance-app-omega-five.vercel.app'
  ],
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// Routes (Mount at both /api and / to handle environment variable misconfigurations)
const mountRoutes = (prefix) => {
  app.use(`${prefix}/auth`, authRoutes);
  app.use(`${prefix}/athletes`, athleteRoutes);
  app.use(`${prefix}/sessions`, sessionRoutes);
  app.use(`${prefix}/attendance`, attendanceRoutes);
  app.use(`${prefix}/export`, exportRoutes);
  app.use(`${prefix}/schedules`, scheduleRoutes);
  app.use(`${prefix}/tests`, testRoutes);
  app.use(`${prefix}/cron`, cronRoutes);
  app.use(`${prefix}/admin`, adminRoutes);
  app.use(`${prefix}/team`, teamRoutes);
  app.use(`${prefix}/finance`, financeRoutes);
};

mountRoutes('/api');
mountRoutes(''); // Handles cases where the frontend forgot to append /api to the URL

// Health check
const health = (req, res) => {
  const db = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  res.json({ status: 'ok', db, timestamp: new Date().toISOString() });
};
app.get('/api/health', health);
app.get('/health', health);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ message: 'Internal server error.' });
});

// Connect to MongoDB and start server
const PORT = process.env.PORT || 5000;

mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('Connected to MongoDB');
    Payment.dropLegacyIndexes().catch((err) => console.error('Could not drop the old payments index:', err.message));
    if (process.env.NODE_ENV !== 'production') {
      app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
      });
    }
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err.message);
    // On Vercel, exiting kills the function and every request (CORS preflights included) fails with no headers
    // (Vercel sets VERCEL=1 at runtime; NODE_ENV is not reliably 'production' there)
    if (!process.env.VERCEL) process.exit(1);
  });

// Export the Express API for Vercel Serverless
module.exports = app;
