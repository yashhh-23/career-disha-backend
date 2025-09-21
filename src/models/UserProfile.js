const mongoose = require('mongoose');

const experienceLevelEnum = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT'];

const userProfileSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true
  },

  firstName: String,
  lastName: String,
  dateOfBirth: Date,
  phone: String,
  avatar: String,
  bio: String,
  location: String,
  timezone: String,
  linkedinUrl: String,
  githubUrl: String,
  portfolioUrl: String,

  // Career Information
  currentJobTitle: String,
  company: String,
  experience: {
    type: String,
    enum: experienceLevelEnum
  },
  industry: String,
  careerGoals: String,

  // Skills and Interests
  skills: [String],
  interests: [String],
  preferredLanguages: [String],

  // Privacy Settings
  isProfilePublic: {
    type: Boolean,
    default: true
  },
  showEmail: {
    type: Boolean,
    default: false
  },
  showPhone: {
    type: Boolean,
    default: false
  },

  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update the updatedAt field before saving
userProfileSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('UserProfile', userProfileSchema);