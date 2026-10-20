const Schedule = require('../models/Schedule');
const Session = require('../models/Session');
const { dayRange, noonUtc, toDayKey, addDays } = require('./dates');

// Backfill never walks further back than this, even for a template untouched for months.
const MAX_BACKFILL_DAYS = 400;

/**
 * Creates the sessions a template calls for on the given days (skipping wrong weekdays,
 * skipped days and days that already have one). Safe to run concurrently: generated
 * sessions carry a dayKey with a unique index per template, and the duplicate-key
 * errors a racing request gets are ignored.
 */
const generateDays = async (coachId, schedule, dayKeys) => {
  const skipped = new Set(schedule.skippedDates || []);
  const wanted = dayKeys.filter((k) => schedule.daysOfWeek.includes(dayRange(k).start.getUTCDay()) && !skipped.has(k));
  if (wanted.length === 0) return 0;

  // Sessions generated before dayKey existed are matched by their date.
  const sorted = [...wanted].sort();
  const existing = await Session.find({
    coach: coachId,
    scheduleId: schedule._id,
    $or: [
      { dayKey: { $in: wanted } },
      { date: { $gte: dayRange(sorted[0]).start, $lt: dayRange(sorted[sorted.length - 1]).end } }
    ]
  }).select('dayKey date');
  const have = new Set(existing.map((s) => s.dayKey || toDayKey(s.date)));
  const missing = wanted.filter((k) => !have.has(k));
  if (missing.length === 0) return 0;

  try {
    const result = await Session.bulkWrite(missing.map((dayKey) => ({
      updateOne: {
        filter: { coach: coachId, scheduleId: schedule._id, dayKey },
        update: {
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
        upsert: true
      }
    })), { ordered: false });
    return result.upsertedCount;
  } catch (error) {
    const errors = error.writeErrors || [];
    if (error.code !== 11000 && !(errors.length && errors.every((e) => e.code === 11000))) throw error;
    return error.result?.upsertedCount ?? 0;
  }
};

/** Today's (or any single day's) sessions for every active template that runs that day. */
const ensureScheduledSessions = async (coachId, dayKey) => {
  const dayOfWeek = dayRange(dayKey).start.getUTCDay();
  const schedules = await Schedule.find({ coach: coachId, active: true, daysOfWeek: dayOfWeek });
  await Promise.all(schedules.map((schedule) => generateDays(coachId, schedule, [dayKey])));
};

/**
 * Fills every template day after the template's watermark up to `upTo` (the coach's
 * today), then moves the watermark forward. Templates without a watermark start from
 * yesterday: older gaps are ambiguous (never opened, or deleted before skippedDates
 * existed) and are left alone. Returns the number of sessions created.
 */
const backfillScheduledSessions = async (coachId, upTo) => {
  const schedules = await Schedule.find({ coach: coachId, active: true });
  const counts = await Promise.all(schedules.map(async (schedule) => {
    const createdKey = toDayKey(schedule.createdAt || new Date());
    const watermark = schedule.generatedThrough || addDays(upTo, -1);
    let from = addDays(watermark, 1);
    if (from < createdKey) from = createdKey;
    const floor = addDays(upTo, -MAX_BACKFILL_DAYS);
    if (from < floor) from = floor;
    if (from > upTo) return 0;

    const days = [];
    for (let k = from; k <= upTo; k = addDays(k, 1)) days.push(k);
    const created = await generateDays(coachId, schedule, days);

    // Only ever move the watermark forward, even if another request got there first.
    await Schedule.updateOne(
      { _id: schedule._id, $or: [{ generatedThrough: null }, { generatedThrough: { $lt: upTo } }] },
      { $set: { generatedThrough: upTo } }
    );
    return created;
  }));
  return counts.reduce((a, b) => a + b, 0);
};

/** Backfill for every coach with an active template (used by the daily cron). */
const backfillAllCoaches = async (upTo) => {
  const coaches = await Schedule.distinct('coach', { active: true });
  let created = 0;
  for (const coachId of coaches) {
    created += await backfillScheduledSessions(coachId, upTo);
  }
  return { coaches: coaches.length, created };
};

module.exports = { ensureScheduledSessions, backfillScheduledSessions, backfillAllCoaches };
