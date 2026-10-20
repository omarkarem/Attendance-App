const mongoose = require('mongoose');

/**
 * Test types keep their history as a slowly changing dimension (type 2).
 *
 * Every version of a test is its own document. Versions of the same test share a
 * `lineageId` (the _id of the first version). Changing what a test measures (sport,
 * fixed distance or fixed time) after results exist closes the current version
 * (`validTo`, `isCurrent: false`) and opens a new one, so every result keeps pointing
 * at the definition it was actually recorded under. Renaming is a plain overwrite
 * across all versions (type 1): it fixes the label without changing meaning.
 *
 * Documents created before versioning have no lineageId/version; they are read as
 * version 1 of their own lineage (see lineageOf).
 */
const testTypeSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Test title is required'],
    trim: true,
  },
  category: {
    type: String,
    enum: ['Running', 'Swimming', 'Cycling', 'Other'],
    required: true,
  },
  measureType: {
    type: String,
    enum: ['Distance', 'Time'],
    required: true,
  },
  targetDistance: {
    type: Number, // in meters
  },
  targetTime: {
    type: Number, // in seconds
  },
  coach: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  // Soft delete of the whole test (set on the current version).
  active: {
    type: Boolean,
    default: true
  },
  lineageId: {
    type: mongoose.Schema.Types.ObjectId,
    index: true,
    default: null
  },
  version: {
    type: Number,
    default: 1
  },
  // No default: older documents have none and fall back to createdAt.
  validFrom: {
    type: Date,
    default: null
  },
  validTo: {
    type: Date,
    default: null
  },
  isCurrent: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

testTypeSchema.index({ coach: 1, isCurrent: 1, active: 1 });

const TestType = mongoose.model('TestType', testTypeSchema);

/** The lineage a version belongs to (older documents are their own lineage). */
const lineageOf = (t) => (t.lineageId || t._id);

/** Query matching every version in the given lineages. */
const lineageQuery = (coach, lineageIds) => ({
  coach,
  $or: [{ lineageId: { $in: lineageIds } }, { _id: { $in: lineageIds }, lineageId: null }]
});

module.exports = TestType;
module.exports.lineageOf = lineageOf;
module.exports.lineageQuery = lineageQuery;
