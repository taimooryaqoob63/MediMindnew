import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdf = require('pdf-parse');
import mammoth from 'mammoth';
import { JSDOM } from 'jsdom';
import { storage } from '../storage';
import { vectorStore } from './vectorStore';
import type { InsertDocument, InsertDocumentChunk, InsertProcessingJob } from '@shared/schema';

// Enhanced metadata structure according to your specifications
interface EnhancedMetadata {
  docId: string;
  version: string;
  source: 'NICE' | 'NHS' | 'CQC' | 'other';
  docType: 'guideline' | 'faq' | 'paper' | 'learning';
  title: string;
  sectionPath: string[];
  nodeType: 'paragraph' | 'table' | 'figure';
  page?: number;
  tableId?: string;
  refIds: string[];
  publishedAt: string;
  ingestedAt: string;
  category: string;
  kgAnchors: string[];
  embedModel: 'text-embedding-3-small' | 'text-embedding-3-large';
  simHash?: string;
  minHash?: string;
}

interface DoclingStructure {
  sections: Array<{
    heading: string;
    level: number;
    paragraphs: string[];
    tables: Array<{
      id: string;
      caption: string;
      data: any[];
    }>;
    figures: Array<{
      id: string;
      caption: string;
      description: string;
    }>;
  }>;
  references: string[];
  pageNumbers: Record<string, number>;
  metadata: Record<string, any>;
}

export interface ProcessingOptions {
  chunkSize?: number;
  chunkOverlap?: number;
  extractEntities?: boolean;
  buildKnowledgeGraph?: boolean;
  docType?: 'guideline' | 'faq' | 'paper' | 'learning';
  source?: 'NICE' | 'NHS' | 'CQC' | 'other';
  version?: string;
  publishedAt?: string;
  enableDeduplication?: boolean;
}

export class EnhancedDocumentProcessor {
  private defaultOptions: ProcessingOptions = {
    chunkSize: 1000, // tokens, not words
    chunkOverlap: 200, // tokens overlap
    extractEntities: true,
    buildKnowledgeGraph: true,
    docType: 'learning',
    source: 'other',
    enableDeduplication: true,
  };

  // Document-level deduplication using SimHash
  private async computeSimHash(content: string): Promise<string> {
    // Simplified SimHash implementation - normalize text first
    const normalized = this.normalizeContent(content);
    const hash = crypto.createHash('sha256').update(normalized).digest('hex');
    return hash.substring(0, 16); // Use first 16 chars as simplified SimHash
  }

  private normalizeContent(content: string): string {
    return content
      .toLowerCase()
      .replace(/\d+/g, '#') // Replace numbers with placeholder
      .replace(/\b\d{4}-\d{2}-\d{2}\b/g, 'DATE') // Replace dates
      .replace(/\b[A-Z]{2,}\d+\b/g, 'REF') // Replace reference codes
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private async checkForDuplicates(simHash: string): Promise<string | null> {
    // Check if similar document already exists
    // In production, this would use Hamming distance comparison
    try {
      if (!simHash || typeof simHash !== 'string') {
        return null;
      }

      const existingDocs = await storage.getDocuments();
      if (!Array.isArray(existingDocs)) {
        return null;
      }

      for (const doc of existingDocs) {
        if (doc?.metadata && 
            typeof doc.metadata === 'object' && 
            'simHash' in doc.metadata &&
            doc.metadata.simHash === simHash) {
          return doc.id;
        }
      }
    } catch (error) {
      console.error('Duplicate check failed:', error);
    }
    return null;
  }

  // Improved document structure parsing - much more inclusive
  private async parseWithDoclingStructure(content: string, filePath: string): Promise<DoclingStructure> {
    if (!content || typeof content !== 'string') {
      throw new Error('Invalid content provided for parsing');
    }

    console.log(`📋 Parsing document structure for ${path.basename(filePath)}`);
    const lines = content.split('\n');
    const sections: DoclingStructure['sections'] = [];
    const references: string[] = [];
    const pageNumbers: Record<string, number> = {};
    
    // Always create a default section to ensure content is captured
    let currentSection: DoclingStructure['sections'][0] = {
      heading: 'Document Content',
      level: 1,
      paragraphs: [],
      tables: [],
      figures: []
    };
    
    let currentPage = 1;
    let currentParagraph = '';

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) {
        // Empty line - if we have accumulated paragraph content, save it
        if (currentParagraph.trim()) {
          currentSection.paragraphs.push(currentParagraph.trim());
          currentParagraph = '';
        }
        continue;
      }

      // More flexible heading detection
      const headingPatterns = [
        /^(\d+\.?\d*\.?\d*)\s+(.+)$/, // Numbered headings
        /^[A-Z][A-Z\s]{4,}$/, // All caps headings (reduced minimum)
        /^(CHAPTER|SECTION|PART|INTRODUCTION|CONCLUSION|SUMMARY|BACKGROUND|METHODS|RESULTS|DISCUSSION)\b/i,
        /^.{1,50}:$/, // Lines ending with colon (short titles)
        /^#+\s/, // Markdown headings
        /^[A-Z][^.!?]*$/ // Single sentence in title case without punctuation
      ];

      const isHeading = headingPatterns.some(pattern => pattern.test(trimmedLine)) && 
                       trimmedLine.length < 100 && // Reasonable heading length
                       !trimmedLine.includes('.') || trimmedLine.match(/^\d/); // Avoid normal sentences unless numbered

      if (isHeading) {
        // Save current paragraph if exists
        if (currentParagraph.trim()) {
          currentSection.paragraphs.push(currentParagraph.trim());
          currentParagraph = '';
        }

        // Save previous section if it has content
        if (currentSection.paragraphs.length > 0 || currentSection.tables.length > 0 || currentSection.figures.length > 0) {
          sections.push(currentSection);
        }

        // Start new section
        currentSection = {
          heading: trimmedLine,
          level: 1,
          paragraphs: [],
          tables: [],
          figures: []
        };
      } else {
        // Process content
        if (trimmedLine.toLowerCase().includes('table') && trimmedLine.includes(':')) {
          // Save current paragraph first
          if (currentParagraph.trim()) {
            currentSection.paragraphs.push(currentParagraph.trim());
            currentParagraph = '';
          }
          // Detect table
          const tableId = `T${currentSection.tables.length + 1}`;
          currentSection.tables.push({
            id: tableId,
            caption: trimmedLine,
            data: []
          });
        } else if (trimmedLine.toLowerCase().includes('figure') && trimmedLine.includes(':')) {
          // Save current paragraph first
          if (currentParagraph.trim()) {
            currentSection.paragraphs.push(currentParagraph.trim());
            currentParagraph = '';
          }
          // Detect figure
          const figureId = `F${currentSection.figures.length + 1}`;
          currentSection.figures.push({
            id: figureId,
            caption: trimmedLine,
            description: ''
          });
        } else if (trimmedLine.includes('doi:') || trimmedLine.includes('NICE:') || trimmedLine.includes('http')) {
          // Detect reference
          references.push(trimmedLine);
        } else {
          // Accumulate paragraph content
          currentParagraph += (currentParagraph ? ' ' : '') + trimmedLine;
        }

        // Track page numbers (simplified)
        if (trimmedLine.includes('Page ') || currentSection.paragraphs.length % 15 === 0) {
          pageNumbers[trimmedLine.substring(0, 50)] = currentPage++;
        }
      }
    }

