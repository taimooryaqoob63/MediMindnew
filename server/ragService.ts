import { ChatOpenAI } from "@langchain/openai";
import { OpenAIEmbeddings } from "@langchain/openai";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { Document } from "langchain/document";
// Dynamic import to avoid initialization issues
let pdfParse: any;
const loadPdfParse = async () => {
  if (!pdfParse) {
    try {
      const pdfParseModule = await import("pdf-parse");
      pdfParse = pdfParseModule.default;
    } catch (error) {
      console.warn("pdf-parse could not be loaded:", error.message);
    }
  }
  return pdfParse;
};
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
   */
  async processPDFDocument(filePath: string, fileName: string, originalName: string, uploadedBy: string): Promise<DBDocument> {
    try {
      // Ensure pdf-parse is loaded
      await loadPdfParse();
      if (!pdfParse) {
        throw new Error("PDF parsing is not available. Please install pdf-parse package.");
      }
      
      // Read and parse PDF
      const dataBuffer = fs.readFileSync(filePath);
      const pdfData = await pdfParse(dataBuffer);
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
      
      // Extract text content
      const fullText = pdfData.text;
      
      // Split text into chunks
      const docs = await this.textSplitter.createDocuments([fullText], [{
        source: filePath,
        fileName: fileName,
        originalName,
        totalPages: pdfData.numpages,
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
            pageNumber: null, // PDF parsing doesn't give us page numbers directly
            totalPages: pdfData.numpages,
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
          answer: response,
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
        answer,
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
    return `You are an AI tutor specializing in diabetes care for healthcare workers in care homes and nursing facilities. You provide evidence-based guidance following NICE guidelines, NHS best practices, and CQC requirements.

RETRIEVED CONTEXT FROM UPLOADED DOCUMENTS:
${retrievedContext}

ADDITIONAL CONTEXT:
${additionalContext}

QUESTION: ${question}

INSTRUCTIONS:
- Base your answer primarily on the retrieved context from the uploaded documents
- Supplement with your knowledge of NICE guidelines, NHS practices, and CQC requirements
- If the retrieved context doesn't contain relevant information, clearly state this and provide general diabetes care guidance
- Always emphasize safety protocols and recommend consulting healthcare professionals for specific medical decisions
- Provide practical, actionable advice suitable for care home staff
- Include relevant source references when using information from the uploaded documents

Please provide a comprehensive answer that combines the retrieved information with established diabetes care guidelines:`;
  }

  /**
   * Create fallback prompt when no relevant documents are found
   */
  private createFallbackPrompt(question: string, context: string): string {
    return `You are an AI tutor specializing in diabetes care for healthcare workers in care homes and nursing facilities. You provide evidence-based guidance following NICE guidelines, NHS best practices, and CQC requirements.

CONTEXT: ${context}

QUESTION: ${question}

INSTRUCTIONS:
- Provide answers based on established NICE guidelines, NHS best practices, and CQC requirements
- Note that you don't have access to any specific uploaded documents for this query
- Always emphasize safety protocols and recommend consulting healthcare professionals for specific medical decisions
- Provide practical, actionable advice suitable for care home staff

Please provide a comprehensive answer based on established diabetes care guidelines:`;
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