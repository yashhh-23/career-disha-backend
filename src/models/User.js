const mongoose = require('mongoose');

const userRoleEnum = ['STUDENT', 'MENTOR', 'ADMIN', 'SUPER_ADMIN'];

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    index: true
  },
  passwordHash: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  role: {
    type: String,
    enum: userRoleEnum,
    default: 'STUDENT',
    index: true
  },
  emailVerified: {
    type: Boolean,
    default: false
  },
  emailVerifiedAt: Date,
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  lastLoginAt: Date,
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },

  // Relationships (as ObjectIds)
  profile: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'UserProfile'
  },
  mentorProfile: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MentorProfile'
  }
});

// Update the updatedAt field before saving
userSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('User', userSchema);