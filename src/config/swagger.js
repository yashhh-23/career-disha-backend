const swaggerJsDoc = require('swagger-jsdoc');

const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'CareerDisha API',
      version: '1.0.0',
      description: 'AI-powered career guidance platform API - Complete backend documentation for CareerDisha platform with AI interviews, skill analysis, career recommendations, and mentorship features.',
      contact: {
        name: 'CareerDisha Team',
        email: 'support@careerdisha.com',
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
    },
    servers: [
      {
        url: process.env.API_BASE_URL || 'http://localhost:3000',
        description: process.env.NODE_ENV === 'production' ? 'Production Server' : 'Development Server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT token obtained from login endpoint',
        },
      },
      schemas: {
        // User and Auth Schemas
        User: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Unique user identifier (cuid)' },
            email: { type: 'string', format: 'email', description: 'User email address' },
            role: { 
              type: 'string', 
              enum: ['STUDENT', 'MENTOR', 'ADMIN', 'SUPER_ADMIN'], 
              description: 'User role in the system' 
            },
            createdAt: { type: 'string', format: 'date-time', description: 'Account creation timestamp' },
          },
        },
        Profile: {
          type: 'object',
          properties: {
            userId: { type: 'string', description: 'Associated user ID' },
            summary: { type: 'string', description: 'User profile summary' },
            tags: { 
              type: 'array', 
              items: { type: 'string' },
              description: 'Profile tags generated from interviews and analysis'
            },
            skills: { 
              type: 'array', 
              items: { type: 'string' },
              description: 'User skills and competencies'
            },
            languages: { 
              type: 'array', 
              items: { type: 'string' },
              description: 'Languages spoken by the user'
            },
            interests: { 
              type: 'array', 
              items: { type: 'string' },
              description: 'User interests and preferences'
            },
            experience: { type: 'string', description: 'Work experience details' },
            education: { type: 'string', description: 'Educational background' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        
        // Interview Schemas
        Interview: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Unique interview identifier' },
            userId: { type: 'string', description: 'Associated user ID' },
            status: { 
              type: 'string', 
              enum: ['active', 'completed', 'abandoned'],
              description: 'Interview status'
            },
            currentStep: { type: 'integer', minimum: 1, maximum: 5, description: 'Current interview step' },
            responses: { 
              type: 'object',
              description: 'User responses organized by step'
            },
            summary: { type: 'string', description: 'AI-generated interview summary' },
            profileTags: { 
              type: 'array', 
              items: { type: 'string' },
              description: 'Tags extracted from interview responses'
            },
            createdAt: { type: 'string', format: 'date-time' },
            completedAt: { type: 'string', format: 'date-time', nullable: true },
          },
        },
        
        // Recommendation Schemas
        Recommendation: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Unique recommendation identifier' },
            userId: { type: 'string', description: 'Associated user ID' },
            type: { 
              type: 'string', 
              enum: ['course', 'skill', 'career_path', 'project', 'networking'],
              description: 'Type of recommendation'
            },
            title: { type: 'string', description: 'Recommendation title' },
            description: { type: 'string', description: 'Detailed recommendation description' },
            priority: { 
              type: 'string', 
              enum: ['high', 'medium', 'low'],
              description: 'Recommendation priority'
            },
            status: { 
              type: 'string', 
              enum: ['pending', 'in_progress', 'completed', 'dismissed'],
              description: 'Recommendation status'
            },
            metadata: { 
              type: 'object',
              description: 'Additional recommendation data (courses, links, etc.)'
            },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        
        // Upload and OCR Schemas
        Upload: {
          type: 'object',
          properties: {
            id: { type: 'integer', description: 'Unique upload identifier (legacy numeric)' },
            userId: { type: 'string', description: 'Associated user ID' },
            filePath: { type: 'string', description: 'Server file path' },
            status: { 
              type: 'string', 
              enum: ['processing', 'completed', 'failed'],
              description: 'Processing status'
            },
            extractedData: { 
              type: 'object',
              description: 'OCR and AI-extracted data from uploaded file'
            },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        
        // Mentorship Schemas
        MentorshipQuestion: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Unique question identifier' },
            userId: { type: 'string', description: 'User who asked the question' },
            question: { type: 'string', description: 'The actual question text' },
            answer: { type: 'string', nullable: true, description: 'Mentor response' },
            status: { 
              type: 'string', 
              enum: ['pending', 'answered', 'closed'],
              description: 'Question status'
            },
            category: { 
              type: 'string', 
              enum: ['career', 'technical', 'personal', 'general'],
              description: 'Question category'
            },
            priority: { 
              type: 'string', 
              enum: ['urgent', 'normal', 'low'],
              description: 'Question priority'
            },
            createdAt: { type: 'string', format: 'date-time' },
            answeredAt: { type: 'string', format: 'date-time', nullable: true },
          },
        },
        
        // Progress Schema
        Progress: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Unique progress identifier' },
            userId: { type: 'string', description: 'Associated user ID' },
            type: { 
              type: 'string', 
              enum: ['lesson', 'skill', 'recommendation', 'interview'],
              description: 'Type of progress being tracked'
            },
            referenceId: { type: 'string', description: 'ID of the referenced item' },
            progress: { type: 'number', minimum: 0, maximum: 100, description: 'Progress percentage' },
            status: { 
              type: 'string', 
              enum: ['not_started', 'in_progress', 'completed', 'paused'],
              description: 'Progress status'
            },
            metadata: { 
              type: 'object',
              description: 'Additional tracking data'
            },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        
        // Constellation Graph Schemas
        GraphNode: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Unique node identifier' },
            label: { type: 'string', description: 'Display label for the node' },
            type: { 
              type: 'string', 
              enum: ['skill', 'career', 'user', 'recommendation', 'industry'],
              description: 'Node type'
            },
            size: { type: 'number', description: 'Visual size of the node' },
            color: { type: 'string', description: 'Node color (hex)' },
            metadata: { 
              type: 'object',
              description: 'Additional node data'
            },
          },
        },
        GraphEdge: {
          type: 'object',
          properties: {
            source: { type: 'string', description: 'Source node ID' },
            target: { type: 'string', description: 'Target node ID' },
            weight: { type: 'number', minimum: 0, maximum: 1, description: 'Connection strength' },
            type: { 
              type: 'string', 
              enum: ['related', 'requires', 'optional', 'progression', 'owns', 'recommended'],
              description: 'Edge relationship type'
            },
          },
        },
        
        // Error Schemas
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string', description: 'Error message' },
            details: { 
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  field: { type: 'string' },
                  message: { type: 'string' },
                  value: { type: 'string' }
                }
              },
              description: 'Validation error details'
            },
          },
        },
        
        // Success Response
        SuccessResponse: {
          type: 'object',
          properties: {
            message: { type: 'string', description: 'Success message' },
            data: { type: 'object', description: 'Response data' },
          },
        },
      },
      
      responses: {
        UnauthorizedError: {
          description: 'Authentication required',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' },
              example: {
                error: 'Missing or invalid Authorization header'
              }
            }
          }
        },
        ForbiddenError: {
          description: 'Insufficient permissions',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' },
              example: {
                error: 'Access denied. Required roles: admin'
              }
            }
          }
        },
        ValidationError: {
          description: 'Input validation failed',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' },
              example: {
                error: 'Validation failed',
                details: [
                  {
                    field: 'email',
                    message: 'Please provide a valid email address',
                    value: 'invalid-email'
                  }
                ]
              }
            }
          }
        },
        NotFoundError: {
          description: 'Resource not found',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' },
              example: {
                error: 'User not found'
              }
            }
          }
        },
        RateLimitError: {
          description: 'Rate limit exceeded',
          content: {
            'application/json': {
              schema: { 
                type: 'object',
                properties: {
                  error: { type: 'string' },
                  retryAfter: { type: 'number' }
                }
              },
              example: {
                error: 'Too many requests. Please try again in 15 minutes.',
                retryAfter: 900
              }
            }
          }
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: [
    './src/api/*.js', // All API route files
    './src/server.js'   // Main server file
  ],
};

const specs = swaggerJsDoc(swaggerOptions);

module.exports = specs;