const axios = require('axios');
const { getRedisClient } = require('../config/redis');

class ExternalApiService {
  constructor() {
    this.courseProviders = {
      coursera: {
        baseUrl: 'https://api.coursera.org/api/courses.v1',
        apiKey: process.env.COURSERA_API_KEY,
        rateLimit: 100, // requests per hour
        lastRequest: 0
      },
      udemy: {
        baseUrl: 'https://www.udemy.com/api-2.0',
        clientId: process.env.UDEMY_CLIENT_ID,
        clientSecret: process.env.UDEMY_CLIENT_SECRET,
        rateLimit: 200,
        lastRequest: 0
      },
      edx: {
        baseUrl: 'https://api.edx.org/courses/v1',
        apiKey: process.env.EDX_API_KEY,
        rateLimit: 1000,
        lastRequest: 0
      },
      nptel: {
        baseUrl: 'https://nptel.ac.in/api',
        rateLimit: 200,
        lastRequest: 0
      }
    };

    this.jobProviders = {
      indeed: {
        baseUrl: 'https://api.indeed.com',
        apiKey: process.env.INDEED_API_KEY,
        rateLimit: 10000,
        lastRequest: 0
      },
      github: {
        baseUrl: 'https://jobs.github.com/positions.json',
        rateLimit: 60,
        lastRequest: 0
      },
      adzuna: {
        baseUrl: 'https://api.adzuna.com/v1/api/jobs',
        appId: process.env.ADZUNA_APP_ID,
        appKey: process.env.ADZUNA_APP_KEY,
        country: 'gb',
        rateLimit: 1000,
        lastRequest: 0
      }
    };

    // In-memory cache + optional Redis
    this.cache = new Map();
    this.cacheTimeout = 60 * 60 * 1000; // 1 hour
    this.redis = getRedisClient();

    console.log('📡 External API Service initialized');
  }

  // === COURSE PROVIDER METHODS ===

  /**
   * Search courses across multiple platforms
   */
  async searchCourses(query, options = {}) {
    try {
      const { 
        providers = ['coursera', 'udemy', 'edx'], 
        limit = 20,
        skillLevel = 'all',
        language = 'en'
      } = options;

      const cacheKey = `courses:${query}:${JSON.stringify(options)}`;
      
      // Check cache first
      const cached = await this.getCached(cacheKey);
      if (cached) return cached;

      const courseResults = [];
      
      for (const provider of providers) {
        try {
          let courses;
          switch (provider) {
            case 'coursera':
              courses = await this.searchCoursera(query, { limit: Math.ceil(limit / providers.length) });
              break;
            case 'udemy':
              courses = await this.searchUdemy(query, { limit: Math.ceil(limit / providers.length), skillLevel });
              break;
            case 'edx':
              courses = await this.searchEdX(query, { limit: Math.ceil(limit / providers.length) });
              break;
            default:
              continue;
          }
          courseResults.push(...courses);
        } catch (error) {
          console.warn(`${provider} API error:`, error.message);
          // Continue with other providers
        }
      }

      // Normalize and rank courses
      const normalizedCourses = this.normalizeCourseData(courseResults);
      const rankedCourses = this.rankCourses(normalizedCourses, query);

      // Cache results
      await this.setCached(cacheKey, rankedCourses.slice(0, limit), 3600);

      return rankedCourses.slice(0, limit);

    } catch (error) {
      console.error('Course search error:', error);
      return this.getFallbackCourses(query);
    }
  }

  /**
   * Get course recommendations based on skills
   */
  async getCourseRecommendations(skills, userLevel = 'intermediate') {
    try {
      const recommendations = [];

      for (const skill of skills.slice(0, 5)) { // Limit to 5 skills to avoid rate limits
        const courses = await this.searchCourses(skill, {
          limit: 3,
          skillLevel: userLevel
        });
        
        recommendations.push({
          skill: skill,
          courses: courses.map(course => ({
            ...course,
            relevanceScore: this.calculateRelevanceScore(course, skill),
            recommendedFor: skill
          }))
        });
      }

      return recommendations;

    } catch (error) {
      console.error('Course recommendations error:', error);
      return this.getFallbackCourseRecommendations(skills);
    }
  }

  // === JOB MARKET METHODS ===

