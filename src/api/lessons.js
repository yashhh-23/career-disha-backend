const express = require('express');
const prisma = require('../config/prisma');

const router = express.Router();

// GET /api/v1/lessons - Get all lessons
router.get('/', async (req, res) => {
  try {
    const { category, limit = 10, offset = 0 } = req.query;
    
    const whereClause = category ? { 
      content: { contains: category, mode: 'insensitive' } 
    } : {};

    const lessons = await prisma.lesson.findMany({
      where: whereClause,
      take: parseInt(limit),
      skip: parseInt(offset),
      orderBy: { id: 'asc' }
    });

    // Get user progress for these lessons
    const userProgress = await prisma.userLesson.findMany({
      where: {
        userId: req.user.id,
        lessonId: { in: lessons.map(l => l.id) }
      }
    });

    // Merge lesson data with user progress
    const lessonsWithProgress = lessons.map(lesson => {
      const progress = userProgress.find(p => p.lessonId === lesson.id);
      return {
        ...lesson,
        userProgress: {
          completed: !!progress?.completedAt,
          quizPassed: progress?.quizPassed || false,
          completedAt: progress?.completedAt
        }
      };
    });

    res.json({
      lessons: lessonsWithProgress,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: await prisma.lesson.count({ where: whereClause })
      }
    });

  } catch (error) {
    console.error('Get lessons error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/lessons/:id - Get specific lesson
router.get('/:id', async (req, res) => {
  try {
    const lessonId = parseInt(req.params.id);
    
    if (isNaN(lessonId)) {
      return res.status(400).json({ error: 'Invalid lesson ID' });
    }

    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId }
    });

    if (!lesson) {
      return res.status(404).json({ error: 'Lesson not found' });
    }

    // Get user progress for this lesson
    const userProgress = await prisma.userLesson.findUnique({
      where: {
        userId_lessonId: {
          userId: req.user.id,
          lessonId: lessonId
        }
      }
    });

    res.json({
      ...lesson,
      userProgress: {
        completed: !!userProgress?.completedAt,
        quizPassed: userProgress?.quizPassed || false,
        completedAt: userProgress?.completedAt
      }
    });

  } catch (error) {
    console.error('Get lesson error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v1/lessons/:id/start - Start a lesson
router.post('/:id/start', async (req, res) => {
  try {
    const lessonId = parseInt(req.params.id);
    
    if (isNaN(lessonId)) {
      return res.status(400).json({ error: 'Invalid lesson ID' });
    }

    // Check if lesson exists
    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId }
    });

    if (!lesson) {
      return res.status(404).json({ error: 'Lesson not found' });
    }

    // Create or update user lesson record
    const userLesson = await prisma.userLesson.upsert({
      where: {
        userId_lessonId: {
          userId: req.user.id,
          lessonId: lessonId
        }
      },
      update: {}, // Don't update if already exists
      create: {
        userId: req.user.id,
        lessonId: lessonId
      }
    });

    // Create or update progress record
    await prisma.progress.upsert({
      where: {
        userId_type_referenceId: {
          userId: req.user.id,
          type: 'lesson',
          referenceId: lessonId.toString()
        }
      },
      update: {
        status: 'in_progress',
        progress: 0
      },
      create: {
        userId: req.user.id,
        type: 'lesson',
        referenceId: lessonId.toString(),
        status: 'in_progress',
        progress: 0
      }
    });

    res.json({
      message: 'Lesson started successfully',
      lessonId: lessonId,
      status: 'in_progress'
    });

  } catch (error) {
    console.error('Start lesson error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v1/lessons/:id/complete - Complete a lesson
router.post('/:id/complete', async (req, res) => {
  try {
    const lessonId = parseInt(req.params.id);
    const { quizScore = 0 } = req.body;
    
    if (isNaN(lessonId)) {
      return res.status(400).json({ error: 'Invalid lesson ID' });
    }

    // Check if lesson exists
    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId }
    });

    if (!lesson) {
      return res.status(404).json({ error: 'Lesson not found' });
    }

    const quizPassed = quizScore >= 70; // 70% passing score
    const completedAt = new Date();

    // Update user lesson record
    await prisma.userLesson.upsert({
      where: {
        userId_lessonId: {
          userId: req.user.id,
          lessonId: lessonId
        }
      },
      update: {
        quizPassed: quizPassed,
        completedAt: completedAt
      },
      create: {
        userId: req.user.id,
        lessonId: lessonId,
        quizPassed: quizPassed,
        completedAt: completedAt
      }
    });

    // Update progress record
    await prisma.progress.upsert({
      where: {
        userId_type_referenceId: {
          userId: req.user.id,
          type: 'lesson',
          referenceId: lessonId.toString()
        }
      },
      update: {
        status: 'completed',
        progress: 100,
        metadata: { quizScore, quizPassed, completedAt }
      },
      create: {
        userId: req.user.id,
        type: 'lesson',
        referenceId: lessonId.toString(),
        status: 'completed',
        progress: 100,
        metadata: { quizScore, quizPassed, completedAt }
      }
    });

    res.json({
      message: 'Lesson completed successfully',
      lessonId: lessonId,
      quizScore: quizScore,
      quizPassed: quizPassed,
      completedAt: completedAt
    });

  } catch (error) {
    console.error('Complete lesson error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;