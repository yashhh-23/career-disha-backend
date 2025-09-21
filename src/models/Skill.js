const mongoose = require('mongoose');

const skillSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  normalized: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  tags: [String]
});

module.exports = mongoose.model('Skill', skillSchema);