const express = require('express');
const prisma = require('../config/prisma');
const aiService = require('../services/aiService');
const i18nService = require('../services/i18nService');

const router = express.Router();

// POST /api/v1/mentorship/question - Submit a question to mentors
router.post('/question', async (req, res) => {
  try {
    const { question, category = 'general', priority = 'normal' } = req.body;

    if (!question || question.trim().length === 0) {
      return res.status(400).json({ error: 'Question is required' });
    }

    if (question.length > 1000) {
      return res.status(400).json({ error: 'Question must be 1000 characters or less' });
    }

    // Validate category
    const validCategories = ['career', 'technical', 'personal', 'general'];
    if (!validCategories.includes(category)) {
      return res.status(400).json({ 
        error: `Invalid category. Must be one of: ${validCategories.join(', ')}` 
      });
    }

    // Validate priority
    const validPriorities = ['urgent', 'normal', 'low'];
    if (!validPriorities.includes(priority)) {
      return res.status(400).json({ 
        error: `Invalid priority. Must be one of: ${validPriorities.join(', ')}` 
      });
    }

    // Check if user has too many pending questions (rate limiting)
    const pendingQuestions = await prisma.mentorshipQuestion.count({
      where: {
        userId: req.user.id,
        status: 'pending'
      }
    });

    if (pendingQuestions >= 5) {
      return res.status(429).json({ 
        error: 'You have too many pending questions. Please wait for responses before submitting more.' 
      });
    }

    // Create question
    const mentorshipQuestion = await prisma.mentorshipQuestion.create({
      data: {
        userId: req.user.id,
        question: question.trim(),
        category: category,
        priority: priority,
        status: 'pending'
      }
    });

    // TODO: In production, implement mentor assignment logic
    // For now, questions will be manually assigned or auto-answered by AI

    res.status(201).json({
      message: 'Question submitted successfully',
      question: {
        id: mentorshipQuestion.id,
        question: mentorshipQuestion.question,
        category: mentorshipQuestion.category,
        priority: mentorshipQuestion.priority,
        status: mentorshipQuestion.status,
        createdAt: mentorshipQuestion.createdAt,
        estimatedResponse: getEstimatedResponseTime(priority)
      }
    });

  } catch (error) {
    console.error('Submit question error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/mentorship/:id - Get specific question and answer
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const question = await prisma.mentorshipQuestion.findFirst({
      where: {
        id: id,
        userId: req.user.id
      }
    });

    if (!question) {
      return res.status(404).json({ error: 'Question not found' });
    }

    res.json({
      question: {
        id: question.id,
        question: question.question,
        answer: question.answer,
        category: question.category,
        priority: question.priority,
        status: question.status,
        createdAt: question.createdAt,
        answeredAt: question.answeredAt
      }
    });

  } catch (error) {
    console.error('Get question error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/mentorship - Get user's questions
router.get('/', async (req, res) => {
  try {
    const { status, category, priority, limit = 20 } = req.query;

    const whereClause = { userId: req.user.id };
    if (status) whereClause.status = status;
    if (category) whereClause.category = category;
    if (priority) whereClause.priority = priority;

    const questions = await prisma.mentorshipQuestion.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit)
    });

    // Get quick stats
    const allQuestions = await prisma.mentorshipQuestion.findMany({
      where: { userId: req.user.id },
      select: { status: true, category: true, priority: true }
    });

    const stats = {
      total: allQuestions.length,
      pending: allQuestions.filter(q => q.status === 'pending').length,
      answered: allQuestions.filter(q => q.status === 'answered').length,
      closed: allQuestions.filter(q => q.status === 'closed').length,
      byCategory: allQuestions.reduce((acc, q) => {
        acc[q.category] = (acc[q.category] || 0) + 1;
        return acc;
      }, {}),
      avgResponseTime: calculateAverageResponseTime(allQuestions)
    };

    res.json({
      questions: questions,
      stats: stats,
      filters: { status, category, priority, limit }
    });

  } catch (error) {
    console.error('Get questions error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/v1/mentorship/:id/close - Close a question
router.put('/:id/close', async (req, res) => {
  try {
    const { id } = req.params;
    const { satisfied = true, feedback } = req.body;

    const question = await prisma.mentorshipQuestion.findFirst({
      where: {
        id: id,
        userId: req.user.id
      }
    });

    if (!question) {
      return res.status(404).json({ error: 'Question not found' });
    }

    if (question.status !== 'answered') {
      return res.status(400).json({ 
        error: 'Can only close answered questions' 
      });
    }

    // Update question status to closed
    const closedQuestion = await prisma.mentorshipQuestion.update({
      where: { id: id },
      data: {
        status: 'closed'
        // Note: In a real system, we'd have a separate feedback table
        // For now, we could store feedback in a metadata JSON field if needed
      }
    });

    res.json({
      message: 'Question closed successfully',
      question: {
        id: closedQuestion.id,
        status: closedQuestion.status
      }
    });

  } catch (error) {
    console.error('Close question error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// === MENTOR ENDPOINTS ===

// GET /api/v1/mentorship/mentor/queue - Get questions assigned to mentor (mentor role only)
router.get('/mentor/queue', async (req, res) => {
  try {
    // Check if user is a mentor
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { role: true }
    });

    if (user?.role !== 'mentor' && user?.role !== 'admin') {
      return res.status(403).json({ 
        error: 'Access denied. Mentor role required.' 
      });
    }

    const { status = 'pending', category, priority, limit = 50 } = req.query;

    const whereClause = {};
    if (status) whereClause.status = status;
    if (category) whereClause.category = category;
    if (priority) whereClause.priority = priority;

    const questions = await prisma.mentorshipQuestion.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            createdAt: true,
            profile: {
              select: {
                summary: true,
                skills: true,
                interests: true
              }
            }
          }
        }
      },
      orderBy: [
        { priority: 'asc' }, // urgent first
        { createdAt: 'asc' }  // older first
      ],
      take: parseInt(limit)
    });

    res.json({
      questions: questions,
      total: questions.length
    });

  } catch (error) {
    console.error('Get mentor queue error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v1/mentorship/mentor/answer - Answer a question (mentor role only)
router.post('/mentor/answer', async (req, res) => {
  try {
    // Check if user is a mentor
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { role: true }
    });

    if (user?.role !== 'mentor' && user?.role !== 'admin') {
      return res.status(403).json({ 
        error: 'Access denied. Mentor role required.' 
      });
    }

    const { questionId, answer } = req.body;

    if (!questionId || !answer) {
      return res.status(400).json({ 
        error: 'questionId and answer are required' 
      });
    }

    if (answer.length > 2000) {
      return res.status(400).json({ 
        error: 'Answer must be 2000 characters or less' 
      });
    }

    // Find the question
    const question = await prisma.mentorshipQuestion.findUnique({
      where: { id: questionId }
    });

    if (!question) {
      return res.status(404).json({ error: 'Question not found' });
    }

    if (question.status !== 'pending') {
      return res.status(400).json({ 
        error: 'Question is not pending. Cannot answer.' 
      });
    }

    // Update question with answer
    const answeredQuestion = await prisma.mentorshipQuestion.update({
      where: { id: questionId },
      data: {
        answer: answer.trim(),
        status: 'answered',
        answeredAt: new Date()
      }
    });

    res.json({
      message: 'Answer submitted successfully',
      question: {
        id: answeredQuestion.id,
        answer: answeredQuestion.answer,
        status: answeredQuestion.status,
        answeredAt: answeredQuestion.answeredAt
      }
    });

  } catch (error) {
    console.error('Answer question error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// === AI AUTO-ANSWER ENDPOINTS (MVP Feature) ===

// POST /api/v1/mentorship/:id/ai-answer - Generate AI answer for a question
router.post('/:id/ai-answer', async (req, res) => {
  try {
    const { id } = req.params;
    const { useAI = true } = req.body;

    const question = await prisma.mentorshipQuestion.findFirst({
      where: {
        id: id,
        userId: req.user.id
      }
    });

    if (!question) {
      return res.status(404).json({ error: 'Question not found' });
    }

    if (question.status !== 'pending') {
      return res.status(400).json({ 
        error: 'Question is not pending. Cannot generate AI answer.' 
      });
    }

    // Generate AI answer (placeholder - to be enhanced with actual AI)
    const aiAnswer = await generateAIAnswer(question);

    // Update question with AI-generated answer
    const answeredQuestion = await prisma.mentorshipQuestion.update({
      where: { id: id },
      data: {
        answer: aiAnswer,
        status: 'answered',
        answeredAt: new Date()
      }
    });

    res.json({
      message: 'AI answer generated successfully',
      question: {
        id: answeredQuestion.id,
        answer: answeredQuestion.answer,
        status: answeredQuestion.status,
        answeredAt: answeredQuestion.answeredAt,
        aiGenerated: true
      }
    });

  } catch (error) {
    console.error('Generate AI answer error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Helper Functions

function getEstimatedResponseTime(priority) {
  const estimatedTimes = {
    'urgent': '24 hours',
    'normal': '72 hours',
    'low': '1 week'
  };
  return estimatedTimes[priority] || '72 hours';
}

function calculateAverageResponseTime(questions) {
  const answeredQuestions = questions.filter(q => 
    q.status === 'answered' || q.status === 'closed'
  );
  
  if (answeredQuestions.length === 0) return null;
  
  // For now, return a placeholder value
  // In a real system, we'd calculate based on createdAt and answeredAt timestamps
  return '2.5 days';
}

async function generateAIAnswer(question, language = 'en') {
  // Use AI service to generate intelligent mentorship answers
  try {
    // Get user context for more personalized answers
    const userContext = await getUserContextForAI(question.userId);
    const aiResponse = await aiService.generateMentorshipAnswer(question, question.category, userContext);
    
    // Translate response if language is not English
    if (language !== 'en') {
      const translatedResponse = await i18nService.translateMentorshipResponse(aiResponse, language);
      return translatedResponse.translated;
    }
    
    return aiResponse;
  } catch (error) {
    console.error('Error generating AI mentorship answer:', error);
    // Fallback to template answer
    const fallbackAnswer = getFallbackMentorshipAnswer(question);
    
    // Translate fallback if needed
    if (language !== 'en') {
      try {
        const translatedFallback = await i18nService.translateMentorshipResponse(fallbackAnswer, language);
        return translatedFallback.translated;
      } catch (translateError) {
        console.error('Error translating fallback answer:', translateError);
        return fallbackAnswer;
      }
    }
    
    return fallbackAnswer;
  }
}

// Helper function to get user context for AI
async function getUserContextForAI(userId) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
        interviews: {
          where: { status: 'completed' },
          orderBy: { completedAt: 'desc' },
          take: 1
        }
      }
    });
    
    return {
      profile: user?.profile || {},
      latestInterview: user?.interviews[0] || {},
      memberSince: user?.createdAt
    };
  } catch (error) {
    console.error('Error fetching user context:', error);
    return {};
  }
}

// Fallback function for AI service failures
function getFallbackMentorshipAnswer(question) {
  const fallbackTemplates = {
    'career': `Thank you for your career-related question. Based on general career guidance principles, I'd recommend focusing on self-assessment, thorough research, strategic networking, and continuous learning. For more personalized advice, consider connecting with a human mentor in your field.`,
    
    'technical': `Thank you for your technical question. Generally, I'd suggest breaking down complex problems, researching best practices, practicing hands-on implementation, and staying current with industry trends. For specific technical guidance, consulting with an expert mentor would be most beneficial.`,
    
    'personal': `Thank you for your personal development question. Personal growth typically involves regular self-reflection, setting clear goals, seeking feedback, and being patient with the process. For more personalized guidance, speaking with a mentor or counselor would be valuable.`,
    
    'general': `Thank you for your question. I'd recommend defining your objective clearly, gathering thorough information, considering multiple perspectives, and taking actionable steps. For more specific guidance, discussing with a human mentor would provide the most value.`
  };

  return fallbackTemplates[question.category] || fallbackTemplates['general'];
}

module.exports = router;