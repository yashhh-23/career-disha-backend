require('dotenv').config();
const ChatbotService = require('./src/services/chatbotService');

async function testChatbotDirect() {
    console.log('🤖 Testing ChatbotService directly...\n');
    
    try {
        console.log('📍 Initializing ChatbotService...');
        const chatbotService = new ChatbotService();
        console.log('✅ ChatbotService initialized successfully');
        
        console.log('\n💬 Testing message processing...');
        const testMessage = "Hello, I want to learn about becoming a software developer";
        const userProfile = {
            name: "Test User",
            email: "test@example.com",
            currentRole: "Student",
            experience: "Beginner"
        };
        
        console.log(`📤 Sending message: "${testMessage}"`);
        const response = await chatbotService.processMessage(testMessage, [], userProfile);
        
        if (response.success) {
            console.log('✅ Message processed successfully!');
            console.log('📥 Response:', response.message);
            console.log('⏰ Timestamp:', response.timestamp);
        } else {
            console.log('❌ Message processing failed:', response.message);
        }
        
        console.log('\n🔍 Testing conversation suggestions...');
        const suggestions = await chatbotService.getConversationSuggestions(
            [{ role: 'user', content: testMessage }], 
            userProfile
        );
        
        if (suggestions.success) {
            console.log('✅ Suggestions generated successfully!');
            console.log('💡 Suggestions:', suggestions.suggestions);
        } else {
            console.log('❌ Suggestions failed:', suggestions.message);
        }
        
    } catch (error) {
        console.error('❌ ChatbotService test failed:', error.message);
        if (error.message.includes('GEMINI_API_KEY')) {
            console.log('💡 Make sure your GEMINI_API_KEY is set in the .env file');
        }
    }
}

testChatbotDirect();