// Export all Mongoose models
const User = require('./User');
const UserProfile = require('./UserProfile');
const MentorProfile = require('./MentorProfile');
const Course = require('./Course');
const Lesson = require('./Lesson');
const Category = require('./Category');
const FileUpload = require('./FileUpload');
const Notification = require('./Notification');
const Skill = require('./Skill');
const UserSkill = require('./UserSkill');
const Interview = require('./Interview');
const InterviewSession = require('./InterviewSession');
const Recommendation = require('./Recommendation');
const Progress = require('./Progress');

module.exports = {
  User,
  UserProfile,
  MentorProfile,
  Course,
  Lesson,
  Category,
  FileUpload,
  Notification,
  Skill,
  UserSkill,
  Interview,
  InterviewSession,
  Recommendation,
  Progress
};