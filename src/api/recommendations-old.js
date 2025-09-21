const express = require('express');
const prisma = require('../config/prisma');
const aiService = require('../services/aiService');
const i18nService = require('../services/i18nService');
const { requireResourceAccess } = require('../middlewares/roleAuth');

const router = express.Router();

// POST /api/v1/recommendations/generate - Generate new recommendations
router.post('/generate', async (req, res) => {
  try {
    const { forceRegenerate = false, focusArea, language = 'en' } = req.body;

    // Check if user has recent recommendations (within 7 days) unless forced
    if (!forceRegenerate) {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      
      const recentRecommendations = await prisma.recommendation.count({
        where: {
          userId: req.user.id,
          createdAt: { gte: weekAgo },
          status: { not: 'dismissed' }
        }
      });

      if (recentRecommendations > 0) {
        return res.status(409).json({
          error: 'You have recent recommendations. Use forceRegenerate=true to create new ones.',
          recentCount: recentRecommendations
        });
      }
    }

    // Get user data for analysis
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: {
        profile: true,
        interviews: {
          where: { status: 'completed' },
          orderBy: { completedAt: 'desc' },
          take: 1
        },
        uploads: {
          where: { status: 'completed' },
          orderBy: { createdAt: 'desc' },
          take: 3
        },
        progress: {
          where: { status: 'completed' },
          orderBy: { updatedAt: 'desc' },
          take: 10
        }
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Generate recommendations based on user data
    const recommendations = await generatePersonalizedRecommendations(user, focusArea);
    
    // Translate recommendations if language is not English
    let translatedRecommendations = recommendations;
    if (language !== 'en') {
      translatedRecommendations = await i18nService.translateRecommendations(recommendations, language);
    }

    // Store recommendations in database
    const storedRecommendations = [];
    for (const rec of translatedRecommendations) {
      const stored = await prisma.recommendation.create({
        data: {
          userId: req.user.id,
          type: rec.type,
          title: rec.title,
          description: rec.description,
          priority: rec.priority,
          metadata: {
            ...rec.metadata,
            generatedAt: new Date().toISOString(),
            source: 'ai_analysis',
            focusArea: focusArea || 'general',
            language: language,
            originalLanguage: rec.originalLanguage || 'en'
          }
        }
      });
      storedRecommendations.push(stored);
    }

    res.status(201).json({
      message: 'Recommendations generated successfully',
      count: storedRecommendations.length,
      recommendations: storedRecommendations,
      language: language,
      generatedAt: new Date().toISOString(),
      basedOn: {
        hasProfile: !!user.profile,
        hasInterview: user.interviews.length > 0,
        hasUploads: user.uploads.length > 0,
        completedItems: user.progress.length
      }
    });

  } catch (error) {
    console.error('Generate recommendations error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/recommendations/:userId - Get user recommendations
router.get('/:userId', requireResourceAccess('userId'), async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const { status, type, priority, limit = 20 } = req.query;

    if (isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    // Role-based access is handled by requireResourceAccess middleware

    // Build where clause
    const whereClause = { userId: userId };
    if (status) whereClause.status = status;
    if (type) whereClause.type = type;
    if (priority) whereClause.priority = priority;

    const recommendations = await prisma.recommendation.findMany({
      where: whereClause,
      orderBy: [
        { priority: 'asc' }, // high priority first
        { createdAt: 'desc' }
      ],
      take: parseInt(limit)
    });

    // Group recommendations by type and priority
    const grouped = groupRecommendations(recommendations);

    // Calculate recommendation statistics
    const stats = {
      total: recommendations.length,
      byStatus: recommendations.reduce((acc, r) => {
        acc[r.status] = (acc[r.status] || 0) + 1;
        return acc;
      }, {}),
      byType: recommendations.reduce((acc, r) => {
        acc[r.type] = (acc[r.type] || 0) + 1;
        return acc;
      }, {}),
      byPriority: recommendations.reduce((acc, r) => {
        acc[r.priority] = (acc[r.priority] || 0) + 1;
        return acc;
      }, {})
    };

    res.json({
      recommendations: recommendations,
      grouped: grouped,
      stats: stats
    });

  } catch (error) {
    console.error('Get recommendations error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/recommendations - Get current user's recommendations
router.get('/', async (req, res) => {
  try {
    const { status = 'pending', type, priority, limit = 10 } = req.query;

    const whereClause = { userId: req.user.id };
    if (status !== 'all') whereClause.status = status;
    if (type) whereClause.type = type;
    if (priority) whereClause.priority = priority;

    const recommendations = await prisma.recommendation.findMany({
      where: whereClause,
      orderBy: [
        { priority: 'asc' },
        { createdAt: 'desc' }
      ],
      take: parseInt(limit)
    });

    // Get quick stats
    const allRecommendations = await prisma.recommendation.findMany({
      where: { userId: req.user.id },
      select: { status: true, type: true, priority: true }
    });

    const stats = {
      total: allRecommendations.length,
      pending: allRecommendations.filter(r => r.status === 'pending').length,
      inProgress: allRecommendations.filter(r => r.status === 'in_progress').length,
      completed: allRecommendations.filter(r => r.status === 'completed').length,
      highPriority: allRecommendations.filter(r => r.priority === 'high').length
    };

    res.json({
      recommendations: recommendations,
      stats: stats,
      filters: { status, type, priority, limit }
    });

  } catch (error) {
    console.error('Get user recommendations error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/v1/recommendations/:id - Update recommendation status
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }

    const validStatuses = ['pending', 'in_progress', 'completed', 'dismissed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
    }

    // Find recommendation
    const recommendation = await prisma.recommendation.findFirst({
      where: {
        id: id,
        userId: req.user.id
      }
    });

    if (!recommendation) {
      return res.status(404).json({ error: 'Recommendation not found' });
    }

    // Update recommendation
    const updatedRecommendation = await prisma.recommendation.update({
      where: { id: id },
      data: {
        status: status,
        metadata: {
          ...recommendation.metadata,
          lastUpdated: new Date().toISOString(),
          userNotes: notes || recommendation.metadata?.userNotes
        }
      }
    });

    // Update progress tracking if completed
    if (status === 'completed') {
      await prisma.progress.upsert({
        where: {
          userId_type_referenceId: {
            userId: req.user.id,
            type: 'recommendation',
            referenceId: id
          }
        },
        update: {
          status: 'completed',
          progress: 100,
          metadata: {
            completedAt: new Date().toISOString(),
            recommendationType: recommendation.type
          }
        },
        create: {
          userId: req.user.id,
          type: 'recommendation',
          referenceId: id,
          status: 'completed',
          progress: 100,
          metadata: {
            completedAt: new Date().toISOString(),
            recommendationType: recommendation.type
          }
        }
      });
    }

    res.json({
      message: 'Recommendation updated successfully',
      recommendation: updatedRecommendation
    });

  } catch (error) {
    console.error('Update recommendation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v1/recommendations/:id/feedback - Add feedback to recommendation
router.post('/:id/feedback', async (req, res) => {
  try {
    const { id } = req.params;
    const { rating, feedback, helpful = true } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ 
        error: 'Rating is required and must be between 1 and 5' 
      });
    }

    const recommendation = await prisma.recommendation.findFirst({
      where: {
        id: id,
        userId: req.user.id
      }
    });

    if (!recommendation) {
      return res.status(404).json({ error: 'Recommendation not found' });
    }

    // Update recommendation with feedback
    const updatedRecommendation = await prisma.recommendation.update({
      where: { id: id },
      data: {
        metadata: {
          ...recommendation.metadata,
          feedback: {
            rating: rating,
            comment: feedback,
            helpful: helpful,
            submittedAt: new Date().toISOString()
          }
        }
      }
    });

    res.json({
      message: 'Feedback submitted successfully',
      recommendation: updatedRecommendation
    });

  } catch (error) {
    console.error('Submit feedback error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/v1/recommendations/:id - Dismiss recommendation
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { reason = 'user_dismissed' } = req.body;

    const recommendation = await prisma.recommendation.findFirst({
      where: {
        id: id,
        userId: req.user.id
      }
    });

    if (!recommendation) {
      return res.status(404).json({ error: 'Recommendation not found' });
    }

    // Update status to dismissed instead of deleting
    await prisma.recommendation.update({
      where: { id: id },
      data: {
        status: 'dismissed',
        metadata: {
          ...recommendation.metadata,
          dismissedAt: new Date().toISOString(),
          dismissReason: reason
        }
      }
    });

    res.json({ message: 'Recommendation dismissed successfully' });

  } catch (error) {
    console.error('Dismiss recommendation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/recommendations/analytics/summary - Get recommendation analytics
router.get('/analytics/summary', async (req, res) => {
  try {
    const { timeframe = '30' } = req.query;

    // Calculate date filter
    let dateFilter = {};
    if (timeframe !== 'all') {
      const days = parseInt(timeframe);
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      dateFilter = { createdAt: { gte: startDate } };
    }

    // Get recommendations with date filter
    const recommendations = await prisma.recommendation.findMany({
      where: {
        userId: req.user.id,
        ...dateFilter
      }
    });

    // Calculate analytics
    const analytics = {
      overview: {
        total: recommendations.length,
        completed: recommendations.filter(r => r.status === 'completed').length,
        inProgress: recommendations.filter(r => r.status === 'in_progress').length,
        pending: recommendations.filter(r => r.status === 'pending').length,
        dismissed: recommendations.filter(r => r.status === 'dismissed').length
      },
      byType: recommendations.reduce((acc, r) => {
        acc[r.type] = (acc[r.type] || 0) + 1;
        return acc;
      }, {}),
      byPriority: recommendations.reduce((acc, r) => {
        acc[r.priority] = (acc[r.priority] || 0) + 1;
        return acc;
      }, {}),
      completionRate: recommendations.length > 0 ? 
        Math.round((recommendations.filter(r => r.status === 'completed').length / recommendations.length) * 100) : 0,
      averageRating: calculateAverageRating(recommendations)
    };

    res.json({
      analytics: analytics,
      timeframe: timeframe
    });

  } catch (error) {
    console.error('Get analytics error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Helper Functions

async function generatePersonalizedRecommendations(user, focusArea) {
  // Use AI service for intelligent recommendations
  try {
    const aiRecommendations = await aiService.generateRecommendations(user, focusArea);

    // Augment with real course provider results
    const externalApiService = require('../services/externalApiService');
    const skills = user.profile?.skills || [];
    const topSkills = skills.slice(0, 3);
    const providerCourses = [];
    for (const skill of topSkills) {
      const list = await externalApiService.searchCourses(skill, { providers: ['coursera', 'udemy', 'edx', 'nptel'], limit: 4 });
      providerCourses.push(...list.map(c => ({
        type: 'course',
        title: c.title,
        description: c.description,
        priority: 'medium',
        metadata: { provider: c.provider, url: c.url, duration: c.duration, level: c.level, price: c.price }
      })));
    }

    return [...aiRecommendations, ...providerCourses].slice(0, 10);
  } catch (error) {
    console.error('Error generating AI recommendations:', error);
    // Fallback to basic recommendations
    return getFallbackRecommendations(user, focusArea);
  }
}

// Fallback function for when AI service is unavailable
function getFallbackRecommendations(user, focusArea) {
  const recommendations = [];
  const profile = user.profile;
  const latestInterview = user.interviews[0];
  const skills = profile?.skills || [];
  const interests = profile?.interests || [];

  // Career path recommendations
  if (latestInterview?.profileTags?.length > 0) {
    const topTags = latestInterview.profileTags.slice(0, 3);
    topTags.forEach((tag, index) => {
      recommendations.push({
        type: 'career_path',
        title: `Explore ${tag} Career Opportunities`,
        description: `Based on your interview responses, you show strong interest in ${tag}. Consider exploring career paths in this area.`,
        priority: index === 0 ? 'high' : 'medium',
        metadata: {
          relatedSkills: [tag],
          estimatedTimeToComplete: '2-4 weeks research',
          source: 'interview_analysis'
        }
      });
    });
  }

  // Skill development recommendations
  const skillGaps = identifySkillGaps(skills, interests, focusArea);
  skillGaps.forEach((skill, index) => {
    recommendations.push({
      type: 'skill',
      title: `Develop ${skill} Skills`,
      description: `Enhance your ${skill} capabilities to advance your career prospects.`,
      priority: index < 2 ? 'high' : 'medium',
      metadata: {
        skillLevel: 'beginner',
        estimatedTimeToComplete: '4-8 weeks',
        suggestedPlatforms: ['Coursera', 'Udemy', 'freeCodeCamp']
      }
    });
  });

  // Course recommendations
  const courseRecommendations = generateCourseRecommendations(skills, interests, focusArea);
  recommendations.push(...courseRecommendations);

  // Default recommendations
  recommendations.push({
    type: 'skill',
    title: 'Improve Communication Skills',
    description: 'Strong communication skills are valuable in any career path.',
    priority: 'high',
    metadata: {
      estimatedTime: '4-6 weeks',
      difficulty: 'beginner',
      suggestedPlatforms: ['Coursera', 'LinkedIn Learning'],
      careerImpact: 'High - applicable to all roles'
    }
  });

  return recommendations.slice(0, 8); // Limit to 8 recommendations
}

function identifySkillGaps(currentSkills, interests, focusArea) {
  // Simple skill gap identification - to be enhanced with AI
  const inDemandSkills = {
    'technology': ['JavaScript', 'Python', 'React', 'Node.js', 'SQL', 'Git'],
    'design': ['Figma', 'Adobe Creative Suite', 'UI/UX Design', 'Prototyping'],
    'data': ['Python', 'SQL', 'Tableau', 'Excel', 'Statistics', 'Machine Learning'],
    'marketing': ['Google Analytics', 'Social Media Marketing', 'SEO', 'Content Creation'],
    'general': ['Communication', 'Leadership', 'Project Management', 'Problem Solving']
  };

  const targetSkills = inDemandSkills[focusArea] || inDemandSkills.general;
  const skillGaps = targetSkills.filter(skill => 
    !currentSkills.some(userSkill => 
      userSkill.toLowerCase().includes(skill.toLowerCase())
    )
  );

  return skillGaps.slice(0, 5); // Return top 5 skill gaps
}

function generateCourseRecommendations(skills, interests, focusArea) {
  // Generate course recommendations based on user data
  const courses = [];

  if (focusArea === 'technology' || skills.some(s => s.includes('programming'))) {
    courses.push({
      type: 'course',
      title: 'Full Stack Web Development',
      description: 'Comprehensive course covering front-end and back-end development.',
      priority: 'high',
      metadata: {
        provider: 'Coursera',
        duration: '6 months',
        level: 'intermediate',
        cost: 'paid'
      }
    });
  }

  if (interests.includes('design') || focusArea === 'design') {
    courses.push({
      type: 'course',
      title: 'UI/UX Design Fundamentals',
      description: 'Learn the principles of user interface and experience design.',
      priority: 'medium',
      metadata: {
        provider: 'Udemy',
        duration: '8 weeks',
        level: 'beginner',
        cost: 'paid'
      }
    });
  }

  return courses;
}

function groupRecommendations(recommendations) {
  return {
    byType: recommendations.reduce((acc, r) => {
      if (!acc[r.type]) acc[r.type] = [];
      acc[r.type].push(r);
      return acc;
    }, {}),
    byPriority: recommendations.reduce((acc, r) => {
      if (!acc[r.priority]) acc[r.priority] = [];
      acc[r.priority].push(r);
      return acc;
    }, {}),
    byStatus: recommendations.reduce((acc, r) => {
      if (!acc[r.status]) acc[r.status] = [];
      acc[r.status].push(r);
      return acc;
    }, {})
  };
}

function calculateAverageRating(recommendations) {
  const ratingsWithFeedback = recommendations.filter(r => r.metadata?.feedback?.rating);
  if (ratingsWithFeedback.length === 0) return null;
  
  const totalRating = ratingsWithFeedback.reduce((sum, r) => sum + r.metadata.feedback.rating, 0);
  return Math.round((totalRating / ratingsWithFeedback.length) * 10) / 10; // Round to 1 decimal
}

module.exports = router;