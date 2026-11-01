const express = require('express');
const crypto = require('crypto');
const { toDayKey } = require('../utils/dates');
const { backfillAllCoaches } = require('../utils/sessionGenerator');

const router = express.Router();

// Vercel Cron sends "Authorization: Bearer <CRON_SECRET>" when CRON_SECRET is set on the project.
const authorized = (req) => {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(req.headers.authorization || '');
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && crypto.timingSafeEqual(given, expected);
};

// GET /api/cron/generate - create today's template sessions (and catch up missed days) for every coach.
router.get('/generate', async (req, res) => {
  if (!process.env.CRON_SECRET) return res.status(503).json({ message: 'Cron is disabled. Set CRON_SECRET to enable it.' });
  if (!authorized(req)) return res.status(401).json({ message: 'Unauthorized.' });
  try {
    const today = toDayKey(new Date());
    const result = await backfillAllCoaches(today);
    res.json({ date: today, ...result });
  } catch (error) {
    console.error('Cron generate failed:', error);
    res.status(500).json({ message: error.message || 'Cron generate failed.' });
  }
});

module.exports = router;
