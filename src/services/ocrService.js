const { createWorker } = require('tesseract.js');
const pdfParse = require('pdf-parse');
const sharp = require('sharp');
const fs = require('fs').promises;
const path = require('path');
const aiService = require('./aiService');

class OCRService {
  constructor() {
    this.worker = null;
  }

  async initializeWorker() {
    if (!this.worker) {
      this.worker = await createWorker('eng');
      console.log('OCR Worker initialized');
    }
    return this.worker;
  }

  async processResume(filePath, userProfile = {}) {
    try {
      console.log(`Processing resume: ${filePath}`);
      
      const fileExt = path.extname(filePath).toLowerCase();
      let extractedText = '';

      // Extract text based on file type
      if (fileExt === '.pdf') {
        extractedText = await this.extractTextFromPDF(filePath);
      } else if (['.jpg', '.jpeg', '.png'].includes(fileExt)) {
        extractedText = await this.extractTextFromImage(filePath);
      } else {
        throw new Error('Unsupported file format');
      }

      console.log(`Extracted ${extractedText.length} characters from resume`);

      // Validate and enhance with AI
      const processedData = await this.processWithAI(extractedText, userProfile);

      return {
        success: true,
        extractedText: extractedText,
        processedData: processedData,
        confidence: this.calculateConfidence(extractedText, processedData)
      };

    } catch (error) {
      console.error('OCR Processing Error:', error);
      return {
        success: false,
        error: error.message,
        extractedText: '',
        processedData: null,
        confidence: 0
      };
    }
  }

  async extractTextFromPDF(filePath) {
    try {
      const dataBuffer = await fs.readFile(filePath);
      const data = await pdfParse(dataBuffer);
      return data.text;
    } catch (error) {
      console.error('PDF extraction error:', error);
      throw new Error('Failed to extract text from PDF');
    }
  }

  async extractTextFromImage(filePath) {
    try {
      // Initialize OCR worker if not already done
      const worker = await this.initializeWorker();

      // Preprocess image for better OCR results
      const processedImagePath = await this.preprocessImage(filePath);

      // Perform OCR
      const { data: { text } } = await worker.recognize(processedImagePath);

      // Clean up processed image
      try {
        await fs.unlink(processedImagePath);
      } catch (cleanupError) {
        console.warn('Failed to cleanup processed image:', cleanupError);
      }

      return text;
    } catch (error) {
      console.error('Image OCR error:', error);
      throw new Error('Failed to extract text from image');
    }
  }

  async preprocessImage(filePath) {
    try {
      const processedPath = filePath.replace(/\.[^.]+$/, '_processed.png');

      await sharp(filePath)
        .greyscale()
        .normalize()
        .sharpen()
        .png()
        .toFile(processedPath);

      return processedPath;
    } catch (error) {
      console.error('Image preprocessing error:', error);
      return filePath; // Return original if preprocessing fails
    }
  }

  async processWithAI(extractedText, userProfile) {
    try {
      // Use AI service to structure the extracted text
      const structuredData = await aiService.analyzeResumeText(extractedText, userProfile);
      
      // Enhance with additional processing
      return {
        ...structuredData,
        rawText: extractedText,
        processedAt: new Date().toISOString(),
        wordCount: extractedText.split(/\s+/).length,
        keywordDensity: this.analyzeKeywordDensity(extractedText)
      };
    } catch (error) {
      console.error('AI processing error:', error);
      // Fallback to basic extraction
      return this.fallbackProcessing(extractedText);
    }
  }

  analyzeKeywordDensity(text) {
    const words = text.toLowerCase().split(/\s+/);
    const totalWords = words.length;
    const wordCounts = {};

    // Common skill keywords to track
    const skillKeywords = [
      'javascript', 'python', 'java', 'react', 'node', 'sql', 'html', 'css',
      'programming', 'development', 'software', 'web', 'mobile', 'data',
      'machine learning', 'ai', 'artificial intelligence', 'cloud', 'aws',
      'project management', 'leadership', 'communication', 'teamwork'
    ];

    skillKeywords.forEach(keyword => {
      const count = (text.toLowerCase().match(new RegExp(keyword, 'g')) || []).length;
      if (count > 0) {
        wordCounts[keyword] = {
          count: count,
          density: (count / totalWords) * 100
        };
      }
    });

    return wordCounts;
  }

  fallbackProcessing(extractedText) {
    // Basic extraction without AI
    const lines = extractedText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const phoneRegex = /(\+?\d{1,4}[-.\s]?)?\(?\d{1,4}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,4}[-.\s]?\d{0,9}/g;
    
    return {
      personalInfo: {
        name: this.extractName(lines),
        email: (extractedText.match(emailRegex) || [])[0] || null,
        phone: (extractedText.match(phoneRegex) || [])[0] || null
      },
      skills: this.extractSkills(extractedText),
      experience: this.extractExperience(lines),
      education: this.extractEducation(lines),
      certifications: [],
      languages: [],
      summary: lines.slice(0, 5).join(' ').substring(0, 200),
      careerLevel: this.estimateCareerLevel(extractedText),
      industryFocus: [],
      extractionConfidence: 0.6
    };
  }

