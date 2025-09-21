const mongoose = require('mongoose');

const recommendationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  type: {
    type: String,
    enum: ['CAREER_PATH', 'SKILL', 'COURSE', 'JOB', 'LEARNING'],
    required: true
  },
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  category: {
    type: String,
    required: true
  },
  priority: {
    type: String,
    enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
    default: 'MEDIUM'
  },
  confidence: {
    type: Number,
    min: 0,
    max: 1,
    default: 0.5
  },
  source: {
    type: String,
    enum: ['AI_ANALYSIS', 'INTERVIEW', 'ASSESSMENT', 'MANUAL'],
    default: 'AI_ANALYSIS'
  },
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: new Map()
  },
  relatedSkills: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Skill'
  }],
  relatedCourses: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course'
  }],
  status: {
    type: String,
    enum: ['ACTIVE', 'VIEWED', 'DISMISSED', 'COMPLETED'],
    default: 'ACTIVE'
  },
  expiresAt: {
    type: Date
  },
  viewedAt: {
    type: Date
  },
  actionTaken: {
    type: String
  },
  actionTakenAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Indexes
recommendationSchema.index({ userId: 1, status: 1 });
recommendationSchema.index({ userId: 1, type: 1 });
recommendationSchema.index({ priority: 1, confidence: -1 });
recommendationSchema.index({ expiresAt: 1 });

module.exports = mongoose.model('Recommendation', recommendationSchema);