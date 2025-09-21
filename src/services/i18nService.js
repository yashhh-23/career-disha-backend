const { GoogleGenerativeAI } = require('@google/generative-ai');

class I18nService {
  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-pro' });
    this.supportedLanguages = [
      'en', 'hi', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'ja', 'ko', 'zh', 'ar'
    ];
    this.cache = new Map(); // Simple in-memory cache
  }

  async detectLanguage(text) {
    try {
      const prompt = `Detect the language of this text and return only the ISO 639-1 language code (e.g., 'en', 'hi', 'es'): "${text}"`;
      const result = await this.model.generateContent(prompt);
      const detected = result.response.text().trim().toLowerCase();
      
      return this.supportedLanguages.includes(detected) ? detected : 'en';
    } catch (error) {
      console.error('Language detection error:', error);
      return 'en'; // Default to English
    }
  }

  async translateText(text, targetLanguage = 'en', sourceLanguage = null) {
    if (!text || typeof text !== 'string') return text;
    
    // Check cache first
    const cacheKey = `${sourceLanguage || 'auto'}-${targetLanguage}-${text}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    try {
      // Detect source language if not provided
      if (!sourceLanguage) {
        sourceLanguage = await this.detectLanguage(text);
      }

      // Skip translation if source and target are the same
      if (sourceLanguage === targetLanguage) {
        this.cache.set(cacheKey, text);
        return text;
      }

      const prompt = `Translate the following text from ${sourceLanguage} to ${targetLanguage}. 
      Return only the translated text without any explanations or additional text: "${text}"`;
      
      const result = await this.model.generateContent(prompt);
      const translated = result.response.text().trim();
      
      // Cache the result
      this.cache.set(cacheKey, translated);
      
      return translated;
    } catch (error) {
      console.error('Translation error:', error);
      return text; // Return original text on error
    }
  }

  async translateInterviewQuestions(questions, targetLanguage = 'en') {
    if (!Array.isArray(questions)) return questions;
    
    const translatedQuestions = [];
    
    for (const question of questions) {
      try {
        const translatedText = await this.translateText(question.text || question, targetLanguage);
        translatedQuestions.push({
          ...question,
          text: translatedText,
          originalLanguage: await this.detectLanguage(question.text || question),
          targetLanguage
        });
      } catch (error) {
        console.error('Question translation error:', error);
        translatedQuestions.push(question);
      }
    }
    
    return translatedQuestions;
  }

  async translateRecommendations(recommendations, targetLanguage = 'en') {
    if (!Array.isArray(recommendations)) return recommendations;
    
    const translatedRecommendations = [];
    
    for (const rec of recommendations) {
      try {
        const translatedTitle = await this.translateText(rec.title, targetLanguage);
        const translatedDescription = rec.description ? 
          await this.translateText(rec.description, targetLanguage) : rec.description;
        
        translatedRecommendations.push({
          ...rec,
          title: translatedTitle,
          description: translatedDescription,
          originalLanguage: await this.detectLanguage(rec.title),
          targetLanguage
        });
      } catch (error) {
        console.error('Recommendation translation error:', error);
        translatedRecommendations.push(rec);
      }
    }
    
    return translatedRecommendations;
  }

  async translateMentorshipResponse(response, targetLanguage = 'en') {
    if (!response || typeof response !== 'string') return response;
    
    try {
      const translatedResponse = await this.translateText(response, targetLanguage);
      return {
        original: response,
        translated: translatedResponse,
        originalLanguage: await this.detectLanguage(response),
        targetLanguage
      };
    } catch (error) {
      console.error('Mentorship response translation error:', error);
      return response;
    }
  }

  // Utility method to get language name from code
  getLanguageName(code) {
    const languageNames = {
      'en': 'English',
      'hi': 'Hindi',
      'es': 'Spanish',
      'fr': 'French',
      'de': 'German',
      'it': 'Italian',
      'pt': 'Portuguese',
      'ru': 'Russian',
      'ja': 'Japanese',
      'ko': 'Korean',
      'zh': 'Chinese',
      'ar': 'Arabic'
    };
    return languageNames[code] || 'Unknown';
  }

  // Clear cache (useful for testing or memory management)
  clearCache() {
    this.cache.clear();
  }

  // Get cache stats
  getCacheStats() {
    return {
      size: this.cache.size,
      maxSize: 1000 // Configurable limit
    };
  }
}

module.exports = new I18nService();
