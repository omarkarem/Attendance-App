const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Session name is required'],
    trim: true,
    maxlength: [100, 'Session name must be less than 100 characters']
  },
  coach: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  date: {
    type: Date,
    required: true,
    index: true
  },
  // Optional start time "HH:MM", shown as-is (no timezone math).
  time: {
    type: String,
    trim: true,
    default: null
  },
  // "yyyy-MM-dd" for sessions generated from a template; used to dedupe generation.
  dayKey: {
    type: String,
    default: undefined
  },
  scheduleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Schedule',
    default: null
  },
  assignedAthletes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Athlete'
  }]
}, {
  timestamps: true
});

// Compound index for coach + date queries
sessionSchema.index({ coach: 1, date: -1 });
// One generated session per template per day, even under concurrent requests.
sessionSchema.index(
  { scheduleId: 1, dayKey: 1 },
  { unique: true, partialFilterExpression: { dayKey: { $type: 'string' } } }
);

module.exports = mongoose.model('Session', sessionSchema);
