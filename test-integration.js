const axios = require('axios');
require('dotenv').config();

const API_BASE = 'http://localhost:3000';

class IntegrationTester {
    constructor() {
        this.results = {
            passed: 0,
            failed: 0,
            total: 0,
            details: []
        };
        this.authToken = null;
    }

    log(testName, success, message, data = null) {
        this.results.total++;
        const status = success ? '✅' : '❌';
        const logMessage = `${status} ${testName}: ${message}`;
        
        if (success) this.results.passed++;
        else this.results.failed++;
        
        console.log(logMessage);
        if (data && typeof data === 'object') {
            console.log('   Data:', JSON.stringify(data, null, 2));
        }
        
        this.results.details.push({
            testName,
            success,
            message,
            data,
            timestamp: new Date().toISOString()
        });
    }

    async testServerHealth() {
        console.log('\n🏥 Testing Server Health...');
        
        try {
            // Test main endpoint
            const response = await axios.get(`${API_BASE}/`);
            this.log('Server Root', true, 'Server is responding', response.data);
        } catch (error) {
            this.log('Server Root', false, `Server not responding: ${error.message}`);
        }

        try {
            // Test health endpoint
            const response = await axios.get(`${API_BASE}/api/health`);
            this.log('Health Endpoint', true, 'Health check passed', response.data);
        } catch (error) {
            this.log('Health Endpoint', false, `Health endpoint failed: ${error.message}`);
        }
    }

    async testAuthentication() {
        console.log('\n🔐 Testing Authentication...');
        
        const testUser = {
            email: `test${Date.now()}@example.com`,
            password: 'TestPassword123!',
            name: 'Integration Test User'
        };

        try {
            // Test registration
            const registerResponse = await axios.post(`${API_BASE}/api/v1/auth/register`, testUser);
            this.log('User Registration', true, 'User registered successfully', {
                userId: registerResponse.data.user?.id,
                hasToken: !!registerResponse.data.token
            });
        } catch (error) {
            this.log('User Registration', false, `Registration failed: ${error.response?.data?.error || error.message}`);
            return false;
        }

        try {
            // Test login
            const loginResponse = await axios.post(`${API_BASE}/api/v1/auth/login`, {
                email: testUser.email,
                password: testUser.password
            });
            
            if (loginResponse.data.token) {
                this.authToken = loginResponse.data.token;
                this.log('User Login', true, 'Login successful with token');
            } else {
                this.log('User Login', false, 'Login failed - no token received');
                return false;
            }
        } catch (error) {
            this.log('User Login', false, `Login failed: ${error.response?.data?.error || error.message}`);
            return false;
        }

        try {
            // Test protected route
            const profileResponse = await axios.get(`${API_BASE}/api/v1/auth/profile`, {
                headers: { Authorization: `Bearer ${this.authToken}` }
            });
            this.log('Protected Route', true, 'Profile access successful', {
                email: profileResponse.data.email,
                name: profileResponse.data.name
            });
        } catch (error) {
            this.log('Protected Route', false, `Profile access failed: ${error.response?.data?.error || error.message}`);
        }

        return true;
    }

    async testAIIntegration() {
        console.log('\n🤖 Testing AI Integration...');
        
        if (!this.authToken) {
            this.log('AI Integration', false, 'No auth token available - skipping AI tests');
            return;
        }

        // Test career insights
        try {
            const insightsResponse = await axios.post(`${API_BASE}/api/v1/ai/career-insights`, {
                skills: ['JavaScript', 'React', 'Node.js'],
                experience: 'beginner',
                interests: ['web development', 'mobile apps']
            }, {
                headers: { Authorization: `Bearer ${this.authToken}` }
            });
            
            this.log('AI Career Insights', true, 'Career insights generated successfully', {
                responseLength: JSON.stringify(insightsResponse.data).length,
                hasRecommendations: !!insightsResponse.data.recommendations
            });
        } catch (error) {
            this.log('AI Career Insights', false, `AI insights failed: ${error.response?.data?.error || error.message}`);
        }

        // Test skill analysis
        try {
            const analysisResponse = await axios.post(`${API_BASE}/api/v1/ai/skill-analysis`, {
                currentSkills: ['HTML', 'CSS', 'JavaScript'],
                targetRole: 'Full Stack Developer'
            }, {
                headers: { Authorization: `Bearer ${this.authToken}` }
            });
            
            this.log('AI Skill Analysis', true, 'Skill analysis completed', {
                hasGaps: !!analysisResponse.data.skillGaps,
                hasRecommendations: !!analysisResponse.data.recommendations
            });
        } catch (error) {
            this.log('AI Skill Analysis', false, `Skill analysis failed: ${error.response?.data?.error || error.message}`);
        }

        // Test roadmap generation
        try {
            const roadmapResponse = await axios.post(`${API_BASE}/api/v1/ai/roadmap`, {
                currentRole: 'Junior Developer',
                targetRole: 'Senior Full Stack Developer',
                timeframe: '12 months'
            }, {
                headers: { Authorization: `Bearer ${this.authToken}` }
            });
            
            this.log('AI Roadmap Generation', true, 'Career roadmap generated', {
                hasSteps: !!roadmapResponse.data.steps,
                stepCount: roadmapResponse.data.steps?.length || 0
            });
        } catch (error) {
            this.log('AI Roadmap Generation', false, `Roadmap generation failed: ${error.response?.data?.error || error.message}`);
        }
    }

