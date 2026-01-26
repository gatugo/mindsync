
import { buildPrompt } from '../src/lib/coachLogic';

const mockRequest = {
    mode: 'chat',
    tasks: [],
    score: 80,
    balance: 'optimal',
    question: 'How am I doing?',
    history: [
        { date: '2023-01-01', score: 85, adultCompleted: 5, childCompleted: 2, restCompleted: 1 }
    ],
    localDate: '2023-01-02',
    localTime: '12:00'
};

const prompt = buildPrompt(mockRequest);
console.log("Generated Prompt Snippet:");
console.log(prompt.split('Past 7 Days History:')[1]?.split('\n')[1]);

if (prompt.includes('Rest 1')) {
    console.log('SUCCESS: Rest stats found in prompt.');
} else {
    console.error('FAILURE: Rest stats NOT found in prompt.');
    process.exit(1);
}
