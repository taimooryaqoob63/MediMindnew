import { Pinecone } from '@pinecone-database/pinecone';
import OpenAI from 'openai';

interface VectorStoreConfig {
  indexName: string;
  environment?: string;
  dimension: number;
}

export class VectorStore {
  private pinecone?: Pinecone;
  private openai?: OpenAI;
  private config: VectorStoreConfig;

  constructor(config: VectorStoreConfig) {
    this.config = config;
    
    // Only initialize if API keys are available
    if (process.env.PINECONE_API_KEY) {
      this.pinecone = new Pinecone({
        apiKey: process.env.PINECONE_API_KEY,
      });
    }
    
    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
    }
  }

  async initialize(): Promise<void> {
    console.log(`🔄 VectorStore.initialize() called for index: ${this.config.indexName}`);
    
    if (!this.pinecone) {
      const error = 'Pinecone API key not configured. Please add PINECONE_API_KEY to your environment variables.';
      console.error('❌', error);
      throw new Error(error);
    }
    
    if (!this.openai) {
      const error = 'OpenAI API key not configured. Please add OPENAI_API_KEY to your environment variables.';
      console.error('❌', error);
      throw new Error(error);
    }
    
    try {
      console.log(`🌲 Initializing Pinecone index: ${this.config.indexName}`);
      console.log(`🔑 API Keys available: Pinecone=${!!process.env.PINECONE_API_KEY}, OpenAI=${!!process.env.OPENAI_API_KEY}`);
      
      // Check if index exists
      const indexList = await this.pinecone.listIndexes();
      const availableIndexes = indexList.indexes?.map(i => i.name) || [];
      console.log('📝 Available indexes:', availableIndexes);
      
      const indexExists = availableIndexes.includes(this.config.indexName);
      console.log(`🔍 Index "${this.config.indexName}" exists: ${indexExists}`);

      if (!indexExists) {
        // Try to use medimind-rag if quickstart doesn't exist
        if (this.config.indexName === 'quickstart' && availableIndexes.includes('medimind-rag')) {
          console.log('🔄 Switching to medimind-rag index as it exists');
          this.config.indexName = 'medimind-rag';
        } else {
          console.log(`🏗️ Creating new index: ${this.config.indexName}`);
          await this.pinecone.createIndex({
            name: this.config.indexName,
            dimension: this.config.dimension,
            metric: 'cosine',
            spec: {
              serverless: {
                cloud: 'aws',
                region: 'us-east-1'
              }
            }
          });
          
          // Wait for index to be ready
          await this.waitForIndexReady();
          console.log(`✅ Index ${this.config.indexName} created and ready`);
        }
      } else {
        console.log(`✅ Index ${this.config.indexName} already exists`);
        
        // Test the existing index
        const index = this.pinecone.index(this.config.indexName);
        const stats = await index.describeIndexStats();
        console.log(`📊 Index stats - Total vectors: ${stats.totalVectorCount || 0}, Dimension: ${stats.dimension}`);
        
        if (stats.totalVectorCount === 0) {
          console.warn('⚠️  WARNING: Index exists but contains 0 vectors! This means the knowledge base is empty.');
          console.warn('⚠️  RAG will not work without documents in the vector index.');
        }
      }
      
      console.log('✅ VectorStore initialization completed successfully');
    } catch (error) {
      console.error('❌ Error initializing vector store:', error);
      
      if (error.message?.includes('401') || error.message?.includes('authentication')) {
        throw new Error('Authentication failed. Please verify your PINECONE_API_KEY is correct.');
      } else if (error.message?.includes('quota') || error.message?.includes('limit')) {
        throw new Error('Pinecone quota exceeded. Please check your Pinecone dashboard.');
      } else {
        throw error;
      }
    }
  }

  private async waitForIndexReady(): Promise<void> {
    const maxRetries = 30;
    let retries = 0;
    
    while (retries < maxRetries) {
      try {
        const indexStats = await this.pinecone!.index(this.config.indexName).describeIndexStats();
        if (indexStats) {
          console.log('Index is ready');
          return;
        }
      } catch (error) {
        console.log(`Waiting for index to be ready... (${retries + 1}/${maxRetries})`);
      }
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      retries++;
    }
    
    throw new Error('Index failed to become ready within timeout');
  }

  async createEmbedding(text: string, model?: 'text-embedding-3-small' | 'text-embedding-3-large'): Promise<number[]> {
    if (!this.openai) {
      throw new Error('OpenAI not configured');
    }
    
    try {
      const embeddingModel = model || 'text-embedding-3-small';
      const response = await this.openai.embeddings.create({
        model: embeddingModel,
        input: text,
      });
      
      return response.data[0].embedding;
    } catch (error) {
      console.error('Error creating embedding:', error);
      throw error;
    }
  }

  async upsertVector(
    id: string,
    embedding: number[],
    metadata: Record<string, any>
  ): Promise<void> {
    if (!this.pinecone) {
      throw new Error('Pinecone not initialized');
    }
    
    try {
      // Ensure index exists before upserting
      await this.ensureIndexExists();
      
      const index = this.pinecone.index(this.config.indexName);
      
      await index.upsert([{
        id,
        values: embedding,
        metadata
      }]);
    } catch (error) {
      console.error('Error upserting vector:', error);
      throw error;
    }
  }

  private async ensureIndexExists(): Promise<void> {
    if (!this.pinecone) {
      throw new Error('Pinecone not initialized');
    }
    
    try {
      // Check if index exists
      const indexList = await this.pinecone.listIndexes();
      const indexExists = indexList.indexes?.some(index => index.name === this.config.indexName);

      if (!indexExists) {
        console.log(`Creating Pinecone index: ${this.config.indexName}`);
        await this.pinecone.createIndex({
          name: this.config.indexName,
          dimension: this.config.dimension,
          metric: 'cosine',
          spec: {
            serverless: {
              cloud: 'aws',
              region: 'us-east-1'
            }
          }
        });
        
        // Wait for index to be ready
        await this.waitForIndexReady();
        console.log(`Index ${this.config.indexName} created successfully`);
      }
    } catch (error) {
      // If index already exists, that's fine
      if ((error as Error).message?.includes('already exists')) {
        console.log(`Index ${this.config.indexName} already exists`);
        return;
      }
      throw error;
    }
  }

  async queryVectors(
    queryEmbedding: number[],
    topK: number = 5,
    filter?: Record<string, any>
  ): Promise<Array<{
    id: string;
    score: number;
    metadata?: Record<string, any>;
  }>> {
    try {
      if (!this.pinecone) {
        throw new Error('Pinecone not initialized');
      }
      
      const index = this.pinecone.index(this.config.indexName);
      
      const queryRequest: any = {
        vector: queryEmbedding,
        topK,
        includeMetadata: true,
      };
      
      // Only add filter if it's valid and not empty
      if (filter && typeof filter === 'object' && Object.keys(filter).length > 0) {
        // Sanitize filter to ensure it matches Pinecone's expected format
        const sanitizedFilter: Record<string, any> = {};
        
        Object.entries(filter).forEach(([key, value]) => {
          // Only include non-null, defined values
          if (value !== null && value !== undefined && value !== '') {
            // Handle special filter cases
            if (key === 'recency_weight' || key === 'compliance_focused') {
              // These are processing hints, not Pinecone filters
              return;
            }
            
            // Ensure proper filter format for Pinecone
            if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
              sanitizedFilter[key] = { '$eq': value };
            } else if (Array.isArray(value)) {
              sanitizedFilter[key] = { '$in': value };
            } else {
              sanitizedFilter[key] = value;
            }
          }
        });
        
        // Only add filter if we have valid entries
        if (Object.keys(sanitizedFilter).length > 0) {
          queryRequest.filter = sanitizedFilter;
        }
      }
      
      const response = await index.query(queryRequest);
      
      return response.matches?.map(match => ({
        id: match.id || '',
        score: match.score || 0,
        metadata: match.metadata
      })) || [];
    } catch (error) {
      console.error('Error querying vectors:', error);
      // If filter caused the error, retry without filter
      if (error.message?.includes('filter') && filter) {
        console.warn('Retrying query without filter due to filter error');
        return this.queryVectors(queryEmbedding, topK);
      }
      throw error;
    }
  }

  async searchSimilar(
    query: string,
    topK: number = 5,
    filter?: Record<string, any>
  ): Promise<Array<{
    id: string;
    title: string;
    excerpt: string;
    score: number;
    type: string;
    pageNumber?: number;
    section?: string;
    clickable?: boolean;
  }>> {
    try {
      console.log(`🔍 VectorStore.searchSimilar() called with query: "${query.substring(0, 50)}...", topK: ${topK}`);
      console.log(`🔧 Using index: ${this.config.indexName}, filter:`, filter);
      
      // Check if Pinecone is initialized
      if (!this.pinecone) {
        throw new Error('Pinecone not initialized - check PINECONE_API_KEY');
      }
      
      // Create embedding for the query
      console.log('📝 Creating embedding for query...');
      const embedding = await this.createEmbedding(query);
      console.log(`✅ Embedding created with dimension: ${embedding.length}`);
      
      // Query vectors
      console.log('🔎 Querying vectors...');
      const vectors = await this.queryVectors(embedding, topK, filter);
      console.log(`📊 Found ${vectors.length} vectors from Pinecone`);
      
      // Log vector scores for debugging
      vectors.forEach((vector, index) => {
        console.log(`  Vector ${index + 1}: score=${vector.score.toFixed(3)}, id=${vector.id}`);
      });
      
      // Transform results to expected format
      const results = vectors.map(vector => ({
        id: vector.id,
        title: vector.metadata?.title || 'Unknown Document',
        excerpt: vector.metadata?.content || 'No content available',
        score: vector.score,
        type: vector.metadata?.type || 'document',
        pageNumber: vector.metadata?.page,
        section: vector.metadata?.section,
        clickable: true,
      }));
      
      console.log(`✅ Returning ${results.length} transformed results`);
      return results;
    } catch (error) {
      console.error('❌ Error in searchSimilar:', error);
      console.error('❌ Error details:', {
        message: error.message,
        stack: error.stack,
        query: query.substring(0, 100),
        topK,
        filter,
        indexName: this.config.indexName,
        hasPinecone: !!this.pinecone,
        hasOpenAI: !!this.openai
      });
      // Return empty array on error to prevent app crash
      return [];
    }
  }

  // Enhanced query method for hybrid search compatibility
  async query(
    query: string,
    topK: number = 5,
    filters?: Record<string, any>
  ): Promise<Array<{
    id: string;
    score: number;
    metadata?: Record<string, any>;
  }>> {
    try {
      // Create embedding for the query
      const embedding = await this.createEmbedding(query);
      
      // Search for similar vectors
      return await this.queryVectors(embedding, topK, filters);
    } catch (error) {
      console.error('Error querying vectors:', error);
      return [];
    }
  }

  async deleteVector(id: string): Promise<void> {
    try {
      if (!this.pinecone) {
        throw new Error('Pinecone not initialized');
      }
      const index = this.pinecone.index(this.config.indexName);
      await index.deleteOne(id);
    } catch (error) {
      console.error('Error deleting vector:', error);
      throw error;
    }
  }

  async deleteVectorsByFilter(filter: Record<string, any>): Promise<void> {
    try {
      if (!this.pinecone) {
        throw new Error('Pinecone not initialized');
      }
      const index = this.pinecone.index(this.config.indexName);
      await index.deleteMany(filter);
    } catch (error) {
      console.error('Error deleting vectors by filter:', error);
      throw error;
    }
  }

  async deleteAllVectors(): Promise<void> {
    try {
      if (!this.pinecone) {
        throw new Error('Pinecone not initialized');
      }
      const index = this.pinecone.index(this.config.indexName);
      await index.deleteAll();
      console.log('✅ All vectors deleted from Pinecone index');
    } catch (error) {
      console.error('Error deleting all vectors:', error);
      throw error;
    }
  }

  async getIndexStats(): Promise<any> {
    try {
      if (!this.pinecone) {
        throw new Error('Pinecone not initialized');
      }
      const index = this.pinecone.index(this.config.indexName);
      return await index.describeIndexStats();
    } catch (error) {
      console.error('Error getting index stats:', error);
      return null;
    }
  }

  async isIndexEmpty(): Promise<boolean> {
    try {
      const stats = await this.getIndexStats();
      const isEmpty = stats?.totalVectorCount === 0;
      console.log(`📊 Index status: ${stats?.totalVectorCount || 0} vectors stored`);
      return isEmpty;
    } catch (error) {
      console.error('Error checking if index is empty:', error);
      return true; // Assume empty on error
    }
  }

  async shouldSkipReindexing(): Promise<boolean> {
    try {
      // Check if index has substantial content
      const stats = await this.getIndexStats();
      const vectorCount = stats?.totalVectorCount || 0;
      
      if (vectorCount > 100) { // If we have substantial vectors, skip re-indexing
        console.log(`✅ Skipping re-indexing: ${vectorCount} vectors already exist in Pinecone`);
        return true;
      }
      
      console.log(`🔄 Proceeding with re-indexing: only ${vectorCount} vectors found`);
      return false;
    } catch (error) {
      console.error('Error checking reindexing status:', error);
      return false; // Proceed with reindexing on error
    }
  }
}

