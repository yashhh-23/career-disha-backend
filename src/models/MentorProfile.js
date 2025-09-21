const mongoose = require('mongoose');

const mentorProfileSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true
  },

  title: {
    type: String,
    required: true
  },
  specialization: {
    type: [String],
    index: true
  },
  yearsOfExperience: {
    type: Number,
    required: true,
    min: 0
  },
  hourlyRate: Number,
  isAvailable: {
    type: Boolean,
    default: true,
    index: true
  },
  maxStudents: {
    type: Number,
    default: 5,
    min: 1
  },
  description: {
    type: String,
    required: true
  },

  // Statistics
  totalSessions: {
    type: Number,
    default: 0,
    min: 0
  },
  averageRating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  totalReviews: {
    type: Number,
    default: 0,
    min: 0
  },

  // Availability - store as mixed type for flexible JSON structure
  availability: mongoose.Schema.Types.Mixed,

  isVerified: {
    type: Boolean,
    default: false
  },
  verifiedAt: Date,

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
mentorProfileSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('MentorProfile', mentorProfileSchema);