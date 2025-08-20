
import { vectorStore } from './vectorStore';
import { v4 as uuidv4 } from 'uuid';

interface StructuredChunk {
  title: string;
  description: string;
  content: string;
  source: string;
  tags: string[];
}

interface ChunkMetadata {
  title: string;
  description: string;
  source: string;
  tags: string[];
  chunk_id: string;
}

export class StructuredChunkEmbedder {
  private chunkCounter = 0;

  /**
   * Generate a unique chunk ID
   */
  private generateChunkId(): string {
    this.chunkCounter++;
    return `chunk_${this.chunkCounter}_${uuidv4()}`;
  }

  /**
   * Create embedding input by concatenating title, description, and content
   */
  private createEmbeddingInput(chunk: StructuredChunk): string {
    return `${chunk.title} ${chunk.description} ${chunk.content}`.trim();
  }

  /**
   * Process and embed a single structured chunk
   */
  async embedChunk(chunk: StructuredChunk): Promise<string> {
    try {
      // Generate unique chunk ID
      const chunkId = this.generateChunkId();

      // Create embedding input (title + description + content only)
      const embeddingInput = this.createEmbeddingInput(chunk);

      // Generate embedding using text-embedding-3-small
      const embedding = await vectorStore.createEmbedding(embeddingInput, 'text-embedding-3-small');

      // Prepare metadata according to your schema
      const metadata: ChunkMetadata = {
        title: chunk.title,
        description: chunk.description,
        source: chunk.source,
        tags: chunk.tags,
        chunk_id: chunkId
      };

      // Use source as namespace for Pinecone
      const namespace = chunk.source.toLowerCase().replace(/[^a-z0-9-]/g, '-');

      // Upsert to Pinecone with namespace
      await this.upsertToNamespace(chunkId, embedding, metadata, namespace);

      console.log(`✅ Embedded chunk: ${chunkId} in namespace: ${namespace}`);
      return chunkId;

    } catch (error) {
      console.error('Error embedding chunk:', error);
      throw error;
    }
  }

  /**
   * Process multiple structured chunks
   */
  async embedChunks(chunks: StructuredChunk[]): Promise<string[]> {
    const processedChunkIds: string[] = [];
    const batchSize = 5; // Process in small batches to avoid rate limits

    console.log(`🚀 Starting to embed ${chunks.length} structured chunks...`);

    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      console.log(`📦 Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(chunks.length/batchSize)}`);

      const batchPromises = batch.map(chunk => this.embedChunk(chunk));
      const batchResults = await Promise.all(batchPromises);
      processedChunkIds.push(...batchResults);

      // Small delay between batches
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    console.log(`🎉 Successfully embedded ${processedChunkIds.length} chunks`);
    return processedChunkIds;
  }

  /**
   * Upsert vector to Pinecone with namespace support
   */
  private async upsertToNamespace(
    id: string,
    embedding: number[],
    metadata: ChunkMetadata,
    namespace: string
  ): Promise<void> {
    try {
      // Initialize vector store if needed
      await vectorStore.initialize();

      // For now, we'll add namespace to metadata since the current vectorStore 
      // doesn't have built-in namespace support
      const enhancedMetadata = {
        ...metadata,
        namespace,
        type: 'structured_chunk',
        embedding_model: 'text-embedding-3-small',
        created_at: new Date().toISOString()
      };

      await vectorStore.upsertVector(id, embedding, enhancedMetadata);
    } catch (error) {
      console.error(`Error upserting to namespace ${namespace}:`, error);
      throw error;
    }
  }

  /**
   * Search within a specific source namespace
   */
  async searchInSource(
    query: string,
    source: string,
    topK: number = 5
  ): Promise<Array<{
    id: string;
    score: number;
    metadata: ChunkMetadata;
  }>> {
    try {
      const namespace = source.toLowerCase().replace(/[^a-z0-9-]/g, '-');
      
      // Create embedding for query
      const queryEmbedding = await vectorStore.createEmbedding(query, 'text-embedding-3-small');
      
      // Search with source filter
      const results = await vectorStore.queryVectors(
        queryEmbedding,
        topK,
        { 
          namespace: { '$eq': namespace },
          type: { '$eq': 'structured_chunk' }
        }
      );

      return results.map(result => ({
        id: result.id,
        score: result.score,
        metadata: result.metadata as ChunkMetadata
      }));

    } catch (error) {
      console.error('Error searching in source:', error);
      throw error;
    }
  }

  /**
   * Get statistics about embedded chunks
   */
  async getEmbeddingStats(): Promise<{
    totalChunks: number;
    chunksBySource: Record<string, number>;
    recentChunks: Array<{ id: string; source: string; title: string }>;
  }> {
    try {
      // This would need to be implemented based on your specific requirements
      // For now, return basic stats structure
      return {
        totalChunks: this.chunkCounter,
        chunksBySource: {},
        recentChunks: []
      };
    } catch (error) {
      console.error('Error getting embedding stats:', error);
      throw error;
    }
  }
}

export const structuredChunkEmbedder = new StructuredChunkEmbedder();
