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
