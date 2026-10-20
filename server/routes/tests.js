const express = require('express');
const mongoose = require('mongoose');
const TestType = require('../models/TestType');
const TestResult = require('../models/TestResult');
const Athlete = require('../models/Athlete');
const auth = require('../middleware/auth');
const { clientToday, toDayKey, escapeRegex, noonUtc } = require('../utils/dates');

const { lineageOf, lineageQuery } = TestType;

const CATEGORIES = ['Running', 'Swimming', 'Cycling', 'Other'];
const CYCLING_FIELDS = ['avgPower', 'maxPower', 'avgCadence', 'maxCadence', 'avgHeartRate', 'maxHeartRate', 'weight'];
const TYPE_FIELDS = 'title category measureType targetDistance targetTime lineageId version validFrom validTo isCurrent active';
const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;

const isId = (id) => mongoose.isValidObjectId(id);
const num = (v) => (v === undefined || v === null || v === '' ? null : Number(v));
const isCurrentQuery = { isCurrent: { $ne: false } };

// Validates and normalizes a test type payload. Only the target that matches the
// measure type is kept, so a "fixed distance" test never carries a stray target time.
const normalizeType = ({ title, category, measureType, targetDistance, targetTime }) => {
  if (!title || !String(title).trim() || !category || !measureType) return { error: 'Title, category, and measure type are required.' };
  if (!CATEGORIES.includes(category)) return { error: 'Invalid category.' };
  if (!['Distance', 'Time'].includes(measureType)) return { error: 'Invalid measure type.' };
  const distance = num(targetDistance);
  const time = num(targetTime);
  if (measureType === 'Distance' && !(distance > 0)) return { error: 'Enter the distance athletes cover.' };
  if (measureType === 'Time' && !(time > 0)) return { error: 'Enter how long the test lasts.' };
  return {
    value: {
      title: String(title).trim(),
      category,
      measureType,
      targetDistance: measureType === 'Distance' ? distance : null,
      targetTime: measureType === 'Time' ? Math.round(time) : null
    }
  };
};

const definitionOf = (t) => ({
  category: t.category,
  measureType: t.measureType,
  targetDistance: t.measureType === 'Distance' ? (t.targetDistance ?? null) : null,
  targetTime: t.measureType === 'Time' ? (t.targetTime ?? null) : null
});

const sameDefinition = (a, b) => {
  const x = definitionOf(a);
  const y = definitionOf(b);
  return Object.keys(x).every((k) => x[k] === y[k]);
};

const titleTaken = (coach, title, exceptLineage) => TestType.exists({
  coach,
  active: true,
  ...isCurrentQuery,
  title: { $regex: `^${escapeRegex(title)}$`, $options: 'i' },
  ...(exceptLineage ? { _id: { $ne: exceptLineage }, lineageId: { $ne: exceptLineage } } : {})
});

// Versions of the lineage that `typeId` belongs to, oldest first.
const versionsFor = async (coach, typeId) => {
  if (!isId(typeId)) return [];
  const any = await TestType.findOne({ _id: typeId, coach });
  if (!any) return [];
  return TestType.find(lineageQuery(coach, [lineageOf(any)])).sort({ version: 1 });
};

const startKey = (v) => toDayKey(v.validFrom || v.createdAt);

// The version that applied on `dayKey`: the newest one that had started by then.
// Results dated before the first version use the first one.
const versionOn = (versions, dayKey) => {
  let chosen = versions[0];
  versions.forEach((v) => { if (startKey(v) <= dayKey) chosen = v; });
  return chosen;
};

// Expands any version ids to every version id of their lineages.
const expandLineages = async (coach, ids) => {
  const valid = ids.filter(isId);
  if (valid.length === 0) return [];
  const picked = await TestType.find({ _id: { $in: valid }, coach }).select('_id lineageId');
  const lineages = [...new Set(picked.map((t) => String(lineageOf(t))))];
  if (lineages.length === 0) return [];
  const all = await TestType.find(lineageQuery(coach, lineages)).select('_id');
  return all.map((t) => t._id);
};

// Validates a result's date: a calendar day, not after the coach's today.
const resultDay = (date, today) => {
  if (date === undefined || date === null || date === '') return { key: today };
  const key = typeof date === 'string' && DAY_KEY.test(date) ? date : (Number.isNaN(new Date(date).getTime()) ? null : toDayKey(date));
  if (!key) return { error: 'Pick a valid date.' };
  if (key > today) return { error: 'Results cannot be dated in the future.' };
  return { key };
};

