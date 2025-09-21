require('dotenv').config();
const ChatbotService = require('./src/services/chatbotService');

async function testHuggingFaceFallback() {
    console.log('🤖 Testing Hugging Face Fallback...\n');
    
    try {
        console.log('📍 Initializing ChatbotService...');
        const chatbotService = new ChatbotService();
        console.log('✅ ChatbotService initialized successfully');
        
        console.log('\n💬 Testing Hugging Face API directly...');
        const testMessage = "I want to become a data scientist. What skills should I learn?";
        
        console.log(`📤 Testing HF API with message: "${testMessage}"`);
        
        try {
            const hfResponse = await chatbotService.callHuggingFace(testMessage, []);
            console.log('✅ Hugging Face API response:', hfResponse);
        } catch (hfError) {
            console.error('❌ Hugging Face API test failed:', hfError.message);
        }
        
        console.log('\n💬 Testing full fallback system...');
        // This will try Gemini first, then fallback to HF if quota exceeded
        const response = await chatbotService.processMessage(testMessage, [], {
            name: "Test User",
            email: "test@example.com"
        });
        
        console.log('✅ Response received:', {
            success: response.success,
            source: response.source,
            message: response.message.substring(0, 100) + '...',
            metadata: response.metadata
        });
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

testHuggingFaceFallback();