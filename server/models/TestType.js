const mongoose = require('mongoose');

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
  active: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('TestType', testTypeSchema);
