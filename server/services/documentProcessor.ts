
import fs from 'fs';
import path from 'path';
import { PDFLoader } from "langchain/document_loaders/fs/pdf";
import { DocxLoader } from "langchain/document_loaders/fs/docx";
import { TextLoader } from "langchain/document_loaders/fs/text";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { OpenAIEmbeddings } from "@langchain/openai";
import { FaissStore } from "@langchain/community/vectorstores/faiss";
import { Document } from "langchain/document";

export class DocumentProcessor {
  private embeddings: OpenAIEmbeddings;
  private vectorStore: FaissStore | null = null;
  private documentsPath = path.join(process.cwd(), 'documents');
  private vectorStorePath = path.join(process.cwd(), 'vectorstore');

  constructor() {
    this.embeddings = new OpenAIEmbeddings({
      openAIApiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_ENV_VAR || "default_key",
    });
    
    // Ensure directories exist
    if (!fs.existsSync(this.documentsPath)) {
      fs.mkdirSync(this.documentsPath, { recursive: true });
    }
    if (!fs.existsSync(this.vectorStorePath)) {
      fs.mkdirSync(this.vectorStorePath, { recursive: true });
    }
  }

  async loadDocuments(): Promise<Document[]> {
    const documents: Document[] = [];
    
    if (!fs.existsSync(this.documentsPath)) {
      console.log('Documents directory does not exist');
      return documents;
    }

    const files = fs.readdirSync(this.documentsPath);
    
    for (const file of files) {
      const filePath = path.join(this.documentsPath, file);
      const ext = path.extname(file).toLowerCase();
      
      try {
        let loader;
        
        switch (ext) {
          case '.pdf':
            loader = new PDFLoader(filePath);
            break;
          case '.docx':
            loader = new DocxLoader(filePath);
            break;
          case '.txt':
            loader = new TextLoader(filePath);
            break;
          default:
            console.log(`Unsupported file type: ${ext}`);
            continue;
        }
        
        const docs = await loader.load();
        
        // Add metadata to identify the source
        docs.forEach(doc => {
          doc.metadata = {
            ...doc.metadata,
            source: file,
            category: this.getCategoryFromFilename(file)
          };
        });
        
        documents.push(...docs);
        console.log(`Loaded ${docs.length} documents from ${file}`);
      } catch (error) {
        console.error(`Error loading ${file}:`, error);
      }
    }
    
    return documents;
  }

  private getCategoryFromFilename(filename: string): string {
    const lower = filename.toLowerCase();
    if (lower.includes('nice')) return 'NICE';
    if (lower.includes('nhs')) return 'NHS';
    if (lower.includes('cqc')) return 'CQC';
    if (lower.includes('diabetes')) return 'diabetes';
    return 'guideline';
  }

  async splitDocuments(documents: Document[]): Promise<Document[]> {
    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
      separators: ["\n\n", "\n", ". ", " ", ""],
    });
    
    return await textSplitter.splitDocuments(documents);
  }

  async createVectorStore(documents: Document[]): Promise<void> {
    console.log('Creating vector store from documents...');
    
    if (documents.length === 0) {
      console.log('No documents to process');
      return;
    }

    // Split documents into chunks
    const splitDocs = await this.splitDocuments(documents);
    console.log(`Split into ${splitDocs.length} chunks`);

    // Create vector store
    this.vectorStore = await FaissStore.fromDocuments(splitDocs, this.embeddings);
    
    // Save vector store to disk
    await this.vectorStore.save(this.vectorStorePath);
    console.log('Vector store created and saved');
  }

  async loadVectorStore(): Promise<void> {
    try {
      this.vectorStore = await FaissStore.load(this.vectorStorePath, this.embeddings);
      console.log('Vector store loaded from disk');
    } catch (error) {
      console.log('No existing vector store found, will create new one');
      await this.initializeVectorStore();
    }
  }

  async initializeVectorStore(): Promise<void> {
    const documents = await this.loadDocuments();
    if (documents.length > 0) {
      await this.createVectorStore(documents);
    }
  }

  async searchSimilarDocuments(query: string, k: number = 4): Promise<Document[]> {
    if (!this.vectorStore) {
      await this.loadVectorStore();
    }
    
    if (!this.vectorStore) {
      console.log('No vector store available');
      return [];
    }

    try {
      const results = await this.vectorStore.similaritySearch(query, k);
      return results;
    } catch (error) {
      console.error('Error searching documents:', error);
      return [];
    }
  }

  async addDocument(filePath: string): Promise<void> {
    const documents = await this.loadSingleDocument(filePath);
    if (documents.length > 0) {
      const splitDocs = await this.splitDocuments(documents);
      
      if (!this.vectorStore) {
        await this.loadVectorStore();
      }
      
      if (this.vectorStore) {
        await this.vectorStore.addDocuments(splitDocs);
        await this.vectorStore.save(this.vectorStorePath);
        console.log(`Added ${splitDocs.length} chunks from ${filePath}`);
      }
    }
  }

  private async loadSingleDocument(filePath: string): Promise<Document[]> {
    const ext = path.extname(filePath).toLowerCase();
    
    try {
      let loader;
      
      switch (ext) {
        case '.pdf':
          loader = new PDFLoader(filePath);
          break;
        case '.docx':
          loader = new DocxLoader(filePath);
          break;
        case '.txt':
          loader = new TextLoader(filePath);
          break;
        default:
          throw new Error(`Unsupported file type: ${ext}`);
      }
      
      const docs = await loader.load();
      const filename = path.basename(filePath);
      
      docs.forEach(doc => {
        doc.metadata = {
          ...doc.metadata,
          source: filename,
          category: this.getCategoryFromFilename(filename)
        };
      });
      
      return docs;
    } catch (error) {
      console.error(`Error loading document ${filePath}:`, error);
      return [];
    }
  }
}

// Export a singleton instance
export const documentProcessor = new DocumentProcessor();
