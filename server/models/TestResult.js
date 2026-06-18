const mongoose = require('mongoose');

const testResultSchema = new mongoose.Schema({
  athlete: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Athlete',
    required: true,
    index: true
  },
  testType: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TestType',
    required: true,
  },
  date: {
    type: Date,
    required: true,
    default: Date.now
  },
  distance: {
    type: Number,
    required: true,
    min: [0, 'Distance cannot be negative']
  },
  time: {
    type: Number,
    required: true,
    min: [0, 'Time cannot be negative']
  },
  description: {
    type: String,
    trim: true
  },
  // ── Cycling-specific fields (all optional) ──
  avgPower: { type: Number, min: 0 },   // watts (FTP)
  maxPower: { type: Number, min: 0 },
  avgCadence: { type: Number, min: 0 }, // RPM
  maxCadence: { type: Number, min: 0 },
  avgHeartRate: { type: Number, min: 0 }, // BPM
  maxHeartRate: { type: Number, min: 0 },
  weight: { type: Number, min: 0 },     // kg
  coach: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('TestResult', testResultSchema);
