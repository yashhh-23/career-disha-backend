const mongoose = require('mongoose');

const interviewSessionSchema = new mongoose.Schema({
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
    default: 'BEHAVIORAL'
  },
  duration: {
    type: Number,
    required: true
  },
  currentStep: {
    type: Number,
    default: 1
  },
  totalSteps: {
    type: Number,
    default: 5
  },
  questions: [{
    step: Number,
    category: String,
    question: String,
    answer: String,
    feedback: String,
    score: Number,
    answeredAt: Date
  }],
  responses: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: new Map()
  },
  currentQuestion: {
    step: Number,
    category: String,
    question: String,
    options: [String],
    questionIndex: Number
  },
  progress: {
    answeredQuestions: { type: Number, default: 0 },
    totalQuestions: { type: Number, default: 15 },
    currentCategory: String,
    completionPercentage: { type: Number, default: 0 }
  },
  status: {
    type: String,
    enum: ['IN_PROGRESS', 'COMPLETED', 'ABANDONED'],
    default: 'IN_PROGRESS'
  },
  language: {
    type: String,
    default: 'en'
  },
  results: {
    totalScore: { type: Number, default: 0 },
    categoryScores: {
      type: Map,
      of: Number,
      default: new Map()
    },
    recommendations: [String],
    analysis: String
  },
  startedAt: {
    type: Date,
    default: Date.now
  },
  completedAt: {
    type: Date
  },
  lastActivityAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes
interviewSessionSchema.index({ userId: 1, status: 1 });
interviewSessionSchema.index({ lastActivityAt: 1 });
interviewSessionSchema.index({ completedAt: 1 });

// Update lastActivityAt on any modification
interviewSessionSchema.pre('save', function(next) {
  this.lastActivityAt = new Date();
  next();
});

module.exports = mongoose.model('InterviewSession', interviewSessionSchema);