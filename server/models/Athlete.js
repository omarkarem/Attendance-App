const mongoose = require('mongoose');

// An athlete counts as new for this many days after their join date.
const NEW_ATHLETE_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

// Derived from the join date so the badge goes away on its own.
const isNewSince = (joinDate, now = new Date()) =>
  !!joinDate && now.getTime() - new Date(joinDate).getTime() < NEW_ATHLETE_DAYS * DAY_MS;

const athleteSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Athlete name is required'],
    trim: true,
    minlength: [2, 'Name must be at least 2 characters'],
    maxlength: [50, 'Name must be less than 50 characters']
  },
  coach: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  // The calendar day they joined, stored at 12:00 UTC like sessions.
  joinDate: {
    type: Date,
    default: Date.now
  },
  active: {
    type: Boolean,
    default: true
  },
  archivedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true,
  toJSON: {
    transform: (doc, ret) => {
      ret.isNewAthlete = isNewSince(ret.joinDate);
      return ret;
    }
  }
});

// Older documents still carry a stored isNewAthlete flag; this getter wins over it.
athleteSchema.virtual('isNewAthlete').get(function isNewAthlete() {
  return isNewSince(this.joinDate);
});

// Compound index for coach + active queries
athleteSchema.index({ coach: 1, active: 1 });

module.exports = mongoose.model('Athlete', athleteSchema);
module.exports.NEW_ATHLETE_DAYS = NEW_ATHLETE_DAYS;
module.exports.isNewSince = isNewSince;
