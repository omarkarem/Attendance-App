const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    minlength: [2, 'Name must be at least 2 characters'],
    maxlength: [50, 'Name must be less than 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false
  },
  role: {
    type: String,
    enum: ['coach', 'admin'],
    default: 'coach'
  },
  // Accounts created before access control have no status, so the default keeps them
  // working. Signup sets 'pending' explicitly; an admin moves it to 'active' or 'revoked'.
  status: {
    type: String,
    enum: ['pending', 'active', 'revoked'],
    default: 'active'
  },
  statusChangedAt: {
    type: Date
  },
  // Team: a coach can work under one head coach. The head can open and manage this
  // account; teamAccess is what the head lets this coach do with the head's own data.
  headCoach: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
    index: true
  },
  teamJoinedAt: {
    type: Date
  },
  teamAccess: {
    // 'view' or 'edit' lets this coach open the head coach's account.
    data: { type: String, enum: ['none', 'view', 'edit'], default: 'none' },
    // Lets this coach see the team's finance pages (revenue, packages, costs).
    finance: { type: Boolean, default: false }
  },
  // Finance settings, used on the head coach (or a coach without a team).
  currency: {
    type: String,
    trim: true,
    maxlength: 8,
    default: ''
  }
}, {
  timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function() {
  if (!this.isModified('password')) return;
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