  extractName(lines) {
    // Look for name in first few lines
    for (let i = 0; i < Math.min(5, lines.length); i++) {
      const line = lines[i];
      // Simple heuristic: name is likely a short line with 2-4 words, no special chars
      if (line.length < 50 && 
          line.split(' ').length >= 2 && 
          line.split(' ').length <= 4 &&
          !/[@#$%^&*(),.?":{}|<>]/.test(line) &&
          !line.toLowerCase().includes('resume')) {
        return line;
      }
    }
    return null;
  }

  extractSkills(text) {
    const skillKeywords = [
      'JavaScript', 'Python', 'Java', 'C++', 'React', 'Angular', 'Vue', 'Node.js',
      'HTML', 'CSS', 'SQL', 'MongoDB', 'PostgreSQL', 'AWS', 'Docker', 'Git',
      'Machine Learning', 'Data Analysis', 'Project Management', 'Leadership'
    ];

    const foundSkills = [];
    const lowerText = text.toLowerCase();

    skillKeywords.forEach(skill => {
      if (lowerText.includes(skill.toLowerCase())) {
        foundSkills.push(skill);
      }
    });

    return [...new Set(foundSkills)]; // Remove duplicates
  }

  extractExperience(lines) {
    const experience = [];
    const experienceKeywords = ['experience', 'work', 'employment', 'career', 'position'];
    
    let inExperienceSection = false;
    let currentJob = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].toLowerCase();
      
      // Check if we're entering experience section
      if (experienceKeywords.some(keyword => line.includes(keyword))) {
        inExperienceSection = true;
        continue;
      }

      // If we're in experience section, try to parse jobs
      if (inExperienceSection && lines[i].length > 10) {
        // Simple heuristic for job entries
        if (this.looksLikeJobTitle(lines[i])) {
          if (currentJob) {
            experience.push(currentJob);
          }
          currentJob = {
            title: lines[i],
            company: lines[i + 1] || 'Unknown',
            duration: lines[i + 2] || 'Unknown',
            description: lines.slice(i + 3, i + 6).join(' ')
          };
        }
      }
    }

    if (currentJob) {
      experience.push(currentJob);
    }

    return experience.slice(0, 5); // Limit to 5 jobs
  }

  extractEducation(lines) {
    const education = [];
    const educationKeywords = ['education', 'degree', 'university', 'college', 'bachelor', 'master', 'phd'];
    
    let inEducationSection = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].toLowerCase();
      
      if (educationKeywords.some(keyword => line.includes(keyword))) {
        inEducationSection = true;
        
        // Try to extract degree info
        if (line.includes('bachelor') || line.includes('master') || line.includes('phd')) {
          education.push({
            degree: lines[i],
            institution: lines[i + 1] || 'Unknown',
            year: this.extractYear(lines[i] + ' ' + (lines[i + 1] || '')),
            field: 'Unknown'
          });
        }
      }
    }

    return education.slice(0, 3); // Limit to 3 degrees
  }

  extractYear(text) {
    const yearMatch = text.match(/\b(19|20)\d{2}\b/);
    return yearMatch ? yearMatch[0] : 'Unknown';
  }

  looksLikeJobTitle(line) {
    const jobWords = ['engineer', 'developer', 'manager', 'analyst', 'consultant', 'specialist', 'coordinator', 'director'];
    const lowerLine = line.toLowerCase();
    return jobWords.some(word => lowerLine.includes(word)) && line.length < 100;
  }

  estimateCareerLevel(text) {
    const seniorKeywords = ['senior', 'lead', 'principal', 'manager', 'director', 'vp', 'cto', 'ceo'];
    const entryKeywords = ['intern', 'junior', 'entry', 'graduate', 'trainee'];
    
    const lowerText = text.toLowerCase();
    
    if (seniorKeywords.some(keyword => lowerText.includes(keyword))) {
      return 'senior';
    } else if (entryKeywords.some(keyword => lowerText.includes(keyword))) {
      return 'entry';
    } else {
      return 'mid';
    }
  }

  calculateConfidence(extractedText, processedData) {
    let confidence = 0.5; // Base confidence

    // Increase confidence based on successful extractions
    if (processedData?.personalInfo?.name) confidence += 0.1;
    if (processedData?.personalInfo?.email) confidence += 0.1;
    if (processedData?.skills?.length > 0) confidence += 0.1;
    if (processedData?.experience?.length > 0) confidence += 0.1;
    if (processedData?.education?.length > 0) confidence += 0.1;

    // Adjust based on text quality
    if (extractedText.length > 500) confidence += 0.05;
    if (extractedText.length > 1000) confidence += 0.05;

    return Math.min(confidence, 1.0); // Cap at 100%
  }

  async cleanup() {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
      console.log('OCR Worker terminated');
    }
  }
}

// Export singleton instance
module.exports = new OCRService();