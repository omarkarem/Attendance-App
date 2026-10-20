const Schedule = require('../models/Schedule');
const Session = require('../models/Session');
const { dayRange, noonUtc } = require('./dates');

/**
 * Lazily creates the sessions that a coach's active templates call for on a given day.
 * Safe to call concurrently: generated sessions carry a dayKey with a unique index per
 * template, so a second request racing the first gets a duplicate-key error we ignore.
 */
const ensureScheduledSessions = async (coachId, dayKey) => {
  const { start, end } = dayRange(dayKey);
  const dayOfWeek = start.getUTCDay();

  const schedules = await Schedule.find({ coach: coachId, active: true, daysOfWeek: dayOfWeek });

  await Promise.all(schedules.map(async (schedule) => {
    if ((schedule.skippedDates || []).includes(dayKey)) return;

    // Sessions generated before dayKey existed are matched by date range.
    const existing = await Session.exists({
      coach: coachId,
      scheduleId: schedule._id,
      $or: [{ dayKey }, { date: { $gte: start, $lt: end } }]
    });
    if (existing) return;

    try {
      await Session.updateOne(
        { coach: coachId, scheduleId: schedule._id, dayKey },
        {
          $setOnInsert: {
            name: schedule.name,
            coach: coachId,
            date: noonUtc(dayKey),
            time: schedule.time || null,
            scheduleId: schedule._id,
            dayKey,
            assignedAthletes: schedule.assignedAthletes || []
          }
        },
        { upsert: true }
      );
    } catch (error) {
      if (error.code !== 11000) throw error;
    }
  }));
};

module.exports = { ensureScheduledSessions };
