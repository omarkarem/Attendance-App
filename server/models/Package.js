const mongoose = require('mongoose');

// Money from the package price that is passed on to someone else (the gym, the pool),
// so it is not counted as the coach's revenue.
const shareSchema = new mongoose.Schema({
  label: {
    type: String,
    required: [true, 'Name where the money goes'],
    trim: true,
    maxlength: [40, 'Keep names under 40 characters']
  },
  amount: {
    type: Number,
    required: true,
    min: [0, 'Amounts cannot be negative']
  }
}, { _id: false });

// A training package the team sells. Owned by the head coach (the team's finance owner).
const packageSchema = new mongoose.Schema({
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: [true, 'Package name is required'],
    trim: true,
    maxlength: [50, 'Name must be less than 50 characters']
  },
  price: {
    type: Number,
    required: [true, 'Price is required'],
    min: [0, 'Price cannot be negative']
  },
  daysPerWeek: {
    type: Number,
    required: [true, 'Days per week is required'],
    min: [1, 'At least 1 day a week'],
    max: [7, 'At most 7 days a week']
  },
  shares: {
    type: [shareSchema],
    default: []
  },
  // Packages already used on payments are archived instead of deleted.
  active: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Package', packageSchema);
module.exports.shareSchema = shareSchema;