/**
 * Turns one entry into a result document for the given version. Fixed targets come
 * from the version (the coach only enters what was measured) unless `keepValues`
 * is set, which edits use so a coach can correct an unusual distance or time.
 */
const buildResult = (entry, version, { keepValues = false } = {}) => {
  const fixedDistance = version.measureType === 'Distance' && version.targetDistance > 0;
  const fixedTime = version.measureType === 'Time' && version.targetTime > 0;
  let distance = num(entry.distance);
  let time = num(entry.time);
  if (fixedDistance && (!keepValues || !(distance > 0))) distance = version.targetDistance;
  if (fixedTime && (!keepValues || !(time > 0))) time = version.targetTime;
  if (!Number.isFinite(distance) || distance <= 0) return { error: 'Distance must be greater than zero.' };
  if (!Number.isFinite(time) || time <= 0) return { error: 'Time must be greater than zero.' };

  const doc = {
    testType: version._id,
    distance,
    time: Math.round(time * 100) / 100,
    description: entry.description ? String(entry.description).trim().slice(0, 300) : ''
  };
  // Cycling extras only make sense on cycling tests; they are cleared elsewhere.
  for (const k of CYCLING_FIELDS) {
    const v = version.category === 'Cycling' ? num(entry[k]) : null;
    if (v !== null && (!Number.isFinite(v) || v < 0)) return { error: 'Cycling values must be positive numbers.' };
    doc[k] = v;
  }
  return { value: doc };
};

const populateResult = (query) => query
  .populate('athlete', 'name active')
  .populate('testType', TYPE_FIELDS);

const router = express.Router();

// All routes require authentication
router.use(auth);

// --- Test Types ---

// GET /api/tests/types - Current test types, each with its version history and result count
router.get('/types', async (req, res) => {
  try {
    const current = await TestType.find({ coach: req.user._id, active: true, ...isCurrentQuery }).sort({ title: 1 });
    const lineages = current.map((t) => lineageOf(t));
    const [history, counts] = await Promise.all([
      lineages.length ? TestType.find(lineageQuery(req.user._id, lineages)).sort({ version: 1 }) : [],
      TestResult.aggregate([
        { $match: { coach: req.user._id, testType: { $in: current.map((t) => t._id) } } },
        { $group: { _id: '$testType', n: { $sum: 1 } } }
      ])
    ]);
    const countBy = new Map(counts.map((c) => [String(c._id), c.n]));
    const byLineage = new Map();
    history.forEach((v) => {
      const key = String(lineageOf(v));
      if (!byLineage.has(key)) byLineage.set(key, []);
      byLineage.get(key).push(v);
    });

    res.json(current.map((t) => ({
      ...t.toObject(),
      lineageId: lineageOf(t),
      resultCount: countBy.get(String(t._id)) || 0,
      versions: (byLineage.get(String(lineageOf(t))) || [t]).map((v) => ({
        _id: v._id,
        version: v.version || 1,
        category: v.category,
        measureType: v.measureType,
        targetDistance: v.targetDistance,
        targetTime: v.targetTime,
        validFrom: v.validFrom || v.createdAt,
        validTo: v.validTo || null,
        isCurrent: v.isCurrent !== false
      }))
    })));
  } catch (error) {
    res.status(500).json({ message: error.message || 'Error fetching test types.' });
  }
});

// POST /api/tests/types - Create a new test type (version 1 of a new lineage)
router.post('/types', async (req, res) => {
  try {
    const { value, error } = normalizeType(req.body);
    if (error) return res.status(400).json({ message: error });
    if (await titleTaken(req.user._id, value.title)) {
      return res.status(400).json({ message: 'A test with this name already exists.' });
    }

    const _id = new mongoose.Types.ObjectId();
    const testType = await TestType.create({
      _id,
      ...value,
      coach: req.user._id,
      lineageId: _id,
      version: 1,
      validFrom: noonUtc(clientToday(req.query.today))
    });

    res.status(201).json({ ...testType.toObject(), resultCount: 0, versions: [{ ...testType.toObject(), isCurrent: true }] });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Error creating test type.' });
  }
});

