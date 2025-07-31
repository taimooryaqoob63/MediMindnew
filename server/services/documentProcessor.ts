import fs from "fs/promises";
import path from "path";
import OpenAI from "openai";

// Document interface for compatibility
interface Document {
  pageContent: string;
  metadata: Record<string, any>;
}

// Vector store interface for document chunks with embeddings
interface DocumentChunk {
  id: string;
  content: string;
  embedding: number[];
  metadata: {
    filename: string;
    category: string;
    source: string;
    chunkIndex: number;
  };
}

export class DocumentProcessor {
  private documentsDir = "./documents";
  private vectorStoreDir = "./vector_store";
  private initialized = false;
  private documentChunks: DocumentChunk[] = [];
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_ENV_VAR || "default_key",
    });
  }

  async initializeVectorStore(): Promise<void> {
    try {
      console.log("Initializing document processor with OpenAI embeddings...");
      
      // Create necessary directories
      await fs.mkdir(this.documentsDir, { recursive: true });
      await fs.mkdir(this.vectorStoreDir, { recursive: true });

      // Try to load existing vector store
      try {
        const vectorStorePath = path.join(this.vectorStoreDir, "chunks.json");
        await fs.access(vectorStorePath);
        console.log("Loading existing vector store...");
        
        const data = await fs.readFile(vectorStorePath, 'utf-8');
        this.documentChunks = JSON.parse(data);
        console.log(`Loaded ${this.documentChunks.length} document chunks from existing store`);
      } catch (error) {
        console.log("No existing vector store found, will create sample documents");
        await this.createSampleDocuments();
      }

      this.initialized = true;
      console.log("Document processor initialized successfully");
    } catch (error) {
      console.error("Error initializing document processor:", error);
      throw error;
    }
  }

  private async createSampleDocuments(): Promise<void> {
    console.log("Creating sample diabetes care documents...");
    
    const sampleDocuments = [
      {
        filename: "NICE_diabetes_guidelines.txt",
        category: "NICE",
        content: `NICE Guidelines for Diabetes Management in Care Settings

Blood Glucose Monitoring:
- Check blood glucose levels before meals and at bedtime for residents with diabetes
- Target blood glucose ranges: 4-7 mmol/L before meals, 5-9 mmol/L 2 hours after meals
- Use appropriate testing equipment and ensure staff are trained in its use
- Record all readings in the resident's care plan

Medication Administration:
- Insulin must be stored in refrigerator between 2-8°C
- Check expiry dates before each administration
- Rotate injection sites to prevent lipodystrophy
- Never share insulin pens between residents
- Monitor for signs of hypoglycemia after insulin administration

Hypoglycemia Management:
- Recognize symptoms: sweating, trembling, confusion, dizziness
- If conscious: give 15-20g quick-acting carbohydrates (glucose tablets, fruit juice)
- Recheck blood glucose after 15 minutes
- If unconscious: call emergency services immediately, do not give oral treatment
- Follow up with complex carbohydrates once conscious

Dietary Management:
- Provide consistent carbohydrate intake with meals
- Encourage regular meal times
- Monitor portion sizes and record food intake
- Ensure adequate hydration
- Consider individual dietary preferences and cultural needs

Emergency Procedures:
- Contact healthcare provider if blood glucose <4 mmol/L or >15 mmol/L
- Document all incidents and interventions
- Ensure emergency contact numbers are readily available
- Staff must know location of emergency glucose supplies`
      },
      {
        filename: "NHS_diabetes_care_standards.txt",
        category: "NHS",
        content: `NHS Standards for Diabetes Care in Residential Settings

Care Planning:
- Individual care plans must be developed for each resident with diabetes
- Plans should include medication schedules, dietary requirements, and monitoring protocols
- Regular review of care plans with healthcare professionals
- Involve residents and families in care planning decisions

Staff Training Requirements:
- All care staff must receive diabetes awareness training annually
- Training must cover: blood glucose monitoring, medication administration, recognizing complications
- Maintain training records and ensure competency assessments
- Designated diabetes link worker in each care setting

Medication Management:
- Accurate medication administration records (MAR)
- Regular medication reviews with prescribing clinician
- Proper storage and disposal of diabetes medications
- Understanding of different insulin types and their actions
- Knowledge of medication interactions

Monitoring and Documentation:
- Daily blood glucose monitoring as prescribed
- Weekly weight monitoring
- Monthly review of overall diabetes management
- Annual eye, foot, and kidney checks
- Comprehensive documentation of all care provided

Quality Assurance:
- Regular audits of diabetes care provision
- Feedback from residents and families
- Continuous improvement of care standards
- Collaboration with local diabetes teams`
      },
      {
        filename: "CQC_diabetes_requirements.txt",
        category: "CQC",
        content: `CQC Requirements for Diabetes Care Quality

Fundamental Standards:
- Safe care and treatment for all residents with diabetes
- Safeguarding people from abuse and improper treatment
- Meeting nutritional and hydration needs
- Premises and equipment fit for purpose
- Staffing levels appropriate for safe care delivery

Person-Centered Care:
- Care plans reflect individual needs and preferences
- Residents involved in decisions about their care
- Cultural and religious dietary requirements respected
- Regular communication with residents about their condition
- Support for self-management where appropriate

Safety Requirements:
- Risk assessments for diabetes-related complications
- Clear protocols for emergency situations
- Regular equipment calibration and maintenance
- Incident reporting and learning systems
- Medicine management policies and procedures

Staff Competency:
- Evidence of diabetes training for all relevant staff
- Regular supervision and competency assessments
- Clear roles and responsibilities defined
- Access to specialist advice when needed
- Continuing professional development opportunities

Governance and Leadership:
- Clear leadership structure for diabetes care
- Regular monitoring of care quality
- Audit systems to track outcomes
- Policies and procedures regularly reviewed
- Engagement with external healthcare providers

Documentation Standards:
- Accurate and timely record keeping
- Evidence of care plan reviews
- Monitoring of key health indicators
- Incident reporting and follow-up actions
- Continuous quality improvement evidence`
      }
    ];

    // Create sample documents
    for (const doc of sampleDocuments) {
      const filePath = path.join(this.documentsDir, doc.filename);
      await fs.writeFile(filePath, doc.content);
      console.log(`Created sample document: ${doc.filename}`);
    }

    // Process the sample documents
    await this.processDocuments();
  }

  async processDocuments(): Promise<void> {
    try {
      await fs.mkdir(this.documentsDir, { recursive: true });
      const files = await fs.readdir(this.documentsDir);
      const textFiles = files.filter(file => file.toLowerCase().endsWith('.txt'));
      
      console.log(`Processing ${textFiles.length} text files...`);
      
      if (textFiles.length === 0) {
        console.log("No text files found to process");
        return;
      }

      // Clear existing chunks for fresh processing
      this.documentChunks = [];
      
      for (const filename of textFiles) {
        const filePath = path.join(this.documentsDir, filename);
        console.log(`Processing: ${filename}`);
        
        try {
          await this.processSingleDocument(filePath);
        } catch (error) {
          console.error(`Error processing ${filename}:`, error);
        }
      }

      if (this.documentChunks.length > 0) {
        // Save vector store
        await this.saveVectorStore();
        console.log(`Vector store saved with ${this.documentChunks.length} document chunks`);
      }
    } catch (error) {
      console.error("Error processing documents:", error);
      throw error;
    }
  }

  private async processSingleDocument(filePath: string): Promise<void> {
    const filename = path.basename(filePath);
    const fullText = await fs.readFile(filePath, 'utf-8');
    
    if (!fullText || fullText.trim().length === 0) {
      console.log(`No text content found in ${filename}`);
      return;
    }

    // Split text into chunks
    const chunks = this.splitTextIntoChunks(fullText, 1000, 200);
    const category = this.categorizeDocument(filename);
    
    console.log(`Split ${filename} into ${chunks.length} chunks`);

    // Generate embeddings for each chunk
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      if (chunk.trim().length < 50) continue; // Skip very short chunks
      
      try {
        const embedding = await this.generateEmbedding(chunk);
        
        const documentChunk: DocumentChunk = {
          id: `${filename}_${i}`,
          content: chunk,
          embedding,
          metadata: {
            filename,
            category,
            source: filePath,
            chunkIndex: i
          }
        };
        
        this.documentChunks.push(documentChunk);
        
        // Add a small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`Error generating embedding for chunk ${i} of ${filename}:`, error);
      }
    }
  }

  private splitTextIntoChunks(text: string, chunkSize: number, overlap: number): string[] {
    const chunks: string[] = [];
    const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
    
    let currentChunk = '';
    let currentSize = 0;
    
    for (const paragraph of paragraphs) {
      const paragraphLength = paragraph.length;
      
      if (currentSize + paragraphLength > chunkSize && currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
        
        // Start new chunk with some overlap
        const sentences = currentChunk.split(/[.!?]+/).filter(s => s.trim().length > 0);
        const overlapSentences = sentences.slice(-2); // Keep last 2 sentences for overlap
        currentChunk = overlapSentences.join('. ') + '. ' + paragraph;
        currentSize = currentChunk.length;
      } else {
        currentChunk += '\n\n' + paragraph;
        currentSize += paragraphLength;
      }
    }
    
    if (currentChunk.trim().length > 0) {
      chunks.push(currentChunk.trim());
    }
    
    return chunks;
  }

  private async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await this.openai.embeddings.create({
        model: "text-embedding-3-small",
        input: text.replace(/\n/g, ' ').trim(),
      });
      
      return response.data[0].embedding;
    } catch (error) {
      console.error("Error generating embedding:", error);
      throw error;
    }
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  private categorizeDocument(filename: string): string {
    const lower = filename.toLowerCase();
    if (lower.includes('nice') || lower.includes('cks')) return 'NICE';
    if (lower.includes('nhs')) return 'NHS';
    if (lower.includes('cqc')) return 'CQC';
    return 'General';
  }

  async searchDocuments(query: string, k: number = 4): Promise<Document[]> {
    if (!this.initialized) {
      await this.initializeVectorStore();
    }

    if (this.documentChunks.length === 0) {
      console.log("No documents available for search, processing documents first...");
      await this.processDocuments();
    }

    if (this.documentChunks.length === 0) {
      console.log("No documents available for search");
      return [];
    }

    try {
      console.log(`Searching for: "${query}" in ${this.documentChunks.length} chunks`);
      
      // Generate embedding for the query
      const queryEmbedding = await this.generateEmbedding(query);
      
      // Calculate similarities and sort
      const similarities = this.documentChunks.map(chunk => ({
        chunk,
        similarity: this.cosineSimilarity(queryEmbedding, chunk.embedding)
      }));
      
      similarities.sort((a, b) => b.similarity - a.similarity);
      
      // Return top k results
      const topResults = similarities.slice(0, k);
      console.log(`Found ${topResults.length} relevant document chunks (top similarity: ${topResults[0]?.similarity.toFixed(3)})`);
      
      return topResults.map(result => ({
        pageContent: result.chunk.content,
        metadata: result.chunk.metadata
      }));
    } catch (error) {
      console.error("Error searching documents:", error);
      return [];
    }
  }

  async addDocument(filePath: string): Promise<void> {
    try {
      if (!this.initialized) {
        await this.initializeVectorStore();
      }

      const filename = path.basename(filePath);
      console.log(`Processing new document: ${filename}`);
      
      await this.processSingleDocument(filePath);
      await this.saveVectorStore();
      
      console.log(`Document ${filename} processed and added to vector store`);
    } catch (error) {
      console.error("Error adding document:", error);
      throw error;
    }
  }

  private async saveVectorStore(): Promise<void> {
    try {
      const vectorStorePath = path.join(this.vectorStoreDir, "chunks.json");
      await fs.writeFile(vectorStorePath, JSON.stringify(this.documentChunks, null, 2));
      console.log("Vector store saved successfully");
    } catch (error) {
      console.error("Error saving vector store:", error);
      throw error;
    }
  }

  // Method to rebuild the entire vector store
  async rebuildVectorStore(): Promise<void> {
    try {
      console.log("Rebuilding vector store from all documents...");
      this.documentChunks = [];
      await this.processDocuments();
      console.log("Vector store rebuilt successfully");
    } catch (error) {
      console.error("Error rebuilding vector store:", error);
      throw error;
    }
  }
}

// Create singleton instance
export const documentProcessor = new DocumentProcessor();