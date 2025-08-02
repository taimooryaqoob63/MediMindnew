import { ChatOpenAI } from "@langchain/openai";
import { OpenAIEmbeddings } from "@langchain/openai";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { Document } from "langchain/document";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { storage } from "./storage";
import type { Document as DBDocument, DocumentChunk as DBDocumentChunk } from "@shared/schema";

interface DocumentChunk {
  id: string;
  content: string;
  metadata: {
    source: string;
    fileName: string;
    pageNumber?: number;
    chunkIndex: number;
    uploadedAt: string;
  };
  embedding?: number[]; 
}

interface RAGQuery {
  question: string;
  context?: string;
  topK?: number;
}

interface RAGResponse {
  answer: string;
  sources: Array<{
    fileName: string;
    pageNumber?: number;
    content: string;
    relevanceScore: number;
  }>;
}

export class RAGService {
  private llm: ChatOpenAI;
  private embeddings: OpenAIEmbeddings;
  private textSplitter: RecursiveCharacterTextSplitter;
  private documentsPath: string;

  constructor() {
    // Initialize OpenAI LLM - using GPT-4o which is the latest model
    this.llm = new ChatOpenAI({
      openAIApiKey: process.env.OPENAI_API_KEY,
      modelName: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      temperature: 0.7,
      maxTokens: 2000,
    });

    // Initialize embeddings
    this.embeddings = new OpenAIEmbeddings({
      openAIApiKey: process.env.OPENAI_API_KEY,
      modelName: "text-embedding-ada-002",
    });

    // Initialize text splitter for chunking documents
    this.textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
      separators: ["\n\n", "\n", ".", "!", "?", ",", " ", ""],
    });
    
    // Create documents directory if it doesn't exist
    this.documentsPath = path.join(process.cwd(), "uploaded_documents");
    if (!fs.existsSync(this.documentsPath)) {
      fs.mkdirSync(this.documentsPath, { recursive: true });
    }
  }

  /**
   * Process a PDF file and store its chunks with embeddings in the database
   * Note: Currently creates a placeholder document - actual PDF text extraction to be implemented
   */
  async processPDFDocument(filePath: string, fileName: string, originalName: string, uploadedBy: string): Promise<DBDocument> {
    try {
      const stats = fs.statSync(filePath);
      
      // Create document record in database
      const document = await storage.createDocument({
        fileName,
        originalName,
        filePath,
        fileSize: stats.size,
        mimeType: "application/pdf",
        uploadedBy,
        processed: false,
        chunkCount: 0,
      });
      
      // For now, create a sample text chunk indicating PDF was uploaded
      // TODO: Implement actual PDF text extraction
      const sampleText = `PDF Document: ${originalName}\nThis is a placeholder for PDF content extraction. The document has been uploaded and stored successfully.`;
      
      // Split text into chunks
      const docs = await this.textSplitter.createDocuments([sampleText], [{
        source: filePath,
        fileName: fileName,
        originalName,
        totalPages: 1,
      }]);

      const chunkIds: string[] = [];

      // Process each chunk
      for (let i = 0; i < docs.length; i++) {
        const doc = docs[i];
        
        // Generate embedding for the chunk
        const embedding = await this.embeddings.embedQuery(doc.pageContent);
        
        // Store chunk in database
        const chunk = await storage.createDocumentChunk({
          documentId: document.id,
          content: doc.pageContent,
          chunkIndex: i,
          embedding: JSON.stringify(embedding),
          metadata: {
            source: filePath,
            fileName: fileName,
            originalName,
            pageNumber: null,
            totalPages: 1,
          },
        });

        chunkIds.push(chunk.id);
      }

      // Update document as processed
      const updatedDocument = await storage.updateDocument(document.id, {
        processed: true,
        chunkCount: chunkIds.length,
      });

      console.log(`Successfully processed PDF: ${originalName} into ${chunkIds.length} chunks`);
      return updatedDocument;

    } catch (error) {
      console.error(`Error processing PDF ${fileName}:`, error);
      throw new Error(`Failed to process PDF: ${error.message}`);
    }
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private calculateCosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Retrieve relevant documents for a query using semantic search
   */
  async retrieveRelevantDocuments(query: string, topK: number = 5): Promise<DBDocumentChunk[]> {
    try {
      // Generate embedding for the query
      const queryEmbedding = await this.embeddings.embedQuery(query);
      
      // Get all document chunks from database (in a real implementation you'd use a vector database)
      const allChunks = await storage.searchDocumentChunks(queryEmbedding, topK * 3);
      
      // Calculate similarity scores and rank
      const scoredChunks = allChunks
        .map(chunk => {
          if (!chunk.embedding) return { chunk, score: 0 };
          
          try {
            const chunkEmbedding = JSON.parse(chunk.embedding);
            const similarity = this.calculateCosineSimilarity(queryEmbedding, chunkEmbedding);
            return { chunk, score: similarity };
          } catch (error) {
            console.error("Error parsing embedding:", error);
            return { chunk, score: 0 };
          }
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, topK);

      return scoredChunks.map(item => item.chunk);
    } catch (error) {
      console.error("Error retrieving relevant documents:", error);
      return [];
    }
  }

  /**
   * Generate an answer using RAG (Retrieval-Augmented Generation)
   */
  async generateRAGResponse(ragQuery: RAGQuery): Promise<RAGResponse> {
    try {
      const { question, context = "", topK = 5 } = ragQuery;

      // Retrieve relevant documents
      const relevantDocs = await this.retrieveRelevantDocuments(question, topK);
      
      if (relevantDocs.length === 0) {
        // No relevant documents found, use base knowledge
        const response = await this.llm.invoke(this.createFallbackPrompt(question, context));
        
        return {
          answer: response.content || response.toString(),
          sources: [],
        };
      }

      // Create context from retrieved documents
      const retrievedContext = relevantDocs
        .map((doc, index) => `[Source ${index + 1} - ${doc.metadata?.originalName || doc.metadata?.fileName || 'Document'}]: ${doc.content}`)
        .join("\n\n");

      // Create enhanced prompt with retrieved context
      const prompt = this.createRAGPrompt(question, retrievedContext, context);
      
      // Generate response using LLM
      const answer = await this.llm.invoke(prompt);

      // Prepare sources information
      const sources = relevantDocs.map((doc, index) => ({
        fileName: doc.metadata?.originalName || doc.metadata?.fileName || 'Unknown Document',
        pageNumber: doc.metadata?.pageNumber,
        content: doc.content.substring(0, 200) + "...", // Truncate for brevity
        relevanceScore: 1 - (index / relevantDocs.length), // Simple relevance scoring
      }));

      return {
        answer: answer.content || answer.toString(),
        sources,
      };

    } catch (error) {
      console.error("Error generating RAG response:", error);
      throw new Error(`Failed to generate response: ${error.message}`);
    }
  }

  /**
   * Create a RAG prompt with retrieved context
   */
  private createRAGPrompt(question: string, retrievedContext: string, additionalContext: string): string {
    return `You are a friendly AI tutor helping healthcare workers learn about diabetes care. You explain things in simple, easy-to-understand language.

REFERENCE INFORMATION:
${retrievedContext}

ADDITIONAL CONTEXT:
${additionalContext}

STUDENT QUESTION: ${question}

INSTRUCTIONS:
- Act like a helpful, patient tutor speaking to a student
- Use the reference information to answer the question accurately
- Explain in simple, clear English - avoid medical jargon
- Be concise and direct - keep answers short (2-3 sentences maximum)
- Make it conversational and friendly
- Focus on practical advice that care workers can easily understand and use
- Base your answer primarily on the reference information provided
- If you don't have enough information in the references, say "Based on general diabetes care knowledge..." and then provide the answer
- Always prioritize information from the uploaded documents when available

Respond as a friendly tutor would in a conversation:`;
  }

  /**
   * Create fallback prompt when no relevant documents are found
   */
  private createFallbackPrompt(question: string, context: string): string {
    return `You are a friendly AI tutor helping healthcare workers learn about diabetes care. You explain things in simple, easy-to-understand language.

CONTEXT: ${context}

STUDENT QUESTION: ${question}

INSTRUCTIONS:
- Act like a helpful, patient tutor speaking to a student
- Use simple, clear English - avoid medical jargon
- Be concise and direct - keep answers short (2-3 sentences maximum)
- Make it conversational and friendly
- Focus on practical advice that care workers can easily understand and use
- Base your answer on established diabetes care best practices
- If you're not sure about something specific, just say "I'd recommend checking with a healthcare professional about that"

Respond as a friendly tutor would in a conversation:`;
  }

  /**
   * Get information about stored documents
   */
  async getStoredDocuments(userId?: string): Promise<DBDocument[]> {
    try {
      return await storage.getDocuments(userId);
    } catch (error) {
      console.error("Error getting stored documents:", error);
      return [];
    }
  }

  /**
   * Delete a document and all its chunks
   */
  async deleteDocument(documentId: string): Promise<boolean> {
    try {
      const result = await storage.deleteDocument(documentId);
      if (result) {
        console.log(`Successfully deleted document ${documentId}`);
      }
      return result;
    } catch (error) {
      console.error(`Error deleting document ${documentId}:`, error);
      return false;
    }
  }
}

// Export singleton instance
export const ragService = new RAGService();