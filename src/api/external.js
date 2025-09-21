const express = require('express');
const externalApiService = require('../services/externalApiService');
const { requireMentorOrAdmin } = require('../middlewares/roleAuth');
const { validationRules, handleValidationErrors } = require('../middlewares/security');

const router = express.Router();

/**
 * @swagger
 * /api/v1/external/courses/search:
 *   get:
 *     tags: [External APIs]
 *     summary: Search courses across multiple platforms
 *     description: Search for courses on Coursera, Udemy, EdX based on query
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: query
 *         in: query
 *         required: true
 *         schema:
 *           type: string
 *           minLength: 2
 *         description: Search query for courses
 *       - name: providers
 *         in: query
 *         schema:
 *           type: string
 *         description: Comma-separated list of providers (coursera,udemy,edx)
 *       - name: limit
 *         in: query
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 20
 *       - name: skillLevel
 *         in: query
 *         schema:
 *           type: string
 *           enum: [beginner, intermediate, advanced, all]
 *           default: all
 *       - name: language
 *         in: query
 *         schema:
 *           type: string
 *           default: en
 *     responses:
 *       200:
 *         description: Courses found successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 courses:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       title:
 *                         type: string
 *                       description:
 *                         type: string
 *                       provider:
 *                         type: string
 *                       instructor:
 *                         type: string
 *                       duration:
 *                         type: string
 *                       level:
 *                         type: string
 *                       rating:
 *                         type: number
 *                       price:
 *                         type: number
 *                       url:
 *                         type: string
 *                 query:
 *                   type: string
 *                 totalResults:
 *                   type: integer
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 */
router.get('/courses/search', async (req, res) => {
  try {
    const { query, providers, limit = 20, skillLevel = 'all', language = 'en' } = req.query;

    if (!query || query.trim().length < 2) {
      return res.status(400).json({
        error: 'Query parameter is required and must be at least 2 characters long'
      });
    }

    const options = {
      limit: parseInt(limit),
      skillLevel,
      language
    };

    if (providers) {
      options.providers = providers.split(',').map(p => p.trim());
    }

    const courses = await externalApiService.searchCourses(query.trim(), options);

    res.json({
      courses: courses,
      query: query.trim(),
      totalResults: courses.length,
      options: options
    });

  } catch (error) {
    console.error('Course search error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/v1/external/courses/recommendations:
 *   post:
 *     tags: [External APIs]
 *     summary: Get course recommendations based on skills
 *     description: Get personalized course recommendations for specific skills
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - skills
 *             properties:
 *               skills:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of skills to get recommendations for
 *                 maxItems: 10
 *               userLevel:
 *                 type: string
 *                 enum: [beginner, intermediate, advanced]
 *                 default: intermediate
 *     responses:
 *       200:
 *         description: Course recommendations retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 recommendations:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       skill:
 *                         type: string
 *                       courses:
 *                         type: array
 *                         items:
 *                           type: object
 */
router.post('/courses/recommendations', [
  validationRules.array('skills'),
  handleValidationErrors
], async (req, res) => {
  try {
    const { skills, userLevel = 'intermediate' } = req.body;

    if (!skills || !Array.isArray(skills) || skills.length === 0) {
      return res.status(400).json({
        error: 'Skills array is required and cannot be empty'
      });
    }

    if (skills.length > 10) {
      return res.status(400).json({
        error: 'Maximum 10 skills allowed per request'
      });
    }

    const recommendations = await externalApiService.getCourseRecommendations(skills, userLevel);

    res.json({
      recommendations: recommendations,
      userLevel: userLevel,
      skillsQueried: skills.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Course recommendations error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/v1/external/jobs/trends:
 *   post:
 *     tags: [External APIs]
 *     summary: Get job market trends for skills
 *     description: Analyze job market trends, salaries, and demand for specific skills
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - skills
 *             properties:
 *               skills:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of skills to analyze trends for
 *                 maxItems: 15
 *     responses:
 *       200:
 *         description: Job market trends retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 trends:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       skill:
 *                         type: string
 *                       demand:
 *                         type: string
 *                         enum: [low, medium, high]
 *                       averageSalary:
 *                         type: number
 *                         nullable: true
 *                       growthRate:
 *                         type: number
 *                         description: Estimated growth rate percentage
 *                       topLocations:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             location:
 *                               type: string
 *                             count:
 *                               type: number
 *                       requiredSkills:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             skill:
 *                               type: string
 *                             frequency:
 *                               type: number
 */
router.post('/jobs/trends', [
  validationRules.array('skills'),
  handleValidationErrors
], async (req, res) => {
  try {
    const { skills } = req.body;

    if (!skills || !Array.isArray(skills) || skills.length === 0) {
      return res.status(400).json({
        error: 'Skills array is required and cannot be empty'
      });
    }

    if (skills.length > 15) {
      return res.status(400).json({
        error: 'Maximum 15 skills allowed per request'
      });
    }

    const trends = await externalApiService.getJobMarketTrends(skills);

    res.json({
      trends: trends,
      skillsAnalyzed: skills.length,
      timestamp: new Date().toISOString(),
      summary: {
        highDemandSkills: trends.filter(t => t.demand === 'high').length,
        averageSalaryRange: {
          min: Math.min(...trends.filter(t => t.averageSalary).map(t => t.averageSalary)),
          max: Math.max(...trends.filter(t => t.averageSalary).map(t => t.averageSalary))
        },
        fastestGrowingSkill: trends.reduce((max, trend) => 
          trend.growthRate > (max.growthRate || 0) ? trend : max, {}
        )
      }
    });

  } catch (error) {
    console.error('Job trends error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/v1/external/jobs/search:
 *   get:
 *     tags: [External APIs]
 *     summary: Search jobs across platforms
 *     description: Search for jobs based on skills and location
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: query
 *         in: query
 *         required: true
 *         schema:
 *           type: string
 *         description: Job search query (skill, title, etc.)
 *       - name: location
 *         in: query
 *         schema:
 *           type: string
 *         description: Job location
 *       - name: remote
 *         in: query
 *         schema:
 *           type: boolean
 *           default: false
 *       - name: limit
 *         in: query
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 25
 *     responses:
 *       200:
 *         description: Jobs found successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 jobs:
 *                   type: array
 *                   items:
 *                     type: object
 *                 query:
 *                   type: string
 *                 totalResults:
 *                   type: integer
 */
router.get('/jobs/search', async (req, res) => {
  try {
    const { query, location = '', remote = false, limit = 25 } = req.query;

    if (!query || query.trim().length < 2) {
      return res.status(400).json({
        error: 'Query parameter is required and must be at least 2 characters long'
      });
    }

    const options = {
      location,
      remote: remote === 'true',
      limit: parseInt(limit)
    };

    const jobs = await externalApiService.searchJobs(query.trim(), options);

    res.json({
      jobs: jobs,
      query: query.trim(),
      totalResults: jobs.length,
      options: options,
      summary: {
        remoteJobs: jobs.filter(job => job.remote).length,
        averageSalary: jobs
          .filter(job => job.salary)
          .reduce((sum, job, _, arr) => 
            sum + (job.salary.min + job.salary.max) / 2 / arr.length, 0
          ) || null,
        topCompanies: [...new Set(jobs.map(job => job.company))].slice(0, 5)
      }
    });

  } catch (error) {
    console.error('Job search error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/v1/external/cache/clear:
 *   post:
 *     tags: [External APIs]
 *     summary: Clear external API cache
 *     description: Clear cached external API responses (admin/mentor only)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               cacheType:
 *                 type: string
 *                 enum: [courses, jobs, all]
 *                 default: all
 *     responses:
 *       200:
 *         description: Cache cleared successfully
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 */
router.post('/cache/clear', requireMentorOrAdmin(), async (req, res) => {
  try {
    const { cacheType = 'all' } = req.body;

    // Clear external API cache
    if (cacheType === 'all') {
      externalApiService.cache.clear();
    } else {
      // Clear specific cache entries
      const keysToDelete = [];
      externalApiService.cache.forEach((_, key) => {
        if (key.startsWith(`${cacheType}:`)) {
          keysToDelete.push(key);
        }
      });
      keysToDelete.forEach(key => externalApiService.cache.delete(key));
    }

    res.json({
      message: `${cacheType === 'all' ? 'All' : cacheType} cache cleared successfully`,
      clearedBy: req.user.id,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Cache clear error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/v1/external/status:
 *   get:
 *     tags: [External APIs]
 *     summary: Get external API service status
 *     description: Check status and configuration of external API integrations
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Service status retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: active
 *                 providers:
 *                   type: object
 *                 cacheStats:
 *                   type: object
 */
router.get('/status', async (req, res) => {
  try {
    const status = {
      status: 'active',
      providers: {
        courses: {
          coursera: {
            configured: !!process.env.COURSERA_API_KEY,
            rateLimit: externalApiService.courseProviders.coursera.rateLimit
          },
          udemy: {
            configured: !!(process.env.UDEMY_CLIENT_ID && process.env.UDEMY_CLIENT_SECRET),
            rateLimit: externalApiService.courseProviders.udemy.rateLimit
          },
          edx: {
            configured: !!process.env.EDX_API_KEY,
            rateLimit: externalApiService.courseProviders.edx.rateLimit
          }
        },
        jobs: {
          indeed: {
            configured: !!process.env.INDEED_API_KEY,
            rateLimit: externalApiService.jobProviders.indeed.rateLimit
          },
          github: {
            configured: true, // No API key required for mock data
            rateLimit: externalApiService.jobProviders.github.rateLimit
          }
        }
      },
      cacheStats: {
        totalEntries: externalApiService.cache.size,
        cacheTimeout: `${externalApiService.cacheTimeout / (60 * 1000)} minutes`
      },
      timestamp: new Date().toISOString()
    };

    res.json(status);

  } catch (error) {
    console.error('Status check error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;