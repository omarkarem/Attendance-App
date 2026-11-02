const mongoose = require('mongoose');
const { shareSchema } = require('./Package');

// One package an athlete is on for one month, and whether it is paid. An athlete on
// several packages has one of these per package. The package's name, price and shares
// are copied in, so later price changes do not rewrite past months.
const paymentSchema = new mongoose.Schema({
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  athlete: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Athlete',
    required: true
  },
  // Kept for display if the athlete is deleted later.
  athleteName: {
    type: String,
    trim: true
  },
  // The athlete's coach when the package was set.
  coach: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  month: {
    type: String,
    required: true,
    match: /^\d{4}-\d{2}$/
  },
  package: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Package'
  },
  packageName: String,
  price: {
    type: Number,
    required: true,
    min: 0
  },
  daysPerWeek: Number,
  shares: {
    type: [shareSchema],
    default: []
  },
  paid: {
    type: Boolean,
    default: false
  },
  paidAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

paymentSchema.index({ owner: 1, month: 1 });
paymentSchema.index({ owner: 1, athlete: 1, month: 1, package: 1 }, { unique: true });

const Payment = mongoose.model('Payment', paymentSchema);

// Payments used to allow one package per athlete per month. That unique index stops a
// second package from being added, and Mongoose never drops old indexes itself.
const LEGACY_INDEX = 'owner_1_athlete_1_month_1';
Payment.dropLegacyIndexes = async () => {
  try {
    const indexes = await Payment.collection.indexes();
    if (indexes.some((i) => i.name === LEGACY_INDEX)) await Payment.collection.dropIndex(LEGACY_INDEX);
  } catch (error) {
    // No payments collection yet: nothing to drop.
    if (error.codeName !== 'NamespaceNotFound') throw error;
  }
};

module.exports = Payment;