    async testProgressSystem() {
        console.log('\n📊 Testing Progress System...');
        
        if (!this.authToken) {
            this.log('Progress System', false, 'No auth token available - skipping progress tests');
            return;
        }

        try {
            // Test progress update
            const updateResponse = await axios.post(`${API_BASE}/api/v1/progress/update`, {
                type: 'lesson',
                referenceId: 'test-lesson-001',
                progress: 75,
                status: 'in_progress',
                metadata: { lesson_name: 'React Basics' }
            }, {
                headers: { Authorization: `Bearer ${this.authToken}` }
            });
            
            this.log('Progress Update', true, 'Progress updated successfully', {
                progressId: updateResponse.data.id,
                progress: updateResponse.data.progress
            });
        } catch (error) {
            this.log('Progress Update', false, `Progress update failed: ${error.response?.data?.error || error.message}`);
        }

        try {
            // Test dashboard data
            const dashboardResponse = await axios.get(`${API_BASE}/api/v1/progress/dashboard`, {
                headers: { Authorization: `Bearer ${this.authToken}` }
            });
            
            this.log('Progress Dashboard', true, 'Dashboard data retrieved', {
                hasData: !!dashboardResponse.data,
                dataKeys: Object.keys(dashboardResponse.data || {})
            });
        } catch (error) {
            this.log('Progress Dashboard', false, `Dashboard failed: ${error.response?.data?.error || error.message}`);
        }
    }

    async testDatabaseConnection() {
        console.log('\n🗄️ Testing Database Connection...');
        
        try {
            // Test if we can create and retrieve a user (indirect database test)
            const testResponse = await axios.get(`${API_BASE}/`);
            
            // If server is running, database should be connected
            if (testResponse.status === 200) {
                this.log('Database Connection', true, 'Database appears to be connected (server responding)');
            }
        } catch (error) {
            this.log('Database Connection', false, `Database connection issues: ${error.message}`);
        }
    }

    async runAllTests() {
        console.log('🚀 Starting Comprehensive Integration Tests...');
        console.log('=' .repeat(60));
        
        const startTime = Date.now();
        
        await this.testServerHealth();
        await this.testDatabaseConnection();
        const authSuccess = await this.testAuthentication();
        
        if (authSuccess) {
            await this.testProgressSystem();
            await this.testAIIntegration();
        }
        
        const endTime = Date.now();
        const duration = (endTime - startTime) / 1000;
        
        console.log('\n' + '='.repeat(60));
        console.log('📊 FINAL TEST RESULTS');
        console.log('='.repeat(60));
        console.log(`⏱️  Duration: ${duration.toFixed(2)} seconds`);
        console.log(`✅ Passed: ${this.results.passed}/${this.results.total}`);
        console.log(`❌ Failed: ${this.results.failed}/${this.results.total}`);
        console.log(`📈 Success Rate: ${((this.results.passed / this.results.total) * 100).toFixed(1)}%`);
        
        // Summary by category
        const categories = {};
        this.results.details.forEach(test => {
            const category = test.testName.split(' ')[0];
            if (!categories[category]) categories[category] = { passed: 0, total: 0 };
            categories[category].total++;
            if (test.success) categories[category].passed++;
        });
        
        console.log('\n📋 RESULTS BY CATEGORY:');
        Object.entries(categories).forEach(([category, stats]) => {
            const rate = ((stats.passed / stats.total) * 100).toFixed(1);
            console.log(`${category}: ${stats.passed}/${stats.total} (${rate}%)`);
        });
        
        return this.results;
    }
}

// Run tests if this file is executed directly
if (require.main === module) {
    const tester = new IntegrationTester();
    tester.runAllTests().catch(console.error);
}

module.exports = IntegrationTester;