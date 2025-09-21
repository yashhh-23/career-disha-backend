const express = require('express');
const { body, validationResult } = require('express-validator');
const { UserProfile, User } = require('../models');

const router = express.Router();

// GET /api/v1/profile
router.get('/', async (req, res) => {
  try {
    let profile = await UserProfile.findOne({ userId: req.user.id });

    if (!profile) {
      profile = new UserProfile({
        userId: req.user.id,
        bio: 'Welcome to your CareerDisha profile!',
        skills: [],
        interests: [],
        preferredLanguages: []
      });
      await profile.save();
    }

    // Normalize response to include legacy keys for backward compatibility
    res.json({
      userId: profile.userId,
      summary: profile.bio || '',
      tags: profile.interests || [],
      skills: profile.skills || [],
      languages: profile.preferredLanguages || [],
      interests: profile.interests || [],
      careerGoals: profile.careerGoals || null,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt
    });
  } catch (err) {
    console.error('Profile GET error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/v1/profile
router.put(
  '/',
  [
    body('summary').optional().isString().isLength({ max: 2000 }),
    body('tags').optional().isArray(),
    body('skills').optional().isArray(),
    body('languages').optional().isArray(),
    body('interests').optional().isArray(),
    body('careerGoals').optional().isString().isLength({ max: 2000 }),
    // Accept new field names as well
    body('preferredLanguages').optional().isArray(),
    body('bio').optional().isString().isLength({ max: 2000 })
  ],
  async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      summary = '',
      bio, // new name
      tags = [],
      interests = [],
      skills = [],
      languages = [], // legacy name
      preferredLanguages = [], // new name
      careerGoals = null
    } = req.body;

    const mergedInterests = Array.isArray(tags) || Array.isArray(interests)
      ? Array.from(new Set([...(tags || []), ...(interests || [])]))
      : [];
    const finalSkills = Array.isArray(skills) ? skills : [];
    const finalLanguages = Array.isArray(preferredLanguages)
      ? preferredLanguages
      : (Array.isArray(languages) ? languages : []);
    const finalBio = typeof bio === 'string' && bio.length > 0 ? bio : summary;

    const upserted = await UserProfile.findOneAndUpdate(
      { userId: req.user.id },
      {
        bio: finalBio,
        skills: finalSkills,
        interests: mergedInterests,
        preferredLanguages: finalLanguages,
        careerGoals: careerGoals || undefined
      },
      {
        upsert: true,
        new: true
      }
    );

    res.json({
      userId: upserted.userId,
      summary: upserted.bio || '',
      tags: upserted.interests || [],
      skills: upserted.skills || [],
      languages: upserted.preferredLanguages || [],
      interests: upserted.interests || [],
      careerGoals: upserted.careerGoals || null,
      createdAt: upserted.createdAt,
      updatedAt: upserted.updatedAt
    });
  } catch (err) {
    console.error('Profile PUT error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/profile/:id - Public profile view
router.get('/:id', async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    
    if (isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    const user = await User.findById(userId)
      .select('email createdAt')
      .populate('profile', 'bio skills interests preferredLanguages careerGoals updatedAt');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Return public profile (email hidden for privacy)
    res.json({
      id: user.id,
      profile: user.profile
        ? {
            summary: user.profile.bio || '',
            skills: user.profile.skills || [],
            interests: user.profile.interests || [],
            languages: user.profile.preferredLanguages || [],
            careerGoals: user.profile.careerGoals || null,
            updatedAt: user.profile.updatedAt
          }
        : null,
      memberSince: user.createdAt
    });
  } catch (err) {
    console.error('Public profile GET error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
