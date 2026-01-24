
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');

// Hardcoded key for debugging script only - matches user provided key
const apiKey = 'AIzaSyDoiIKCfUJ5EYa248oPnPkRm_m2ev8gkBg';

async function testGemini() {
    console.log('Testing Gemini with key length:', apiKey.length);
    const genAI = new GoogleGenerativeAI(apiKey);

    // Try gemini-1.5-flash first
    try {
        console.log('Attempting model: gemini-1.5-flash');
        const model = genAI.getGenerativeModel({
            model: 'gemini-1.5-flash',
            generationConfig: { responseMimeType: "application/json" }
        });

        const result = await model.generateContent([
            "You are a scheduling assistant.",
            "Parse this: Gym in 1 hour"
        ]);
        console.log('Success gemini-1.5-flash:', await result.response.text());
        return;
    } catch (error) {
        const msg = `Error gemini-1.5-flash: ${error.message}\nStack: ${error.stack}\n`;
        console.error(msg);
        fs.writeFileSync('gemini_debug_log.txt', msg);
    }

    // Fallback test: gemini-pro
    try {
        console.log('Attempting fallback model: gemini-pro');
        const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
        const result = await model.generateContent("Hello");
        console.log('Success gemini-pro:', await result.response.text());
    } catch (error) {
        const msg = `Error gemini-pro: ${error.message}\nStack: ${error.stack}\n`;
        console.error(msg);
        fs.appendFileSync('gemini_debug_log.txt', msg);
    }
}

testGemini();
