const { HfInference } = require('@huggingface/inference');
const { GoogleGenerativeAI } = require('@google/generative-ai');

class AIService {
  constructor() {
    // Initialize Google Gemini (Primary)
    this.gemini = null;
    if (process.env.GEMINI_API_KEY) {
      this.gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      console.log('AI Service initialized with Google Gemini as primary');
    }
    
    // Initialize Hugging Face (Fallback)
    this.hf = null;
    if (process.env.HUGGING_FACE_API_KEY) {
      this.hf = new HfInference(process.env.HUGGING_FACE_API_KEY);
      console.log('Hugging Face initialized as fallback');
    }
    
    // Gemini models (Primary)
    this.geminiModels = {
      flash: 'gemini-2.0-flash-exp',
      pro: 'gemini-1.5-pro',
      flashThinking: 'gemini-2.0-flash-thinking-exp'
    };
    
    // Hugging Face models (Fallback)
    this.hfModels = {
      textGeneration: 'mistralai/Mistral-7B-Instruct-v0.1',
      chatModel: 'microsoft/DialoGPT-large',
      questionAnswering: 'deepset/roberta-base-squad2',
      textClassification: 'cardiffnlp/twitter-roberta-base-sentiment-latest',
      summarization: 'facebook/bart-large-cnn'
    };
    
    // Configuration
    this.config = {
      useGeminiPrimary: !!this.gemini,
      maxRetries: 2,
      requestTimeout: 30000
    };
    
    console.log(`AI Service initialized - Primary: ${this.config.useGeminiPrimary ? 'Gemini' : 'Hugging Face'}`);
  }

  /**
   * Generate interview questions based on step and previous responses
   */
  async generateInterviewQuestions(step, previousResponses = {}, userProfile = {}) {
    const prompt = this.buildInterviewPrompt(step, previousResponses, userProfile);
    
    // Try Gemini first, then Hugging Face fallback
    let result = await this.tryGeminiFirst(
      () => this.generateWithGemini(prompt, {
        temperature: 0.7,
        maxOutputTokens: 300,
        topP: 0.9
      }),
      () => this.generateWithHuggingFace(prompt, {
        max_new_tokens: 300,
        temperature: 0.7,
        top_p: 0.9
      })
    );
    
    if (result) {
      return this.parseInterviewQuestions(result);
    }
    
    // Ultimate fallback to predefined questions
    return this.getFallbackQuestions(step);
  }

  /**
   * Analyze interview responses and extract insights
   */
  async analyzeInterviewResponses(step, responses, allResponses = {}) {
    const prompt = this.buildAnalysisPrompt(step, responses, allResponses);
    
    let result = await this.tryGeminiFirst(
      () => this.generateWithGemini(prompt, {
        temperature: 0.3,
        maxOutputTokens: 400,
        topP: 0.8
      }),
      () => this.generateWithHuggingFace(prompt, {
        max_new_tokens: 400,
        temperature: 0.3,
        top_p: 0.8
      })
    );
    
    if (result) {
      return this.parseAnalysisResponse(result);
    }
    
    // Fallback analysis
    return this.getFallbackAnalysis(step, responses);
  }

  /**
   * Generate personalized career recommendations
   */
  async generateRecommendations(userData, focusArea = null) {
    const prompt = this.buildRecommendationsPrompt(userData, focusArea);
    
    let result = await this.tryGeminiFirst(
      () => this.generateWithGemini(prompt, {
        temperature: 0.4,
        maxOutputTokens: 600,
        topP: 0.85
      }),
      () => this.generateWithHuggingFace(prompt, {
        max_new_tokens: 600,
        temperature: 0.4,
        top_p: 0.85
      })
    );
    
    if (result) {
      return this.parseRecommendations(result);
    }
    
    // Fallback recommendations
    return this.getFallbackRecommendations(userData, focusArea);
  }