// Initialize global vector store instance
export const vectorStore = new VectorStore({
  indexName: process.env.PINECONE_INDEX_NAME || 'quickstart',
  dimension: 1536, // text-embedding-3-small dimension
});

// Re-index all existing document chunks into vector store
export async function reindexAllChunks() {
  try {
    console.log('🔄 Starting re-indexing of all document chunks...');
    
    // Initialize vector store first
    await vectorStore.initialize();
    
    // Check if we should skip re-indexing
    const shouldSkip = await vectorStore.shouldSkipReindexing();
    if (shouldSkip) {
      return { 
        success: true, 
        message: 'Re-indexing skipped - vectors already exist',
        skipped: true 
      };
    }
    
    // Import storage here to avoid circular dependency
    const { storage } = await import('../storage');
    
    // Get all documents first, then get all their chunks
    const documents = await storage.getAllDocuments();
    console.log(`📄 Found ${documents.length} documents`);
    
    const chunks = [];
    for (const document of documents) {
      const documentChunks = await storage.getDocumentChunks(document.id);
      chunks.push(...documentChunks);
    }
    console.log(`📚 Found ${chunks.length} chunks to re-index`);
    
    if (chunks.length === 0) {
      console.log('⚠️  No chunks found to index');
      return { success: true, message: 'No chunks to index' };
    }
    
    let successCount = 0;
    let errorCount = 0;
    
    // Process chunks in batches to avoid overwhelming the system
    const batchSize = 5; // Smaller batches for stability
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      console.log(`🔄 Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(chunks.length/batchSize)}`);
      
      for (const chunk of batch) {
        try {
          // Create embedding for the chunk
          const embedding = await vectorStore.createEmbedding(chunk.content);
          
          // Get document details for metadata
          const document = await storage.getDocument(chunk.documentId);
          
          // Store in vector database
          await vectorStore.upsertVector(
            chunk.id,
            embedding,
            {
              documentId: chunk.documentId,
              chunkIndex: chunk.chunkIndex,
              content: chunk.content.substring(0, 500), // Store first 500 chars in metadata
              type: 'document_chunk',
              title: document?.title || 'Unknown Document',
              category: document?.category || 'general',
              documentType: document?.documentType || 'document'
            }
          );
          
          successCount++;
          console.log(`✅ Re-indexed chunk ${successCount}/${chunks.length}`);
        } catch (error) {
          errorCount++;
          console.error(`❌ Failed to re-index chunk ${chunk.id}:`, error);
        }
      }
      
      // Small delay between batches
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    console.log(`🎉 Re-indexing completed: ${successCount} success, ${errorCount} errors`);
    
    return {
      success: errorCount === 0,
      totalChunks: chunks.length,
      successCount,
      errorCount
    };
  } catch (error) {
    console.error('❌ Re-indexing error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}