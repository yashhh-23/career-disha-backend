const express = require('express');
const prisma = require('../config/prisma');
const aiService = require('../services/aiService');
const i18nService = require('../services/i18nService');

const router = express.Router();

// Interview configuration
const INTERVIEW_CONFIG = {
  totalSteps: 5,
  questionsPerStep: 3,
  categories: ['background', 'skills', 'interests', 'goals', 'constraints'],
  stepNames: {
    1: 'Background & Education',
    2: 'Technical Skills & Experience', 
    3: 'Interests & Passions',
    4: 'Career Goals & Aspirations',
    5: 'Constraints & Preferences'
  }
};

// POST /api/v1/interview/start - Start new interview
router.post('/start', async (req, res) => {
  try {
    const { language = 'en' } = req.body;
    
    // Check if user has an active interview session
    const activeInterview = await prisma.interviewSession.findFirst({
      where: {
        userId: req.user.id,
        status: 'IN_PROGRESS'
      }
    });

    if (activeInterview) {
      return res.status(409).json({ 
        error: 'You already have an active interview session. Please complete or abandon it first.',
        interviewId: activeInterview.id
      });
    }

    // Create new interview session
    const interview = await prisma.interviewSession.create({
      data: {
        userId: req.user.id,
        title: 'Career Discovery Interview',
        jobRole: 'General Career Assessment',
        difficulty: 'MEDIUM',
        interviewType: 'BEHAVIORAL',
        duration: 30, // 30 minutes
        questionCount: INTERVIEW_CONFIG.totalSteps * INTERVIEW_CONFIG.questionsPerStep,
        aiModel: 'gemini',
        questions: [],
        responses: {
          language: language,
          turns: []
        },
        feedback: {},
        status: 'IN_PROGRESS',
        startedAt: new Date(),
        strengths: [],
        improvements: [],
        recommendations: []
      }
    });

    // Generate first set of questions
    const firstQuestions = await generateQuestionsForStep(1, {}, req.user);
    
    // Translate questions if language is not English
    let translatedQuestions = firstQuestions;
    if (language !== 'en') {
      translatedQuestions = await i18nService.translateInterviewQuestions(firstQuestions, language);
    }

    // Update interview session with first questions
    await prisma.interviewSession.update({
      where: { id: interview.id },
      data: {
        questions: translatedQuestions,
        responses: {
          language: language,
          turns: [],
          currentStep: 1,
          totalSteps: INTERVIEW_CONFIG.totalSteps
        }
      }
    });

    // Create initial progress record
    await prisma.progress.create({
      data: {
        userId: req.user.id,
        type: 'interview',
        referenceId: interview.id,
        progress: 0,
        status: 'in_progress',
        metadata: {
          step: 1,
          totalSteps: INTERVIEW_CONFIG.totalSteps,
          startedAt: new Date().toISOString(),
          language: language,
          sessionType: 'career_discovery'
        }
      }
    });

    res.status(201).json({
      message: 'Interview session started successfully',
      interview: {
        id: interview.id,
        title: interview.title,
        jobRole: interview.jobRole,
        difficulty: interview.difficulty,
        interviewType: interview.interviewType,
        duration: interview.duration,
        questionCount: interview.questionCount,
        currentStep: 1,
        totalSteps: INTERVIEW_CONFIG.totalSteps,
        stepName: INTERVIEW_CONFIG.stepNames[1],
        questions: translatedQuestions,
        progress: 0,
        language: language,
        status: interview.status
      }
    });

  } catch (error) {
    console.error('Start interview error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v1/interview/respond - Submit interview response
router.post('/respond', async (req, res) => {
  try {
    const { interviewId, responses, currentStep } = req.body;

    if (!interviewId || !responses || !currentStep) {
      return res.status(400).json({ 
        error: 'interviewId, responses, and currentStep are required' 
      });
    }

    // Get interview session
    const interview = await prisma.interviewSession.findFirst({
      where: {
        id: interviewId,
        userId: req.user.id,
        status: 'IN_PROGRESS'
      }
    });

    if (!interview) {
      return res.status(404).json({ error: 'Active interview session not found' });
    }

    const currentStepFromSession = interview.responses?.currentStep || 1;
    if (currentStepFromSession !== currentStep) {
      return res.status(400).json({ 
        error: `Step mismatch. Expected step ${currentStepFromSession}, got ${currentStep}` 
      });
    }

    // Validate responses
    if (!Array.isArray(responses) || responses.length === 0) {
      return res.status(400).json({ 
        error: 'Responses must be a non-empty array' 
      });
    }

    // Process and store responses
    const currentResponses = interview.responses || {};
    currentResponses[`step_${currentStep}`] = {
      responses: responses,
      timestamp: new Date().toISOString(),
      stepName: INTERVIEW_CONFIG.stepNames[currentStep]
    };
    // Append conversation turns history for auditing and UX continuity
    const nowIso = new Date().toISOString();
    const existingTurns = Array.isArray(currentResponses.turns) ? currentResponses.turns : [];
    const newTurns = responses.map((answer, idx) => ({
      step: currentStep,
      index: idx,
      answer,
      timestamp: nowIso
    }));
    currentResponses.turns = [...existingTurns, ...newTurns];

    // Analyze responses and extract insights
    const stepAnalysis = await analyzeStepResponses(currentStep, responses, currentResponses);
    
    // Determine if interview is complete or move to next step
    const isComplete = currentStep >= INTERVIEW_CONFIG.totalSteps;
    const nextStep = isComplete ? currentStep : currentStep + 1;
    const progress = Math.round((currentStep / INTERVIEW_CONFIG.totalSteps) * 100);

    // Update interview session
    const updatedInterview = await prisma.interviewSession.update({
      where: { id: interviewId },
      data: {
        responses: currentResponses,
        updatedAt: new Date()
      }
    });

    // Update progress
    await prisma.progress.update({
      where: {
        userId_type_referenceId: {
          userId: req.user.id,
          type: 'interview',
          referenceId: interviewId
        }
      },
      data: {
        progress: progress,
        status: isComplete ? 'completed' : 'in_progress',
        metadata: {
          step: nextStep,
          totalSteps: INTERVIEW_CONFIG.totalSteps,
          completedSteps: currentStep,
          lastUpdated: new Date().toISOString()
        }
      }
    });

    // If interview is complete, generate recommendations
    let recommendations = null;
    if (isComplete) {
      recommendations = await generateInitialRecommendations(updatedInterview, req.user.id);
      
      // Update user profile with extracted insights
      await updateUserProfileFromInterview(updatedInterview, req.user.id);
    }

    // Generate next questions if not complete
    const nextQuestions = isComplete ? null : 
      await generateQuestionsForStep(nextStep, currentResponses, req.user);

    res.json({
      message: isComplete ? 'Interview completed successfully' : 'Response recorded successfully',
      interview: {
        id: interview.id,
        currentStep: nextStep,
        totalSteps: INTERVIEW_CONFIG.totalSteps,
        stepName: isComplete ? 'Completed' : INTERVIEW_CONFIG.stepNames[nextStep],
        questions: nextQuestions,
        progress: progress,
        isComplete: isComplete,
        analysis: stepAnalysis.insights
      },
      recommendations: recommendations
    });

  } catch (error) {
    console.error('Interview respond error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/interview/:id - Get interview details
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const interview = await prisma.interviewSession.findFirst({
      where: {
        id: id,
        userId: req.user.id
      }
    });

    if (!interview) {
      return res.status(404).json({ error: 'Interview not found' });
    }

    // Get current questions if interview is active
    let currentQuestions = null;
    if (interview.status === 'active') {
      currentQuestions = await generateQuestionsForStep(
        interview.currentStep, 
        interview.responses || {}, 
        req.user
      );
    }

    const progress = interview.status === 'completed' ? 100 : 
      Math.round(((interview.currentStep - 1) / INTERVIEW_CONFIG.totalSteps) * 100);

    res.json({
      interview: {
        id: interview.id,
        status: interview.status,
        currentStep: interview.currentStep,
        totalSteps: INTERVIEW_CONFIG.totalSteps,
        stepName: interview.status === 'completed' ? 'Completed' : 
          INTERVIEW_CONFIG.stepNames[interview.currentStep],
        progress: progress,
        createdAt: interview.createdAt,
        completedAt: interview.completedAt,
        summary: interview.summary,
        profileTags: interview.profileTags,
        responses: interview.responses,
        questions: currentQuestions
      }
    });

  } catch (error) {
    console.error('Get interview error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v1/interview/complete - Force complete interview
router.post('/complete', async (req, res) => {
  try {
    const { interviewId, reason = 'user_requested' } = req.body;

    if (!interviewId) {
      return res.status(400).json({ error: 'interviewId is required' });
    }

    const interview = await prisma.interviewSession.findFirst({
      where: {
        id: interviewId,
        userId: req.user.id,
        status: 'IN_PROGRESS'
      }
    });

    if (!interview) {
      return res.status(404).json({ error: 'Active interview session not found' });
    }

    // Generate summary from current responses
    const partialAnalysis = await analyzeAllResponses(interview.responses || {});
    
    // Update interview session as completed
    const completedInterview = await prisma.interviewSession.update({
      where: { id: interviewId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        feedback: {
          summary: partialAnalysis.summary || 'Interview completed early',
          strengths: partialAnalysis.strengths || [],
          improvements: partialAnalysis.improvements || [],
          recommendations: partialAnalysis.recommendations || []
        },
        strengths: partialAnalysis.strengths || [],
        improvements: partialAnalysis.improvements || [],
        recommendations: partialAnalysis.recommendations || []
      }
    });

    // Update progress
    await prisma.progress.update({
      where: {
        userId_type_referenceId: {
          userId: req.user.id,
          type: 'interview',
          referenceId: interviewId
        }
      },
      data: {
        progress: 100,
        status: 'completed',
        metadata: {
          completedEarly: true,
          reason: reason,
          completedAt: new Date().toISOString()
        }
      }
    });

    // Generate recommendations based on available data
    const recommendations = await generateInitialRecommendations(completedInterview, req.user.id);

    // Update user profile
    await updateUserProfileFromInterview(completedInterview, req.user.id);

    res.json({
      message: 'Interview completed successfully',
      interview: {
        id: completedInterview.id,
        status: 'completed',
        summary: completedInterview.summary,
        profileTags: completedInterview.profileTags
      },
      recommendations: recommendations
    });

  } catch (error) {
    console.error('Complete interview error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/interview - Get user's interviews
router.get('/', async (req, res) => {
  try {
    const { status, limit = 10 } = req.query;

    const whereClause = { userId: req.user.id };
    if (status) {
      whereClause.status = status;
    }

    const interviews = await prisma.interview.findMany({
      where: whereClause,
      select: {
        id: true,
        status: true,
        currentStep: true,
        createdAt: true,
        completedAt: true,
        summary: true,
        profileTags: true
      },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit)
    });

    const formattedInterviews = interviews.map(interview => ({
      ...interview,
      progress: interview.status === 'completed' ? 100 : 
        Math.round(((interview.currentStep - 1) / INTERVIEW_CONFIG.totalSteps) * 100),
      stepName: interview.status === 'completed' ? 'Completed' : 
        INTERVIEW_CONFIG.stepNames[interview.currentStep]
    }));

    res.json({
      interviews: formattedInterviews,
      total: interviews.length
    });

  } catch (error) {
    console.error('Get interviews error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/v1/interview/:id - Delete/abandon interview
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const interview = await prisma.interviewSession.findFirst({
      where: {
        id: id,
        userId: req.user.id
      }
    });

    if (!interview) {
      return res.status(404).json({ error: 'Interview not found' });
    }

    if (interview.status === 'completed') {
      return res.status(400).json({ 
        error: 'Cannot delete completed interview. Contact support if needed.' 
      });
    }

    // Delete interview and related progress
    await prisma.$transaction([
      prisma.progress.deleteMany({
        where: {
          userId: req.user.id,
          type: 'interview',
          referenceId: id
        }
      }),
      prisma.interview.delete({
        where: { id: id }
      })
    ]);

    res.json({ message: 'Interview deleted successfully' });

  } catch (error) {
    console.error('Delete interview error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Helper Functions (AI placeholders - to be enhanced with actual AI integration)

async function generateQuestionsForStep(step, previousResponses, user) {
  // Use AI service to generate personalized questions
  try {
    const userProfile = await getUserProfileForAI(user.id);
    return await aiService.generateInterviewQuestions(step, previousResponses, userProfile);
  } catch (error) {
    console.error('Error generating AI questions:', error);
    // Fallback to predefined questions
    return aiService.getFallbackQuestions(step);
  }
}

// Helper function to get user profile data for AI
async function getUserProfileForAI(userId) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true
      }
    });
    
    return {
      email: user?.email,
      profile: user?.profile || {},
      memberSince: user?.createdAt
    };
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return {};
  }
}

async function analyzeStepResponses(step, responses, allResponses) {
  // Use AI service for intelligent response analysis
  try {
    return await aiService.analyzeInterviewResponses(step, responses, allResponses);
  } catch (error) {
    console.error('Error analyzing responses with AI:', error);
    // Fallback to basic analysis
    return {
      extractedTags: ['communication', 'problem-solving', 'teamwork'],
      insights: [{
        category: INTERVIEW_CONFIG.categories[step - 1],
        insight: 'Successfully completed interview step',
        confidence: 0.6
      }],
      summary: `Step ${step} completed: ${INTERVIEW_CONFIG.stepNames[step]}`
    };
  }
}

async function analyzeAllResponses(responses) {
  // TODO: Implement comprehensive AI analysis
  const allTags = [];
  let summary = "Interview analysis: ";
  
  Object.entries(responses).forEach(([stepKey, stepData]) => {
    if (stepData.responses) {
      stepData.responses.forEach(response => {
        const keywords = response.toLowerCase().match(/\b\w{4,}\b/g) || [];
        keywords.forEach(keyword => {
          if (!allTags.includes(keyword) && isRelevantSkillOrTag(keyword)) {
            allTags.push(keyword);
          }
        });
      });
    }
  });

  summary += `Identified ${allTags.length} relevant skills and interests.`;
  
  return {
    extractedTags: allTags.slice(0, 20),
    summary: summary
  };
}

async function generateInitialRecommendations(interview, userId) {
  // TODO: Generate AI-powered recommendations
  // For now, create basic recommendations based on tags
  
  const recommendations = [];
  const tags = interview.profileTags || [];
  
  // Create skill-based recommendations
  tags.slice(0, 3).forEach((tag, index) => {
    recommendations.push({
      type: 'skill',
      title: `Improve ${tag} skills`,
      description: `Based on your interview, enhancing your ${tag} skills could advance your career`,
      priority: index === 0 ? 'high' : 'medium'
    });
  });

  // Create course recommendations
  recommendations.push({
    type: 'course',
    title: 'Career Development Fundamentals',
    description: 'A comprehensive course to help you navigate your career path effectively',
    priority: 'medium'
  });

  // Store recommendations in database
  for (const rec of recommendations) {
    await prisma.recommendation.create({
      data: {
        userId: userId,
        type: rec.type,
        title: rec.title,
        description: rec.description,
        priority: rec.priority,
        metadata: {
          source: 'interview_analysis',
          interviewId: interview.id
        }
      }
    });
  }

  return recommendations;
}

async function updateUserProfileFromInterview(interview, userId) {
  // Update user profile with insights from interview session
  const feedback = interview.feedback || {};
  const summary = feedback.summary || interview.summary || '';
  const strengths = interview.strengths || [];
  const recommendations = interview.recommendations || [];
  
  // Extract skills from strengths and recommendations
  const extractedSkills = [...strengths, ...recommendations]
    .filter(item => typeof item === 'string' && isSkill(item))
    .slice(0, 15);
  
  await prisma.profile.upsert({
    where: { userId: userId },
    update: {
      summary: summary,
      tags: [...strengths, ...recommendations].slice(0, 10),
      skills: extractedSkills
    },
    create: {
      userId: userId,
      summary: summary,
      tags: [...strengths, ...recommendations].slice(0, 10),
      skills: extractedSkills,
      languages: [],
      interests: [...strengths, ...recommendations]
        .filter(item => typeof item === 'string' && !isSkill(item))
        .slice(0, 10)
    }
  });

  // Map identified skills into Skill + UserSkill tables
  const skillTags = extractedSkills.slice(0, 50);
  for (const raw of skillTags) {
    const name = String(raw).trim();
    if (!name) continue;
    const normalized = name.toLowerCase().replace(/[^a-z0-9+.#]+/g, '-');
    const skill = await prisma.skill.upsert({
      where: { normalized },
      update: { name },
      create: { name, normalized, category: undefined, tags: [] }
    });
    await prisma.userSkill.upsert({
      where: { userId_skillId: { userId: userId, skillId: skill.id } },
      update: { level: undefined, source: 'interview', confidence: 0.8 },
      create: { userId: userId, skillId: skill.id, level: undefined, source: 'interview', confidence: 0.8 }
    });
  }
}

// Helper function to determine if a keyword is relevant
function isRelevantSkillOrTag(keyword) {
  const relevantWords = [
    'javascript', 'python', 'react', 'nodejs', 'programming', 'development',
    'design', 'marketing', 'management', 'leadership', 'communication',
    'analytics', 'data', 'machine', 'learning', 'artificial', 'intelligence'
  ];
  return relevantWords.some(word => keyword.includes(word) || word.includes(keyword));
}

function isSkill(tag) {
  const skillWords = [
    'javascript', 'python', 'react', 'nodejs', 'programming', 'development',
    'design', 'analytics', 'data', 'machine', 'learning'
  ];
  return skillWords.some(skill => tag.toLowerCase().includes(skill));
}

module.exports = router;