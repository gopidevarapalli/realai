process.env.TRANSFORMERS_NO_NODE = "1";
import { NextRequest } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { PDFLoader } from '@langchain/community/document_loaders/fs/pdf';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';


let embedder: any = null;

async function getEmbedder() {
    if (!embedder) {
        const { pipeline } = await import('@xenova/transformers');
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

        // Load and parse PDF
        const blob = new Blob([buffer], { type: 'application/pdf' });
        const loader = new PDFLoader(blob);
        const docs = await loader.load();

        // Split into small chunks
        const splitter = new RecursiveCharacterTextSplitter({
            chunkSize: 500,
            chunkOverlap: 50,
        });
        const chunks = await splitter.splitDocuments(docs);

        console.log(`PDF parsed: ${chunks.length} chunks`);

        // Embed each chunk
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

        // Save to MongoDB
        const client = await clientPromise;
        const collection = client.db('realai').collection('documents');
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