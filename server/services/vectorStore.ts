import { Pinecone } from '@pinecone-database/pinecone';
import OpenAI from 'openai';

interface VectorStoreConfig {
  indexName: string;
  environment?: string;
  dimension: number;
}

export class VectorStore {
  private pinecone?: Pinecone;
  private openai: OpenAI;
  private config: VectorStoreConfig;

  constructor(config: VectorStoreConfig) {
    this.config = config;
    
    // Only initialize if API keys are available
    if (process.env.PINECONE_API_KEY) {
      this.pinecone = new Pinecone({
        apiKey: process.env.PINECONE_API_KEY,
      });
    }
    
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || 'default_key',
    });
  }

  async initialize(): Promise<void> {
    if (!this.pinecone) {
      throw new Error('Pinecone API key not configured');
    }
    
    try {
      // Check if index exists, create if not
      const indexList = await this.pinecone.listIndexes();
      const indexExists = indexList.indexes?.some(index => index.name === this.config.indexName);

      if (!indexExists) {
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
      }
    } catch (error) {
      console.error('Error initializing vector store:', error);
      throw error;
    }
  }

  private async waitForIndexReady(): Promise<void> {
    const maxRetries = 30;
    let retries = 0;
    
    while (retries < maxRetries) {
      try {
        const indexStats = await this.pinecone.index(this.config.indexName).describeIndexStats();
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
      const index = this.pinecone.index(this.config.indexName);
      
      const queryRequest: any = {
        vector: queryEmbedding,
        topK,
        includeMetadata: true,
      };
      
      if (filter) {
        queryRequest.filter = filter;
      }
      
      const response = await index.query(queryRequest);
      
      return response.matches?.map(match => ({
        id: match.id || '',
        score: match.score || 0,
        metadata: match.metadata
      })) || [];
    } catch (error) {
      console.error('Error querying vectors:', error);
      throw error;
    }
  }

  async deleteVector(id: string): Promise<void> {
    try {
      const index = this.pinecone.index(this.config.indexName);
      await index.deleteOne(id);
    } catch (error) {
      console.error('Error deleting vector:', error);
      throw error;
    }
  }

  async deleteVectorsByFilter(filter: Record<string, any>): Promise<void> {
    try {
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
  indexName: process.env.PINECONE_INDEX_NAME || 'medimind-rag',
  dimension: 1536, // text-embedding-3-small dimension
});