  /**
   * Get job market trends for skills
   */
  async getJobMarketTrends(skills) {
    try {
      const cacheKey = `job-trends:${skills.join(',')}`;
      
      const cached = await this.getCached(cacheKey);
      if (cached) return cached;

      const trends = [];

      for (const skill of skills.slice(0, 10)) {
        try {
          const jobs = await this.searchJobs(skill, { limit: 50 });
          
          const trend = {
            skill: skill,
            demand: this.calculateDemand(jobs),
            averageSalary: this.calculateAverageSalary(jobs),
            topLocations: this.getTopLocations(jobs),
            growthRate: this.estimateGrowthRate(skill),
            requiredSkills: this.extractRequiredSkills(jobs),
            jobCount: jobs.length
          };

          trends.push(trend);
        } catch (error) {
          console.warn(`Job trend error for ${skill}:`, error.message);
        }
      }

      await this.setCached(cacheKey, trends, 3600);
      return trends;

    } catch (error) {
      console.error('Job market trends error:', error);
      return this.getFallbackJobTrends(skills);
    }
  }

  /**
   * Search jobs across platforms
   */
  async searchJobs(query, options = {}) {
    try {
      const { limit = 25, location = '', remote = false, country = 'gb' } = options;
      const jobs = [];

      // GitHub Jobs (until it was deprecated - using as example)
      if (this.canMakeRequest('github')) {
        try {
          const githubJobs = await this.searchGitHubJobs(query, { limit: Math.ceil(limit / 2) });
          jobs.push(...githubJobs);
        } catch (error) {
          console.warn('GitHub jobs error:', error.message);
        }
      }

      // Adzuna (real public API with app id/key)
      if (this.canMakeRequest('adzuna') && this.jobProviders.adzuna.appId && this.jobProviders.adzuna.appKey) {
        try {
          const adzunaJobs = await this.searchAdzunaJobs(query, { limit: Math.ceil(limit / 2), location, remote, country });
          jobs.push(...adzunaJobs);
        } catch (error) {
          console.warn('Adzuna jobs error:', error.message);
        }
      }

      // Mock data for demonstration (replace with real APIs)
      const mockJobs = this.generateMockJobs(query, limit);
      jobs.push(...mockJobs);

      return jobs.slice(0, limit);

    } catch (error) {
      console.error('Job search error:', error);
      return [];
    }
  }

  // === PROVIDER-SPECIFIC METHODS ===

  async searchCoursera(query, options = {}) {
    if (!this.canMakeRequest('coursera')) {
      throw new Error('Coursera rate limit exceeded');
    }

    const { limit = 10 } = options;
    try {
      if (!this.courseProviders.coursera.apiKey) {
        return this.mockCourseraResponse(query, limit);
      }
      this.updateLastRequest('coursera');
      const resp = await axios.get(`${this.courseProviders.coursera.baseUrl}`, {
        params: {
          q: 'search',
          query: query,
          limit: limit
        },
        headers: {
          'X-Coursera-API-Key': this.courseProviders.coursera.apiKey
        },
        timeout: 8000
      });
      const items = (resp.data?.elements || []).map((c) => ({
        id: `coursera_${c.id}`,
        title: c.name,
        description: c.description || '',
        provider: 'coursera',
        instructor: (c.partnerIds || [])[0] || 'Coursera',
        duration: c.duration || null,
        level: c.level || 'all',
        rating: c.rating || null,
        enrollments: c.enrollments || 0,
        price: c.price || 0,
        url: `https://www.coursera.org/learn/${c.slug || c.id}`,
        skills: c.skills || [],
        certificate: true
      }));
      return items.slice(0, limit);
    } catch (err) {
      return this.mockCourseraResponse(query, limit);
    }
  }

