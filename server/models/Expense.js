const mongoose = require('mongoose');

// A cost the team pays (coach pay, pool or gym rent, equipment). Monthly costs apply
// from startMonth until endMonth (open-ended when null); one-off costs have
// startMonth === endMonth.
const expenseSchema = new mongoose.Schema({
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  label: {
    type: String,
    required: [true, 'Say what the cost is for'],
    trim: true,
    maxlength: [50, 'Keep it under 50 characters']
  },
  amount: {
    type: Number,
    required: [true, 'Amount is required'],
    min: [0, 'Amount cannot be negative']
  },
  category: {
    type: String,
    enum: ['coach', 'facility', 'other'],
    default: 'other'
  },
  // For coach pay: the team coach it is for (optional).
  coach: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  recurring: {
    type: Boolean,
    default: true
  },
  startMonth: {
    type: String,
    required: true,
    match: /^\d{4}-\d{2}$/
  },
  endMonth: {
    type: String,
    default: null,
    match: /^\d{4}-\d{2}$/
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Expense', expenseSchema);