  /**
   * Generate mentorship answers
   */
  async generateMentorshipAnswer(question, category = 'general', userContext = {}) {
    const prompt = this.buildMentorshipPrompt(question, category, userContext);
    
    let result = await this.tryGeminiFirst(
      () => this.generateWithGemini(prompt, {
        temperature: 0.6,
        maxOutputTokens: 400,
        topP: 0.9
      }),
      () => this.generateWithHuggingFace(prompt, {
        max_new_tokens: 400,
        temperature: 0.6,
        top_p: 0.9
      })
    );
    
    if (result) {
      return this.formatMentorshipAnswer(result);
    }
    
    // Fallback answer
    return this.getFallbackMentorshipAnswer(question, category);
  }

  /**
   * Analyze resume text and extract structured data
   */
  async analyzeResumeText(resumeText, userProfile = {}) {
    const prompt = this.buildResumeAnalysisPrompt(resumeText, userProfile);
    
    let result = await this.tryGeminiFirst(
      () => this.generateWithGemini(prompt, {
        temperature: 0.2,
        maxOutputTokens: 500,
        topP: 0.7
      }),
      () => this.generateWithHuggingFace(prompt, {
        max_new_tokens: 500,
        temperature: 0.2,
        top_p: 0.7
      })
    );
    
    if (result) {
      return this.parseResumeData(result);
    }
    
    // Fallback parsing
    return this.getFallbackResumeData(resumeText);
  }

  // === AI SERVICE METHODS ===
  
  /**
   * Try Gemini first, fallback to Hugging Face
   */
  async tryGeminiFirst(geminiFunction, hfFunction) {
    const cacheKey = undefined;
    if (this.config.useGeminiPrimary && this.gemini) {
      try {
        console.log('Attempting Gemini API call...');
        return await geminiFunction();
      } catch (error) {
        console.warn('Gemini API failed, falling back to Hugging Face:', error.message);
        
        // Try Hugging Face fallback
        if (this.hf) {
          try {
            return await hfFunction();
          } catch (hfError) {
            console.error('Both Gemini and Hugging Face failed:', hfError.message);
          }
        }
      }
    } else if (this.hf) {
      // Use Hugging Face as primary if Gemini not available
      try {
        return await hfFunction();
      } catch (error) {
        console.error('Hugging Face API failed:', error.message);
      }
    }
    
    return null;
  }
  
  /**
   * Generate text using Gemini API
   */
  async generateWithGemini(prompt, options = {}) {
    if (!this.gemini) {
      throw new Error('Gemini not initialized');
    }
    
    const model = this.gemini.getGenerativeModel({ 
      model: this.geminiModels.flash,
      generationConfig: {
        temperature: options.temperature || 0.7,
        maxOutputTokens: options.maxOutputTokens || 1000,
        topP: options.topP || 0.8,
        topK: options.topK || 40
      }
    });
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  }
  
  /**
   * Generate text using Hugging Face API
   */
  async generateWithHuggingFace(prompt, options = {}) {
    if (!this.hf) {
      throw new Error('Hugging Face not initialized');
    }
    
    const response = await this.hf.textGeneration({
      model: this.hfModels.textGeneration,
      inputs: prompt,
      parameters: {
        max_new_tokens: options.max_new_tokens || 1000,
        temperature: options.temperature || 0.7,
        top_p: options.top_p || 0.8,
        return_full_text: false
      }
    });
    
    return response.generated_text || response;
  }

  // === PROMPT BUILDERS ===

  buildInterviewPrompt(step, previousResponses, userProfile) {
    const stepNames = {
      1: 'Background & Education',
      2: 'Technical Skills & Experience', 
      3: 'Interests & Passions',
      4: 'Career Goals & Aspirations',
      5: 'Constraints & Preferences'
    };

    const context = Object.keys(previousResponses).length > 0 ? 
      `Previous responses context: ${JSON.stringify(previousResponses, null, 2)}` : 
      'This is the first step of the interview.';

    return `<s>[INST] You are an experienced career counselor conducting a personalized AI interview.

Step ${step}/5: ${stepNames[step]}
${context}

Generate exactly 3 thoughtful interview questions for this step. Make them:
- Open-ended and conversational
- Specific to ${stepNames[step]}
- Personalized based on context

Respond with only a JSON array:
["Question 1", "Question 2", "Question 3"] [/INST]`;
  }

