
import { parseNaturalDateTime } from '../src/lib/datePatterns';

const testCases = [
    { input: "Gym at 130p", expectedTime: "13:30", desc: "Compact 130p" },
    { input: "Meeting 1030am", expectedTime: "10:30", desc: "Compact 1030am" },
    { input: "Dinner 5p", expectedTime: "17:00", desc: "Short 5p" },
    { input: "Breakfast 9a", expectedTime: "09:00", desc: "Short 9a" },
    { input: "Lunch 12:30pm", expectedTime: "12:30", desc: "Standard 12:30pm" },
    { input: "Call at 22:00", expectedTime: "22:00", desc: "24h format" }, // Regex might not catch pure 24h without : or am/pm in this specific logic? Let's check.
    // The current logic prioritizes AM/PM/Colon. 
    // Pure "2200" is ambiguous (year vs time), so we probably only support if it has am/pm or colon.
];

console.log("=== Testing Time Parsing ===");
let passed = 0;

testCases.forEach(test => {
    const result = parseNaturalDateTime(test.input);
    const success = result.time === test.expectedTime;
    if (success) passed++;
    console.log(`[${success ? 'PASS' : 'FAIL'}] ${test.desc}`);
    console.log(`   Input: "${test.input}" -> Got: ${result.time}, Expected: ${test.expectedTime}`);
    if (!success) console.log(`   Internal Result:`, result);
});

console.log(`\nPassed ${passed}/${testCases.length}`);

if (passed === testCases.length) process.exit(0);
else process.exit(1);
