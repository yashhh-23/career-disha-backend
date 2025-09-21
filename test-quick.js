const axios = require('axios');

const API_BASE = 'http://localhost:3000';

class QuickTester {
    static async testServerAlive() {
        console.log('🏥 Quick Server Test...');
        
        const endpoints = [
            '/',
            '/api/health',
            '/api/v1/auth',
            '/api/v1/progress',
            '/api/v1/recommendations'
        ];

        for (const endpoint of endpoints) {
            try {
                const response = await axios.get(`${API_BASE}${endpoint}`, { timeout: 5000 });
                console.log(`✅ ${endpoint} - ${response.status} ${response.statusText}`);
            } catch (error) {
                const status = error.response?.status || 'TIMEOUT';
                const message = error.response?.statusText || error.message;
                console.log(`❌ ${endpoint} - ${status} ${message}`);
            }
        }
    }

    static async testQuickAuth() {
        console.log('\n🔐 Quick Auth Test...');
        
        const testUser = {
            email: `quicktest${Date.now()}@example.com`,
            password: 'Quick123!',
            name: 'Quick Test'
        };

        try {
            // Register
            const registerResponse = await axios.post(`${API_BASE}/api/v1/auth/register`, testUser);
            console.log('✅ Registration successful');
            
            // Login
            const loginResponse = await axios.post(`${API_BASE}/api/v1/auth/login`, {
                email: testUser.email,
                password: testUser.password
            });
            console.log('✅ Login successful');
            
            const token = loginResponse.data.token;
            
            // Test protected route
            const profileResponse = await axios.get(`${API_BASE}/api/v1/auth/profile`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            console.log('✅ Protected route access successful');
            
            return token;
        } catch (error) {
            console.log('❌ Auth test failed:', error.response?.data?.error || error.message);
            return null;
        }
    }

    static async testQuickAI(token) {
        if (!token) {
            console.log('\n❌ Skipping AI test - no auth token');
            return;
        }

        console.log('\n🤖 Quick AI Test...');
        
        try {
            const response = await axios.post(`${API_BASE}/api/v1/ai/career-insights`, {
                skills: ['JavaScript', 'React'],
                experience: 'beginner'
            }, {
                headers: { Authorization: `Bearer ${token}` },
                timeout: 15000
            });
            
            console.log('✅ AI service working');
            console.log(`   Response size: ${JSON.stringify(response.data).length} chars`);
        } catch (error) {
            console.log('❌ AI test failed:', error.response?.data?.error || error.message);
        }
    }

    static async runQuickTest() {
        console.log('⚡ Quick Integration Test');
        console.log('=' .repeat(30));
        
        await this.testServerAlive();
        const token = await this.testQuickAuth();
        await this.testQuickAI(token);
        
        console.log('\n⚡ Quick test complete!');
    }
}

// Run if executed directly
if (require.main === module) {
    QuickTester.runQuickTest().catch(console.error);
}

module.exports = QuickTester;