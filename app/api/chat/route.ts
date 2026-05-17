import { createGroq } from '@ai-sdk/groq';
import { streamText } from 'ai';
import clientPromise from '@/lib/mongodb';

const groq = createGroq();


// Pure JS embedding — no external API, no packages
// Works on Vercel, localhost, anywhere

function hashCode(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash = hash & hash; // convert to 32-bit int
    }
    return Math.abs(hash);
}

function embedText(text: string, dimensions = 384): number[] {
    const vector = new Array(dimensions).fill(0);

    // Clean and tokenize
    const words = text
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(Boolean);

    const tokens: string[] = [];

    for (const word of words) {
        // Add full word
        tokens.push(word);

        // Add character n-grams (2, 3, 4 chars) for better matching
        for (let n = 2; n <= 4; n++) {
            for (let i = 0; i <= word.length - n; i++) {
                tokens.push(word.slice(i, i + n));
            }
        }

        // Add bigrams (pairs of words) for context
        const idx = words.indexOf(word);
        if (idx < words.length - 1) {
            tokens.push(`${word}_${words[idx + 1]}`);
        }
    }

    // Hash each token into the vector
    for (const token of tokens) {
        const index = hashCode(token) % dimensions;
        vector[index] += 1;
    }

    // L2 normalize so cosine similarity works correctly
    const magnitude = Math.sqrt(
        vector.reduce((sum, val) => sum + val * val, 0)
    );

    if (magnitude > 0) {
        for (let i = 0; i < dimensions; i++) {
            vector[i] = vector[i] / magnitude;
        }
    }

    return vector;
}

async function searchDocuments(query: string): Promise<string> {
    try {
      const client = await clientPromise;
      const collection = client.db('realai').collection('documents');

      const totalDocs = await collection.countDocuments();
      if (totalDocs === 0) return '';

      // ── Small PDF (≤ 30 chunks): send everything to LLM ──
      if (totalDocs <= 30) {
          const allDocs = await collection
              .find({})
              .sort({ 'metadata.page': 1 })
              .toArray();
          return allDocs
              .map((r: any) => `[Page ${r.metadata?.page || '?'}]: ${r.content}`)
              .join('\n\n---\n\n');
      }

      // ── Large PDF: hybrid text + vector search ──
      const results: Map<string, any> = new Map();

      // 1. MongoDB full-text search (keyword matching — great for specific terms)
      try {
          const textResults = await collection
              .find(
                  { $text: { $search: query } },
                  { projection: { score: { $meta: 'textScore' }, content: 1, metadata: 1 } }
              )
              .sort({ score: { $meta: 'textScore' } })
              .limit(4)
              .toArray();

          textResults.forEach((r: any) => results.set(r._id.toString(), r));
      } catch {
          // Text index doesn't exist yet — create it silently
          await collection.createIndex({ content: 'text' });
          console.log('Text index created');
      }

      // 2. Vector search (semantic matching)
      try {
          const queryEmbedding = embedText(query);
          const vectorResults = await collection.aggregate([
              {
                  $vectorSearch: {
                      index: 'vector_index',
                      path: 'embedding',
                      queryVector: queryEmbedding,
                  numCandidates: 100,
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

          vectorResults.forEach((r: any) => results.set(r._id.toString(), r));
      } catch (e) {
          console.error('Vector search error:', e);
      }

      if (results.size === 0) return '';

      // Sort by page number and return combined unique results
      return Array.from(results.values())
          .sort((a, b) => (a.metadata?.page || 0) - (b.metadata?.page || 0))
          .slice(0, 6)
          .map((r: any) => `[Page ${r.metadata?.page || '?'}]: ${r.content}`)
          .join('\n\n---\n\n');

  } catch (err) {
      console.error('Search error:', err);
      return '';
  }
}

export async function POST(req: Request) {
    console.log('HF_API_KEY exists:', !!process.env.HF_API_KEY)
    const { messages, memory } = await req.json();
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

${memory?.englishLearner ? 'The user is learning English. Politely correct grammar mistakes before answering.' : ''}

${context ? `\n## Relevant context from uploaded PDF or from the database:\n${context}\n\nUse this context to answer accurately. Mention page numbers when referencing the document If they ask specifically and do not reveal salary information If they ask deeply then give approximately \n` : ''}

Never say you cannot remember user information.`.trim();

    const result = streamText({
        model: groq('llama-3.3-70b-versatile'),
        system: systemPrompt,
        messages,
    });

    return result.toTextStreamResponse();
}