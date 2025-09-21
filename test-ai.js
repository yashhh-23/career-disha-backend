const axios = require('axios');
require('dotenv').config();

const API_BASE = 'http://localhost:3000';

class AITester {
    constructor() {
        this.authToken = null;
    }

    async authenticate() {
        console.log('🔐 Authenticating for AI tests...');
        
        const testUser = {
            email: `aitest${Date.now()}@example.com`,
            password: 'AITest123!',
            name: 'AI Test User'
        };

        try {
            // Register
            await axios.post(`${API_BASE}/api/v1/auth/register`, testUser);
            
            // Login
            const loginResponse = await axios.post(`${API_BASE}/api/v1/auth/login`, {
                email: testUser.email,
                password: testUser.password
            });
            
            this.authToken = loginResponse.data.token;
            console.log('✅ Authentication successful');
            return true;
        } catch (error) {
            console.error('❌ Authentication failed:', error.message);
            return false;
        }
    }

    async testGeminiAPI() {
        console.log('\n🤖 Testing Gemini AI API...');
        
        const tests = [
            {
                name: 'Career Insights',
                endpoint: '/ai/career-insights',
                data: {
                    skills: ['JavaScript', 'React', 'Node.js', 'MongoDB'],
                    experience: 'intermediate',
                    interests: ['web development', 'machine learning', 'cloud computing'],
                    currentRole: 'Frontend Developer',
                    goals: ['become full-stack developer', 'learn AI/ML']
                }
            },
            {
                name: 'Skill Gap Analysis',
                endpoint: '/ai/skill-analysis',
                data: {
                    currentSkills: ['HTML', 'CSS', 'JavaScript', 'React'],
                    targetRole: 'Full Stack Developer',
                    industry: 'Technology'
                }
            },
            {
                name: 'Career Roadmap',
                endpoint: '/ai/roadmap',
                data: {
                    currentRole: 'Junior Developer',
                    targetRole: 'Senior Full Stack Developer',
                    timeframe: '18 months',
                    preferences: ['remote work', 'continuous learning']
                }
            },
            {
                name: 'Interview Preparation',
                endpoint: '/ai/interview-feedback',
                data: {
                    position: 'Full Stack Developer',
                    experience: 'intermediate',
                    responses: [
                        {
                            question: 'What is your experience with React?',
                            answer: 'I have been working with React for 2 years...'
                        }
                    ]
                }
            }
        ];

        for (const test of tests) {
            try {
                console.log(`\nTesting ${test.name}...`);
                const response = await axios.post(`${API_BASE}/api/v1${test.endpoint}`, test.data, {
                    headers: { Authorization: `Bearer ${this.authToken}` },
                    timeout: 30000 // 30 second timeout for AI calls
                });
                
                console.log(`✅ ${test.name} - Success`);
                console.log(`   Response length: ${JSON.stringify(response.data).length} characters`);
                console.log(`   Keys: ${Object.keys(response.data).join(', ')}`);
                
                if (response.data.recommendations) {
                    console.log(`   Recommendations: ${response.data.recommendations.length} items`);
                }
                
            } catch (error) {
                console.log(`❌ ${test.name} - Failed`);
                console.log(`   Error: ${error.response?.data?.error || error.message}`);
                console.log(`   Status: ${error.response?.status || 'Network Error'}`);
            }
        }
    }

    async testAIServiceHealth() {
        console.log('\n🔍 Testing AI Service Health...');
        
        try {
            // Test if AI service is properly initialized
            const response = await axios.get(`${API_BASE}/api/v1/ai/health`, {
                headers: { Authorization: `Bearer ${this.authToken}` }
            });
            
            console.log('✅ AI Service Health Check Passed');
            console.log('   Services:', response.data);
        } catch (error) {
            console.log('❌ AI Service Health Check Failed');
            console.log('   Error:', error.response?.data || error.message);
        }
    }

    async testAPIKeyValidation() {
        console.log('\n🔑 Testing API Key Validation...');
        
        // Check environment variables
        const geminiKey = process.env.GEMINI_API_KEY;
        const hfKey = process.env.HUGGING_FACE_API_KEY;
        
        console.log(`Gemini API Key: ${geminiKey ? '✅ Present' : '❌ Missing'}`);
        console.log(`Hugging Face Key: ${hfKey ? '✅ Present' : '❌ Missing'}`);
        
        if (geminiKey) {
            console.log(`   Gemini Key Length: ${geminiKey.length} characters`);
            console.log(`   Gemini Key Prefix: ${geminiKey.substring(0, 10)}...`);
        }
        
        if (hfKey) {
            console.log(`   HF Key Length: ${hfKey.length} characters`);
            console.log(`   HF Key Prefix: ${hfKey.substring(0, 10)}...`);
        }
    }

    async runAITests() {
        console.log('🤖 Starting AI Integration Tests...');
        console.log('=' .repeat(50));
        
        this.testAPIKeyValidation();
        
        const authSuccess = await this.authenticate();
        if (!authSuccess) {
            console.log('❌ Cannot proceed with AI tests - authentication failed');
            return;
        }
        
        await this.testAIServiceHealth();
        await this.testGeminiAPI();
        
        console.log('\n🎉 AI Integration Tests Complete!');
    }
}

// Run tests if this file is executed directly
if (require.main === module) {
    const aiTester = new AITester();
    aiTester.runAITests().catch(console.error);
}

module.exports = AITester;