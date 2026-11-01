const mongoose = require('mongoose');

const scheduleSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Schedule name is required'],
    trim: true,
    maxlength: [100, 'Schedule name must be less than 100 characters']
  },
  coach: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  daysOfWeek: {
    type: [Number], // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    required: true,
    validate: {
      validator: function(v) {
        return v && v.length > 0 && v.every(day => day >= 0 && day <= 6);
      },
      message: 'At least one valid day of the week (0-6) is required'
    }
  },
  time: {
    type: String, // HH:MM format optional
    trim: true
  },
  assignedAthletes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Athlete'
  }],
  // Days ("yyyy-MM-dd") whose generated session the coach deleted; never regenerate them.
  skippedDates: {
    type: [String],
    default: []
  },
  // Watermark ("yyyy-MM-dd"): every day up to and including it has had its session
  // generated. Backfill only fills days after it, so days a coach deleted before
  // skippedDates existed, and days while the template was paused, are never recreated.
  // null on templates created before the watermark existed; treated as "yesterday".
  generatedThrough: {
    type: String,
    default: null
  },
  active: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Schedule', scheduleSchema);
