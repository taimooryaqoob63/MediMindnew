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

  async createEmbedding(text: string): Promise<number[]> {
    if (!this.openai) {
      throw new Error('OpenAI not configured');
    }
    
    try {
      const response = await this.openai.embeddings.create({
        model: 'text-embedding-3-small',
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
      // Create embedding for the query
      const embedding = await this.createEmbedding(query);
      
      // Query vectors
      const vectors = await this.queryVectors(embedding, topK, filter);
      
      // Transform results to expected format
      return vectors.map(vector => ({
        id: vector.id,
        title: vector.metadata?.title || 'Unknown Document',
        excerpt: vector.metadata?.content || 'No content available',
        score: vector.score,
        type: vector.metadata?.type || 'document',
        pageNumber: vector.metadata?.page,
        section: vector.metadata?.section,
        clickable: true,
      }));
    } catch (error) {
      console.error('Error in searchSimilar:', error);
      // Return empty array on error to prevent app crash
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
}

// Initialize global vector store instance
export const vectorStore = new VectorStore({
  indexName: process.env.PINECONE_INDEX_NAME || 'quickstart',
  dimension: 1536, // text-embedding-3-small dimension
});