    // Save final paragraph if exists
    if (currentParagraph.trim()) {
      currentSection.paragraphs.push(currentParagraph.trim());
    }

    // Always add the final section if it has content
    if (currentSection.paragraphs.length > 0 || currentSection.tables.length > 0 || currentSection.figures.length > 0) {
      sections.push(currentSection);
    }

    // ALWAYS use simple approach - don't try to parse complex sections
    // This fixes the fragmentation issue by keeping all content together
    const allText = content.trim();
    if (allText) {
      console.log(`🔧 DEBUG: Using simple parsing approach for: "${allText.substring(0, 100)}..."`);
      
      sections.length = 0; // Clear any existing sections
      sections.push({
        heading: 'Medical Content',
        level: 1,
        paragraphs: [allText], // Keep ALL content as one paragraph to prevent fragmentation
        tables: [],
        figures: []
      });
    }

    console.log(`📄 Document parsing completed: ${sections.length} sections, ${sections.reduce((acc, s) => acc + s.paragraphs.length, 0)} paragraphs`);

    return {
      sections,
      references,
      pageNumbers,
      metadata: {
        totalSections: sections.length,
        totalReferences: references.length,
        estimatedPages: currentPage
      }
    };
  }

  // Adaptive chunk sizing based on document type
  private getAdaptiveChunkSize(docType: string, nodeType: string): { size: number; overlap: number } {
    // Using consistent chunking parameters for better context preservation (in tokens)
    return { size: 1000, overlap: 200 };
  }

  // Semantic chunking - groups related sentences based on meaning rather than length
  private async chunkDocumentStructured(
    structure: DoclingStructure,
    docType: string,
    maxTokens: number = 1000
  ): Promise<Array<{ content: string; metadata: Partial<EnhancedMetadata> }>> {
    console.log(`🔍 DEBUG: Starting chunkDocumentStructured with ${structure.sections.length} sections`);
    const chunks: Array<{ content: string; metadata: Partial<EnhancedMetadata> }> = [];

    for (const section of structure.sections) {
      const sectionPath = [section.heading];
      console.log(`📝 DEBUG: Processing section: ${section.heading} with ${section.paragraphs.length} paragraphs`);

      // Process paragraphs with semantic chunking
      for (const paragraph of section.paragraphs) {
        if (!paragraph.trim()) continue;

        console.log(`📄 DEBUG: Processing paragraph: "${paragraph.substring(0, 100)}..."`);
        // Always create chunks from paragraphs - semantic grouping
        const semanticChunks = await this.semanticChunkParagraph(paragraph, maxTokens);
        console.log(`📊 DEBUG: semanticChunkParagraph returned ${semanticChunks.length} chunks`);
        
        for (let i = 0; i < semanticChunks.length; i++) {
          const chunk = semanticChunks[i];
          if (chunk.trim()) { // Only check if content exists
            console.log(`✅ DEBUG: Adding chunk ${i+1}: "${chunk.substring(0, 80)}..."`);
            chunks.push({
              content: chunk.trim(),
              metadata: {
                sectionPath,
                nodeType: 'paragraph',
                page: structure.pageNumbers[paragraph.substring(0, 50)]
              }
            });
          } else {
            console.log(`🚫 DEBUG: Skipping empty chunk ${i+1}`);
          }
        }
      }

      // Process tables - always include
      for (const table of section.tables) {
        chunks.push({
          content: `Table: ${table.caption}\nData: ${JSON.stringify(table.data)}`,
          metadata: {
            sectionPath,
            nodeType: 'table',
            tableId: table.id
          }
        });
      }

      // Process figures - always include
      for (const figure of section.figures) {
        chunks.push({
          content: `Figure: ${figure.caption}\nDescription: ${figure.description}`,
          metadata: {
            sectionPath,
            nodeType: 'figure'
          }
        });
      }
    }

    // Ensure we always have chunks if we have content
    if (chunks.length === 0 && structure.sections.length > 0) {
      console.warn('⚠️  Semantic chunking produced 0 chunks, using sentence-based fallback');
      
      // Combine all section content and force chunk creation
      const allContent = structure.sections
        .flatMap(s => s.paragraphs)
        .filter(p => p.trim().length > 0)
        .join('\n\n');
      
      if (allContent.trim()) {
        // Force creation of chunks using sentence-based approach
        const sentences = this.splitIntoSentences(allContent);
        if (sentences.length > 0) {
          // Group sentences into chunks of reasonable size
          const sentenceChunks = this.groupSentencesIntoChunks(sentences, maxTokens);
          
          for (let i = 0; i < sentenceChunks.length; i++) {
            chunks.push({
              content: sentenceChunks[i],
              metadata: {
                sectionPath: ['Document Content'],
                nodeType: 'paragraph'
              }
            });
          }
        } else {
          // Last resort: split by character length
          const textChunks = this.forceCreateChunks(allContent, maxTokens);
          for (const chunk of textChunks) {
            chunks.push({
              content: chunk,
              metadata: {
                sectionPath: ['Document Content'],
                nodeType: 'paragraph'
              }
            });
          }
        }
      }
    }

    // Post-processing: merge small adjacent chunks for better context
    const optimizedChunks = this.mergeSmallChunks(chunks, maxTokens);
    // Semantic chunking completed
    return optimizedChunks;
  }

  // Clean document content by removing headers, footers, metadata, and navigation
  private cleanDocumentContent(content: string): string {
    if (!content) return '';
    
    let cleaned = content;
    
    // Remove common document headers and metadata - much more aggressive
    const headerPatterns = [
      /.*?copyright.*?(?=\n|[A-Z])/gim,
      /.*?clarity informatics.*?(?=\n|[A-Z])/gim,
      /.*?trading agreement.*?(?=\n|[A-Z])/gim,
      /.*?clinical knowledge summaries.*?(?=\n|[A-Z])/gim,
      /.*?all rights reserved.*?(?=\n|[A-Z])/gim,
      /.*?\(CKS\).*?(?=\n|[A-Z])/gim,
      /.*?the content.*?site.*?(?=\n|[A-Z])/gim,
      /.*?agreement\).*?(?=\n|[A-Z])/gim
    ];
    
    for (const pattern of headerPatterns) {
      cleaned = cleaned.replace(pattern, '');
    }
    
    // Remove navigation breadcrumbs and ALL reference links
    cleaned = cleaned.replace(/\(\/?[a-zA-Z0-9\/_-]+\/?\)/g, ''); // Remove navigation paths
    cleaned = cleaned.replace(/\[\w+,\s*\d{4}\s*\(.*?\)\]/g, ''); // Remove full references [Author, 2018 (...)]
    
    // Clean up incomplete references and brackets - much more aggressive
    cleaned = cleaned.replace(/\[\w+[,\s]*\d*.*?\]/g, ''); // Remove all reference patterns
    cleaned = cleaned.replace(/\[\w+,?.*?$/gm, ''); // Remove incomplete references at line ends
    cleaned = cleaned.replace(/\[.*?\]/g, ''); // Remove all bracketed content
    
    // Fix broken parentheses - much more thorough
    cleaned = cleaned.replace(/^\s*\)+/gm, ''); // Remove orphaned closing parens at start of lines
    cleaned = cleaned.replace(/\s*\)+\s*$/gm, ''); // Remove orphaned closing parens at end of lines
    
    // Remove text fragments that start mid-sentence
    const lines = cleaned.split('\n');
    const filteredLines = lines.filter(line => {
      const trimmed = line.trim();
      if (!trimmed) return false;
      if (trimmed.length < 10) return false;
      // Skip lines that start with lowercase (likely fragments) unless they start with medical terms
      if (/^[a-z]/.test(trimmed) && !/^(insulin|diabetes|glucose|treatment|patient|medication)/.test(trimmed.toLowerCase())) {
        return false;
      }
      // Skip lines that are just fragments of copyright text
      if (/^(agreement|copyright|rights|reserved|clarity|informatics)\b/i.test(trimmed)) {
        return false;
      }
      return true;
    });
    cleaned = filteredLines.join('\n');
    
    // Remove excessive whitespace and normalize
    cleaned = cleaned.replace(/\n\s*\n\s*\n/g, '\n\n'); // Max 2 consecutive newlines
    cleaned = cleaned.replace(/^\s+|\s+$/gm, ''); // Trim lines
    cleaned = cleaned.replace(/\s{2,}/g, ' '); // Multiple spaces to single
    
    return cleaned.trim();
  }

  private splitIntoSentences(text: string): string[] {
    if (!text || typeof text !== 'string') {
      return [];
    }
    
    console.log(`🔍 DEBUG: Input text: "${text}"`);
    
    // SIMPLE approach: Don't split at all - return the whole text as one chunk
    // This preserves all medical content without fragmentation
    const cleaned = this.cleanSentence(text.trim());
    if (cleaned && cleaned.length > 10) {
      console.log(`✅ Returning whole text as single sentence: "${cleaned.substring(0, 100)}..."`);
      return [cleaned];
    }
    
    console.log(`🚫 Text too short or empty after cleaning`);
    return [];
  }
  
  private isMetadataContent(text: string): boolean {
    const metadataPatterns = [
      /^\s*copyright/i,
      /^\s*all rights reserved/i,
      /clarity informatics/i,
      /trading agreement/i,
      /clinical knowledge summaries/i,
      /^\s*\(CKS\)/i,
      /^\s*agreement\)/i,
      /^\s*[a-z]/, // Starts with lowercase (likely fragment)
      /^\s*\)/, // Starts with closing paren
      /^\w+\s*\)\s*$/ // Just a word followed by closing paren
    ];
    
    return metadataPatterns.some(pattern => pattern.test(text)) || text.trim().length < 25;
  }
  
  private cleanSentence(sentence: string): string {
    // Clean individual sentences
    let cleaned = sentence;
    
    // Fix incomplete parentheses
    const openParens = (cleaned.match(/\(/g) || []).length;
    const closeParens = (cleaned.match(/\)/g) || []).length;
    
    // If we have unmatched parens, try to fix
    if (openParens > closeParens) {
      // Find the last incomplete parenthetical and remove it if it looks incomplete
      const lastOpenParen = cleaned.lastIndexOf('(');
      if (lastOpenParen > cleaned.length - 50) { // If opening paren is near the end, likely incomplete
        cleaned = cleaned.substring(0, lastOpenParen).trim();
      }
    } else if (closeParens > openParens) {
      // Remove orphaned closing parens at the beginning
      cleaned = cleaned.replace(/^\s*\)+/, '');
    }
    
    // Remove incomplete references at the end
    cleaned = cleaned.replace(/\[\w+,?\s*$/g, '');
    
    return cleaned.trim();
  }

  private getOverlapText(text: string, overlapTokens: number): string {
    const words = text.split(/\s+/);
    const overlapWords = Math.min(Math.floor(overlapTokens * 0.75), words.length); // ~0.75 words per token
    return words.slice(-overlapWords).join(' ');
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

  // Enhanced semantic chunking for individual paragraphs
  private async semanticChunkParagraph(paragraph: string, maxTokens: number = 1000): Promise<string[]> {
    console.log(`🔍 DEBUG: semanticChunkParagraph called with: "${paragraph.substring(0, 100)}..."`);
    if (!paragraph.trim()) return [];
    
    const targetSize = Math.max(maxTokens, 400); // Ensure minimum meaningful size
    const paragraphTokens = this.estimateTokenCount(paragraph);
    console.log(`📊 DEBUG: Paragraph has ${paragraphTokens} tokens, target size: ${targetSize}`);
    
    // If paragraph is appropriately sized, return as single chunk
    if (paragraphTokens >= 200 && paragraphTokens <= targetSize * 1.2) {
      console.log(`✅ DEBUG: Returning paragraph as single chunk (good size)`);
      return [paragraph.trim()];
    }
    
    // If paragraph is very small, check if we should combine it later
    if (paragraphTokens < 200) {
      // Still return it - the caller will handle small chunk aggregation
      return [paragraph.trim()];
    }

    // Split large paragraphs into sentences for better chunking
    console.log(`📝 DEBUG: Splitting paragraph into sentences...`);
    const sentences = this.splitIntoSentences(paragraph);
    console.log(`📊 DEBUG: splitIntoSentences returned ${sentences.length} sentences`);
    if (sentences.length === 0) {
      console.log(`⚠️ DEBUG: No valid sentences found, returning original paragraph`);
      return paragraph.trim() ? [paragraph.trim()] : [];
    }
    
    if (sentences.length === 1) {
      // Single very long sentence - split by clauses or force split
      return this.splitLongSentence(sentences[0], targetSize);
    }

    return this.groupSentencesIntoChunks(sentences, targetSize);
  }

  // Group sentences into semantically coherent chunks with improved logic
  private groupSentencesIntoChunks(sentences: string[], maxTokens: number = 1000): string[] {
    if (sentences.length === 0) return [];
    
    const targetChunkSize = Math.max(maxTokens, 400); // Increased minimum chunk size
    const minChunkSize = Math.max(250, Math.floor(targetChunkSize * 0.4)); // Higher minimum for better context
    const maxOverlap = Math.min(100, Math.floor(targetChunkSize * 0.15)); // Reduced overlap
    
    const chunks: string[] = [];
    let currentChunk = '';
    let currentTokens = 0;

    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i].trim();
      if (!sentence) continue;
      
      // Skip very short or incomplete sentences
      if (sentence.length < 20 || this.isIncompleteContent(sentence)) {
        continue;
      }
      
      const sentenceTokens = this.estimateTokenCount(sentence);
      
      // If single sentence is very large, handle it specially
      if (sentenceTokens > targetChunkSize * 1.2) {
        // Save current chunk if it has substantial content
        if (currentTokens >= minChunkSize) {
          // Ensure chunk ends properly
          const cleanChunk = this.ensureProperChunkEnding(currentChunk.trim());
          if (cleanChunk && cleanChunk.length > 50) {
            chunks.push(cleanChunk);
          }
          currentChunk = '';
          currentTokens = 0;
        }
        
        // Split very long sentence and add as separate chunks
        const subChunks = this.splitLongSentence(sentence, targetChunkSize)
          .map(chunk => this.ensureProperChunkEnding(chunk))
          .filter(chunk => chunk && chunk.length > 50);
        chunks.push(...subChunks);
        continue;
      }
      
      // Check if adding this sentence would exceed limit
      if (currentTokens + sentenceTokens > targetChunkSize && currentTokens >= minChunkSize) {
        // Ensure current chunk ends properly before saving
        const cleanChunk = this.ensureProperChunkEnding(currentChunk.trim());
        if (cleanChunk && cleanChunk.length > 50) {
          chunks.push(cleanChunk);
        }
        
        // Start new chunk with minimal overlap for continuity
        if (currentTokens > maxOverlap * 3) {
          const overlapText = this.getLastSentences(currentChunk, maxOverlap);
          currentChunk = overlapText + (overlapText ? ' ' : '') + sentence;
          currentTokens = this.estimateTokenCount(currentChunk);
        } else {
          // If current chunk is small, start fresh
          currentChunk = sentence;
          currentTokens = sentenceTokens;
        }
      } else {
        currentChunk += (currentChunk ? ' ' : '') + sentence;
        currentTokens += sentenceTokens;
      }
    }

    // Add final chunk if substantial and properly formed
    if (currentTokens >= minChunkSize) {
      const cleanChunk = this.ensureProperChunkEnding(currentChunk.trim());
      if (cleanChunk && cleanChunk.length > 50) {
        chunks.push(cleanChunk);
      }
    } else if (chunks.length > 0 && currentChunk.trim()) {
      // Merge small final chunk with previous chunk if possible
      const lastChunk = chunks[chunks.length - 1];
      const combinedContent = lastChunk + ' ' + currentChunk.trim();
      const combinedTokens = this.estimateTokenCount(combinedContent);
      if (combinedTokens <= targetChunkSize * 1.3) {
        const cleanCombined = this.ensureProperChunkEnding(combinedContent);
        if (cleanCombined) {
          chunks[chunks.length - 1] = cleanCombined;
        }
      } else {
        const cleanChunk = this.ensureProperChunkEnding(currentChunk.trim());
        if (cleanChunk && cleanChunk.length > 50) {
          chunks.push(cleanChunk);
        }
      }
    } else if (currentChunk.trim()) {
      // First chunk - include if it has meaningful content
      const cleanChunk = this.ensureProperChunkEnding(currentChunk.trim());
      if (cleanChunk && cleanChunk.length > 50) {
        chunks.push(cleanChunk);
      }
    }

    // Final validation - ensure all chunks are meaningful and well-formed
    const validChunks = chunks.filter(chunk => {
      const tokens = this.estimateTokenCount(chunk);
      const hasGoodContent = this.hasValidContent(chunk);
      return tokens >= 200 && chunk.trim().length > 75 && hasGoodContent; // Higher standards for quality
    });

    // Logging removed for production
    
    return validChunks.length > 0 ? validChunks : (sentences.length > 0 ? [this.ensureProperChunkEnding(sentences.join(' '))] : []);
  }

  // Get last few sentences for overlap
  private getLastSentences(text: string, maxTokens: number): string {
    const sentences = this.splitIntoSentences(text);
    let result = '';
    let tokens = 0;
    
    for (let i = sentences.length - 1; i >= 0; i--) {
      const sentence = sentences[i];
      const sentenceTokens = this.estimateTokenCount(sentence);
      
      if (tokens + sentenceTokens > maxTokens) break;
      
      result = sentence + (result ? ' ' + result : '');
      tokens += sentenceTokens;
    }
    
    return result;
  }
  
  // Check if content is incomplete or low-quality
  private isIncompleteContent(text: string): boolean {
    const incompletePatterns = [
      /^\s*\)/, // Starts with closing parenthesis
      /\[.*?\]/, // Contains any bracketed references
      /^\s*[a-z]/, // Starts with lowercase (likely continuation)
      /^\s*(and|or|but|however|therefore|thus|hence|the|where|that)\s/i, // Starts with continuation words
      /copyright|rights reserved|agreement|clarity informatics/i, // Contains copyright text
      /^\s*\w+\s*\)/, // Single word followed by closing paren
      /\(\s*$/  // Ends with opening parenthesis
    ];
    
    return incompletePatterns.some(pattern => pattern.test(text)) || text.trim().length < 30;
  }
  
  // Ensure chunk endings are proper and complete
  private ensureProperChunkEnding(chunk: string): string {
    if (!chunk) return '';
    
    let cleaned = chunk.trim();
    
    // Remove incomplete references at the end
    cleaned = cleaned.replace(/\s*\[\w+,?\s*$/, '');
    
    // If chunk ends with incomplete parentheses, try to balance or remove
    const openParens = (cleaned.match(/\(/g) || []).length;
    const closeParens = (cleaned.match(/\)/g) || []).length;
    
    if (openParens > closeParens) {
      // Find the last unmatched opening paren and remove everything from there if it's near the end
      const lastOpenParen = cleaned.lastIndexOf('(');
      if (lastOpenParen > cleaned.length - 100) { // If within last 100 chars
        cleaned = cleaned.substring(0, lastOpenParen).trim();
      }
    }
    
    // Ensure chunk ends with proper punctuation
    if (!/[.!?]\s*$/.test(cleaned) && cleaned.length > 0) {
      // Add period if it doesn't end with punctuation
      cleaned += '.';
    }
    
    return cleaned;
  }
  
  // Validate that content is meaningful and not just metadata
  private hasValidContent(text: string): boolean {
    if (!text || text.trim().length < 50) return false;
    
    // Check if it's mostly metadata or copyright text
    const metadataRatio = (text.match(/copyright|rights reserved|clarity informatics|CKS|trading agreement/gi) || []).length;
    const totalWords = text.split(/\s+/).length;
    
    if (metadataRatio / totalWords > 0.3) return false; // Too much metadata
    
    // Check if it has actual medical/educational content
    const medicalTerms = (text.match(/diabetes|insulin|glucose|blood|treatment|patient|medication|condition|disease|symptom|diagnosis/gi) || []).length;
    
    return medicalTerms > 0 || totalWords > 30; // Either has medical terms or is substantial text
  }

  // Split very long sentences by natural break points
  private splitLongSentence(sentence: string, maxTokens: number = 1000): string[] {
    if (!sentence.trim()) return [];
    
    // Try to split by natural break points first
    const breakPoints = /[,;:]\s+|\s+(?:and|but|or|however|therefore|moreover|furthermore|additionally|specifically|particularly)\s+/gi;
    const parts = sentence.split(breakPoints).filter(part => part.trim().length > 10);
    
    if (parts.length > 1) {
      // Group parts into appropriately sized chunks
      const chunks: string[] = [];
      let currentChunk = '';
      let currentTokens = 0;
      
      for (const part of parts) {
        const partTokens = this.estimateTokenCount(part);
        
        if (currentTokens + partTokens > maxTokens && currentChunk.trim()) {
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
      
      return chunks.length > 0 ? chunks : [sentence.trim()];
    }
    
    // No natural breaks - force split by words as last resort
    return this.forceCreateChunks(sentence, maxTokens);
  }
  
  // Force chunk creation as absolute last resort
  private forceCreateChunks(content: string, maxTokens: number = 1000): string[] {
    if (!content.trim()) return [];
    
    const chunks: string[] = [];
    const words = content.split(/\s+/).filter(w => w.length > 0);
    const targetWordsPerChunk = Math.floor(maxTokens * 0.8); // More conservative estimate
    
    for (let i = 0; i < words.length; i += targetWordsPerChunk) {
      const chunkWords = words.slice(i, i + targetWordsPerChunk);
      const chunk = chunkWords.join(' ').trim();
      if (chunk && this.estimateTokenCount(chunk) >= 100) { // Ensure minimum size
        chunks.push(chunk);
      }
    }
    
    return chunks.length > 0 ? chunks : (content.trim() ? [content.trim()] : []);
  }

  // Smart chunk merging to combine small adjacent chunks
  private mergeSmallChunks(
    chunks: Array<{ content: string; metadata: Partial<EnhancedMetadata> }>, 
    maxTokens: number = 1000
  ): Array<{ content: string; metadata: Partial<EnhancedMetadata> }> {
    if (chunks.length <= 1) return chunks;
    
    const minChunkSize = 250; // Minimum desired chunk size
    const maxMergedSize = Math.floor(maxTokens * 1.3); // Allow 30% over target for merged chunks
    const optimized: Array<{ content: string; metadata: Partial<EnhancedMetadata> }> = [];
    
    let i = 0;
    while (i < chunks.length) {
      const currentChunk = chunks[i];
      const currentTokens = this.estimateTokenCount(currentChunk.content);
      
      // If chunk is already good size, keep it
      if (currentTokens >= minChunkSize) {
        optimized.push(currentChunk);
        i++;
        continue;
      }
      
      // Try to merge with next chunks
      let mergedContent = currentChunk.content;
      let mergedTokens = currentTokens;
      let mergedMetadata = { ...currentChunk.metadata };
      let chunksToMerge = 1;
      
      // Look ahead to find mergeable chunks
      for (let j = i + 1; j < chunks.length && j < i + 3; j++) { // Max merge 3 chunks
        const nextChunk = chunks[j];
        const nextTokens = this.estimateTokenCount(nextChunk.content);
        
        // Check if we can merge without exceeding limits
        if (mergedTokens + nextTokens <= maxMergedSize) {
          // Check if chunks are from the same section (better semantic coherence)
          const sameSectionPath = JSON.stringify(currentChunk.metadata.sectionPath || []) === 
                                JSON.stringify(nextChunk.metadata.sectionPath || []);
          
          if (sameSectionPath || mergedTokens < minChunkSize * 0.7) { // Force merge if very small
            mergedContent += '\n\n' + nextChunk.content;
            mergedTokens += nextTokens;
            chunksToMerge++;
            
            // Update metadata to reflect merged nature
            if (nextChunk.metadata.sectionPath && !mergedMetadata.sectionPath?.includes(nextChunk.metadata.sectionPath[0])) {
              mergedMetadata.sectionPath = [...(mergedMetadata.sectionPath || []), ...(nextChunk.metadata.sectionPath || [])];
            }
          } else {
            break; // Don't merge if sections are different and we have enough content
          }
        } else {
          break; // Would exceed size limit
        }
      }
      
      // Add the merged chunk
      optimized.push({
        content: mergedContent,
        metadata: mergedMetadata
      });
      
      i += chunksToMerge;
    }
    
    console.log(`📊 Chunk optimization: ${chunks.length} → ${optimized.length} chunks (merged ${chunks.length - optimized.length})`);
    return optimized;
  }

  // Determine embedding model based on content type
  private selectEmbeddingModel(docType: string, content: string): 'text-embedding-3-small' | 'text-embedding-3-large' {
    // Use large model for critical clinical content or complex calculations
    const isClinical = /\b(dosage|medication|treatment|diagnosis|clinical)\b/i.test(content);
    const hasCalculations = /\b(\d+\s*(mg|ml|units|mmol|%)|calculate|formula)\b/i.test(content);
    
    if ((docType === 'guideline' && (isClinical || hasCalculations)) || docType === 'paper') {
      return 'text-embedding-3-large';
    }
    
    return 'text-embedding-3-small';
  }

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
      metadata: { filePath, documentType, category, enhanced: true }
    });

    try {
      // Step 1: Extract text content
      await this.updateJobProgress(job.id, 5, 'Extracting text content...');
      console.log(`🔍 Processing file: ${filePath}`);
      const content = await this.extractTextContent(filePath);
      
      if (!content || !content.trim()) {
        const error = 'No text content extracted from document - file may be empty, corrupted, or unsupported format';
        console.error(`❌ ${error}`);
        throw new Error(error);
      }
      
      console.log(`✅ Successfully extracted ${content.length} characters of content`);

      // Step 2: Document-level deduplication
      if (opts.enableDeduplication) {
        await this.updateJobProgress(job.id, 10, 'Checking for duplicates...');
        const simHash = await this.computeSimHash(content);
        const existingDocId = await this.checkForDuplicates(simHash);
        
        if (existingDocId) {
          await this.updateJobProgress(job.id, 100, 'Document already exists - skipping');
          await storage.updateProcessingJob(job.id, { status: 'skipped' });
          return existingDocId;
        }
      }

      // Step 3: Parse with Docling-like structure
      await this.updateJobProgress(job.id, 20, 'Parsing document structure...');
      const structure = await this.parseWithDoclingStructure(content, filePath);

      // Step 4: Create document record with enhanced metadata
      await this.updateJobProgress(job.id, 25, 'Creating document record...');
      const document = await storage.createDocument({
        title: path.basename(filePath),
        content,
        source: filePath,
        documentType: opts.docType || documentType,
        category,
        metadata: {
          fileSize: (await fs.stat(filePath)).size,
          processedAt: new Date().toISOString(),
          docSource: opts.source,
          version: opts.version || 'v1.0',
          publishedAt: opts.publishedAt || new Date().toISOString(),
          structure: structure.metadata,
          totalReferences: structure.references.length,
          enhanced: true
        }
      });

      // Step 5: Structure-aware chunking
      await this.updateJobProgress(job.id, 30, 'Creating structure-aware chunks...');
      const structuredChunks = await this.chunkDocumentStructured(
        structure, 
        opts.docType || documentType, 
        opts.chunkSize
      );

      // Step 6: Process chunks with enhanced metadata and appropriate embedding models
      const totalChunks = structuredChunks.length;
      for (let i = 0; i < structuredChunks.length; i++) {
        const { content: chunkContent, metadata: chunkMetadata } = structuredChunks[i];
        const progress = 30 + Math.round((i / totalChunks) * 40);
        await this.updateJobProgress(job.id, progress, `Processing chunk ${i + 1}/${totalChunks}...`);
        
        // Enhanced metadata for each chunk
        const enhancedMetadata: EnhancedMetadata = {
          docId: document.id,
          version: opts.version || 'v1.0',
          source: opts.source || 'other',
          docType: opts.docType || 'learning',
          title: document.title,
          sectionPath: chunkMetadata.sectionPath || [],
          nodeType: chunkMetadata.nodeType || 'paragraph',
          page: chunkMetadata.page,
          tableId: chunkMetadata.tableId,
          refIds: structure.references.slice(0, 5), // First 5 refs
          publishedAt: opts.publishedAt || new Date().toISOString(),
          ingestedAt: new Date().toISOString(),
          category,
          kgAnchors: [], // Will be populated during entity extraction
          embedModel: this.selectEmbeddingModel(opts.docType || documentType, chunkContent)
        };

        await this.processEnhancedChunk(document.id, chunkContent, i, enhancedMetadata);
      }

      // Step 7: Extract entities and build KG anchors
      if (opts.extractEntities) {
        await this.updateJobProgress(job.id, 80, 'Extracting entities for KG anchors...');
        await this.extractEntitiesEnhanced(document.id, content, structure);
      }

      // Step 8: Build knowledge graph
      if (opts.buildKnowledgeGraph) {
        await this.updateJobProgress(job.id, 90, 'Building enhanced knowledge graph...');
        await this.buildEnhancedKnowledgeGraph(document.id, structure);
      }

      // Check if no chunks were created and provide detailed diagnostics
      if (totalChunks === 0) {
        console.error(`❌ CRITICAL: Document "${document.title}" produced 0 chunks`);
        console.error(`   📊 Content length: ${content.length} characters`);
        console.error(`   📑 Sections found: ${structure.sections.length}`);
        console.error(`   📝 Total paragraphs: ${structure.sections.reduce((acc, s) => acc + s.paragraphs.length, 0)}`);
        console.error(`   🔗 Document ID: ${document.id}`);
        console.error(`   📁 File: ${filePath}`);
        
        // Log sample content for debugging
        const sampleContent = content.substring(0, 500).replace(/\n/g, '\\n');
        console.error(`   📋 Sample content: "${sampleContent}..."`); 
        
        // This is an error condition that should be addressed
        throw new Error(`Document processing failed: 0 chunks created from ${content.length} characters of content`);
      }

      // Mark job as completed
      await this.updateJobProgress(job.id, 100, 'Enhanced document processing completed');
      await storage.updateProcessingJob(job.id, { status: 'completed' });

      console.log(`✅ Enhanced document processing completed for ${document.title}`);
      console.log(`📊 Created ${totalChunks} structure-aware chunks with rich metadata`);

      return document.id;
    } catch (error) {
      console.error('Enhanced document processing error:', error);
      await storage.updateProcessingJob(job.id, {
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  private async extractTextContent(filePath: string): Promise<string> {
    if (!filePath) {
      throw new Error('File path is required');
    }

    // Check if file exists
    try {
      await fs.access(filePath);
    } catch (error) {
      throw new Error(`File not found: ${filePath}`);
    }

    const ext = path.extname(filePath).toLowerCase();
    console.log(`📄 Extracting text from ${path.basename(filePath)} (${ext})`);
    
    try {
      let content = '';
      switch (ext) {
        case '.pdf':
          content = await this.extractPdfText(filePath);
          break;
        case '.docx':
          content = await this.extractDocxText(filePath);
          break;
        case '.html':
          content = await this.extractHtmlText(filePath);
          break;
        case '.txt':
          content = await fs.readFile(filePath, 'utf-8');
          break;
        case '.json':
          content = await this.extractJsonText(filePath);
          break;
        default:
          throw new Error(`Unsupported file type: ${ext}`);
      }

      // Clean extracted content to remove headers, footers, and metadata
      const cleanedContent = this.cleanDocumentContent(content);
      console.log(`📊 Extracted ${content.length} characters, cleaned to ${cleanedContent.length} characters from ${path.basename(filePath)}`);
      return cleanedContent;
    } catch (error) {
      console.error(`❌ Failed to extract text from ${filePath}:`, error);
      throw new Error(`Text extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async extractPdfText(filePath: string): Promise<string> {
    try {
      const buffer = await fs.readFile(filePath);
      if (buffer.length === 0) {
        throw new Error('PDF file is empty');
      }
      
      const data = await pdf(buffer);
      if (!data || !data.text) {
        throw new Error('No text content found in PDF');
      }
      
      return data.text.trim();
    } catch (error) {
      console.error('PDF extraction error:', error);
      throw new Error(`PDF processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async extractDocxText(filePath: string): Promise<string> {
    try {
      const buffer = await fs.readFile(filePath);
      if (buffer.length === 0) {
        throw new Error('DOCX file is empty');
      }
      
      const result = await mammoth.extractRawText({ buffer });
      if (!result || !result.value) {
        throw new Error('No text content found in DOCX');
      }
      
      return result.value.trim();
    } catch (error) {
      console.error('DOCX extraction error:', error);
      throw new Error(`DOCX processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async extractHtmlText(filePath: string): Promise<string> {
    try {
      const html = await fs.readFile(filePath, 'utf-8');
      if (!html.trim()) {
        throw new Error('HTML file is empty');
      }
      
      const dom = new JSDOM(html);
      const document = dom.window.document;
      const textContent = document.body?.textContent || '';
      
      if (!textContent.trim()) {
        throw new Error('No text content found in HTML');
      }
      
      return textContent.trim();
    } catch (error) {
      console.error('HTML extraction error:', error);
      throw new Error(`HTML processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async extractJsonText(filePath: string): Promise<string> {
    try {
      const jsonContent = await fs.readFile(filePath, 'utf-8');
      if (!jsonContent.trim()) {
        throw new Error('JSON file is empty');
      }
      
      let jsonData;
      try {
        jsonData = JSON.parse(jsonContent);
      } catch (parseError) {
        throw new Error(`Invalid JSON format: ${parseError instanceof Error ? parseError.message : 'Parse error'}`);
      }
      
      const formattedJson = JSON.stringify(jsonData, null, 2);
      if (!formattedJson.trim()) {
        throw new Error('JSON contains no extractable content');
      }
      
      return formattedJson;
    } catch (error) {
      console.error('JSON extraction error:', error);
      throw new Error(`JSON processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async processEnhancedChunk(
    documentId: string,
    chunkContent: string,
    chunkIndex: number,
    metadata: EnhancedMetadata
  ): Promise<void> {
    try {
      // Create embedding with appropriate model
      const embedding = await vectorStore.createEmbedding(chunkContent);
      
      // Create chunk record with enhanced metadata
      const chunk = await storage.createDocumentChunk({
        documentId,
        content: chunkContent,
        chunkIndex,
        metadata: {
          ...metadata,
          wordCount: chunkContent.split(/\s+/).length,
          createdAt: new Date().toISOString(),
          enhanced: true
        }
      });

      // Store in vector database with enhanced metadata and namespace
      const namespace = `${metadata.source.toLowerCase()}_${metadata.docType}`;
      await vectorStore.upsertVector(
        chunk.id,
        embedding,
        {
          ...metadata,
          content: chunkContent.substring(0, 500), // Preview only
          type: 'enhanced_chunk',
          namespace
        }
      );

      await storage.updateDocumentChunk(chunk.id, { vectorId: chunk.id });
    } catch (error) {
      console.error('Error processing enhanced chunk:', error);
      throw error;
    }
  }

  private escapeRegex(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private async extractEntitiesEnhanced(
    documentId: string, 
    content: string, 
    structure: DoclingStructure
  ): Promise<void> {
    // Enhanced entity extraction with medical ontology awareness
    const medicalEntities = {
      drugs: ['insulin', 'metformin', 'glucagon', 'glipizide', 'pioglitazone'],
      conditions: ['diabetes', 'hypoglycemia', 'hyperglycemia', 'neuropathy', 'retinopathy'],
      measurements: ['HbA1c', 'blood glucose', 'blood pressure', 'BMI'],
      organizations: ['NICE', 'NHS', 'CQC', 'WHO'],
      // Skip guidelines entirely to avoid regex issues - focus on medical terms only
      guidelines: []
    };

    const extractedEntities = [];

    for (const [category, terms] of Object.entries(medicalEntities)) {
      if (!Array.isArray(terms)) continue;
      
      for (const term of terms) {
        if (!term || typeof term !== 'string' || term.length > 100) continue; // Skip invalid or very long terms
        
        try {
          const escapedTerm = this.escapeRegex(term);
          const regex = new RegExp(`\\b${escapedTerm}\\b`, 'gi');
          const matches = content.match(regex);
          
          if (matches && matches.length > 0) {
            extractedEntities.push({
              name: term,
              type: category,
              description: `${category} entity found in enhanced document`,
              metadata: { 
                frequency: matches.length,
                documentId,
                enhanced: true,
                ontologyClass: category
              }
            });
          }
        } catch (error) {
          console.warn(`Skipping problematic term "${term}" in category ${category}:`, error instanceof Error ? error.message : 'Unknown error');
        }
      }
    }

    // Store enhanced entities
    for (const entity of extractedEntities) {
      try {
        await storage.createEntity(entity);
      } catch (error) {
        console.log(`Entity ${entity.name} already exists or error:`, error);
      }
    }
  }

  private async buildEnhancedKnowledgeGraph(documentId: string, structure: DoclingStructure): Promise<void> {
    // Building enhanced knowledge graph for document
    
    // Enhanced medical relationships with stronger ontological grounding
    const enhancedRelationships = [
      // Drug-condition relationships with confidence scores
      { from: 'insulin', to: 'diabetes', type: 'treats', confidence: 95, evidence: 'clinical_guideline' },
      { from: 'metformin', to: 'diabetes', type: 'first_line_treatment', confidence: 90, evidence: 'nice_guideline' },
      { from: 'diabetes', to: 'HbA1c', type: 'monitored_by', confidence: 95, evidence: 'clinical_standard' },
      
      // Complications network
      { from: 'diabetes', to: 'neuropathy', type: 'can_cause', confidence: 80, evidence: 'epidemiological' },
      { from: 'diabetes', to: 'retinopathy', type: 'can_cause', confidence: 80, evidence: 'epidemiological' },
      { from: 'diabetes', to: 'nephropathy', type: 'can_cause', confidence: 75, evidence: 'clinical_study' },
      
      // Organizational authority relationships
      { from: 'NICE', to: 'diabetes', type: 'provides_guidelines', confidence: 100, evidence: 'regulatory' },
      { from: 'NHS', to: 'diabetes', type: 'provides_care', confidence: 100, evidence: 'healthcare_system' },
    ];

    const entities = await storage.getEntities();
    const entityMap = new Map();
    entities.forEach(entity => entityMap.set(entity.name.toLowerCase(), entity));

    for (const rel of enhancedRelationships) {
      const fromEntity = entityMap.get(rel.from.toLowerCase());
      const toEntity = entityMap.get(rel.to.toLowerCase());
      
      if (fromEntity && toEntity) {
        try {
          await storage.createEntityRelationship({
            fromEntityId: fromEntity.id,
            toEntityId: toEntity.id,
            relationshipType: rel.type,
            confidence: rel.confidence,
            source: 'enhanced_medical_knowledge'
          });
        } catch (error) {
          console.log(`Enhanced relationship exists: ${rel.from} ${rel.type} ${rel.to}`);
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
}

export const enhancedDocumentProcessor = new EnhancedDocumentProcessor();