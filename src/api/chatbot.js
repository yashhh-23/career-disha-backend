const express = require('express');
const ChatbotService = require('../services/chatbotService');
const auth = require('../middlewares/auth');
const rateLimit = require('express-rate-limit');

const router = express.Router();

// Initialize chatbot service
let chatbotService;
try {
  chatbotService = new ChatbotService();
} catch (error) {
  console.error('Failed to initialize ChatbotService:', error.message);
}

// Rate limiting for chatbot (more generous than auth)
const chatLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // 50 requests per window
  message: { error: 'Too many chat requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// In-memory storage for conversations (in production, use database)
const conversations = new Map();

/**
 * @route POST /api/v1/chatbot/message
 * @desc Send a message to the chatbot
 * @access Private
 */
router.post('/message', auth, chatLimit, async (req, res) => {
  try {
    if (!chatbotService) {
      return res.status(503).json({ 
        error: 'Chatbot service unavailable. Please check API configuration.' 
      });
    }

    const { message, conversationId } = req.body;

    if (!message || message.trim().length === 0) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Get or create conversation
    const convId = conversationId || `conv_${req.user.id}_${Date.now()}`;
    let conversation = conversations.get(convId) || {
      id: convId,
      userId: req.user.id,
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Add user message to history
    const userMessage = {
      role: 'user',
      content: message,
      timestamp: new Date()
    };
    conversation.messages.push(userMessage);

    // Get user profile for context
    const userProfile = {
      name: req.user.name,
      email: req.user.email,
      currentRole: req.user.currentRole,
      experience: req.user.experience
    };

    // Process message with chatbot
    const response = await chatbotService.processMessage(
      message, 
      conversation.messages.slice(0, -1), // Exclude the current message
      userProfile
    );

    if (response.success) {
      // Add bot response to history
      const botMessage = {
        role: 'assistant',
        content: response.message,
        timestamp: response.timestamp
      };
      conversation.messages.push(botMessage);
      conversation.updatedAt = new Date();

      // Update conversation in storage
      conversations.set(convId, conversation);

      // Get conversation suggestions
      const suggestions = await chatbotService.getConversationSuggestions(
        conversation.messages,
        userProfile
      );

      res.json({
        success: true,
        conversationId: convId,
        message: response.message,
        suggestions: suggestions.suggestions || [],
        messageCount: conversation.messages.length,
        timestamp: response.timestamp,
        metadata: {
          source: response.source || 'gemini',
          fallbackUsed: response.metadata?.fallbackUsed || false,
          ...response.metadata
        }
      });
    } else {
      res.status(500).json({
        error: 'Failed to process message',
        fallbackMessage: response.message
      });
    }
  } catch (error) {
    console.error('Chat message error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      fallbackMessage: "I'm having trouble right now. Can you tell me about your career goals?"
    });
  }
});

/**
 * @route GET /api/v1/chatbot/conversation/:conversationId
 * @desc Get conversation history
 * @access Private
 */
router.get('/conversation/:conversationId', auth, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const conversation = conversations.get(conversationId);

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    // Verify user owns this conversation
    if (conversation.userId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({
      success: true,
      conversation: {
        id: conversation.id,
        messages: conversation.messages,
        messageCount: conversation.messages.length,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt
      }
    });
  } catch (error) {
    console.error('Get conversation error:', error);
    res.status(500).json({ error: 'Failed to retrieve conversation' });
  }
});

/**
 * @route GET /api/v1/chatbot/conversations
 * @desc Get user's conversation list
 * @access Private
 */
router.get('/conversations', auth, async (req, res) => {
  try {
    const userConversations = Array.from(conversations.values())
      .filter(conv => conv.userId === req.user.id)
      .map(conv => ({
        id: conv.id,
        messageCount: conv.messages.length,
        lastMessage: conv.messages[conv.messages.length - 1]?.content.substring(0, 100) + '...',
        createdAt: conv.createdAt,
        updatedAt: conv.updatedAt
      }))
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

    res.json({
      success: true,
      conversations: userConversations,
      total: userConversations.length
    });
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({ error: 'Failed to retrieve conversations' });
  }
});

/**
 * @route POST /api/v1/chatbot/analyze/:conversationId
 * @desc Analyze conversation and extract career insights
 * @access Private
 */
