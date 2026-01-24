
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');

const apiKey = 'AIzaSyDoiIKCfUJ5EYa248oPnPkRm_m2ev8gkBg';

async function listModels() {
    const genAI = new GoogleGenerativeAI(apiKey);

    // There isn't a direct "listModels" on the instance in SDK 0.24.1 typically, 
    // we often have to use specific fetch or assume. 
    // But let's try to infer or use the REST API via fetch if SDK doesn't expose it easily.
    // Actually, checking SDK docs knowledge: usually we just try models.

    // Let's rely on REST API for listing models to be sure.
    try {
        const fetch = require('node-fetch'); // Assume node-fetch or native
        const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
        const res = await fetch(url);
        const data = await res.json();

        console.log('Status:', res.status);
        if (data.models) {
            console.log('Available Models:');
            data.models.forEach(m => console.log(`- ${m.name}`));
            fs.writeFileSync('gemini_models.txt', JSON.stringify(data.models, null, 2));
        } else {
            console.log('No models found or error:', JSON.stringify(data));
            fs.writeFileSync('gemini_models.txt', JSON.stringify(data, null, 2));
        }
    } catch (e) {
        console.error('Error listing models:', e);
    }
}

listModels();
