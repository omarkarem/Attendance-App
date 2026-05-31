const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  session: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Session',
    required: true,
    index: true
  },
  athlete: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Athlete',
    required: true
  },
  coach: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  present: {
    type: Boolean,
    default: false
  },
  date: {
    type: Date,
    required: true,
    index: true
  }
}, {
  timestamps: true
});

// Compound indexes for common queries
attendanceSchema.index({ coach: 1, date: 1 });
attendanceSchema.index({ session: 1, athlete: 1 }, { unique: true });
attendanceSchema.index({ coach: 1, athlete: 1, date: 1 });

module.exports = mongoose.model('Attendance', attendanceSchema);