router.post('/analyze/:conversationId', auth, async (req, res) => {
  try {
    if (!chatbotService) {
      return res.status(503).json({ error: 'Chatbot service unavailable' });
    }

    const { conversationId } = req.params;
    const conversation = conversations.get(conversationId);

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    if (conversation.userId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const userProfile = {
      name: req.user.name,
      email: req.user.email,
      currentRole: req.user.currentRole,
      experience: req.user.experience
    };

    // Analyze conversation
    const analysis = await chatbotService.analyzeConversation(
      conversation.messages,
      userProfile
    );

    if (analysis.success) {
      res.json({
        success: true,
        conversationId,
        analysis: analysis.analysis,
        timestamp: analysis.timestamp
      });
    } else {
      res.status(500).json({
        error: 'Failed to analyze conversation',
        details: analysis.error
      });
    }
  } catch (error) {
    console.error('Analyze conversation error:', error);
    res.status(500).json({ error: 'Failed to analyze conversation' });
  }
});

/**
 * @route POST /api/v1/chatbot/roadmap/:conversationId
 * @desc Generate skill roadmap based on conversation
 * @access Private
 */
router.post('/roadmap/:conversationId', auth, async (req, res) => {
  try {
    if (!chatbotService) {
      return res.status(503).json({ error: 'Chatbot service unavailable' });
    }

    const { conversationId } = req.params;
    const conversation = conversations.get(conversationId);

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    if (conversation.userId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const userProfile = {
      name: req.user.name,
      email: req.user.email,
      currentRole: req.user.currentRole,
      experience: req.user.experience
    };

    // First analyze the conversation
    const analysis = await chatbotService.analyzeConversation(
      conversation.messages,
      userProfile
    );

    if (!analysis.success) {
      return res.status(500).json({
        error: 'Failed to analyze conversation for roadmap generation'
      });
    }

    // Generate roadmap based on analysis
    const roadmap = await chatbotService.generateSkillRoadmap(
      analysis.analysis,
      userProfile
    );

    if (roadmap.success) {
      res.json({
        success: true,
        conversationId,
        roadmap: roadmap.roadmap,
        analysis: analysis.analysis,
        timestamp: roadmap.timestamp
      });
    } else {
      // Return mock roadmap if generation fails
      const mockRoadmap = chatbotService.generateMockRoadmap();
      res.json({
        success: true,
        conversationId,
        roadmap: mockRoadmap.roadmap,
        isMock: true,
        error: roadmap.error,
        timestamp: new Date()
      });
    }
  } catch (error) {
    console.error('Generate roadmap error:', error);
    res.status(500).json({ error: 'Failed to generate roadmap' });
  }
});

/**
 * @route POST /api/v1/chatbot/suggestions
 * @desc Get conversation suggestions
 * @access Private
 */
router.post('/suggestions', auth, async (req, res) => {
  try {
    if (!chatbotService) {
      return res.status(503).json({ error: 'Chatbot service unavailable' });
    }

    const { conversationHistory = [] } = req.body;
    const userProfile = {
      name: req.user.name,
      currentRole: req.user.currentRole,
      experience: req.user.experience
    };

    const suggestions = await chatbotService.getConversationSuggestions(
      conversationHistory,
      userProfile
    );

    res.json({
      success: true,
      suggestions: suggestions.suggestions || [
        "What are your career goals?",
        "What skills would you like to develop?",
        "Tell me about your current experience",
        "What industries interest you?"
      ],
      timestamp: suggestions.timestamp
    });
  } catch (error) {
    console.error('Get suggestions error:', error);
    res.status(500).json({ 
      error: 'Failed to get suggestions',
      fallbackSuggestions: [
        "What are your career goals?",
        "What skills would you like to develop?"
      ]
    });
  }
});

/**
 * @route DELETE /api/v1/chatbot/conversation/:conversationId
 * @desc Delete a conversation
 * @access Private
 */
router.delete('/conversation/:conversationId', auth, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const conversation = conversations.get(conversationId);

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    if (conversation.userId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    conversations.delete(conversationId);

    res.json({
      success: true,
      message: 'Conversation deleted successfully'
    });
  } catch (error) {
    console.error('Delete conversation error:', error);
    res.status(500).json({ error: 'Failed to delete conversation' });
  }
});

/**
 * @route GET /api/v1/chatbot/health
 * @desc Check chatbot service health
 * @access Public
 */
router.get('/health', async (req, res) => {
  try {
    const health = {
      status: 'healthy',
      service: 'chatbot',
      timestamp: new Date(),
      geminiConfigured: !!process.env.GEMINI_API_KEY,
      serviceInitialized: !!chatbotService,
      activeConversations: conversations.size
    };

    res.json(health);
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date()
    });
  }
});

module.exports = router;