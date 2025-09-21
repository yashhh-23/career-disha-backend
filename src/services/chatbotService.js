const { GoogleGenerativeAI } = require('@google/generative-ai');

class ChatbotService {
  constructor() {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY is required for chatbot service');
    }
    
    // Initialize Gemini (primary)
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    this.model = this.genAI.getGenerativeModel({ 
      model: "gemini-1.5-pro",
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.9,
        maxOutputTokens: 1000,
      }
    });

    // Initialize Hugging Face (fallback)
    this.huggingFaceApiKey = process.env.HUGGING_FACE_API_KEY;
    this.huggingFaceModel = "facebook/blenderbot-400M-distill"; // Better model for conversations
    
    this.systemPrompt = `You are CareerDisha AI, a friendly and knowledgeable career guidance chatbot. Your role is to:

1. Help users explore career paths and opportunities
2. Provide personalized skill development advice
3. Suggest learning resources and roadmaps
4. Answer questions about different industries and roles
5. Analyze user interests, skills, and goals from conversations

Guidelines:
- Be conversational and engaging
- Ask follow-up questions to understand user goals
- Provide specific, actionable advice
- Keep track of user's mentioned skills, interests, and experience level
- Suggest concrete next steps and resources
- Be encouraging and supportive

Remember: You're having a conversation to understand the user's career aspirations and help create a personalized skill development roadmap.`;

    console.log('ChatbotService initialized with Gemini API (primary) and Hugging Face (fallback)');
  }

  /**
   * Fallback to Hugging Face API when Gemini fails
   */
  async callHuggingFace(message, conversationHistory = []) {
    if (!this.huggingFaceApiKey || this.huggingFaceApiKey === 'your-hf-api-key') {
      throw new Error('Hugging Face API key not properly configured');
    }

    try {
      const fetch = require('node-fetch');
      
      // Use a simpler, more reliable approach with GPT-2
      const response = await fetch(
        `https://api-inference.huggingface.co/models/gpt2`,
        {
          headers: {
            Authorization: `Bearer ${this.huggingFaceApiKey}`,
            'Content-Type': 'application/json',
          },
          method: 'POST',
          body: JSON.stringify({
            inputs: `Career guidance context: You are helping someone with career advice.\n\nUser question: ${message}\n\nCareer advisor response:`,
            parameters: {
              max_length: 150,
              temperature: 0.8,
              do_sample: true,
              top_p: 0.9,
              return_full_text: false
            }
          }),
        }
      );

      const result = await response.json();
      
      // Check for common Hugging Face errors
      if (result.error) {
        if (result.error.includes('loading')) {
          console.log('Model is loading, using static fallback...');
          return this.getCareerSpecificFallback(message);
        }
        if (result.error.includes('Rate limit')) {
          console.log('Rate limited, using static fallback...');
          return this.getCareerSpecificFallback(message);
        }
        throw new Error(result.error);
      }

      let responseText = '';
      
      // Handle response format
      if (Array.isArray(result) && result.length > 0) {
        responseText = result[0].generated_text || '';
      } else if (result.generated_text) {
        responseText = result.generated_text;
      }
      
      // Clean up and validate response
      responseText = responseText.trim();
      
      // Remove the input prompt from response if it's included
      if (responseText.includes('Career advisor response:')) {
        responseText = responseText.split('Career advisor response:')[1] || '';
        responseText = responseText.trim();
      }
      
      // Validate response quality
      if (!responseText || responseText.length < 10 || 
          responseText.includes('undefined') || responseText.includes('null')) {
        console.log('Invalid response from HF, using static fallback...');
        return this.getCareerSpecificFallback(message);
      }
      
      // Ensure it's career-focused
      return this.addCareerContext(responseText, message);

    } catch (error) {
      console.error('Hugging Face API error:', error);
      // Return static fallback instead of throwing
      return this.getCareerSpecificFallback(message);
    }
  }

  /**
   * Add career context to generic responses
   */
  addCareerContext(response, originalMessage) {
    const lowerMessage = originalMessage.toLowerCase();
    const lowerResponse = response.toLowerCase();
    
    // If response is already career-related, return as is
    if (lowerResponse.includes('career') || lowerResponse.includes('skill') || 
        lowerResponse.includes('job') || lowerResponse.includes('work')) {
      return response;
    }
    
    // Add career context based on the question
    if (lowerMessage.includes('skill') || lowerMessage.includes('learn')) {
      return `${response} In terms of career development, focusing on both technical and soft skills is important for professional growth.`;
    }
    
    if (lowerMessage.includes('career') || lowerMessage.includes('job')) {
      return `${response} From a career perspective, it's valuable to align your goals with market opportunities and your personal interests.`;
    }
    
    // For general responses, add a career guidance touch
    return `${response} If you'd like specific career guidance or skill development advice, I'm here to help!`;
  }

  /**
   * Get career-specific fallback response
   */
  getCareerSpecificFallback(message) {
    const lowerMessage = message.toLowerCase();
    
    if (lowerMessage.includes('skill') || lowerMessage.includes('learn')) {
      return "That's a great question about skill development! Based on current industry trends, I'd recommend focusing on both technical and soft skills. What specific area interests you most - technology, business, creative fields, or something else?";
    }
    
    if (lowerMessage.includes('career') || lowerMessage.includes('job')) {
      return "Career planning is so important! To give you the best advice, I'd love to know more about your background and interests. What field are you currently in or considering?";
    }
    
    if (lowerMessage.includes('roadmap') || lowerMessage.includes('path')) {
      return "I'd be happy to help you create a career roadmap! Every good roadmap starts with understanding your current position and goals. What's your current experience level and where would you like to be in the next 2-3 years?";
    }
    
    return "I'm here to help with your career journey! Whether you're looking for skill development advice, career transitions, or just exploring options, I'm ready to assist. What specific aspect of your career would you like to discuss?";
  }

  /**
   * Process a chat message and generate response
   */
  async processMessage(message, conversationHistory = [], userProfile = {}) {
    // First try Gemini API
    try {
      // Build conversation context
      const context = this.buildConversationContext(conversationHistory, userProfile);
      
      // Create chat session with history
      const chat = this.model.startChat({
        history: this.formatChatHistory(conversationHistory),
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1000,
        },
      });

      // Send message and get response
      const result = await chat.sendMessage(`${context}\n\nUser: ${message}`);
      const response = result.response.text();

      return {
        success: true,
        message: response,
        timestamp: new Date(),
        source: 'gemini',
        metadata: {
          conversationLength: conversationHistory.length,
          hasUserProfile: !!userProfile.name
        }
      };
    } catch (error) {
      console.error('Gemini API error:', error);
      
      // Try Hugging Face as fallback
      if (this.huggingFaceApiKey && this.huggingFaceApiKey !== 'your-hf-api-key') {
        try {
          console.log('Falling back to Hugging Face API...');
          const hfResponse = await this.callHuggingFace(message, conversationHistory);
          
          return {
            success: true,
            message: hfResponse,
            timestamp: new Date(),
            source: 'huggingface',
            metadata: {
              fallbackUsed: true,
              originalError: error.message,
              conversationLength: conversationHistory.length
            }
          };
        } catch (hfError) {
          console.error('Hugging Face fallback also failed:', hfError);
          // Don't throw here, continue to static fallback
        }
      }
      
      // Final fallback to static responses
      return {
        success: false,
        message: this.getCareerSpecificFallback(message),
        error: error.message,
        timestamp: new Date(),
        source: 'fallback',
        metadata: {
          fallbackUsed: true,
          allApiFailed: true
        }
      };
    }
  }

  /**
   * Analyze conversation and extract career insights
   */
  async analyzeConversation(conversationHistory, userProfile = {}) {
    try {
      const analysisPrompt = `
Analyze this career guidance conversation and extract key insights:

User Profile: ${JSON.stringify(userProfile, null, 2)}

Conversation History:
${conversationHistory.map(msg => `${msg.role}: ${msg.content}`).join('\n')}

Please provide a structured analysis in JSON format with:
{
  "userGoals": ["primary career goals mentioned"],
  "currentSkills": ["skills user currently has"],
  "interests": ["areas of interest mentioned"],
  "experience": "beginner/intermediate/advanced",
  "challenges": ["challenges or concerns mentioned"],
  "preferredLearning": "style preferences mentioned",
  "timeline": "any timeline mentioned",
  "recommendations": {
    "immediate": ["immediate next steps"],
    "shortTerm": ["3-6 month goals"],
    "longTerm": ["1+ year goals"]
  }
}

Respond only with valid JSON.`;

      const result = await this.model.generateContent(analysisPrompt);
      const response = result.response.text();
      
      // Try to parse JSON response
      try {
        const analysis = JSON.parse(response);
        return {
          success: true,
          analysis,
          timestamp: new Date()
        };
      } catch (parseError) {
        console.error('Failed to parse analysis JSON:', parseError);
        return {
          success: false,
          error: 'Failed to parse analysis',
          rawResponse: response
        };
      }
    } catch (error) {
      console.error('Conversation analysis error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Generate personalized skill roadmap based on conversation
   */
  async generateSkillRoadmap(conversationAnalysis, userProfile = {}) {
    try {
      const roadmapPrompt = `
Based on this career conversation analysis, create a detailed skill development roadmap:

Analysis: ${JSON.stringify(conversationAnalysis, null, 2)}
User Profile: ${JSON.stringify(userProfile, null, 2)}

Create a comprehensive skill roadmap in JSON format:
{
  "roadmapTitle": "Personalized Career Development Roadmap",
  "userSummary": "Brief summary of user's current state and goals",
  "phases": [
    {
      "phase": "Foundation (Months 1-3)",
      "description": "Core skills to build immediately",
      "skills": [
        {
          "name": "Skill Name",
          "priority": "High/Medium/Low",
          "timeToLearn": "2-4 weeks",
          "resources": ["specific learning resources"],
          "projects": ["hands-on projects to practice"],
          "milestones": ["measurable goals"]
        }
      ]
    }
  ],
  "careerPaths": [
    {
      "title": "Career Path Title",
      "match": "85%",
      "description": "Why this path fits",
      "requiredSkills": ["key skills needed"],
      "timeline": "6-12 months to job-ready"
    }
  ],
  "resources": {
    "courses": ["recommended courses"],
    "books": ["suggested reading"],
    "communities": ["communities to join"],
    "tools": ["tools to learn"]
  },
  "nextSteps": ["immediate actions to take"]
}

Make it specific, actionable, and tailored to the user's conversation. Respond only with valid JSON.`;

      const result = await this.model.generateContent(roadmapPrompt);
      const response = result.response.text();
      
      try {
        const roadmap = JSON.parse(response);
        return {
          success: true,
          roadmap,
          timestamp: new Date(),
          conversationId: conversationAnalysis.conversationId
        };
      } catch (parseError) {
        console.error('Failed to parse roadmap JSON:', parseError);
        return {
          success: false,
          error: 'Failed to parse roadmap',
          rawResponse: response
        };
      }
    } catch (error) {
      console.error('Roadmap generation error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get conversation suggestions based on current context
   */
  async getConversationSuggestions(conversationHistory = [], userProfile = {}) {
    try {
      const suggestionsPrompt = `
Based on this conversation history, suggest 3-4 helpful follow-up questions or topics to explore:

Conversation: ${conversationHistory.slice(-5).map(msg => `${msg.role}: ${msg.content}`).join('\n')}
User Profile: ${JSON.stringify(userProfile)}

Provide suggestions as a JSON array:
["What specific programming languages interest you?", "Tell me about your current work experience", "What's your ideal work environment?"]

Keep suggestions conversational and focused on career development. Respond only with valid JSON array.`;

      const result = await this.model.generateContent(suggestionsPrompt);
      const response = result.response.text();
      
      try {
        const suggestions = JSON.parse(response);
        return {
          success: true,
          suggestions: Array.isArray(suggestions) ? suggestions : [],
          timestamp: new Date()
        };
      } catch (parseError) {
        return {
          success: true,
          suggestions: [
            "What are your career goals?",
            "What skills would you like to develop?",
            "Tell me about your experience level",
            "What industries interest you?"
          ]
        };
      }
    } catch (error) {
      console.error('Suggestions error:', error);
      return {
        success: true,
        suggestions: [
          "What are your career goals?",
          "What skills would you like to develop?",
          "Tell me about your experience level"
        ]
      };
    }
  }

  // === HELPER METHODS ===

  buildConversationContext(conversationHistory, userProfile) {
    let context = this.systemPrompt;
    
    if (userProfile.name) {
      context += `\n\nUser Info: ${userProfile.name}`;
      if (userProfile.currentRole) context += `, currently: ${userProfile.currentRole}`;
      if (userProfile.experience) context += `, experience: ${userProfile.experience}`;
    }
    
    if (conversationHistory.length > 0) {
      context += `\n\nPrevious conversation context (last ${Math.min(3, conversationHistory.length)} messages):`;
      conversationHistory.slice(-3).forEach(msg => {
        context += `\n${msg.role}: ${msg.content}`;
      });
    }
    
    return context;
  }

  formatChatHistory(conversationHistory) {
    return conversationHistory.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }]
    }));
  }

  getFallbackResponse(message) {
    const fallbacks = [
      "I'm here to help with your career development! Could you tell me more about your goals?",
      "That's interesting! What specific areas would you like to explore in your career?",
      "I'd love to help you with that. Can you share more details about your current situation?",
      "Great question! Let me help you think through your career options. What's your background?",
      "I'm experiencing some technical difficulties, but I'm still here to help! What would you like to discuss about your career?"
    ];
    
    return fallbacks[Math.floor(Math.random() * fallbacks.length)];
  }

  // Generate mock roadmap for testing
  generateMockRoadmap(userGoals = "web development") {
    return {
      success: true,
      roadmap: {
        roadmapTitle: `Personalized ${userGoals} Career Development Roadmap`,
        userSummary: "Based on our conversation, you're interested in web development with a focus on modern technologies.",
        phases: [
          {
            phase: "Foundation (Months 1-3)",
            description: "Build core web development skills",
            skills: [
              {
                name: "HTML & CSS",
                priority: "High",
                timeToLearn: "2-3 weeks",
                resources: ["MDN Web Docs", "freeCodeCamp", "CSS-Tricks"],
                projects: ["Personal portfolio", "Landing page"],
                milestones: ["Create responsive layouts", "Master flexbox and grid"]
              },
              {
                name: "JavaScript Fundamentals",
                priority: "High",
                timeToLearn: "4-6 weeks",
                resources: ["JavaScript.info", "Eloquent JavaScript", "MDN"],
                projects: ["Calculator app", "Todo list", "Weather app"],
                milestones: ["Understand DOM manipulation", "Master ES6+ features"]
              }
            ]
          },
          {
            phase: "Intermediate (Months 4-6)",
            description: "Learn modern frameworks and tools",
            skills: [
              {
                name: "React.js",
                priority: "High",
                timeToLearn: "6-8 weeks",
                resources: ["React docs", "React Tutorial", "Scrimba React course"],
                projects: ["Blog app", "E-commerce site", "Social media dashboard"],
                milestones: ["Master component lifecycle", "State management with hooks"]
              }
            ]
          }
        ],
        careerPaths: [
          {
            title: "Frontend Developer",
            match: "90%",
            description: "Perfect fit for your interests in user interfaces and modern web technologies",
            requiredSkills: ["HTML/CSS", "JavaScript", "React", "Version Control"],
            timeline: "6-9 months to job-ready"
          }
        ],
        resources: {
          courses: ["freeCodeCamp", "The Odin Project", "Frontend Masters"],
          books: ["Eloquent JavaScript", "You Don't Know JS"],
          communities: ["Reddit r/webdev", "Dev.to", "FreeCodeCamp forum"],
          tools: ["VS Code", "Git", "Chrome DevTools", "Figma"]
        },
        nextSteps: [
          "Start with HTML/CSS basics",
          "Set up development environment",
          "Join developer communities",
          "Begin building your first project"
        ]
      },
      timestamp: new Date()
    };
  }
}

module.exports = ChatbotService;