// PUT /api/tests/types/:id - Edit the current version of a test type.
// A rename applies to every version. A change to what is measured starts a new version
// when results already use the current one; otherwise the version is corrected in place.
router.put('/types/:id', async (req, res) => {
  try {
    const { value, error } = normalizeType(req.body);
    if (error) return res.status(400).json({ message: error });

    const current = isId(req.params.id) && await TestType.findOne({ _id: req.params.id, coach: req.user._id, active: true });
    if (!current) return res.status(404).json({ message: 'Test type not found.' });
    if (current.isCurrent === false) {
      return res.status(400).json({ message: 'This is an older version of the test. Edit the current one instead.' });
    }

    const lineage = lineageOf(current);
    if (value.title.toLowerCase() !== current.title.toLowerCase() && await titleTaken(req.user._id, value.title, lineage)) {
      return res.status(400).json({ message: 'A test with this name already exists.' });
    }

    // Type 1: the name is a label, so it is corrected everywhere.
    if (value.title !== current.title) {
      await TestType.updateMany(lineageQuery(req.user._id, [lineage]), { $set: { title: value.title } });
      current.title = value.title;
    }

    if (sameDefinition(current, value)) {
      return res.json({ ...current.toObject(), versioned: false });
    }

    const used = await TestResult.exists({ coach: req.user._id, testType: current._id });
    if (!used) {
      Object.assign(current, value, { lineageId: lineage });
      await current.save();
      return res.json({ ...current.toObject(), versioned: false });
    }

    // Type 2: close the current version and open a new one. Only one request can win.
    const from = noonUtc(clientToday(req.query.today));
    const closed = await TestType.findOneAndUpdate(
      { _id: current._id, ...isCurrentQuery },
      { $set: { isCurrent: false, validTo: from, lineageId: lineage, validFrom: current.validFrom || current.createdAt } },
      { new: true }
    );
    if (!closed) return res.status(409).json({ message: 'This test was just changed. Reload and try again.' });

    const next = await TestType.create({
      ...value,
      coach: req.user._id,
      lineageId: lineage,
      version: (current.version || 1) + 1,
      validFrom: from,
      isCurrent: true,
      active: true
    });

    res.json({ ...next.toObject(), versioned: true, previousVersion: closed.version || 1 });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Error updating test type.' });
  }
});

// DELETE /api/tests/types/:id - Soft delete a test (every version). Results stay.
router.delete('/types/:id', async (req, res) => {
  try {
    const testType = isId(req.params.id) && await TestType.findOne({ _id: req.params.id, coach: req.user._id });
    if (!testType) {
      return res.status(404).json({ message: 'Test type not found.' });
    }
    await TestType.updateMany(lineageQuery(req.user._id, [lineageOf(testType)]), { $set: { active: false } });
    res.json({ message: 'Test type deleted.' });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Error deleting test type.' });
  }
});

// --- Test Results ---

// GET /api/tests/results/athletes - Athletes who have results for the given tests (any version)
router.get('/results/athletes', async (req, res) => {
  try {
    const { testTypeIds } = req.query;
    if (!testTypeIds) {
      return res.status(400).json({ message: 'testTypeIds is required.' });
    }

    const ids = await expandLineages(req.user._id, testTypeIds.split(',').map((id) => id.trim()));

    const athleteIds = await TestResult.distinct('athlete', {
      coach: req.user._id,
      testType: { $in: ids }
    });

    const athletes = await Athlete.find({
      _id: { $in: athleteIds },
      coach: req.user._id
    }).select('_id name').sort({ name: 1 });

    res.json(athletes);
  } catch (error) {
    res.status(500).json({ message: error.message || 'Error fetching athletes.' });
  }
});

// GET /api/tests/results - Results, optionally for one athlete and/or one test (all versions)
router.get('/results', async (req, res) => {
  try {
    const { athleteId, testTypeId } = req.query;
    const query = { coach: req.user._id };

    if (athleteId) {
      if (!isId(athleteId)) return res.json([]);
      query.athlete = athleteId;
    }
    if (testTypeId) query.testType = { $in: await expandLineages(req.user._id, [testTypeId]) };

    const results = await populateResult(TestResult.find(query)).sort({ date: -1, createdAt: -1 });
    res.json(results);
  } catch (error) {
    res.status(500).json({ message: error.message || 'Error fetching test results.' });
  }
});

// POST /api/tests/results - Record one result.
// The version that applied on the result's date is used, and its fixed target filled in.
router.post('/results', async (req, res) => {
  try {
    const { athleteId, testTypeId, date } = req.body;
    if (!athleteId || !testTypeId) return res.status(400).json({ message: 'Choose an athlete and a test.' });

    const day = resultDay(date, clientToday(req.query.today));
    if (day.error) return res.status(400).json({ message: day.error });

    const [athlete, versions] = await Promise.all([
      isId(athleteId) ? Athlete.exists({ _id: athleteId, coach: req.user._id }) : null,
      versionsFor(req.user._id, testTypeId)
    ]);
    if (!athlete) return res.status(400).json({ message: 'Athlete not found.' });
    if (versions.length === 0 || versions.every((v) => v.active === false)) return res.status(400).json({ message: 'Test type not found.' });

    const built = buildResult(req.body, versionOn(versions, day.key));
    if (built.error) return res.status(400).json({ message: built.error });

    const result = await TestResult.create({
      ...built.value,
      athlete: athleteId,
      date: new Date(`${day.key}T00:00:00.000Z`),
      coach: req.user._id
    });

    res.status(201).json(await populateResult(TestResult.findById(result._id)));
  } catch (error) {
    res.status(500).json({ message: error.message || 'Error recording test result.' });
  }
});

