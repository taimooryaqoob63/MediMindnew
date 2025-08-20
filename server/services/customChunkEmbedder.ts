
import { vectorStore } from './vectorStore';
import { v4 as uuidv4 } from 'uuid';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface StructuredChunk {
  title: string;
  description: string;
  content: string;
  source: string;
  tags: string[];
}

export interface ChunkMetadata {
  title: string;
  description: string;
  source: string;
  tags: string[];
  chunk_id: string;
}

export class CustomChunkEmbedder {
  private chunkCounter: number = 0;

  async embedAndStoreChunks(chunks: StructuredChunk[]): Promise<{
    success: boolean;
    processedChunks: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let processedChunks = 0;

    console.log(`🚀 Starting to embed ${chunks.length} structured chunks with text-embedding-3-large`);

    try {
      // Initialize vector store
      await vectorStore.initialize();

      // Process chunks in batches to avoid rate limits
      const batchSize = 5;
      for (let i = 0; i < chunks.length; i += batchSize) {
        const batch = chunks.slice(i, i + batchSize);
        
        console.log(`📦 Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(chunks.length/batchSize)}`);

        await Promise.all(batch.map(async (chunk) => {
          try {
            await this.embedSingleChunk(chunk);
            processedChunks++;
          } catch (error) {
            const errorMsg = `Failed to embed chunk "${chunk.title}": ${error instanceof Error ? error.message : 'Unknown error'}`;
            console.error(`❌ ${errorMsg}`);
            errors.push(errorMsg);
          }
        }));

        // Small delay between batches to respect rate limits
        if (i + batchSize < chunks.length) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      console.log(`✅ Embedding completed: ${processedChunks}/${chunks.length} chunks processed successfully`);
      
      return {
        success: errors.length === 0,
        processedChunks,
        errors
      };

    } catch (error) {
      console.error('❌ Failed to embed chunks:', error);
      return {
        success: false,
        processedChunks,
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }

  private async embedSingleChunk(chunk: StructuredChunk): Promise<void> {
    // Generate unique chunk ID
    const chunkId = this.generateChunkId();

    // Concatenate title + description + content for embedding
    const textToEmbed = `${chunk.title}\n\n${chunk.description}\n\n${chunk.content}`.trim();

    console.log(`🔤 Embedding chunk: "${chunk.title}" (${textToEmbed.length} characters)`);

    try {
      // Create embedding using text-embedding-3-large
      const embedding = await openai.embeddings.create({
        model: 'text-embedding-3-large',
        input: textToEmbed,
      });

      // Prepare metadata
      const metadata: ChunkMetadata = {
        title: chunk.title,
        description: chunk.description,
        source: chunk.source,
        tags: chunk.tags,
        chunk_id: chunkId
      };

      // Determine namespace from source
      const namespace = this.getNamespaceFromSource(chunk.source);

      console.log(`📊 Storing in Pinecone with namespace: "${namespace}"`);

      // Store in Pinecone
      await this.upsertToPinecone(
        chunkId,
        embedding.data[0].embedding,
        metadata,
        namespace
      );

      console.log(`✅ Successfully embedded and stored chunk: ${chunkId}`);

    } catch (error) {
      console.error(`❌ Error processing chunk "${chunk.title}":`, error);
      throw error;
    }
  }

  private generateChunkId(): string {
    this.chunkCounter++;
    return `chunk_${Date.now()}_${this.chunkCounter.toString().padStart(4, '0')}`;
  }

  private getNamespaceFromSource(source: string): string {
    // Convert source to valid namespace (lowercase, no spaces)
    return source.toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_-]/g, '')
      .substring(0, 50); // Pinecone namespace length limit
  }

  private async upsertToPinecone(
    id: string,
    embedding: number[],
    metadata: ChunkMetadata,
    namespace: string
  ): Promise<void> {
    try {
      // Get Pinecone client directly
      const { Pinecone } = await import('@pinecone-database/pinecone');
      const pinecone = new Pinecone({
        apiKey: process.env.PINECONE_API_KEY!,
      });

      const indexName = process.env.PINECONE_INDEX_NAME || 'medimind-rag';
      const index = pinecone.index(indexName);

      // Upsert with namespace
      await index.namespace(namespace).upsert([{
        id,
        values: embedding,
        metadata: {
          ...metadata,
          // Add some additional fields for compatibility
          content: `${metadata.title}\n${metadata.description}`.substring(0, 500),
          type: 'custom_chunk',
          namespace: namespace
        }
      }]);

      console.log(`📈 Upserted to namespace "${namespace}" with ID: ${id}`);

    } catch (error) {
      console.error(`❌ Pinecone upsert failed for chunk ${id}:`, error);
      throw error;
    }
  }

  // Method to embed a single chunk (useful for API endpoint)
  async embedChunk(chunk: StructuredChunk): Promise<{
    success: boolean;
    chunkId?: string;
    error?: string;
  }> {
    try {
      await this.embedSingleChunk(chunk);
      return { success: true, chunkId: `chunk_${Date.now()}_${this.chunkCounter}` };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Method to search embedded chunks
  async searchChunks(
    query: string,
    namespace?: string,
    topK: number = 5
  ): Promise<Array<{
    id: string;
    score: number;
    metadata: ChunkMetadata;
  }>> {
    try {
      console.log(`🔍 Searching for: "${query}" in namespace: ${namespace || 'all'}`);

      // Create embedding for query
      const queryEmbedding = await openai.embeddings.create({
        model: 'text-embedding-3-large',
        input: query,
      });

      // Get Pinecone client
      const { Pinecone } = await import('@pinecone-database/pinecone');
      const pinecone = new Pinecone({
        apiKey: process.env.PINECONE_API_KEY!,
      });

      const indexName = process.env.PINECONE_INDEX_NAME || 'medimind-rag';
      const index = pinecone.index(indexName);

      // Search with or without namespace
      const searchIndex = namespace ? index.namespace(namespace) : index;
      
      const searchResults = await searchIndex.query({
        vector: queryEmbedding.data[0].embedding,
        topK,
        includeMetadata: true,
        filter: { type: { '$eq': 'custom_chunk' } }
      });

      const results = searchResults.matches?.map(match => ({
        id: match.id || '',
        score: match.score || 0,
        metadata: {
          title: (match.metadata as any)?.title || '',
          description: (match.metadata as any)?.description || '',
          source: (match.metadata as any)?.source || '',
          tags: (match.metadata as any)?.tags || [],
          chunk_id: (match.metadata as any)?.chunk_id || match.id || ''
        }
      })) || [];

      console.log(`📊 Found ${results.length} matching chunks`);
      return results;

    } catch (error) {
      console.error('❌ Search failed:', error);
      return [];
    }
  }
}

export const customChunkEmbedder = new CustomChunkEmbedder();
