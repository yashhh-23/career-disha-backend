const express = require('express');
// TODO: Create Progress model for MongoDB
// const { Progress } = require('../models');
const { requireResourceAccess } = require('../middlewares/roleAuth');

const router = express.Router();

// POST /api/v1/progress/update - Update progress for any item
router.post('/update', async (req, res) => {
  try {
    const { type, referenceId, progress = 0, status = 'in_progress', metadata = {} } = req.body;

    if (!type || !referenceId) {
      return res.status(400).json({ 
        error: 'Type and referenceId are required' 
      });
    }

    // Validate type
    const validTypes = ['lesson', 'skill', 'recommendation', 'interview'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ 
        error: `Invalid type. Must be one of: ${validTypes.join(', ')}` 
      });
    }

    // Validate progress
    if (progress < 0 || progress > 100) {
      return res.status(400).json({ 
        error: 'Progress must be between 0 and 100' 
      });
    }

    // Validate status
    const validStatuses = ['not_started', 'in_progress', 'completed', 'paused'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ 
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` 
      });
    }

    // Update or create progress record
    const progressRecord = await prisma.progress.upsert({
      where: {
        userId_type_referenceId: {
          userId: req.user.id,
          type: type,
          referenceId: referenceId.toString()
        }
      },
      update: {
        progress: progress,
        status: status,
        metadata: metadata
      },
      create: {
        userId: req.user.id,
        type: type,
        referenceId: referenceId.toString(),
        progress: progress,
        status: status,
        metadata: metadata
      }
    });

    res.json({
      message: 'Progress updated successfully',
      progress: progressRecord
    });

  } catch (error) {
    console.error('Update progress error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/progress/:userId - Get user progress (public for mentors)
router.get('/:userId', requireResourceAccess('userId'), async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const { type } = req.query;

    if (isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    // Role-based access is handled by requireResourceAccess middleware

    const whereClause = { userId: userId };
    if (type) {
      whereClause.type = type;
    }

    const progressRecords = await prisma.progress.findMany({
      where: whereClause,
      orderBy: { updatedAt: 'desc' }
    });

    // Get user info
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, createdAt: true }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Calculate analytics
    const analytics = calculateProgressAnalytics(progressRecords);

    res.json({
      user: user,
      progress: progressRecords,
      analytics: analytics
    });

  } catch (error) {
    console.error('Get progress error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/progress/analytics - Get current user's analytics
router.get('/', async (req, res) => {
  try {
    const { type, timeframe = '30' } = req.query;

    const whereClause = { userId: req.user.id };
    if (type) {
      whereClause.type = type;
    }

    // Add time filter if specified
    if (timeframe !== 'all') {
      const days = parseInt(timeframe);
      const dateFilter = new Date();
      dateFilter.setDate(dateFilter.getDate() - days);
      whereClause.updatedAt = { gte: dateFilter };
    }

    const progressRecords = await prisma.progress.findMany({
      where: whereClause,
      orderBy: { updatedAt: 'desc' }
    });

    const analytics = calculateProgressAnalytics(progressRecords);

    res.json({
      progress: progressRecords,
      analytics: analytics,
      timeframe: timeframe
    });

  } catch (error) {
    console.error('Get analytics error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/progress/dashboard - Get dashboard data for current user
router.get('/dashboard/summary', async (req, res) => {
  try {
    // Get all progress for the user
    const progressRecords = await prisma.progress.findMany({
      where: { userId: req.user.id },
      orderBy: { updatedAt: 'desc' }
    });

    // Get recent activities (last 7 days)
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const recentActivities = await prisma.progress.findMany({
      where: {
        userId: req.user.id,
        updatedAt: { gte: weekAgo }
      },
      orderBy: { updatedAt: 'desc' },
      take: 10
    });

    // Get lesson statistics
    const lessonStats = await prisma.userLesson.findMany({
      where: { userId: req.user.id },
      include: {
        lesson: {
          select: { title: true }
        }
      }
    });

    const completedLessons = lessonStats.filter(l => l.completedAt).length;
    const passedQuizzes = lessonStats.filter(l => l.quizPassed).length;

    // Calculate analytics
    const analytics = calculateProgressAnalytics(progressRecords);

    res.json({
      summary: {
        totalItems: progressRecords.length,
        completedItems: progressRecords.filter(p => p.status === 'completed').length,
        inProgressItems: progressRecords.filter(p => p.status === 'in_progress').length,
        lessonsCompleted: completedLessons,
        quizzesPassed: passedQuizzes
      },
      recentActivity: recentActivities,
      analytics: analytics
    });

  } catch (error) {
    console.error('Get dashboard error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/v1/progress/:type/:referenceId - Reset specific progress
router.delete('/:type/:referenceId', async (req, res) => {
  try {
    const { type, referenceId } = req.params;

    const deleted = await prisma.progress.deleteMany({
      where: {
        userId: req.user.id,
        type: type,
        referenceId: referenceId
      }
    });

    if (deleted.count === 0) {
      return res.status(404).json({ error: 'Progress record not found' });
    }

    res.json({ 
      message: 'Progress reset successfully',
      deletedCount: deleted.count 
    });

  } catch (error) {
    console.error('Delete progress error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Helper function to calculate analytics
function calculateProgressAnalytics(progressRecords) {
  const total = progressRecords.length;
  const completed = progressRecords.filter(p => p.status === 'completed').length;
  const inProgress = progressRecords.filter(p => p.status === 'in_progress').length;
  const notStarted = progressRecords.filter(p => p.status === 'not_started').length;

  // Calculate average progress
  const totalProgress = progressRecords.reduce((sum, p) => sum + p.progress, 0);
  const averageProgress = total > 0 ? totalProgress / total : 0;

  // Group by type
  const byType = progressRecords.reduce((acc, p) => {
    if (!acc[p.type]) {
      acc[p.type] = { total: 0, completed: 0, inProgress: 0 };
    }
    acc[p.type].total++;
    if (p.status === 'completed') acc[p.type].completed++;
    if (p.status === 'in_progress') acc[p.type].inProgress++;
    return acc;
  }, {});

  // Recent activity (last 7 days)
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const recentActivity = progressRecords.filter(p => 
    new Date(p.updatedAt) >= weekAgo
  ).length;

  return {
    overview: {
      total,
      completed,
      inProgress,
      notStarted,
      completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
      averageProgress: Math.round(averageProgress)
    },
    byType,
    recentActivity,
    streaks: {
      // TODO: Calculate learning streaks
      currentStreak: 0,
      longestStreak: 0
    }
  };
}

module.exports = router;