  buildAnalysisPrompt(step, responses, allResponses) {
    return `<s>[INST] Analyze these interview responses and extract career insights.

Step ${step} Responses: ${JSON.stringify(responses)}

Return a JSON object with extracted tags, insights, summary, and career direction suggestions.

Focus on skills, interests, goals, and work preferences.

Respond with only valid JSON. [/INST]`;
  }

  buildRecommendationsPrompt(userData, focusArea) {
    const { profile, interviews = [], skills = [], interests = [] } = userData;
    
    return `You are an AI career advisor generating personalized recommendations.

User Data:
- Profile: ${JSON.stringify(profile)}
- Latest Interview: ${JSON.stringify(interviews[0])}
- Current Skills: ${JSON.stringify(skills)}
- Interests: ${JSON.stringify(interests)}
- Focus Area: ${focusArea || 'general'}

Generate 5-8 personalized recommendations covering:
1. Skill development (2-3 recommendations)
2. Course suggestions (1-2 recommendations)
3. Career path exploration (1-2 recommendations)
4. Project ideas (1 recommendation)
5. Networking opportunities (1 recommendation)

Return JSON array:
[
  {
    "type": "skill|course|career_path|project|networking",
    "title": "Clear, actionable title",
    "description": "Detailed description explaining why this is recommended",
    "priority": "high|medium|low",
    "metadata": {
      "estimatedTime": "time to complete",
      "difficulty": "beginner|intermediate|advanced",
      "suggestedPlatforms": ["platform1", "platform2"],
      "requiredSkills": ["skill1", "skill2"],
      "careerImpact": "expected impact on career growth"
    }
  }
]

Make recommendations specific, actionable, and directly relevant to the user's profile.
Only return valid JSON, no additional text.`;
  }

  buildMentorshipPrompt(question, category, userContext) {
    return `<s>[INST] You are a career mentor. Answer this ${category} question with helpful, actionable advice.

Question: "${question.question || question}"

Provide:
- Direct answer to the question
- 2-3 practical advice points
- Specific next steps
- Encouraging tone

Keep it 200-400 words. [/INST]`;
  }

  buildResumeAnalysisPrompt(resumeText, userProfile) {
    return `Extract structured information from this resume text:

Resume Text:
${resumeText}

User Profile Context: ${JSON.stringify(userProfile)}

Extract and return JSON:
{
  "personalInfo": {
    "name": "extracted name",
    "email": "extracted email",
    "phone": "extracted phone"
  },
  "skills": ["skill1", "skill2", ...], // technical and soft skills
  "experience": [
    {
      "title": "job title",
      "company": "company name",
      "duration": "time period",
      "description": "key responsibilities and achievements"
    }
  ],
  "education": [
    {
      "degree": "degree type",
      "institution": "school name",
      "year": "graduation year",
      "field": "field of study"
    }
  ],
  "certifications": ["cert1", "cert2", ...],
  "languages": ["language1", "language2", ...],
  "summary": "professional summary",
  "careerLevel": "entry|mid|senior|executive",
  "industryFocus": ["industry1", "industry2"],
  "extractionConfidence": 0.85
}

Extract as much relevant information as possible. For missing information, use null.
Only return valid JSON, no additional text.`;
  }

  // === RESPONSE PARSERS ===

