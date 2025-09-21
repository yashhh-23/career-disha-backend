const mongoose = require('mongoose');

const progressSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  type: {
    type: String,
    enum: ['course', 'lesson', 'interview', 'assessment', 'skill'],
    required: true
  },
  referenceId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  progress: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  status: {
    type: String,
    enum: ['not_started', 'in_progress', 'completed', 'paused', 'failed'],
    default: 'not_started'
  },
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: new Map()
  },
  timeSpent: {
    type: Number, // in minutes
    default: 0
  },
  score: {
    type: Number,
    min: 0,
    max: 100
  },
  completedAt: {
    type: Date
  },
  lastAccessedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes
progressSchema.index({ userId: 1, type: 1 });
progressSchema.index({ userId: 1, status: 1 });
progressSchema.index({ referenceId: 1 });
progressSchema.index({ lastAccessedAt: 1 });
progressSchema.index({ completedAt: 1 });

// Compound indexes
progressSchema.index({ userId: 1, type: 1, referenceId: 1 }, { unique: true });

module.exports = mongoose.model('Progress', progressSchema);