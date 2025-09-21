const mongoose = require('mongoose');

const lessonSchema = new mongoose.Schema({
  courseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: true
  },
  createdById: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  title: {
    type: String,
    required: true,
    trim: true
  },
  slug: {
    type: String,
    required: true,
    trim: true
  },
  description: String,
  content: {
    type: String,
    required: true
  },

  // Lesson Structure
  chapterNumber: {
    type: Number,
    required: true,
    min: 1
  },
  lessonNumber: {
    type: Number,
    required: true,
    min: 1
  },
  duration: Number, // in minutes

  // Content Types
  videoUrl: String,
  audioUrl: String,
  documentUrl: String,
  slides: mongoose.Schema.Types.Mixed, // Slide data

  // Interactive Elements
  quiz: mongoose.Schema.Types.Mixed, // Quiz questions
  assignments: mongoose.Schema.Types.Mixed, // Assignments
  resources: mongoose.Schema.Types.Mixed, // Additional resources

  // Status
  isPublished: {
    type: Boolean,
    default: false
  },
  isPreview: {
    type: Boolean,
    default: false
  },

  sortOrder: {
    type: Number,
    default: 0
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
lessonSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Compound unique index for courseId and slug
lessonSchema.index({ courseId: 1, slug: 1 }, { unique: true });
lessonSchema.index({ courseId: 1, chapterNumber: 1, lessonNumber: 1 });
lessonSchema.index({ isPublished: 1 });

module.exports = mongoose.model('Lesson', lessonSchema);