// POST /api/tests/results/bulk - Record one test for many athletes on one day.
// body: { testTypeId, date, entries: [{ athleteId, distance?, time?, description?, ...cycling }] }
// Either every entry is saved or none is; errors name the athlete.
router.post('/results/bulk', async (req, res) => {
  try {
    const { testTypeId, date, entries } = req.body;
    if (!testTypeId) return res.status(400).json({ message: 'Choose a test.' });
    if (!Array.isArray(entries) || entries.length === 0) return res.status(400).json({ message: 'Enter at least one result.' });
    if (entries.length > 300) return res.status(400).json({ message: 'Save at most 300 results at a time.' });

    const day = resultDay(date, clientToday(req.query.today));
    if (day.error) return res.status(400).json({ message: day.error });

    const versions = await versionsFor(req.user._id, testTypeId);
    if (versions.length === 0 || versions.every((v) => v.active === false)) return res.status(400).json({ message: 'Test type not found.' });
    const version = versionOn(versions, day.key);

    const athleteIds = [...new Set(entries.map((e) => String(e.athleteId)))];
    if (athleteIds.some((id) => !isId(id))) return res.status(400).json({ message: 'One or more athletes were not found.' });
    const athletes = await Athlete.find({ _id: { $in: athleteIds }, coach: req.user._id }).select('name');
    const names = new Map(athletes.map((a) => [String(a._id), a.name]));
    if (names.size !== athleteIds.length) return res.status(400).json({ message: 'One or more athletes were not found.' });

    const docs = [];
    for (const entry of entries) {
      const built = buildResult(entry, version);
      if (built.error) return res.status(400).json({ message: `${names.get(String(entry.athleteId))}: ${built.error}`, athleteId: entry.athleteId });
      docs.push({ ...built.value, athlete: entry.athleteId, date: new Date(`${day.key}T00:00:00.000Z`), coach: req.user._id });
    }

    const created = await TestResult.insertMany(docs);
    const populated = await populateResult(TestResult.find({ _id: { $in: created.map((r) => r._id) } }));
    res.status(201).json({ created: populated, version: version.version || 1 });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Error recording test results.' });
  }
});

// PUT /api/tests/results/:id - Update a test result. Changing the date can move it to
// the version that applied on the new date; entered values are kept as typed.
router.put('/results/:id', async (req, res) => {
  try {
    const { athleteId, testTypeId, date } = req.body;
    const existing = isId(req.params.id) && await TestResult.findOne({ _id: req.params.id, coach: req.user._id });
    if (!existing) return res.status(404).json({ message: 'Test result not found.' });
    if (!athleteId || !testTypeId) return res.status(400).json({ message: 'Choose an athlete and a test.' });

    const day = resultDay(date, clientToday(req.query.today));
    if (day.error) return res.status(400).json({ message: day.error });

    const [athlete, versions] = await Promise.all([
      isId(athleteId) ? Athlete.exists({ _id: athleteId, coach: req.user._id }) : null,
      versionsFor(req.user._id, testTypeId)
    ]);
    if (!athlete) return res.status(400).json({ message: 'Athlete not found.' });
    if (versions.length === 0) return res.status(400).json({ message: 'Test type not found.' });

    const built = buildResult(req.body, versionOn(versions, day.key), { keepValues: true });
    if (built.error) return res.status(400).json({ message: built.error });

    Object.assign(existing, built.value, { athlete: athleteId, date: new Date(`${day.key}T00:00:00.000Z`) });
    await existing.save();

    res.json(await populateResult(TestResult.findById(existing._id)));
  } catch (error) {
    res.status(500).json({ message: error.message || 'Error updating test result.' });
  }
});

// DELETE /api/tests/results/:id - Delete a test result
router.delete('/results/:id', async (req, res) => {
  try {
    const result = isId(req.params.id) && await TestResult.findOneAndDelete({
      _id: req.params.id,
      coach: req.user._id
    });

    if (!result) {
      return res.status(404).json({ message: 'Test result not found.' });
    }

    res.json({ message: 'Test result deleted.' });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Error deleting test result.' });
  }
});

module.exports = router;
