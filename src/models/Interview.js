const mongoose = require('mongoose');

const interviewSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  title: {
    type: String,
    required: true
  },
  jobRole: {
    type: String,
    required: true
  },
  difficulty: {
    type: String,
    enum: ['EASY', 'MEDIUM', 'HARD'],
    default: 'MEDIUM'
  },
  interviewType: {
    type: String,
    enum: ['TECHNICAL', 'BEHAVIORAL', 'MIXED'],
    default: 'MIXED'
  },
  duration: {
    type: Number,
    required: true
  },
  questions: [{
    question: String,
    answer: String,
    feedback: String,
    score: Number
  }],
  totalScore: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['PENDING', 'COMPLETED', 'CANCELLED'],
    default: 'PENDING'
  },
  completedAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Indexes
interviewSchema.index({ userId: 1, status: 1 });
interviewSchema.index({ completedAt: 1 });
interviewSchema.index({ totalScore: 1 });

module.exports = mongoose.model('Interview', interviewSchema);