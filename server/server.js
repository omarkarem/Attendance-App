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
};

mountRoutes('/api');
mountRoutes(''); // Handles cases where the frontend forgot to append /api to the URL

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ message: 'Internal server error.' });
});

// Connect to MongoDB and start server
const PORT = process.env.PORT || 5000;

mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('✅ Connected to MongoDB');
    if (process.env.NODE_ENV !== 'production') {
      app.listen(PORT, () => {
        console.log(`🚀 Server running on port ${PORT}`);
      });
    }
  })
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  });

// Export the Express API for Vercel Serverless
module.exports = app;
