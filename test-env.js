require('dotenv').config({ path: './.env' });
const axios = require('axios');

async function testWithEnv() {
    console.log('🔍 Server Test with Environment Variables...\n');
    
    // First, let's check if env vars are loaded correctly
    console.log('🔧 Environment Variables Status:');
    console.log('   NODE_ENV:', process.env.NODE_ENV || 'development');
    console.log('   MONGODB_URI:', process.env.MONGODB_URI ? '✅ Set' : '❌ Missing');
    console.log('   JWT_SECRET:', process.env.JWT_SECRET ? '✅ Set' : '❌ Missing');
    console.log('   GEMINI_API_KEY:', process.env.GEMINI_API_KEY ? '✅ Set' : '❌ Missing');
    console.log('   HUGGING_FACE_API_KEY:', process.env.HUGGING_FACE_API_KEY ? '✅ Set' : '❌ Missing');
    
    if (process.env.GEMINI_API_KEY) {
        console.log('   Gemini Key Preview:', process.env.GEMINI_API_KEY.substring(0, 10) + '...');
    }
    
    try {
        // Test server
        const response = await axios.get('http://localhost:3000/');
        console.log('\n✅ Server Status:', response.data.status);
        
        // Test health
        const health = await axios.get('http://localhost:3000/api/health');
        console.log('✅ Health Status:', health.data.status);
        
        // Let's try a single auth test with a unique email
        const uniqueUser = {
            email: `test${Date.now()}@example.com`,
            password: 'Test123!@#',
            name: 'Test User'
        };
        
        console.log('\n🔐 Testing Authentication...');
        try {
            const registerResponse = await axios.post('http://localhost:3000/api/v1/auth/register', uniqueUser);
            console.log('✅ Registration successful');
            
            // Wait a moment before login
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            const loginResponse = await axios.post('http://localhost:3000/api/v1/auth/login', {
                email: uniqueUser.email,
                password: uniqueUser.password
            });
            
            if (loginResponse.data.token) {
                console.log('✅ Login successful - Token received');
                
                // Test AI endpoint
                console.log('\n🤖 Testing AI Integration...');
                try {
                    const aiResponse = await axios.post('http://localhost:3000/api/v1/ai/career-insights', {
                        skills: ['JavaScript', 'React'],
                        experience: 'beginner',
                        interests: ['web development']
                    }, {
                        headers: { Authorization: `Bearer ${loginResponse.data.token}` },
                        timeout: 30000
                    });
                    
                    console.log('✅ AI Service working!');
                    console.log('   Response keys:', Object.keys(aiResponse.data));
                    
                } catch (aiError) {
                    console.log('❌ AI Service error:', aiError.response?.data?.error || aiError.message);
                }
                
            } else {
                console.log('❌ Login failed - No token received');
            }
            
        } catch (authError) {
            console.log('❌ Authentication error:', authError.response?.data?.error || authError.message);
        }
        
    } catch (error) {
        console.log('❌ Test failed:', error.message);
    }
}

testWithEnv().catch(console.error);