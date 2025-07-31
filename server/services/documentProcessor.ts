
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { OpenAIEmbeddings } from "@langchain/openai";
import { FaissStore } from "@langchain/community/vectorstores/faiss";
import { Document } from "@langchain/core/documents";
import fs from "fs/promises";
import path from "path";

export class DocumentProcessor {
  private vectorStore: FaissStore | null = null;
  private embeddings: OpenAIEmbeddings;
  private documentsDir = "./documents";
  private vectorStoreDir = "./vector_store";

  constructor() {
    this.embeddings = new OpenAIEmbeddings({
      openAIApiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_ENV_VAR
    });
  }

  async initializeVectorStore(): Promise<void> {
    try {
      // Try to load existing vector store
      if (await this.vectorStoreExists()) {
        console.log("Loading existing vector store...");
        this.vectorStore = await FaissStore.load(this.vectorStoreDir, this.embeddings);
        return;
      }

      // Create new vector store from documents
      console.log("Creating new vector store from documents...");
      await this.processDocuments();
    } catch (error) {
      console.error("Error initializing vector store:", error);
      throw error;
    }
  }

  private async vectorStoreExists(): Promise<boolean> {
    try {
      const indexPath = path.join(this.vectorStoreDir, "faiss.index");
      await fs.access(indexPath);
      return true;
    } catch {
      return false;
    }
  }

  async processDocuments(): Promise<void> {
    try {
      // Ensure documents directory exists
      await fs.mkdir(this.documentsDir, { recursive: true });
      
      // Get all PDF files from documents directory
      const files = await fs.readdir(this.documentsDir);
      const pdfFiles = files.filter(file => file.toLowerCase().endsWith('.pdf'));

      if (pdfFiles.length === 0) {
        console.log("No PDF files found in documents directory");
        // Create empty vector store
        const emptyDocs = [new Document({ pageContent: "No documents loaded yet.", metadata: { source: "empty" } })];
        this.vectorStore = await FaissStore.fromDocuments(emptyDocs, this.embeddings);
        await this.vectorStore.save(this.vectorStoreDir);
        return;
      }

      console.log(`Processing ${pdfFiles.length} PDF files...`);
      
      const allDocuments: Document[] = [];

      // Process each PDF file
      for (const pdfFile of pdfFiles) {
        const filePath = path.join(this.documentsDir, pdfFile);
        console.log(`Processing: ${pdfFile}`);

        try {
          const loader = new PDFLoader(filePath);
          const docs = await loader.load();

          // Add metadata to identify the source
          const category = this.categorizeDocument(pdfFile);
          docs.forEach(doc => {
            doc.metadata = {
              ...doc.metadata,
              source: pdfFile,
              category: category,
              filename: pdfFile
            };
          });

          allDocuments.push(...docs);
        } catch (error) {
          console.error(`Error processing ${pdfFile}:`, error);
        }
      }

      if (allDocuments.length === 0) {
        throw new Error("No documents could be processed");
      }

      // Split documents into chunks
      const textSplitter = new RecursiveCharacterTextSplitter({
        chunkSize: 1000,
        chunkOverlap: 200,
      });

      const splitDocs = await textSplitter.splitDocuments(allDocuments);
      console.log(`Created ${splitDocs.length} document chunks`);

      // Create vector store
      this.vectorStore = await FaissStore.fromDocuments(splitDocs, this.embeddings);
      
      // Save vector store
      await fs.mkdir(this.vectorStoreDir, { recursive: true });
      await this.vectorStore.save(this.vectorStoreDir);
      
      console.log("Vector store created and saved successfully");
    } catch (error) {
      console.error("Error processing documents:", error);
      throw error;
    }
  }

  private categorizeDocument(filename: string): string {
    const lower = filename.toLowerCase();
    if (lower.includes('nice')) return 'NICE';
    if (lower.includes('nhs')) return 'NHS';
    if (lower.includes('cqc')) return 'CQC';
    return 'General';
  }

  async searchDocuments(query: string, k: number = 4): Promise<Document[]> {
    if (!this.vectorStore) {
      await this.initializeVectorStore();
    }

    if (!this.vectorStore) {
      throw new Error("Vector store not initialized");
    }

    const results = await this.vectorStore.similaritySearch(query, k);
    return results;
  }

  async addDocument(filePath: string): Promise<void> {
    try {
      console.log(`Adding new document: ${filePath}`);
      
      const loader = new PDFLoader(filePath);
      const docs = await loader.load();

      const filename = path.basename(filePath);
      const category = this.categorizeDocument(filename);
      
      docs.forEach(doc => {
        doc.metadata = {
          ...doc.metadata,
          source: filename,
          category: category,
          filename: filename
        };
      });

      const textSplitter = new RecursiveCharacterTextSplitter({
        chunkSize: 1000,
        chunkOverlap: 200,
      });

      const splitDocs = await textSplitter.splitDocuments(docs);

      if (!this.vectorStore) {
        await this.initializeVectorStore();
      }

      // Add to existing vector store
      await this.vectorStore!.addDocuments(splitDocs);
      await this.vectorStore!.save(this.vectorStoreDir);
      
      console.log(`Successfully added ${splitDocs.length} chunks from ${filename}`);
    } catch (error) {
      console.error("Error adding document:", error);
      throw error;
    }
  }
}

// Create singleton instance
export const documentProcessor = new DocumentProcessor();