  parseInterviewQuestions(aiResponse) {
    try {
      // Try to parse as JSON first
      const parsed = JSON.parse(aiResponse);
      if (Array.isArray(parsed) && parsed.length === 3) {
        return parsed;
      }
    } catch (e) {
      // If JSON parsing fails, try to extract questions manually
      const lines = aiResponse.split('\n').filter(line => line.trim().length > 0);
      const questions = lines.slice(0, 3).map(line => line.replace(/^\d+\.\s*/, '').replace(/^["']|["']$/g, '').trim());
      if (questions.length >= 2) {
        return questions.slice(0, 3);
      }
    }
    
    // Fallback to default questions
    return this.getFallbackQuestions(1);
  }

  parseAnalysisResponse(aiResponse) {
    try {
      return JSON.parse(aiResponse);
    } catch (e) {
      // Fallback parsing
      const tags = aiResponse.match(/\b[a-zA-Z]{4,}\b/g) || [];
      return {
        extractedTags: [...new Set(tags)].slice(0, 10),
        insights: [{
          category: 'general',
          insight: 'Analysis completed successfully',
          confidence: 0.7
        }],
        summary: 'Interview step completed',
        careerDirection: 'Continue exploring options'
      };
    }
  }

  parseRecommendations(aiResponse) {
    try {
      const parsed = JSON.parse(aiResponse);
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch (e) {
      return this.getFallbackRecommendations({}, 'general');
    }
  }

  formatMentorshipAnswer(aiResponse) {
    // Clean and format the AI response
    return aiResponse.trim().replace(/^["']|["']$/g, '');
  }

  parseResumeData(aiResponse) {
    try {
      return JSON.parse(aiResponse);
    } catch (e) {
      return {
        personalInfo: { name: null, email: null, phone: null },
        skills: [],
        experience: [],
        education: [],
        certifications: [],
        languages: [],
        summary: 'Unable to parse resume',
        careerLevel: 'unknown',
        industryFocus: [],
        extractionConfidence: 0.1
      };
    }
  }

  // === FALLBACK METHODS ===

  getFallbackQuestions(step) {
    const fallbackQuestions = {
      1: [
        "Tell me about your educational background and any degrees or certifications you have.",
        "What field of study did you focus on, and what initially drew you to it?",
        "Describe any significant projects or achievements during your education."
      ],
      2: [
        "What technical skills do you currently possess, and how proficient would you rate yourself?",
        "Describe your work experience and the roles you've held so far.",
        "What tools, technologies, or methodologies are you most comfortable working with?"
      ],
      3: [
        "What activities or subjects genuinely excite you and make you lose track of time?",
        "Are there any industries or problem areas you're particularly passionate about?",
        "What kind of work environment and culture do you thrive in?"
      ],
      4: [
        "Where do you see yourself professionally in the next 3-5 years?",
        "What type of impact or contribution would you like to make in your career?",
        "Are there specific roles, companies, or industries you're targeting?"
      ],
      5: [
        "What are your constraints regarding location, work schedule, or travel?",
        "What's your preferred learning style and how do you like to acquire new skills?",
        "Are there any deal-breakers or absolute requirements for your next role?"
      ]
    };

    return fallbackQuestions[step] || fallbackQuestions[1];
  }

  getFallbackAnalysis(step, responses) {
    return {
      extractedTags: ['communication', 'problem-solving', 'teamwork'],
      insights: [{
        category: 'general',
        insight: 'User provided thoughtful responses indicating career interest',
        confidence: 0.6
      }],
      summary: `Step ${step} completed successfully`,
      careerDirection: 'Exploring multiple career paths'
    };
  }

  getFallbackRecommendations(userData, focusArea) {
    return [
      {
        type: 'skill',
        title: 'Improve Communication Skills',
        description: 'Strong communication skills are valuable in any career path.',
        priority: 'high',
        metadata: {
          estimatedTime: '4-6 weeks',
          difficulty: 'beginner',
          suggestedPlatforms: ['Coursera', 'LinkedIn Learning'],
          requiredSkills: [],
          careerImpact: 'High - applicable to all roles'
        }
      },
      {
        type: 'course',
        title: 'Career Development Fundamentals',
        description: 'Learn essential career planning and development strategies.',
        priority: 'medium',
        metadata: {
          estimatedTime: '8 weeks',
          difficulty: 'beginner',
          suggestedPlatforms: ['edX', 'Udemy'],
          requiredSkills: [],
          careerImpact: 'Medium - foundational knowledge'
        }
      }
    ];
  }

  getFallbackMentorshipAnswer(question, category) {
    return `Thank you for your ${category} question. While I'd love to provide personalized advice, I recommend discussing this with a human mentor for the most relevant guidance. In the meantime, consider researching best practices in this area and connecting with professionals in your field of interest.`;
  }

  getFallbackResumeData(resumeText) {
    return {
      personalInfo: { name: null, email: null, phone: null },
      skills: [],
      experience: [],
      education: [],
      certifications: [],
      languages: [],
      summary: 'Resume processing temporarily unavailable',
      careerLevel: 'unknown',
      industryFocus: [],
      extractionConfidence: 0.0
    };
  }
}

// Export singleton instance
module.exports = new AIService();