  async searchUdemy(query, options = {}) {
    if (!this.canMakeRequest('udemy')) {
      throw new Error('Udemy rate limit exceeded');
    }

    const { limit = 10, skillLevel = 'all' } = options;
    try {
      if (!this.courseProviders.udemy.clientId || !this.courseProviders.udemy.clientSecret) {
        return this.mockUdemyResponse(query, limit, skillLevel);
      }
      this.updateLastRequest('udemy');
      const resp = await axios.get(`${this.courseProviders.udemy.baseUrl}/courses/`, {
        params: {
          search: query,
          page_size: Math.min(50, limit)
        },
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Authorization': `Basic ${Buffer.from(`${this.courseProviders.udemy.clientId}:${this.courseProviders.udemy.clientSecret}`).toString('base64')}`
        },
        timeout: 8000
      });
      const items = (resp.data?.results || []).map((c) => ({
        id: `udemy_${c.id}`,
        title: c.title,
        description: c.headline || '',
        provider: 'udemy',
        instructor: (c.visible_instructors?.[0]?.title) || 'Udemy Instructor',
        duration: `${c.content_info || ''}`,
        level: c.instructional_level_simple || skillLevel,
        rating: c.rating || c.avg_rating_recent || null,
        enrollments: c.num_subscribers || 0,
        price: c.price_detail?.amount || null,
        url: `https://www.udemy.com${c.url}`,
        skills: [],
        certificate: true
      }));
      return items.slice(0, limit);
    } catch (err) {
      return this.mockUdemyResponse(query, limit, skillLevel);
    }
  }

  async searchEdX(query, options = {}) {
    if (!this.canMakeRequest('edx')) {
      throw new Error('EdX rate limit exceeded');
    }

    const { limit = 10 } = options;
    try {
      this.updateLastRequest('edx');
      // Public catalog search varies; keep mock unless EDX_API_KEY provided
      if (!this.courseProviders.edx.apiKey) {
        return this.mockEdXResponse(query, limit);
      }
      const resp = await axios.get(`${this.courseProviders.edx.baseUrl}/courses/`, {
        params: { search: query, page_size: Math.min(50, limit) },
        headers: { 'Authorization': `Bearer ${this.courseProviders.edx.apiKey}` },
        timeout: 8000
      });
      const items = (resp.data?.results || []).map((c) => ({
        id: `edx_${c.uuid || c.key}`,
        title: c.title,
        description: c.short_description || '',
        provider: 'edx',
        instructor: (c.owners?.[0]?.name) || 'edX',
        duration: c.weeks_to_complete ? `${c.weeks_to_complete} weeks` : null,
        level: c.level_type || 'all',
        rating: null,
        enrollments: null,
        price: null,
        url: c.marketing_url || '',
        skills: [],
        certificate: true
      }));
      return items.slice(0, limit);
    } catch (err) {
      return this.mockEdXResponse(query, limit);
    }
  }

  async searchNPTEL(query, options = {}) {
    if (!this.canMakeRequest('nptel')) {
      throw new Error('NPTEL rate limit exceeded');
    }
    const { limit = 10 } = options;
    try {
      this.updateLastRequest('nptel');
      // NPTEL does not have a stable public API; use a lightweight fallback
      return [
        {
          id: `nptel_${query}_1`,
          title: `${query} by NPTEL`,
          description: `NPTEL course for ${query}`,
          provider: 'nptel',
          instructor: 'NPTEL Faculty',
          duration: null,
          level: 'all',
          rating: null,
          enrollments: null,
          price: 0,
          url: `https://nptel.ac.in/courses/search?query=${encodeURIComponent(query)}`,
          skills: [query],
          certificate: true
        }
      ].slice(0, limit);
    } catch (err) {
      return [];
    }
  }

  async searchGitHubJobs(query, options = {}) {
    if (!this.canMakeRequest('github')) {
      throw new Error('GitHub rate limit exceeded');
    }

    // Mock GitHub Jobs response
    return this.mockGitHubJobsResponse(query, options.limit);
  }

  async searchAdzunaJobs(query, options = {}) {
    if (!this.canMakeRequest('adzuna')) {
      throw new Error('Adzuna rate limit exceeded');
    }
    const { limit = 10, location = '', remote = false, country = 'gb' } = options;
    try {
      this.updateLastRequest('adzuna');
      const { appId, appKey } = this.jobProviders.adzuna;
      const params = {
        app_id: appId,
        app_key: appKey,
        what: query,
        where: location || undefined,
        results_per_page: Math.min(50, limit),
        content_type: 'application/json',
        distance: 25
      };
      const url = `${this.jobProviders.adzuna.baseUrl}/${country}/search/1`;
      const resp = await axios.get(url, { params, timeout: 8000 });
      const items = (resp.data?.results || []).map(j => ({
        id: `adzuna_${j.id}`,
        title: j.title,
        company: j.company?.display_name || 'Unknown',
        location: j.location?.display_name || (j.location?.area || []).join(', ') || 'Remote',
        remote: remote || /remote/i.test(j.title + ' ' + (j.description || '')),
        salary: normalizeSalary(j.salary_min, j.salary_max, j.salary_is_predicted === '1' ? 'predicted' : 'stated', j.currency),
        description: j.description || '',
        requirements: extractSkillsFromText(j.description || ''),
        posted: j.created ? new Date(j.created) : new Date(),
        url: j.redirect_url
      }));
      return items.slice(0, limit);
    } catch (err) {
      return [];
    }
  }

  // === UTILITY METHODS ===

  canMakeRequest(provider) {
    const providerConfig = this.courseProviders[provider] || this.jobProviders[provider];
    if (!providerConfig) return false;

    const now = Date.now();
    const timeSinceLastRequest = now - providerConfig.lastRequest;
    const minInterval = (60 * 60 * 1000) / providerConfig.rateLimit; // milliseconds between requests

    return timeSinceLastRequest >= minInterval;
  }

  updateLastRequest(provider) {
    const providerConfig = this.courseProviders[provider] || this.jobProviders[provider];
    if (providerConfig) {
      providerConfig.lastRequest = Date.now();
    }
  }

  async getCached(key) {
    // Prefer Redis if available
    try {
      if (this.redis) {
        const val = await this.redis.get(key);
        if (val) return JSON.parse(val);
      }
    } catch (_) {}
    // Fallback memory
    const cached = this.cache.get(key);
    if (cached && (Date.now() - cached.timestamp) < this.cacheTimeout) {
      return cached.data;
    }
    return null;
  }

  async setCached(key, data, ttlSeconds = 3600) {
    // Memory cache
    this.cache.set(key, { data, timestamp: Date.now() });
    // Redis cache
    try {
      if (this.redis) {
        await this.redis.setEx(key, ttlSeconds, JSON.stringify(data));
      }
    } catch (_) {}
  }

  normalizeCourseData(courses) {
    return courses.map(course => ({
      id: course.id,
      title: course.title,
      description: course.description,
      provider: course.provider,
      instructor: course.instructor,
      duration: course.duration,
      level: course.level,
      rating: course.rating,
      enrollments: course.enrollments,
      price: course.price,
      url: course.url,
      skills: course.skills || [],
      language: course.language || 'en',
      certificate: course.certificate || false
    }));
  }

  rankCourses(courses, query) {
    return courses.sort((a, b) => {
      // Ranking factors: relevance, rating, enrollments
      const aScore = this.calculateCourseScore(a, query);
      const bScore = this.calculateCourseScore(b, query);
      return bScore - aScore;
    });
  }

  calculateCourseScore(course, query) {
    let score = 0;
    
    // Title relevance
    if (course.title.toLowerCase().includes(query.toLowerCase())) {
      score += 10;
    }
    
    // Rating weight
    score += (course.rating || 0) * 2;
    
    // Enrollment weight (normalized)
    score += Math.log(course.enrollments || 1) * 0.5;
    
    // Price factor (free courses get bonus)
    if (course.price === 0) {
      score += 5;
    }
    
    return score;
  }

  calculateRelevanceScore(course, skill) {
    let score = 0;
    
    if (course.title.toLowerCase().includes(skill.toLowerCase())) {
      score += 0.8;
    }
    
    if (course.description.toLowerCase().includes(skill.toLowerCase())) {
      score += 0.6;
    }
    
    if (course.skills && course.skills.some(s => s.toLowerCase().includes(skill.toLowerCase()))) {
      score += 0.9;
    }
    
    return Math.min(score, 1.0);
  }

  // === MOCK DATA METHODS (Replace with real API calls) ===

  mockCourseraResponse(query, limit) {
    const mockCourses = [
      {
        id: `coursera_${query}_1`,
        title: `Complete ${query} Course`,
        description: `Learn ${query} from industry experts with hands-on projects`,
        provider: 'coursera',
        instructor: 'Stanford University',
        duration: '6 weeks',
        level: 'intermediate',
        rating: 4.7,
        enrollments: 125000,
        price: 79,
        url: `https://coursera.org/learn/${query.toLowerCase()}`,
        skills: [query, 'problem solving', 'critical thinking'],
        certificate: true
      }
    ];

    return mockCourses.slice(0, limit);
  }

  mockUdemyResponse(query, limit, skillLevel) {
    const mockCourses = [
      {
        id: `udemy_${query}_1`,
        title: `${query} Masterclass: From Beginner to Advanced`,
        description: `Master ${query} with practical examples and real-world projects`,
        provider: 'udemy',
        instructor: 'Tech Expert',
        duration: '12 hours',
        level: skillLevel,
        rating: 4.5,
        enrollments: 89000,
        price: 89.99,
        url: `https://udemy.com/course/${query.toLowerCase()}`,
        skills: [query, 'hands-on learning'],
        certificate: true
      }
    ];

    return mockCourses.slice(0, limit);
  }

  mockEdXResponse(query, limit) {
    const mockCourses = [
      {
        id: `edx_${query}_1`,
        title: `Introduction to ${query}`,
        description: `Comprehensive introduction to ${query} concepts and applications`,
        provider: 'edx',
        instructor: 'MIT',
        duration: '8 weeks',
        level: 'beginner',
        rating: 4.6,
        enrollments: 67000,
        price: 0,
        url: `https://edx.org/course/${query.toLowerCase()}`,
        skills: [query, 'theoretical foundation'],
        certificate: true
      }
    ];

    return mockCourses.slice(0, limit);
  }

  generateMockJobs(query, limit) {
    const mockJobs = [
      {
        id: `job_${query}_1`,
        title: `Senior ${query} Developer`,
        company: 'TechCorp Inc.',
        location: 'San Francisco, CA',
        remote: true,
        salary: { min: 120000, max: 160000, currency: 'USD' },
        description: `We're looking for an experienced ${query} developer...`,
        requirements: [query, 'communication skills', 'teamwork'],
        posted: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 1 week ago
        url: `https://example.com/jobs/${query}-developer`
      }
    ];

    return mockJobs.slice(0, limit);
  }

  mockGitHubJobsResponse(query, limit) {
    return this.generateMockJobs(query, limit);
  }

  // === CALCULATION METHODS ===

  calculateDemand(jobs) {
    // Simple demand calculation based on job count
    if (jobs.length > 100) return 'high';
    if (jobs.length > 50) return 'medium';
    return 'low';
  }

  calculateAverageSalary(jobs) {
    const salaries = jobs
      .filter(job => job.salary && job.salary.min && job.salary.max)
      .map(job => (job.salary.min + job.salary.max) / 2);
    
    if (salaries.length === 0) return null;
    
    return Math.round(salaries.reduce((sum, salary) => sum + salary, 0) / salaries.length);
  }

  getTopLocations(jobs) {
    const locationCounts = {};
    
    jobs.forEach(job => {
      const location = job.location || 'Remote';
      locationCounts[location] = (locationCounts[location] || 0) + 1;
    });
    
    return Object.entries(locationCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([location, count]) => ({ location, count }));
  }

  extractRequiredSkills(jobs) {
    const skillCounts = {};
    
    jobs.forEach(job => {
      if (job.requirements) {
        job.requirements.forEach(skill => {
          const normalizedSkill = skill.toLowerCase();
          skillCounts[normalizedSkill] = (skillCounts[normalizedSkill] || 0) + 1;
        });
      }
    });
    
    return Object.entries(skillCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([skill, count]) => ({ skill, frequency: count }));
  }

  estimateGrowthRate(skill) {
    // Mock growth rate estimation (replace with real data)
    const growthRates = {
      'javascript': 15,
      'python': 20,
      'react': 18,
      'machine learning': 25,
      'cloud computing': 22,
      'data science': 28,
      'cybersecurity': 31,
      'artificial intelligence': 35
    };
    
    return growthRates[skill.toLowerCase()] || 10;
  }

  // === FALLBACK METHODS ===

  getFallbackCourses(query) {
    return [
      {
        id: 'fallback_1',
        title: `Learn ${query} - Free Resources`,
        description: `Collection of free resources to learn ${query}`,
        provider: 'various',
        instructor: 'Community',
        duration: 'self-paced',
        level: 'beginner',
        rating: 4.0,
        price: 0,
        url: `https://freecodecamp.org/learn/${query}`,
        skills: [query]
      }
    ];
  }

  getFallbackCourseRecommendations(skills) {
    return skills.map(skill => ({
      skill,
      courses: this.getFallbackCourses(skill)
    }));
  }

  getFallbackJobTrends(skills) {
    return skills.map(skill => ({
      skill,
      demand: 'medium',
      averageSalary: 75000,
      topLocations: [
        { location: 'San Francisco, CA', count: 100 },
        { location: 'New York, NY', count: 85 },
        { location: 'Remote', count: 120 }
      ],
      growthRate: this.estimateGrowthRate(skill),
      requiredSkills: [
        { skill: skill, frequency: 95 },
        { skill: 'communication', frequency: 80 },
        { skill: 'teamwork', frequency: 70 }
      ],
      jobCount: 50
    }));
  }
}

function normalizeSalary(min, max, type, currency) {
  if (!min && !max) return null;
  return { min: min || max || null, max: max || min || null, currency: currency || 'USD', type };
}

function extractSkillsFromText(text) {
  if (!text) return [];
  const skills = ['javascript','python','react','node','java','sql','aws','docker','kubernetes','ml','ai','typescript'];
  const lower = text.toLowerCase();
  return skills.filter(s => lower.includes(s));
}

module.exports = new ExternalApiService();