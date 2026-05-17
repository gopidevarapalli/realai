import { NextRequest } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { PDFLoader } from '@langchain/community/document_loaders/fs/pdf';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';

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

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get('file') as File;
        if (!file) return Response.json({ error: 'No file provided' }, { status: 400 });

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        const blob = new Blob([buffer], { type: 'application/pdf' });
        const loader = new PDFLoader(blob);
        const docs = await loader.load();

        const splitter = new RecursiveCharacterTextSplitter({
            chunkSize: 500,
            chunkOverlap: 50,
        });
        const chunks = await splitter.splitDocuments(docs);
        console.log(`PDF parsed: ${chunks.length} chunks`);

        const rows = await Promise.all(
            chunks.map(async (chunk) => ({
                content: chunk.pageContent,
                embedding: await embedText(chunk.pageContent),
                metadata: {
                    filename: file.name,
                    page: chunk.metadata?.loc?.pageNumber || 0,
                },
                createdAt: new Date(),
            }))
        );

        const client = await clientPromise;
        const collection = client.db('realai').collection('documents');
        // Ensure text index exists for full-text search
        try {
            await collection.createIndex({ content: 'text' });
        } catch {
            // Index already exists — fine
        }
        await collection.insertMany(rows);

        return Response.json({
            success: true,
            chunks: rows.length,
            filename: file.name,
        });
    } catch (err: any) {
        console.error('Upload error:', err);
        return Response.json({ error: err.message }, { status: 500 });
    }
}