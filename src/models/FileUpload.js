const mongoose = require('mongoose');

const fileUploadSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  path: {
    type: String,
    required: true
  },
  type: {
    type: String,
    required: true,
    enum: ['resume', 'profile_picture', 'other']
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('FileUpload', fileUploadSchema);