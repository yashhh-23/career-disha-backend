require('dotenv').config();

async function testHuggingFaceAPI() {
    const fetch = require('node-fetch');
    
    console.log('🔍 Testing Hugging Face API Key and Models...\n');
    
    const apiKey = process.env.HUGGING_FACE_API_KEY;
    console.log('API Key Preview:', apiKey ? apiKey.substring(0, 8) + '...' : 'Not found');
    
    // Test a simple text generation model
    const models = [
        'gpt2',
        'facebook/blenderbot-400M-distill',
        'microsoft/DialoGPT-medium'
    ];
    
    for (const model of models) {
        console.log(`\n📡 Testing model: ${model}`);
        
        try {
            const response = await fetch(
                `https://api-inference.huggingface.co/models/${model}`,
                {
                    headers: {
                        Authorization: `Bearer ${apiKey}`,
                        'Content-Type': 'application/json',
                    },
                    method: 'POST',
                    body: JSON.stringify({
                        inputs: "What skills do I need to become a data scientist?",
                        parameters: {
                            max_length: 100,
                            temperature: 0.7
                        }
                    }),
                }
            );
            
            console.log(`Status: ${response.status} ${response.statusText}`);
            
            if (response.ok) {
                const result = await response.json();
                console.log('✅ Success! Response:', JSON.stringify(result, null, 2));
            } else {
                const errorText = await response.text();
                console.log('❌ Error:', errorText);
            }
            
        } catch (error) {
            console.log('❌ Request failed:', error.message);
        }
    }
}

testHuggingFaceAPI();