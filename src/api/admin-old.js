const express = require('express');
const prisma = require('../config/prisma');
const { requireAdmin, requireMentorOrAdmin, isValidRole } = require('../middlewares/roleAuth');

const router = express.Router();

// GET /api/v1/admin/users - Get all users (admin only)
router.get('/users', requireAdmin(), async (req, res) => {
  try {
    const { role, limit = 50, offset = 0, search } = req.query;

    // Build where clause
    const whereClause = {};
    if (role && isValidRole(role)) {
      whereClause.role = role;
    }
    if (search) {
      whereClause.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { profile: { summary: { contains: search, mode: 'insensitive' } } }
      ];
    }

    const users = await prisma.user.findMany({
      where: whereClause,
      take: parseInt(limit),
      skip: parseInt(offset),
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
        profile: {
          select: {
            summary: true,
            skills: true,
            experience: true,
            education: true,
            updatedAt: true
          }
        },
        _count: {
          select: {
            interviews: true,
            uploads: true,
            recommendations: true,
            mentorshipQuestions: true,
            progress: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const totalUsers = await prisma.user.count({ where: whereClause });

    // Calculate user statistics
    const roleStats = await prisma.user.groupBy({
      by: ['role'],
      _count: { role: true }
    });

    const stats = {
      total: totalUsers,
      byRole: roleStats.reduce((acc, item) => {
        acc[item.role] = item._count.role;
        return acc;
      }, {}),
      active: users.filter(u => u._count.interviews > 0).length,
      withProfiles: users.filter(u => u.profile).length
    };

    res.json({
      users: users,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: totalUsers
      },
      stats: stats
    });

  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/v1/admin/users/:id/role - Update user role (admin only)
router.put('/users/:id/role', requireAdmin(), async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const { role } = req.body;

    if (isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    if (!role || !isValidRole(role)) {
      return res.status(400).json({ 
        error: 'Invalid role. Must be one of: student, mentor, admin' 
      });
    }

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, role: true }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Prevent admin from changing their own role to non-admin
    if (user.id === req.user.id && role !== 'admin') {
      return res.status(400).json({ 
        error: 'You cannot change your own admin role' 
      });
    }

    // Update user role
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { role: role },
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true
      }
    });

    res.json({
      message: 'User role updated successfully',
      user: updatedUser,
      previousRole: user.role
    });

  } catch (error) {
    console.error('Update user role error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/admin/mentors - Get all mentors (admin only)
router.get('/mentors', requireAdmin(), async (req, res) => {
  try {
    const mentors = await prisma.user.findMany({
      where: { role: 'mentor' },
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
        profile: {
          select: {
            summary: true,
            skills: true,
            experience: true,
            education: true
          }
        },
        _count: {
          select: {
            // In future, add mentorship assignments count
            mentorshipQuestions: false // This would need schema changes
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Get mentorship statistics (questions answered by category)
    const mentorshipStats = await prisma.mentorshipQuestion.groupBy({
      by: ['status', 'category'],
      _count: { id: true }
    });

    res.json({
      mentors: mentors,
      count: mentors.length,
      mentorshipStats: mentorshipStats
    });

  } catch (error) {
    console.error('Get mentors error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/admin/analytics - Get platform analytics (admin only)
router.get('/analytics', requireAdmin(), async (req, res) => {
  try {
    const { timeframe = '30' } = req.query;

    // Calculate date filter
    let dateFilter = {};
    if (timeframe !== 'all') {
      const days = parseInt(timeframe);
      const dateThreshold = new Date();
      dateThreshold.setDate(dateThreshold.getDate() - days);
      dateFilter = { gte: dateThreshold };
    }

    // Get user statistics
    const userStats = await prisma.user.groupBy({
      by: ['role'],
      _count: { role: true }
    });

    // Get activity statistics
    const [
      totalInterviews,
      completedInterviews,
      totalUploads,
      successfulUploads,
      totalRecommendations,
      totalQuestions,
      answeredQuestions
    ] = await Promise.all([
      prisma.interview.count({
        where: { createdAt: dateFilter }
      }),
      prisma.interview.count({
        where: { 
          status: 'completed',
          completedAt: dateFilter
        }
      }),
      prisma.upload.count({
        where: { createdAt: dateFilter }
      }),
      prisma.upload.count({
        where: { 
          status: 'completed',
          createdAt: dateFilter
        }
      }),
      prisma.recommendation.count({
        where: { createdAt: dateFilter }
      }),
      prisma.mentorshipQuestion.count({
        where: { createdAt: dateFilter }
      }),
      prisma.mentorshipQuestion.count({
        where: { 
          status: 'answered',
          createdAt: dateFilter
        }
      })
    ]);

    // Get daily activity (last 30 days)
    const dailyActivity = await prisma.user.findMany({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        }
      },
      select: {
        createdAt: true
      }
    });

    // Group by day
    const dailyStats = dailyActivity.reduce((acc, user) => {
      const date = user.createdAt.toISOString().split('T')[0];
      acc[date] = (acc[date] || 0) + 1;
      return acc;
    }, {});

    const analytics = {
      users: {
        total: userStats.reduce((acc, stat) => acc + stat._count.role, 0),
        byRole: userStats.reduce((acc, stat) => {
          acc[stat.role] = stat._count.role;
          return acc;
        }, {})
      },
      activity: {
        interviews: {
          total: totalInterviews,
          completed: completedInterviews,
          completionRate: totalInterviews > 0 ? (completedInterviews / totalInterviews * 100).toFixed(1) : 0
        },
        uploads: {
          total: totalUploads,
          successful: successfulUploads,
          successRate: totalUploads > 0 ? (successfulUploads / totalUploads * 100).toFixed(1) : 0
        },
        recommendations: {
          total: totalRecommendations
        },
        mentorship: {
          total: totalQuestions,
          answered: answeredQuestions,
          responseRate: totalQuestions > 0 ? (answeredQuestions / totalQuestions * 100).toFixed(1) : 0
        }
      },
      dailyRegistrations: dailyStats,
      timeframe: timeframe
    };

    res.json(analytics);

  } catch (error) {
    console.error('Get analytics error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/admin/pending-questions - Get pending mentorship questions (mentor/admin)
router.get('/pending-questions', requireMentorOrAdmin(), async (req, res) => {
  try {
    const { category, priority, limit = 20 } = req.query;

    const whereClause = { status: 'pending' };
    if (category) whereClause.category = category;
    if (priority) whereClause.priority = priority;

    const questions = await prisma.mentorshipQuestion.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            profile: {
              select: {
                summary: true,
                skills: true
              }
            }
          }
        }
      },
      orderBy: [
        { priority: 'asc' }, // urgent first
        { createdAt: 'asc' } // oldest first
      ],
      take: parseInt(limit)
    });

    // Get statistics
    const stats = await prisma.mentorshipQuestion.groupBy({
      by: ['status', 'category', 'priority'],
      where: { status: 'pending' },
      _count: { id: true }
    });

    res.json({
      questions: questions,
      count: questions.length,
      stats: stats
    });

  } catch (error) {
    console.error('Get pending questions error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/v1/admin/questions/:id/answer - Answer a mentorship question (mentor/admin)
router.put('/questions/:id/answer', requireMentorOrAdmin(), async (req, res) => {
  try {
    const { id } = req.params;
    const { answer } = req.body;

    if (!answer || answer.trim().length === 0) {
      return res.status(400).json({ error: 'Answer is required' });
    }

    if (answer.length > 2000) {
      return res.status(400).json({ error: 'Answer must be 2000 characters or less' });
    }

    const question = await prisma.mentorshipQuestion.findUnique({
      where: { id: id },
      include: {
        user: {
          select: { id: true, email: true }
        }
      }
    });

    if (!question) {
      return res.status(404).json({ error: 'Question not found' });
    }

    if (question.status !== 'pending') {
      return res.status(400).json({ error: 'Question has already been answered' });
    }

    const answeredQuestion = await prisma.mentorshipQuestion.update({
      where: { id: id },
      data: {
        answer: answer.trim(),
        status: 'answered',
        answeredAt: new Date()
      }
    });

    res.json({
      message: 'Question answered successfully',
      question: answeredQuestion,
      answeredBy: {
        id: req.user.id,
        email: req.user.email,
        role: req.user.role
      }
    });

  } catch (error) {
    console.error('Answer question error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;