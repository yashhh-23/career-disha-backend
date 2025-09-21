// Test chatbot integration
const axios = require('axios');

const API_BASE = 'http://localhost:3000/api/v1';

class ChatbotTester {
  constructor() {
    this.authToken = null;
  }

  async login() {
    try {
      console.log('🔐 Testing chatbot authentication...');
      const response = await axios.post(`${API_BASE}/auth/login`, {
        email: 'test@example.com',
        password: 'Test123!@#'
      });
      
      this.authToken = response.data.token;
      console.log('✅ Authentication successful');
      return true;
    } catch (error) {
      console.log('❌ Authentication failed:', error.response?.data?.error || error.message);
      
      // Try to register a new user
      try {
        console.log('📝 Registering new test user...');
        const registerResponse = await axios.post(`${API_BASE}/auth/register`, {
          name: 'Chatbot Test User',
          email: 'test@example.com',
          password: 'Test123!@#'
        });
        
        this.authToken = registerResponse.data.token;
        console.log('✅ Registration and authentication successful');
        return true;
      } catch (regError) {
        console.log('❌ Registration failed:', regError.response?.data?.error || regError.message);
        return false;
      }
    }
  }

  async testChatbotHealth() {
    try {
      console.log('\n🏥 Testing chatbot health...');
      const response = await axios.get(`${API_BASE}/chatbot/health`);
      console.log('✅ Chatbot service health:', response.data);
      return response.data.serviceInitialized;
    } catch (error) {
      console.log('❌ Chatbot health check failed:', error.response?.data || error.message);
      return false;
    }
  }

  async testChatMessage() {
    try {
      console.log('\n💬 Testing chat message...');
      const response = await axios.post(`${API_BASE}/chatbot/message`, {
        message: "Hi! I'm interested in web development as a career. Can you help me?"
      }, {
        headers: { Authorization: `Bearer ${this.authToken}` }
      });

      console.log('✅ Chat message sent successfully');
      console.log('🤖 AI Response:', response.data.message);
      console.log('💡 Suggestions:', response.data.suggestions);
      console.log('🆔 Conversation ID:', response.data.conversationId);
      
      return response.data.conversationId;
    } catch (error) {
      console.log('❌ Chat message failed:', error.response?.data || error.message);
      return null;
    }
  }

  async testFollowUpMessage(conversationId) {
    try {
      console.log('\n💬 Testing follow-up message...');
      const response = await axios.post(`${API_BASE}/chatbot/message`, {
        message: "I have experience with JavaScript and React. What skills should I focus on next?",
        conversationId
      }, {
        headers: { Authorization: `Bearer ${this.authToken}` }
      });

      console.log('✅ Follow-up message sent successfully');
      console.log('🤖 AI Response:', response.data.message);
      console.log('💡 New Suggestions:', response.data.suggestions);
      
      return true;
    } catch (error) {
      console.log('❌ Follow-up message failed:', error.response?.data || error.message);
      return false;
    }
  }

  async testRoadmapGeneration(conversationId) {
    try {
      console.log('\n🗺️ Testing roadmap generation...');
      const response = await axios.post(`${API_BASE}/chatbot/roadmap/${conversationId}`, {}, {
        headers: { Authorization: `Bearer ${this.authToken}` }
      });

      console.log('✅ Roadmap generated successfully');
      console.log('📋 Roadmap Title:', response.data.roadmap.roadmapTitle);
      console.log('📝 User Summary:', response.data.roadmap.userSummary);
      console.log('🎯 Phases:', response.data.roadmap.phases?.length || 0);
      console.log('🚀 Next Steps:', response.data.roadmap.nextSteps?.length || 0);
      
      if (response.data.isMock) {
        console.log('ℹ️  Note: This is a mock roadmap (AI generation failed)');
      }
      
      return true;
    } catch (error) {
      console.log('❌ Roadmap generation failed:', error.response?.data || error.message);
      return false;
    }
  }

  async testConversationHistory(conversationId) {
    try {
      console.log('\n📜 Testing conversation history...');
      const response = await axios.get(`${API_BASE}/chatbot/conversation/${conversationId}`, {
        headers: { Authorization: `Bearer ${this.authToken}` }
      });

      console.log('✅ Conversation history retrieved');
      console.log('💬 Total messages:', response.data.conversation.messages.length);
      console.log('📅 Created:', response.data.conversation.createdAt);
      
      return true;
    } catch (error) {
      console.log('❌ Conversation history failed:', error.response?.data || error.message);
      return false;
    }
  }

  async testSuggestions() {
    try {
      console.log('\n💡 Testing suggestions...');
      const response = await axios.post(`${API_BASE}/chatbot/suggestions`, {
        conversationHistory: [
          { role: 'user', content: 'I want to learn programming' },
          { role: 'assistant', content: 'That\'s great! What interests you most?' }
        ]
      }, {
        headers: { Authorization: `Bearer ${this.authToken}` }
      });

      console.log('✅ Suggestions retrieved');
      console.log('💡 Suggestions:', response.data.suggestions);
      
      return true;
    } catch (error) {
      console.log('❌ Suggestions failed:', error.response?.data || error.message);
      return false;
    }
  }

  async runAllTests() {
    console.log('🚀 Starting Chatbot Integration Tests...\n');
    
    const results = {
      auth: false,
      health: false,
      message: false,
      followUp: false,
      roadmap: false,
      history: false,
      suggestions: false
    };

    // Test authentication
    results.auth = await this.login();
    if (!results.auth) {
      console.log('\n❌ Cannot proceed without authentication');
      return results;
    }

    // Test chatbot health
    results.health = await this.testChatbotHealth();
    
    // Test basic chat message
    const conversationId = await this.testChatMessage();
    results.message = !!conversationId;
    
    if (conversationId) {
      // Test follow-up message
      results.followUp = await this.testFollowUpMessage(conversationId);
      
      // Test roadmap generation
      results.roadmap = await this.testRoadmapGeneration(conversationId);
      
      // Test conversation history
      results.history = await this.testConversationHistory(conversationId);
    }
    
    // Test suggestions
    results.suggestions = await this.testSuggestions();

    // Print summary
    console.log('\n📊 Test Results Summary:');
    console.log('='.repeat(50));
    Object.entries(results).forEach(([test, passed]) => {
      console.log(`${passed ? '✅' : '❌'} ${test.toUpperCase()}: ${passed ? 'PASSED' : 'FAILED'}`);
    });
    
    const passedTests = Object.values(results).filter(Boolean).length;
    const totalTests = Object.keys(results).length;
    
    console.log('\n🎯 Overall Result:');
    console.log(`${passedTests}/${totalTests} tests passed (${Math.round(passedTests/totalTests*100)}%)`);
    
    if (passedTests === totalTests) {
      console.log('🎉 All chatbot tests passed! Integration successful!');
    } else if (passedTests >= totalTests * 0.7) {
      console.log('⚠️ Most tests passed. Minor issues detected.');
    } else {
      console.log('❌ Significant issues detected. Check configuration.');
    }

    return results;
  }
}

// Run tests
const tester = new ChatbotTester();
tester.runAllTests().catch(console.error);