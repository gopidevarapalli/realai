import { NextRequest } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import pdfParse from 'pdf-parse';

// Pure JS embedding — no external API, works on Vercel
function hashCode(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash = hash & hash;
    }
    return Math.abs(hash);
}

function embedText(text: string, dimensions = 384): number[] {
    const vector = new Array(dimensions).fill(0);

    const words = text
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(Boolean);

    const tokens: string[] = [];

    for (const word of words) {
        tokens.push(word);
        for (let n = 2; n <= 4; n++) {
            for (let i = 0; i <= word.length - n; i++) {
                tokens.push(word.slice(i, i + n));
            }
        }
        const idx = words.indexOf(word);
        if (idx < words.length - 1) {
            tokens.push(`${word}_${words[idx + 1]}`);
        }
    }

    for (const token of tokens) {
        const index = hashCode(token) % dimensions;
        vector[index] += 1;
    }

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

        if (!file) {
            return Response.json({ error: 'No file provided' }, { status: 400 });
        }

        // Convert file to buffer
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        // Parse PDF using pdf-parse v1
        const pdfData = await pdfParse(buffer);
        const fullText = pdfData.text;

        console.log(`PDF parsed: ${pdfData.numpages} pages, ${fullText.length} chars`);

        // Split into chunks
        const splitter = new RecursiveCharacterTextSplitter({
            chunkSize: 500,
            chunkOverlap: 50,
        });
        const chunks = await splitter.createDocuments([fullText]);

        console.log(`Split into ${chunks.length} chunks`);

        // Embed each chunk
        const rows = chunks.map((chunk, index) => ({
            content: chunk.pageContent,
            embedding: embedText(chunk.pageContent),
            metadata: {
                filename: file.name,
                chunkIndex: index,
                totalChunks: chunks.length,
            },
            createdAt: new Date(),
        }));

        // Save to MongoDB
        const client = await clientPromise;
        const collection = client.db('realai').collection('documents');

        // Ensure text index exists for hybrid search
        try {
            await collection.createIndex({ content: 'text' });
        } catch {
            // Index already exists
        }

        await collection.insertMany(rows);

        console.log(`Saved ${rows.length} chunks to MongoDB`);

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