import fs from 'fs/promises';
import path from 'path';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdf = require('pdf-parse');
import mammoth from 'mammoth';
import { JSDOM } from 'jsdom';
import { storage } from '../storage';
import { vectorStore } from './vectorStore';
import type { InsertDocument, InsertDocumentChunk, InsertProcessingJob } from '@shared/schema';

export interface ProcessingOptions {
  chunkSize?: number;
  chunkOverlap?: number;
  extractEntities?: boolean;
  buildKnowledgeGraph?: boolean;
}

export class DocumentProcessor {
  private defaultOptions: ProcessingOptions = {
    chunkSize: 1000,
    chunkOverlap: 200,
    extractEntities: true,
    buildKnowledgeGraph: true,
  };

  async processDocument(
    filePath: string,
    documentType: string,
    category: string,
    options: ProcessingOptions = {}
  ): Promise<string> {
    const opts = { ...this.defaultOptions, ...options };
    
    // Create initial processing job
    const job = await storage.createProcessingJob({
      status: 'processing',
      jobType: 'document_processing',
      progress: 0,
      metadata: { filePath, documentType, category }
    });

    try {
      // Extract text content
      await this.updateJobProgress(job.id, 10, 'Extracting text content...');
      const content = await this.extractTextContent(filePath);
      
      if (!content.trim()) {
        throw new Error('No text content extracted from document');
      }

      // Create document record
      await this.updateJobProgress(job.id, 20, 'Creating document record...');
      const document = await storage.createDocument({
        title: path.basename(filePath),
        content,
        source: filePath,
        documentType,
        category,
        metadata: {
          fileSize: (await fs.stat(filePath)).size,
          processedAt: new Date().toISOString(),
        }
      });

      // Chunk the document
      await this.updateJobProgress(job.id, 30, 'Chunking document...');
      const chunks = await this.chunkDocument(content, opts.chunkSize!, opts.chunkOverlap!);
      
      // Process chunks
      const totalChunks = chunks.length;
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const progress = 30 + Math.round((i / totalChunks) * 40);
        await this.updateJobProgress(job.id, progress, `Processing chunk ${i + 1}/${totalChunks}...`);
        
        await this.processChunk(document.id, chunk, i);
      }

      // Extract entities if requested
      if (opts.extractEntities) {
        await this.updateJobProgress(job.id, 80, 'Extracting entities...');
        await this.extractEntities(document.id, content);
      }

      // Build knowledge graph if requested
      if (opts.buildKnowledgeGraph) {
        await this.updateJobProgress(job.id, 90, 'Building knowledge graph...');
        await this.buildKnowledgeGraph(document.id);
      }

      // Mark job as completed
      await this.updateJobProgress(job.id, 100, 'Document processing completed');
      await storage.updateProcessingJob(job.id, { status: 'completed' });

      return document.id;
    } catch (error) {
      console.error('Document processing error:', error);
      await storage.updateProcessingJob(job.id, {
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  private async extractTextContent(filePath: string): Promise<string> {
    const ext = path.extname(filePath).toLowerCase();
    
    try {
      switch (ext) {
        case '.pdf':
          return await this.extractPdfText(filePath);
        case '.docx':
          return await this.extractDocxText(filePath);
        case '.html':
          return await this.extractHtmlText(filePath);
        case '.txt':
          return await fs.readFile(filePath, 'utf-8');
        case '.json':
          return await this.extractJsonText(filePath);
        default:
          throw new Error(`Unsupported file type: ${ext}`);
      }
    } catch (error) {
      console.error(`Error extracting text from ${filePath}:`, error);
      throw error;
    }
  }

  private async extractPdfText(filePath: string): Promise<string> {
    const buffer = await fs.readFile(filePath);
    const data = await pdf(buffer);
    return data.text;
  }

  private async extractDocxText(filePath: string): Promise<string> {
    const buffer = await fs.readFile(filePath);
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  private async extractHtmlText(filePath: string): Promise<string> {
    const html = await fs.readFile(filePath, 'utf-8');
    const dom = new JSDOM(html);
    return dom.window.document.body.textContent || '';
  }

  private async extractJsonText(filePath: string): Promise<string> {
    const jsonContent = await fs.readFile(filePath, 'utf-8');
    
    try {
      const jsonData = JSON.parse(jsonContent);
      
      // Convert JSON to readable text format
      // If it's an array of objects, format each object
      if (Array.isArray(jsonData)) {
        return jsonData.map((item, index) => {
          if (typeof item === 'object' && item !== null) {
            return `Item ${index + 1}:\n${this.formatJsonObject(item)}\n`;
          } else {
            return `Item ${index + 1}: ${String(item)}\n`;
          }
        }).join('\n');
      } 
      // If it's a single object, format it
      else if (typeof jsonData === 'object' && jsonData !== null) {
        return this.formatJsonObject(jsonData);
      } 
      // If it's a primitive value, convert to string
      else {
        return String(jsonData);
      }
    } catch (error) {
      // If JSON parsing fails, treat as plain text
      console.warn(`Failed to parse JSON file ${filePath}, treating as plain text`);
      return jsonContent;
    }
  }

  private formatJsonObject(obj: any, depth: number = 0): string {
    const indent = '  '.repeat(depth);
    const lines: string[] = [];
    
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        lines.push(`${indent}${key}:`);
        lines.push(this.formatJsonObject(value, depth + 1));
      } else if (Array.isArray(value)) {
        lines.push(`${indent}${key}: [${value.length} items]`);
        value.forEach((item, index) => {
          if (typeof item === 'object' && item !== null) {
            lines.push(`${indent}  Item ${index + 1}:`);
            lines.push(this.formatJsonObject(item, depth + 2));
          } else {
            lines.push(`${indent}  Item ${index + 1}: ${String(item)}`);
          }
        });
      } else {
        lines.push(`${indent}${key}: ${String(value)}`);
      }
    }
    
    return lines.join('\n');
  }

  private async chunkDocument(
    content: string,
    chunkSize: number,
    overlap: number
  ): Promise<string[]> {
    const chunks: string[] = [];
    const words = content.split(/\s+/);
    
    for (let i = 0; i < words.length; i += chunkSize - overlap) {
      const chunk = words.slice(i, i + chunkSize).join(' ');
      if (chunk.trim()) {
        chunks.push(chunk.trim());
      }
    }
    
    return chunks;
  }

  private async processChunk(
    documentId: string,
    chunkContent: string,
    chunkIndex: number
  ): Promise<void> {
    try {
      // Create embedding for the chunk
      const embedding = await vectorStore.createEmbedding(chunkContent);
      
      // Create chunk record
      const chunk = await storage.createDocumentChunk({
        documentId,
        content: chunkContent,
        chunkIndex,
        metadata: {
          wordCount: chunkContent.split(/\s+/).length,
          createdAt: new Date().toISOString(),
        }
      });

      // Store in vector database
      await vectorStore.upsertVector(
        chunk.id,
        embedding,
        {
          documentId,
          chunkIndex,
          content: chunkContent.substring(0, 500), // Store first 500 chars in metadata
          type: 'document_chunk'
        }
      );

      // Update chunk with vector ID
      await storage.updateDocumentChunk(chunk.id, { vectorId: chunk.id });
    } catch (error) {
      console.error('Error processing chunk:', error);
      throw error;
    }
  }

  private async extractEntities(documentId: string, content: string): Promise<void> {
    // This is a simplified entity extraction
    // In production, you'd use a more sophisticated NLP library
    const medicalTerms = [
      'diabetes', 'insulin', 'blood glucose', 'hypoglycemia', 'hyperglycemia',
      'HbA1c', 'metformin', 'glucagon', 'ketones', 'neuropathy',
      'retinopathy', 'nephropathy', 'blood pressure', 'cholesterol'
    ];
    
    const foundEntities = [];
    
    for (const term of medicalTerms) {
      const regex = new RegExp(`\\b${term}\\b`, 'gi');
      const matches = content.match(regex);
      
      if (matches && matches.length > 0) {
        foundEntities.push({
          name: term,
          type: 'medical_term',
          description: `Medical term found in document`,
          metadata: { 
            frequency: matches.length,
            documentId 
          }
        });
      }
    }
    
    // Store entities
    for (const entity of foundEntities) {
      try {
        await storage.createEntity(entity);
      } catch (error) {
        // Entity might already exist, that's okay
        console.log(`Entity ${entity.name} already exists`);
      }
    }
  }

  private async buildKnowledgeGraph(documentId: string): Promise<void> {
    // Simplified knowledge graph building
    // In production, you'd use more sophisticated relationship extraction
    console.log(`Building knowledge graph for document ${documentId}`);
    // Implementation would go here
  }

  private async updateJobProgress(
    jobId: string,
    progress: number,
    message?: string
  ): Promise<void> {
    await storage.updateProcessingJob(jobId, {
      progress,
      ...(message && { metadata: { currentStep: message } })
    });
  }
}

export const documentProcessor = new DocumentProcessor();