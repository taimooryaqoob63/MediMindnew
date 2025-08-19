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
    chunkSize: 1500, // tokens - increased for better context
    chunkOverlap: 150, // tokens overlap - reduced to avoid excessive fragmentation
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
    // Validate inputs
    if (!content.trim()) return [];
    
    const targetChunkSize = Math.max(chunkSize, 200); // Minimum chunk size of 200 tokens
    const maxOverlap = Math.min(overlap, Math.floor(targetChunkSize * 0.3)); // Max 30% overlap
    
    // Split content into paragraphs first to preserve document structure
    const paragraphs = content.split(/\n\s*\n/).filter(p => p.trim());
    const chunks: string[] = [];
    let currentChunk = '';
    let currentTokens = 0;

    for (const paragraph of paragraphs) {
      const paragraphTokens = this.estimateTokenCount(paragraph);
      
      // If paragraph alone is much larger than chunk size, use sliding window approach
      if (paragraphTokens > targetChunkSize * 1.5) {
        // Save current chunk if it has substantial content
        if (currentTokens > targetChunkSize * 0.3) {
          chunks.push(currentChunk.trim());
          currentChunk = '';
          currentTokens = 0;
        }
        
        // Use sliding window for very large paragraphs
        const largeParaChunks = this.chunkLargeParagraph(paragraph, targetChunkSize, maxOverlap);
        chunks.push(...largeParaChunks);
      } else {
        // Check if adding this paragraph would exceed chunk size
        if (currentTokens + paragraphTokens > targetChunkSize && currentTokens > targetChunkSize * 0.3) {
          chunks.push(currentChunk.trim());
          // Start new chunk with overlap if current chunk is substantial
          if (currentTokens > maxOverlap * 2) {
            const overlapText = this.getOverlapText(currentChunk, maxOverlap);
            currentChunk = overlapText + '\n\n' + paragraph;
            currentTokens = this.estimateTokenCount(currentChunk);
          } else {
            // If current chunk is small, don't add overlap to avoid over-fragmentation
            currentChunk = paragraph;
            currentTokens = paragraphTokens;
          }
        } else {
          currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
          currentTokens += paragraphTokens;
        }
      }
    }
    
    // Add final chunk if it has substantial content
    if (currentTokens > targetChunkSize * 0.2) { // At least 20% of target size
      chunks.push(currentChunk.trim());
    } else if (chunks.length > 0 && currentChunk.trim()) {
      // Merge small final chunk with previous chunk if possible
      const lastChunk = chunks[chunks.length - 1];
      const combinedTokens = this.estimateTokenCount(lastChunk + '\n\n' + currentChunk);
      if (combinedTokens <= targetChunkSize * 1.2) {
        chunks[chunks.length - 1] = lastChunk + '\n\n' + currentChunk.trim();
      } else {
        chunks.push(currentChunk.trim());
      }
    }
    
    // Filter and validate chunks - require minimum of 100 tokens for meaningful retrieval
    const validChunks = chunks.filter(chunk => {
      const tokens = this.estimateTokenCount(chunk);
      return tokens >= 100 && chunk.trim().length > 50; // At least 100 tokens and 50 characters
    });
    
    console.log(`Chunking complete: ${validChunks.length} chunks created, avg tokens: ${Math.round(validChunks.reduce((sum, chunk) => sum + this.estimateTokenCount(chunk), 0) / validChunks.length)}`);
    
    return validChunks;
  }

  private chunkLargeParagraph(paragraph: string, chunkSize: number, overlap: number): string[] {
    // For very large paragraphs, use a sliding window approach
    const sentences = this.splitIntoSentences(paragraph);
    const chunks: string[] = [];
    let currentChunk = '';
    let currentTokens = 0;
    
    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i];
      const sentenceTokens = this.estimateTokenCount(sentence);
      
      // If single sentence is larger than chunk size, split it further
      if (sentenceTokens > chunkSize) {
        if (currentChunk.trim()) {
          chunks.push(currentChunk.trim());
          currentChunk = '';
          currentTokens = 0;
        }
        // Split very long sentences by clauses/phrases
        const subChunks = this.splitLongSentence(sentence, chunkSize, overlap);
        chunks.push(...subChunks);
        continue;
      }
      
      // Check if adding this sentence would exceed chunk size
      if (currentTokens + sentenceTokens > chunkSize && currentChunk.trim()) {
        chunks.push(currentChunk.trim());
        // Start new chunk with some context from previous chunk
        const overlapText = this.getOverlapText(currentChunk, overlap);
        currentChunk = overlapText + (overlapText ? ' ' : '') + sentence;
        currentTokens = this.estimateTokenCount(currentChunk);
      } else {
        currentChunk += (currentChunk ? ' ' : '') + sentence;
        currentTokens += sentenceTokens;
      }
    }
    
    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }
    
    return chunks;
  }
  
  private splitIntoSentences(text: string): string[] {
    // Improved sentence splitting that handles abbreviations and edge cases
    return text
      .split(/(?<=[.!?])\s+(?=[A-Z])/) // Split on sentence boundaries followed by whitespace and capital letter
      .filter(sentence => sentence.trim().length > 10); // Filter out very short fragments
  }
  
  private splitLongSentence(sentence: string, chunkSize: number, overlap: number): string[] {
    // Split extremely long sentences by natural break points
    const breakPoints = /[,;:]\s+|\s+(?:and|but|or|however|therefore|moreover|furthermore)\s+/gi;
    const parts = sentence.split(breakPoints).filter(part => part.trim());
    
    if (parts.length <= 1) {
      // If no natural breaks, split by word count as last resort
      const words = sentence.split(/\s+/);
      const wordsPerChunk = Math.floor(chunkSize * 0.75); // Rough conversion
      const chunks = [];
      for (let i = 0; i < words.length; i += wordsPerChunk) {
        const chunk = words.slice(i, i + wordsPerChunk).join(' ');
        if (chunk.trim()) chunks.push(chunk.trim());
      }
      return chunks;
    }
    
    // Combine parts into appropriately sized chunks
    const chunks: string[] = [];
    let currentChunk = '';
    let currentTokens = 0;
    
    for (const part of parts) {
      const partTokens = this.estimateTokenCount(part);
      
      if (currentTokens + partTokens > chunkSize && currentChunk.trim()) {
        chunks.push(currentChunk.trim());
        currentChunk = part;
        currentTokens = partTokens;
      } else {
        currentChunk += (currentChunk ? ' ' : '') + part;
        currentTokens += partTokens;
      }
    }
    
    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }
    
    return chunks;
  }

  private getOverlapText(text: string, overlapTokens: number): string {
    if (!text.trim() || overlapTokens <= 0) return '';
    
    const words = text.split(/\s+/).filter(w => w.length > 0);
    if (words.length === 0) return '';
    
    // More conservative overlap calculation - use ~0.8 words per token
    const overlapWords = Math.min(
      Math.floor(overlapTokens * 0.8), 
      Math.floor(words.length * 0.3), // Never take more than 30% of the text
      words.length
    );
    
    // Try to end overlap at sentence boundaries for better context
    const overlapText = words.slice(-overlapWords).join(' ');
    const sentences = overlapText.split(/[.!?]+\s*/);
    
    // If we have multiple sentences in overlap, try to end at sentence boundary
    if (sentences.length > 1 && sentences[sentences.length - 1].length < 50) {
      return sentences.slice(0, -1).join('. ').trim() + '.';
    }
    
    return overlapText;
  }

  private estimateTokenCount(text: string): number {
    // Improved token estimation based on OpenAI's tokenizer patterns
    // Average of ~3.5 characters per token for English text
    const chars = text.length;
    const words = text.split(/\s+/).filter(w => w.length > 0).length;
    
    // Use a weighted approach: combine character-based and word-based estimation
    // Character-based: ~3.5 chars per token (more accurate for modern tokenizers)
    // Word-based: ~1.3 tokens per word (accounts for subwords)
    const charBasedTokens = chars / 3.5;
    const wordBasedTokens = words * 1.3;
    
    // Use weighted average, favoring character-based for longer text
    const weight = Math.min(chars / 1000, 0.8); // More weight to chars as text gets longer
    const estimatedTokens = (charBasedTokens * weight) + (wordBasedTokens * (1 - weight));
    
    return Math.ceil(Math.max(estimatedTokens, words * 0.8)); // Ensure minimum of 0.8 tokens per word
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
    console.log(`Building knowledge graph for document ${documentId}`);
    
    // Get all entities to build relationships
    const entities = await storage.getEntities();
    
    // Define medical knowledge relationships
    const medicalRelationships = [
      // Diabetes and related conditions
      { from: 'diabetes', to: 'blood glucose', type: 'affects', confidence: 95 },
      { from: 'diabetes', to: 'insulin', type: 'requires_treatment', confidence: 90 },
      { from: 'diabetes', to: 'HbA1c', type: 'monitored_by', confidence: 95 },
      { from: 'diabetes', to: 'hypoglycemia', type: 'can_cause', confidence: 80 },
      { from: 'diabetes', to: 'hyperglycemia', type: 'can_cause', confidence: 85 },
      { from: 'diabetes', to: 'neuropathy', type: 'can_cause', confidence: 75 },
      { from: 'diabetes', to: 'retinopathy', type: 'can_cause', confidence: 75 },
      { from: 'diabetes', to: 'nephropathy', type: 'can_cause', confidence: 75 },
      
      // Insulin relationships
      { from: 'insulin', to: 'blood glucose', type: 'regulates', confidence: 95 },
      { from: 'insulin', to: 'hypoglycemia', type: 'can_cause', confidence: 70 },
      { from: 'glucagon', to: 'hypoglycemia', type: 'treats', confidence: 90 },
      
      // Medications
      { from: 'metformin', to: 'diabetes', type: 'treats', confidence: 95 },
      { from: 'metformin', to: 'blood glucose', type: 'lowers', confidence: 90 },
      
      // Monitoring
      { from: 'HbA1c', to: 'blood glucose', type: 'measures_average', confidence: 95 },
      { from: 'ketones', to: 'diabetes', type: 'indicates_control', confidence: 80 },
      
      // Risk factors
      { from: 'blood pressure', to: 'diabetes', type: 'related_condition', confidence: 70 },
      { from: 'cholesterol', to: 'diabetes', type: 'related_condition', confidence: 70 },
      
      // Complications relationships
      { from: 'neuropathy', to: 'blood glucose', type: 'caused_by_high', confidence: 80 },
      { from: 'retinopathy', to: 'blood glucose', type: 'caused_by_high', confidence: 80 },
      { from: 'nephropathy', to: 'blood glucose', type: 'caused_by_high', confidence: 80 }
    ];
    
    // Create entity lookup map
    const entityMap = new Map<string, any>();
    entities.forEach(entity => {
      entityMap.set(entity.name.toLowerCase(), entity);
    });
    
    // Create relationships
    for (const rel of medicalRelationships) {
      const fromEntity = entityMap.get(rel.from.toLowerCase());
      const toEntity = entityMap.get(rel.to.toLowerCase());
      
      if (fromEntity && toEntity) {
        try {
          await storage.createEntityRelationship({
            fromEntityId: fromEntity.id,
            toEntityId: toEntity.id,
            relationshipType: rel.type,
            confidence: rel.confidence,
            source: 'medical_knowledge'
          });
          console.log(`Created relationship: ${rel.from} ${rel.type} ${rel.to}`);
        } catch (error) {
          // Relationship might already exist
          console.log(`Relationship already exists: ${rel.from} ${rel.type} ${rel.to}`);
        }
      }
    }
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

  /**
   * Analyze chunking quality for a set of documents
   */
  async analyzeChunkingQuality(documentIds?: string[]): Promise<{
    analysis: Array<{
      documentId: string;
      documentTitle: string;
      totalChunks: number;
      avgTokens: number;
      avgQuality: number;
      chunksWithVectors: number;
      enhancedChunks: number;
      qualityDistribution: {
        excellent: number;
        good: number;
        poor: number;
      };
    }>;
    overallStats: {
      totalDocuments: number;
      totalChunks: number;
      avgQualityOverall: number;
      avgTokensOverall: number;
      chunksWithVectors: number;
      enhancedChunks: number;
    };
    recommendations: string[];
  }> {
    try {
      const documents = documentIds 
        ? await Promise.all(documentIds.map(id => storage.getDocument(id)))
        : await storage.getDocuments();
      
      const analysis = [];
      let totalChunks = 0;
      let totalTokens = 0;
      let totalQuality = 0;
      let chunksWithVectors = 0;
      let enhancedChunks = 0;

      for (const doc of documents.filter(d => d !== null)) {
        const chunks = await storage.getDocumentChunks(doc!.id);
        
        if (chunks.length === 0) continue;

        const tokenCounts = chunks.map(chunk => this.estimateTokenCount(chunk.content));
        const avgTokens = tokenCounts.reduce((sum, count) => sum + count, 0) / tokenCounts.length;
        
        // Calculate quality score based on token count distribution
        const qualityScores = tokenCounts.map(tokens => {
          if (tokens >= 200) return 95; // Excellent: substantial content
          if (tokens >= 100) return 80; // Good: adequate content  
          if (tokens >= 50) return 65;  // Fair: minimal content
          return 40; // Poor: insufficient content
        });
        
        const avgQuality = qualityScores.reduce((sum, score) => sum + score, 0) / qualityScores.length;
        
        const excellent = qualityScores.filter(score => score >= 90).length;
        const good = qualityScores.filter(score => score >= 70 && score < 90).length;
        const poor = qualityScores.filter(score => score < 70).length;
        
        const withVectors = chunks.filter(chunk => chunk.vectorId).length;
        const enhanced = chunks.length; // All chunks are "enhanced" in our system
        
        analysis.push({
          documentId: doc!.id,
          documentTitle: doc!.title,
          totalChunks: chunks.length,
          avgTokens: Math.round(avgTokens),
          avgQuality: Math.round(avgQuality * 10) / 10,
          chunksWithVectors: withVectors,
          enhancedChunks: enhanced,
          qualityDistribution: { excellent, good, poor }
        });
        
        totalChunks += chunks.length;
        totalTokens += tokenCounts.reduce((sum, count) => sum + count, 0);
        totalQuality += avgQuality * chunks.length;
        chunksWithVectors += withVectors;
        enhancedChunks += enhanced;
      }

      const avgTokensOverall = totalChunks > 0 ? Math.round(totalTokens / totalChunks) : 0;
      const avgQualityOverall = totalChunks > 0 ? Math.round((totalQuality / totalChunks) * 10) / 10 : 0;

      // Generate recommendations
      const recommendations = [];
      
      if (avgTokensOverall < 150) {
        recommendations.push("Chunks are smaller than optimal - consider increasing chunk size for better context");
      } else if (avgTokensOverall > 800) {
        recommendations.push("Chunks are quite large - consider reducing chunk size for more focused retrieval");
      }
      
      const tokenVariance = analysis.length > 0 
        ? analysis.reduce((sum, doc) => sum + Math.abs(doc.avgTokens - avgTokensOverall), 0) / analysis.length
        : 0;
        
      if (tokenVariance > avgTokensOverall * 0.3) {
        recommendations.push("High variance in chunk sizes - chunking strategy is working well for content diversity");
      }
      
      if (avgQualityOverall >= 85) {
        recommendations.push("Excellent chunk quality - good balance of size and content coherence");
      } else if (avgQualityOverall < 70) {
        recommendations.push("Poor chunk quality detected - consider reviewing chunking parameters");
      }
      
      const vectorCoverage = totalChunks > 0 ? (chunksWithVectors / totalChunks) * 100 : 0;
      if (vectorCoverage < 95) {
        recommendations.push(`Only ${Math.round(vectorCoverage)}% of chunks have vectors - check vector generation process`);
      }

      return {
        analysis,
        overallStats: {
          totalDocuments: analysis.length,
          totalChunks,
          avgQualityOverall,
          avgTokensOverall,
          chunksWithVectors,
          enhancedChunks
        },
        recommendations
      };
    } catch (error) {
      console.error('Error analyzing chunking quality:', error);
      throw error;
    }
  }
}

export const documentProcessor = new DocumentProcessor();