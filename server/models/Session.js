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

module.exports = mongoose.model('Session', sessionSchema);
