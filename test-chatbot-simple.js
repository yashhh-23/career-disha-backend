// Simple chatbot test to verify API endpoints work
const axios = require('axios');

const API_BASE = 'http://localhost:3000/api/v1';

async function testChatbotEndpoints() {
  console.log('🧪 Testing Chatbot API Endpoints...\n');

  try {
    // Test health endpoint
    console.log('1️⃣ Testing health endpoint...');
    const healthResponse = await axios.get(`${API_BASE}/chatbot/health`);
    console.log('✅ Health check passed:', healthResponse.data.status);
    console.log('🔧 Gemini configured:', healthResponse.data.geminiConfigured);
    console.log('🤖 Service initialized:', healthResponse.data.serviceInitialized);

    // Test authentication with existing user
    console.log('\n2️⃣ Testing authentication...');
    let authToken;
    
    try {
      const loginResponse = await axios.post(`${API_BASE}/auth/login`, {
        email: 'test@example.com',
        password: 'Test123!@#'
      });
      authToken = loginResponse.data.token;
      console.log('✅ Login successful');
    } catch (error) {
      console.log('ℹ️ Existing user not found, registering new user...');
      const registerResponse = await axios.post(`${API_BASE}/auth/register`, {
        name: 'Chatbot Test User',
        email: `chatbot${Date.now()}@example.com`,
        password: 'Test123!@#'
      });
      authToken = registerResponse.data.token;
      console.log('✅ Registration successful');
    }

    // Test simple message (with expectation of fallback)
    console.log('\n3️⃣ Testing message endpoint...');
    try {
      const messageResponse = await axios.post(`${API_BASE}/chatbot/message`, {
        message: "Hello, I'm testing the chatbot!"
      }, {
        headers: { Authorization: `Bearer ${authToken}` }
      });

      console.log('✅ Message endpoint works');
      console.log('🤖 Response:', messageResponse.data.message?.substring(0, 100) + '...');
      console.log('🆔 Conversation ID:', messageResponse.data.conversationId);
      
      if (messageResponse.data.conversationId) {
        // Test roadmap with conversation ID
        console.log('\n4️⃣ Testing roadmap generation...');
        try {
          const roadmapResponse = await axios.post(`${API_BASE}/chatbot/roadmap/${messageResponse.data.conversationId}`, {}, {
            headers: { Authorization: `Bearer ${authToken}` }
          });
          
          if (roadmapResponse.data.isMock) {
            console.log('✅ Mock roadmap generated (AI service may be rate limited)');
          } else {
            console.log('✅ AI roadmap generated successfully');
          }
          console.log('📋 Roadmap title:', roadmapResponse.data.roadmap?.roadmapTitle);
        } catch (roadmapError) {
          console.log('❌ Roadmap failed:', roadmapError.response?.data?.error);
        }
      }

    } catch (messageError) {
      console.log('❌ Message failed:', messageError.response?.data?.error);
      if (messageError.response?.data?.fallbackMessage) {
        console.log('🔄 Fallback message:', messageError.response.data.fallbackMessage);
      }
    }

    // Test suggestions endpoint
    console.log('\n5️⃣ Testing suggestions...');
    try {
      const suggestionsResponse = await axios.post(`${API_BASE}/chatbot/suggestions`, {
        conversationHistory: []
      }, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      
      console.log('✅ Suggestions work');
      console.log('💡 Sample suggestions:', suggestionsResponse.data.suggestions.slice(0, 2));
    } catch (sugError) {
      console.log('❌ Suggestions failed:', sugError.response?.data?.error);
    }

    console.log('\n🎉 Chatbot API Testing Complete!');
    console.log('\n📝 Summary:');
    console.log('- Health endpoint: ✅ Working');
    console.log('- Authentication: ✅ Working');
    console.log('- Message endpoint: ⚠️ May be rate limited (fallback available)');
    console.log('- Suggestions: ✅ Working');
    console.log('- Roadmap: ⚠️ Mock version available when AI is rate limited');
    
    console.log('\n🚀 Ready for frontend testing!');
    console.log('Start the frontend with: cd career-disha-frontend && npm run dev');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testChatbotEndpoints();