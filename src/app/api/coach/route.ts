import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { COACH_SYSTEM_PROMPT } from '@/lib/aiPrompts';
import { z } from 'zod';

import { buildPrompt } from '@/lib/coachLogic';

// ============ SECURITY: Rate Limiting ============
const REQUESTS_PER_MINUTE = 15; // Increased for Gemini free tier
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

function isRateLimited(ip: string): boolean {
    const now = Date.now();
    const userLimit = rateLimitMap.get(ip) || { count: 0, resetTime: now + 60 * 1000 };

    if (userLimit.resetTime < now) {
        userLimit.count = 0;
        userLimit.resetTime = now + 60 * 1000;
    }

    if (userLimit.count >= REQUESTS_PER_MINUTE) return true;

    userLimit.count++;
    rateLimitMap.set(ip, userLimit);
    return false;
}

// ============ SECURITY: Input Validation ============
const CoachRequestSchema = z.object({
    mode: z.string(),
    tasks: z.array(z.any()).optional(),
    score: z.number().optional(),
    balance: z.string().optional(),
    question: z.string().optional(),
    taskTitle: z.string().optional(),
    history: z.array(z.any()).optional(),
    goals: z.array(z.any()).optional(),
    preferences: z.any().optional(),
    conversationHistory: z.array(z.any()).optional(),
    localDate: z.string().optional(),
    localTime: z.string().optional()
});

type CoachRequest = z.infer<typeof CoachRequestSchema>;

// ============ PROVIDER 1: GEMINI STREAM ============
async function callGeminiStream(prompt: string): Promise<ReadableStream> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY not set');
    
    // Using gemini-2.0-flash-exp (or gemini-1.5-flash)
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' }); 

    const result = await model.generateContentStream(prompt);

    const stream = new ReadableStream({
        async start(controller) {
            const encoder = new TextEncoder();
            try {
                for await (const chunk of result.stream) {
                    const chunkText = chunk.text();
                    if (chunkText) {
                        controller.enqueue(encoder.encode(chunkText));
                    }
                }
                controller.close();
            } catch (err) {
                console.error('[Gemini] Stream Error:', err);
                controller.error(err);
            }
        },
    });
    return stream;
}

// ============ PROVIDER 2: GROQ STREAM (BACKUP) ============
async function callGroqStream(prompt: string): Promise<ReadableStream> {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error('GROQ_API_KEY not set');

    const groq = new Groq({ apiKey });
    const completion = await groq.chat.completions.create({
        messages: [{ role: 'system', content: COACH_SYSTEM_PROMPT }, { role: 'user', content: prompt }],
        model: 'llama-3.3-70b-versatile',
        stream: true,
        temperature: 0.7,
        max_tokens: 1024,
    });

    const stream = new ReadableStream({
        async start(controller) {
            const encoder = new TextEncoder();
            for await (const chunk of completion) {
                const content = chunk.choices[0]?.delta?.content || '';
                if (content) controller.enqueue(encoder.encode(content));
            }
            controller.close();
        },
    });
    return stream;
}

// ============ JSON HANDLERS ============
async function callGeminiJSON(prompt: string): Promise<string> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY not set');
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ 
        model: 'gemini-1.5-flash',
        generationConfig: { responseMimeType: "application/json" } 
    });
    const result = await model.generateContent([COACH_SYSTEM_PROMPT, "Respond with valid JSON.", prompt]);
    return result.response.text();
}

async function callGroqJSON(prompt: string): Promise<string> {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error('GROQ_API_KEY not set');
    const groq = new Groq({ apiKey });
    const completion = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'system', content: COACH_SYSTEM_PROMPT }, { role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        max_tokens: 500
    });
    return completion.choices[0]?.message?.content || '{}';
}


// ============ MAIN HANDLER with HYBRID LOGIC ============
export async function POST(req: NextRequest) {
    // 1. Check Rate Limit
    const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';
    if (isRateLimited(ip)) return NextResponse.json({ error: 'Rate limit exceeded.' }, { status: 429 });

    try {
        const rawBody = await req.json();
        
        // MOCK MODE Check
        if (process.env.MOCK_AI === 'true') {
             // ... Mock Logic (Simplified for brevity, or kept if needed. For now assuming real)
        }

        const body = CoachRequestSchema.parse(rawBody);
        const prompt = buildPrompt(body);

        // --- JSON MODE (Schedule Assist) ---
        if (body.mode === 'schedule_assist') {
            try {
                // Try Gemini First
                // console.log('🤖 Attempting Gemini JSON...');
                const json = await callGeminiJSON(prompt);
                return NextResponse.json({ success: true, response: json });
            } catch (err) {
                console.error('⚠️ Gemini JSON Failed:', err);
                // Fallback Groq
                try {
                    // console.log('🔄 Swapping to Groq JSON...');
                    const json = await callGroqJSON(prompt);
                    return NextResponse.json({ success: true, response: json });
                } catch (groqErr) {
                    return NextResponse.json({ success: false, error: 'All AI services busy' }, { status: 503 });
                }
            }
        } 
        
        // --- STREAMING MODE (Chat/Advice) ---
        else {
            try {
                // Try Gemini First
                // console.log('🤖 Attempting Gemini Stream...');
                const geminiStream = await callGeminiStream(prompt);
                return new NextResponse(geminiStream);
            } catch (geminiError) {
                console.error('⚠️ Gemini Stream Failed:', geminiError);
                
                // Fallback Groq
                try {
                    // console.log('🔄 Swapping to Groq Stream...');
                    const groqStream = await callGroqStream(prompt);
                    
                    // Inject Warning
                    const encoder = new TextEncoder();
                    const warning = encoder.encode("\n\n[System: Switched to Groq Backup due to high load]\n\n");
                    const [pullStream, pushStream] = groqStream.tee();
                    
                    const hybridStream = new ReadableStream({
                        async start(controller) {
                            controller.enqueue(warning);
                            const reader = pullStream.getReader();
                            while(true) {
                                const {done, value} = await reader.read();
                                if(done) break;
                                controller.enqueue(value);
                            }
                            controller.close();
                        }
                    });

                    return new NextResponse(hybridStream);

                } catch (groqError) {
                    return NextResponse.json({ error: 'All AI services busy.' }, { status: 503 });
                }
            }
        }

    } catch (error) {
        console.error('API Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
