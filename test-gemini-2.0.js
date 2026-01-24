
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');

const apiKey = 'AIzaSyDoiIKCfUJ5EYa248oPnPkRm_m2ev8gkBg';

async function testGemini() {
    console.log('Testing Gemini 2.0 Flash...');
    const genAI = new GoogleGenerativeAI(apiKey);

    try {
        console.log('Attempting model: gemini-2.0-flash (no models/ prefix)');
        const model = genAI.getGenerativeModel({
            model: 'gemini-2.0-flash',
            generationConfig: { responseMimeType: "application/json" }
        });

        const result = await model.generateContent([
            "Respond with valid JSON.",
            "Parse this: Gym in 1 hour"
        ]);
        console.log('Success gemini-2.0-flash:', await result.response.text());
    } catch (error) {
        const msg = `Error gemini-2.0-flash: ${error.message}\nStack: ${error.stack}\n`;
        console.error(msg);
        fs.writeFileSync('gemini_debug_2.0.txt', msg);
    }

    try {
        console.log('Attempting model: models/gemini-2.0-flash (WITH models/ prefix)');
        const model = genAI.getGenerativeModel({
            model: 'models/gemini-2.0-flash',
            generationConfig: { responseMimeType: "application/json" }
        });

        const result = await model.generateContent([
            "Respond with valid JSON.",
            "Parse this: Gym in 1 hour"
        ]);
        console.log('Success models/gemini-2.0-flash:', await result.response.text());
    } catch (error) {
        const msg = `Error models/gemini-2.0-flash: ${error.message}\nStack: ${error.stack}\n`;
        console.error(msg);
        fs.appendFileSync('gemini_debug_2.0.txt', msg);
    }
}

testGemini();
