
import fs from "fs/promises";
import path from "path";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { OpenAIEmbeddings } from "@langchain/openai";
import { FaissStore } from "@langchain/community/vectorstores/faiss";
import { Document } from "@langchain/core/documents";

export class DocumentProcessor {
  private documentsDir = "./documents";
  private vectorStoreDir = "./vector_store";
  private vectorStore: FaissStore | null = null;
  private embeddings: OpenAIEmbeddings;
  private initialized = false;

  constructor() {
    this.embeddings = new OpenAIEmbeddings({
      openAIApiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_ENV_VAR || "default_key",
      modelName: "text-embedding-3-small", // More cost-effective embedding model
    });
  }

  async initializeVectorStore(): Promise<void> {
    try {
      console.log("Initializing document processor with vector store...");
      
      // Create necessary directories
      await fs.mkdir(this.documentsDir, { recursive: true });
      await fs.mkdir(this.vectorStoreDir, { recursive: true });

      // Try to load existing vector store
      try {
        const indexPath = path.join(this.vectorStoreDir, "docstore.json");
        await fs.access(indexPath);
        console.log("Loading existing vector store...");
        this.vectorStore = await FaissStore.load(this.vectorStoreDir, this.embeddings);
        console.log("Existing vector store loaded successfully");
      } catch (error) {
        console.log("No existing vector store found, will create new one when documents are added");
      }

      this.initialized = true;
    } catch (error) {
      console.error("Error initializing document processor:", error);
      throw error;
    }
  }

  async processDocuments(): Promise<void> {
    try {
      await fs.mkdir(this.documentsDir, { recursive: true });
      const files = await fs.readdir(this.documentsDir);
      const pdfFiles = files.filter(file => file.toLowerCase().endsWith('.pdf'));
      
      console.log(`Processing ${pdfFiles.length} PDF files...`);
      
      if (pdfFiles.length === 0) {
        console.log("No PDF files found to process");
        return;
      }

      const allDocuments: Document[] = [];

      for (const filename of pdfFiles) {
        const filePath = path.join(this.documentsDir, filename);
        console.log(`Processing: ${filename}`);
        
        try {
          const loader = new PDFLoader(filePath);
          const documents = await loader.load();
          
          // Add metadata to documents
          const category = this.categorizeDocument(filename);
          documents.forEach(doc => {
            doc.metadata = {
              ...doc.metadata,
              filename,
              category,
              source: filePath
            };
          });

          allDocuments.push(...documents);
        } catch (error) {
          console.error(`Error processing ${filename}:`, error);
        }
      }

      if (allDocuments.length > 0) {
        // Split documents into chunks
        const textSplitter = new RecursiveCharacterTextSplitter({
          chunkSize: 1000,
          chunkOverlap: 200,
        });

        const splitDocuments = await textSplitter.splitDocuments(allDocuments);
        console.log(`Split into ${splitDocuments.length} chunks`);

        // Create or update vector store
        if (this.vectorStore) {
          // Add new documents to existing store
          await this.vectorStore.addDocuments(splitDocuments);
        } else {
          // Create new vector store
          this.vectorStore = await FaissStore.fromDocuments(
            splitDocuments,
            this.embeddings
          );
        }

        // Save vector store
        await this.vectorStore.save(this.vectorStoreDir);
        console.log(`Vector store saved with ${splitDocuments.length} document chunks`);
      }
    } catch (error) {
      console.error("Error processing documents:", error);
      throw error;
    }
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

    if (!this.vectorStore) {
      console.log("No vector store available, processing documents first...");
      await this.processDocuments();
    }

    if (!this.vectorStore) {
      console.log("No documents available for search");
      return [];
    }

    try {
      console.log(`Searching for: "${query}"`);
      const results = await this.vectorStore.similaritySearch(query, k);
      console.log(`Found ${results.length} relevant document chunks`);
      return results;
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
      
      const loader = new PDFLoader(filePath);
      const documents = await loader.load();
      
      // Add metadata
      const category = this.categorizeDocument(filename);
      documents.forEach(doc => {
        doc.metadata = {
          ...doc.metadata,
          filename,
          category,
          source: filePath
        };
      });

      // Split documents
      const textSplitter = new RecursiveCharacterTextSplitter({
        chunkSize: 1000,
        chunkOverlap: 200,
      });

      const splitDocuments = await textSplitter.splitDocuments(documents);
      console.log(`Split new document into ${splitDocuments.length} chunks`);

      // Add to vector store
      if (this.vectorStore) {
        await this.vectorStore.addDocuments(splitDocuments);
      } else {
        this.vectorStore = await FaissStore.fromDocuments(
          splitDocuments,
          this.embeddings
        );
      }

      // Save updated vector store
      await this.vectorStore.save(this.vectorStoreDir);
      console.log(`Document ${filename} processed and added to vector store`);
    } catch (error) {
      console.error("Error adding document:", error);
      throw error;
    }
  }

  // Method to rebuild the entire vector store
  async rebuildVectorStore(): Promise<void> {
    try {
      console.log("Rebuilding vector store from all documents...");
      this.vectorStore = null;
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
