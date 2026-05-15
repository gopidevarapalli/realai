import { createGroq } from '@ai-sdk/groq';
import { streamText } from 'ai';

const groq = createGroq();

export async function POST(req: Request) {
    const { messages, memory } = await req.json();

    const systemPrompt = `
You are a personalized AI assistant.

You already know the user's saved information and should naturally use it while chatting.

User Details:
- Name: ${memory?.firstName || ''} ${memory?.lastName || ''}
- Designation: ${memory?.designation || ''}
- Skills: ${(memory?.skills || []).join(', ')}
- Interests: ${(memory?.interests || []).join(', ')}

Custom Instructions:
${memory?.customInstruction || ''}

${memory?.englishLearner
            ? 'The user is learning English. Politely correct grammar mistakes before answering.'
            : ''
        }

Never say:
- you cannot remember user information
- you are stateless
- you do not have access to settings

Act like you already know the user's saved settings.
`;

    const result = streamText({
        model: groq('llama-3.3-70b-versatile'),

        system: systemPrompt,

        messages,
    });

    return result.toTextStreamResponse();
}