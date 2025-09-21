const mongoose = require('mongoose');

const courseLevelEnum = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT'];
const courseStatusEnum = ['DRAFT', 'REVIEW', 'PUBLISHED', 'ARCHIVED'];

const courseSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  shortDescription: String,
  thumbnail: String,

  // Content
  objectives: [String],
  prerequisites: [String],
  targetAudience: [String],

  // Metadata
  categoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: true
  },
  createdById: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  level: {
    type: String,
    enum: courseLevelEnum,
    default: 'BEGINNER'
  },
  difficulty: {
    type: Number,
    min: 1,
    max: 10,
    default: 1
  },
  estimatedHours: Number,

  // Status and Publishing
  status: {
    type: String,
    enum: courseStatusEnum,
    default: 'DRAFT'
  },
  isPublished: {
    type: Boolean,
    default: false
  },
  publishedAt: Date,

  // Pricing
  isPremium: {
    type: Boolean,
    default: false
  },
  price: Number,

  // Statistics
  enrollmentCount: {
    type: Number,
    default: 0,
    min: 0
  },
  completionRate: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
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
courseSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Indexes for performance
courseSchema.index({ categoryId: 1 });
courseSchema.index({ createdById: 1 });
courseSchema.index({ status: 1 });
courseSchema.index({ isPublished: 1 });
courseSchema.index({ level: 1 });

module.exports = mongoose.model('Course', courseSchema);