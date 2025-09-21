const axios = require('axios');

// Simple test to check current server status
async function simpleTest() {
    console.log('🔍 Simple Server Status Check...\n');
    
    try {
        // Test 1: Server root
        const rootResponse = await axios.get('http://localhost:3000/');
        console.log('✅ Server is running');
        console.log('   Version:', rootResponse.data.version);
        console.log('   Available endpoints:', Object.keys(rootResponse.data.endpoints).join(', '));
        
        // Test 2: Health
        const healthResponse = await axios.get('http://localhost:3000/api/health');
        console.log('✅ Health endpoint working');
        console.log('   Status:', healthResponse.data.status);
        console.log('   Uptime:', Math.round(healthResponse.data.uptime / 60), 'minutes');
        
        // Test 3: Database status from health
        if (healthResponse.data.issues && healthResponse.data.issues.length === 0) {
            console.log('✅ No health issues detected');
        }
        
        // Test 4: Check if we can access auth endpoint (just to see what error we get)
        try {
            await axios.get('http://localhost:3000/api/v1/auth');
        } catch (authError) {
            if (authError.response?.status === 404) {
                console.log('⚠️  Auth endpoint returns 404 - needs GET route');
            } else if (authError.response?.status === 401) {
                console.log('✅ Auth endpoint exists but requires authentication');
            }
        }
        
        // Test 5: Environment check
        console.log('\n🔧 Environment Status:');
        console.log('   PORT: 3000 ✅');
        console.log('   NODE_ENV:', process.env.NODE_ENV || 'not set');
        console.log('   MongoDB URI:', process.env.MONGODB_URI ? 'Set ✅' : 'Missing ❌');
        console.log('   JWT Secret:', process.env.JWT_SECRET ? 'Set ✅' : 'Missing ❌');
        console.log('   Gemini API Key:', process.env.GEMINI_API_KEY ? 'Set ✅' : 'Missing ❌');
        console.log('   Hugging Face Key:', process.env.HUGGING_FACE_API_KEY ? 'Set ✅' : 'Missing ❌');
        
    } catch (error) {
        console.log('❌ Server test failed:', error.message);
    }
}

// Run the test
simpleTest().catch(console.error);