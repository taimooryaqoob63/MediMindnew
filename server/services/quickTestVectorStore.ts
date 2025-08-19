/**
 * Quick Test Vector Store - Bypasses reindexing for immediate testing
 */
import { Pinecone } from '@pinecone-database/pinecone';
import OpenAI from 'openai';

export class QuickTestVectorStore {
  private pinecone?: Pinecone;
  private openai?: OpenAI;
  private indexName: string = 'medimind-rag';

  constructor() {
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

  /**
   * Add just a few test diabetes documents quickly
   */
  async addQuickTestData(): Promise<void> {
    if (!this.pinecone || !this.openai) {
      console.log('⚠️ Missing API keys, skipping test data');
      return;
    }

    try {
      const index = this.pinecone.index(this.indexName);
      
      // Add a few essential diabetes chunks for testing
      const testChunks = [
        {
          id: 'test-diabetes-1',
          text: `Type 2 diabetes management in care homes requires regular blood glucose monitoring. According to NICE guidelines, residents should have their blood sugar checked before meals and at bedtime. Normal blood glucose levels should be between 4-7 mmol/L before meals and less than 8.5 mmol/L after meals. If readings are consistently outside these ranges, contact the resident's GP immediately.`,
          metadata: {
            title: 'NICE Guidelines - Diabetes Blood Glucose Monitoring',
            source: 'NICE',
            docType: 'guideline',
            category: 'diabetes_monitoring',
            pageNumber: 1,
            section: 'Blood Glucose Management'
          }
        },
        {
          id: 'test-diabetes-2', 
          text: `Signs of hypoglycemia (low blood sugar) include sweating, shakiness, confusion, and dizziness. This is a medical emergency in care homes. Immediate action: give 15-20g of fast-acting carbohydrates like glucose tablets or sugary drink. Wait 15 minutes, recheck blood sugar. If still low, repeat treatment. Always call 999 if the resident becomes unconscious or cannot swallow safely.`,
          metadata: {
            title: 'Oxford Diabetes Emergency Procedures',
            source: 'Oxford Diabetes',
            docType: 'guideline', 
            category: 'emergency_procedures',
            pageNumber: 2,
            section: 'Hypoglycemia Management'
          }
        },
        {
          id: 'test-diabetes-3',
          text: `Medication administration for diabetes in care homes requires careful timing. Insulin should be given before meals as prescribed. Never skip insulin doses. If a resident refuses to eat after receiving insulin, offer alternative foods or glucose gel. Record all medication times and any issues in the care plan. Staff must be trained in insulin administration and storage requirements.`,
          metadata: {
            title: 'NICE Guidelines - Diabetes Medication Management', 
            source: 'NICE',
            docType: 'guideline',
            category: 'medication_management',
            pageNumber: 3,
            section: 'Insulin Administration'
          }
        },
        {
          id: 'test-diabetes-4',
          text: `Foot care is critical for diabetes residents. Check feet daily for cuts, blisters, swelling, or color changes. Wash feet in warm (not hot) water and dry thoroughly, especially between toes. Use unscented moisturizer but avoid between toes. Cut nails straight across. Any concerns should be reported to the podiatrist or GP immediately as diabetic foot problems can become serious quickly.`,
          metadata: {
            title: 'Oxford Diabetes Foot Care Guidelines',
            source: 'Oxford Diabetes', 
            docType: 'guideline',
            category: 'foot_care',
            pageNumber: 4,
            section: 'Daily Foot Care'
          }
        }
      ];

      console.log('🧪 Adding quick test data for immediate testing...');
      
      for (const chunk of testChunks) {
        // Generate embedding
        const embedding = await this.openai.embeddings.create({
          model: 'text-embedding-3-small',
          input: chunk.text,
        });

        // Upsert to Pinecone
        await index.upsert([{
          id: chunk.id,
          values: embedding.data[0].embedding,
          metadata: {
            ...chunk.metadata,
            content: chunk.text,
            text: chunk.text
          }
        }]);
        
        console.log(`✅ Added test chunk: ${chunk.id}`);
      }
      
      console.log('🎉 Quick test data added successfully!');
      
    } catch (error) {
      console.error('❌ Failed to add test data:', error);
    }
  }

  /**
   * Simple search method for testing
   */
  async searchSimilar(query: string, topK: number = 5): Promise<any[]> {
    if (!this.pinecone || !this.openai) {
      console.log('⚠️ Missing API keys for search');
      return [];
    }

    try {
      // Generate query embedding
      const embedding = await this.openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: query,
      });

      const index = this.pinecone.index(this.indexName);
      
      const queryResponse = await index.query({
        vector: embedding.data[0].embedding,
        topK,
        includeMetadata: true,
      });

      return queryResponse.matches?.map(match => ({
        id: match.id,
        score: match.score,
        pageContent: match.metadata?.content || match.metadata?.text || '',
        metadata: match.metadata
      })) || [];
      
    } catch (error) {
      console.error('❌ Search failed:', error);
      return [];
    }
  }
}

export const quickTestVectorStore = new QuickTestVectorStore();