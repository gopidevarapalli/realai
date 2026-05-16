import { createGroq } from '@ai-sdk/groq';
import { streamText } from 'ai';
import clientPromise from '@/lib/mongodb';
import { pipeline } from '@xenova/transformers';

const groq = createGroq();

let embedder: any = null;

async function getEmbedder() {
    if (!embedder) {
        embedder = await pipeline(
            'feature-extraction',
            'Xenova/all-MiniLM-L6-v2'
        );
    }
    return embedder;
}

async function embedText(text: string): Promise<number[]> {
    const embed = await getEmbedder();
    const output = await embed(text, { pooling: 'mean', normalize: true });
    return Array.from(output.data);
}

async function searchDocuments(query: string): Promise<string> {
    try {
        const queryEmbedding = await embedText(query);
        const client = await clientPromise;
        const collection = client.db('realai').collection('documents');

        const results = await collection.aggregate([
            {
                $vectorSearch: {
                    index: 'vector_index',
                    path: 'embedding',
                    queryVector: queryEmbedding,
                    numCandidates: 50,
                    limit: 4,
                },
            },
            {
                $project: {
                    content: 1,
                    metadata: 1,
                    score: { $meta: 'vectorSearchScore' },
                },
            },
        ]).toArray();

        if (!results.length) return '';

        return results
            .map((r: any) => `[Page ${r.metadata?.page || '?'}]: ${r.content}`)
            .join('\n\n---\n\n');

    } catch (err) {
        console.error('Vector search error:', err);
        return '';
    }
}

export async function POST(req: Request) {
    const { messages, memory } = await req.json();

    // Search PDF for relevant context
    const lastMessage = messages[messages.length - 1]?.content || '';
    const context = await searchDocuments(lastMessage);

    const systemPrompt = `
You are a personalized AI assistant.

User Details:
- Name: ${memory?.firstName || ''} ${memory?.lastName || ''}
- Designation: ${memory?.designation || ''}
- Skills: ${(memory?.skills || []).join(', ')}
- Interests: ${(memory?.interests || []).join(', ')}

Custom Instructions:
${memory?.customInstruction || ''}

${memory?.englishLearner
      ? 'The user is learning English. Politely correct grammar mistakes before answering.'
      : ''}

${context ? `
## Relevant context from uploaded PDF:
${context}

Use this context to answer accurately. Mention page numbers when referencing the document.
If the answer is NOT in the context, answer from your own knowledge and say so.
` : ''}

Never say you cannot remember user information or that you are stateless.
  `.trim();

    const result = streamText({
        model: groq('llama-3.3-70b-versatile'),
      system: systemPrompt,
      messages,
  });

    return result.toTextStreamResponse();
}