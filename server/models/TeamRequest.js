const mongoose = require('mongoose');

// A request to put `member` under `head`. Either side can start it: the head invites
// a coach, or a coach asks to join a head. The other side accepts or declines in the app.
const teamRequestSchema = new mongoose.Schema({
  head: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  member: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  initiatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'declined', 'cancelled'],
    default: 'pending'
  },
  respondedAt: {
    type: Date
  }
}, {
  timestamps: true
});

teamRequestSchema.index({ head: 1, status: 1 });
teamRequestSchema.index({ member: 1, status: 1 });
// One open request per pair.
teamRequestSchema.index(
  { head: 1, member: 1 },
  { unique: true, partialFilterExpression: { status: 'pending' } }
);

module.exports = mongoose.model('TeamRequest', teamRequestSchema);
