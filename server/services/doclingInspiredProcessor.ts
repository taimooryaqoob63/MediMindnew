import fs from 'fs/promises';
import path from 'path';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdf = require('pdf-parse');
import mammoth from 'mammoth';
import * as cheerio from 'cheerio';
import { storage } from '../storage';
import { vectorStore } from './vectorStore';
import type { InsertDocument, InsertDocumentChunk, InsertProcessingJob } from '@shared/schema';

export interface DoclingProcessingOptions {
  chunkSize?: number;
  chunkOverlap?: number;
  preserveLayout?: boolean;
  extractTables?: boolean;
  extractImages?: boolean;
  semanticChunking?: boolean;
}

interface DocumentStructure {
  title: string;
  sections: Section[];
  tables: Table[];
  metadata: DocumentMetadata;
}

interface Section {
  level: number;
  title: string;
  content: string;
  subsections: Section[];
  pageNumber?: number;
  position?: { x: number; y: number; width: number; height: number };
}

interface Table {
  id: string;
  caption?: string;
  headers: string[];
  rows: string[][];
  pageNumber?: number;
  position?: { x: number; y: number; width: number; height: number };
}

interface DocumentMetadata {
  author?: string;
  title?: string;
  subject?: string;
  creator?: string;
  producer?: string;
  creationDate?: Date;
  modificationDate?: Date;
  pageCount?: number;
  language?: string;
}

interface EnhancedChunk {
  content: string;
  metadata: {
    type: 'text' | 'table' | 'header' | 'list' | 'code';
    level?: number;
    sectionTitle?: string;
    pageNumber?: number;
    position?: { x: number; y: number; width: number; height: number };
    tableId?: string;
    semanticDensity: number;
    readabilityScore: number;
  };
}

export class DoclingInspiredProcessor {
  private defaultOptions: DoclingProcessingOptions = {
    chunkSize: 1000,
    chunkOverlap: 100,
    preserveLayout: true,
    extractTables: true,
    extractImages: false,
    semanticChunking: true,
  };

  async processDocument(
    filePath: string,
    documentType: string,
    category: string,
    options: DoclingProcessingOptions = {}
  ): Promise<string> {
    const opts = { ...this.defaultOptions, ...options };
    
    // Create initial processing job
    const job = await storage.createProcessingJob({
      status: 'processing',
      jobType: 'docling_processing',
      progress: 0,
      metadata: { filePath, documentType, category, processor: 'docling-inspired' }
    });

    try {
      console.log(`📚 Starting docling-inspired processing for: ${path.basename(filePath)}`);
      
      // Step 1: Extract raw content and structure
      await this.updateJobProgress(job.id, 10, 'Analyzing document structure...');
      const documentStructure = await this.analyzeDocumentStructure(filePath);
      
      // Step 2: Create document record with enhanced metadata
      await this.updateJobProgress(job.id, 20, 'Creating document record...');
      const document = await storage.createDocument({
        title: documentStructure.title || path.basename(filePath),
        content: this.structureToText(documentStructure),
        source: filePath,
        documentType,
        category,
        metadata: {
          fileSize: (await fs.stat(filePath)).size,
          processedAt: new Date().toISOString(),
          processor: 'docling-inspired',
          pageCount: documentStructure.metadata.pageCount,
          author: documentStructure.metadata.author,
          language: documentStructure.metadata.language,
          tableCount: documentStructure.tables.length,
          sectionCount: this.countSections(documentStructure.sections),
        }
      });

      // Step 3: Intelligent chunking with structure preservation
      await this.updateJobProgress(job.id, 30, 'Performing intelligent chunking...');
      const enhancedChunks = await this.performIntelligentChunking(
        documentStructure,
        opts.chunkSize!,
        opts.chunkOverlap!,
        opts.semanticChunking!
      );
      
      // Step 4: Process and embed chunks
      const totalChunks = enhancedChunks.length;
      for (let i = 0; i < enhancedChunks.length; i++) {
        const chunk = enhancedChunks[i];
        const progress = 30 + Math.round((i / totalChunks) * 60);
        await this.updateJobProgress(job.id, progress, `Processing chunk ${i + 1}/${totalChunks}...`);
        
        await this.processEnhancedChunk(document.id, chunk, i);
      }

      // Step 5: Build knowledge graph from extracted entities
      await this.updateJobProgress(job.id, 95, 'Building knowledge relationships...');
      await this.buildEnhancedKnowledgeGraph(document.id, documentStructure);

      // Mark job as completed
      await this.updateJobProgress(job.id, 100, 'Document processing completed');
      await storage.updateProcessingJob(job.id, { status: 'completed' });

      console.log(`✅ Completed docling-inspired processing: ${enhancedChunks.length} chunks created`);
      return document.id;
      
    } catch (error) {
      console.error('Docling-inspired processing error:', error);
      await storage.updateProcessingJob(job.id, {
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  private async analyzeDocumentStructure(filePath: string): Promise<DocumentStructure> {
    const ext = path.extname(filePath).toLowerCase();
    
    switch (ext) {
      case '.pdf':
        return await this.analyzePdfStructure(filePath);
      case '.docx':
        return await this.analyzeDocxStructure(filePath);
      case '.html':
        return await this.analyzeHtmlStructure(filePath);
      case '.txt':
        return await this.analyzeTxtStructure(filePath);
      case '.json':
        return await this.analyzeJsonStructure(filePath);
      default:
        throw new Error(`Unsupported file type: ${ext}`);
    }
  }

  private async analyzePdfStructure(filePath: string): Promise<DocumentStructure> {
    const buffer = await fs.readFile(filePath);
    const data = await pdf(buffer);
    
    // Enhanced PDF analysis - detect structure from text patterns
    const text = data.text;
    const metadata = data.info || {};
    
    // Extract sections based on heading patterns
    const sections = this.extractSectionsFromText(text);
    
    // Extract tables (basic pattern matching for now)
    const tables = this.extractTablesFromText(text);
    
    return {
      title: this.extractTitleFromText(text) || metadata.Title || path.basename(filePath),
      sections,
      tables,
      metadata: {
        author: metadata.Author,
        title: metadata.Title,
        subject: metadata.Subject,
        creator: metadata.Creator,
        producer: metadata.Producer,
        creationDate: metadata.CreationDate ? new Date(metadata.CreationDate) : undefined,
        modificationDate: metadata.ModDate ? new Date(metadata.ModDate) : undefined,
        pageCount: data.numpages,
        language: this.detectLanguage(text),
      }
    };
  }

  private async analyzeDocxStructure(filePath: string): Promise<DocumentStructure> {
    const buffer = await fs.readFile(filePath);
    const result = await mammoth.extractRawText({ buffer });
    const text = result.value;
    
    // Extract document structure from DOCX
    const sections = this.extractSectionsFromText(text);
    const tables = this.extractTablesFromText(text);
    
    return {
      title: this.extractTitleFromText(text) || path.basename(filePath),
      sections,
      tables,
      metadata: {
        language: this.detectLanguage(text),
      }
    };
  }

  private async analyzeHtmlStructure(filePath: string): Promise<DocumentStructure> {
    const html = await fs.readFile(filePath, 'utf-8');
    const $ = cheerio.load(html);
    
    // Extract structured content from HTML
    const title = $('title').text() || $('h1').first().text() || path.basename(filePath);
    const sections = this.extractHtmlSections($);
    const tables = this.extractHtmlTables($);
    
    return {
      title,
      sections,
      tables,
      metadata: {
        title,
        language: $('html').attr('lang') || this.detectLanguage($.text()),
      }
    };
  }

  private async analyzeTxtStructure(filePath: string): Promise<DocumentStructure> {
    const text = await fs.readFile(filePath, 'utf-8');
    
    return {
      title: this.extractTitleFromText(text) || path.basename(filePath),
      sections: this.extractSectionsFromText(text),
      tables: this.extractTablesFromText(text),
      metadata: {
        language: this.detectLanguage(text),
      }
    };
  }

  private async analyzeJsonStructure(filePath: string): Promise<DocumentStructure> {
    const jsonContent = await fs.readFile(filePath, 'utf-8');
    const jsonData = JSON.parse(jsonContent);
    
    // Convert JSON to structured text format
    const text = this.formatJsonData(jsonData);
    
    return {
      title: jsonData.title || jsonData.name || path.basename(filePath),
      sections: this.extractSectionsFromText(text),
      tables: [],
      metadata: {
        language: 'en', // Default for JSON
      }
    };
  }

  private extractSectionsFromText(text: string): Section[] {
    const lines = text.split('\n');
    const sections: Section[] = [];
    let currentSection: Section | null = null;
    let currentContent: string[] = [];
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // Detect headings using various patterns
      const headingMatch = this.detectHeading(trimmedLine);
      
      if (headingMatch) {
        // Save previous section
        if (currentSection) {
          currentSection.content = currentContent.join('\n').trim();
          sections.push(currentSection);
        }
        
        // Start new section
        currentSection = {
          level: headingMatch.level,
          title: headingMatch.title,
          content: '',
          subsections: []
        };
        currentContent = [];
      } else if (trimmedLine) {
        currentContent.push(trimmedLine);
      }
    }
    
    // Add final section
    if (currentSection) {
      currentSection.content = currentContent.join('\n').trim();
      sections.push(currentSection);
    }
    
    return this.organizeSectionHierarchy(sections);
  }

  private extractHtmlSections($: cheerio.CheerioAPI): Section[] {
    const sections: Section[] = [];
    
    // Extract headings and their content
    $('h1, h2, h3, h4, h5, h6').each((_: number, element: any) => {
      const $heading = $(element);
      const level = parseInt(element.tagName.substring(1));
      const title = $heading.text().trim();
      
      // Get content until next heading of same or higher level
      let content = '';
      let $next = $heading.next();
      
      while ($next.length > 0 && !this.isHeading($next.get(0)?.tagName || '')) {
        content += $next.text() + '\n';
        $next = $next.next();
      }
      
      sections.push({
        level,
        title,
        content: content.trim(),
        subsections: []
      });
    });
    
    return this.organizeSectionHierarchy(sections);
  }

  private extractTablesFromText(text: string): Table[] {
    const tables: Table[] = [];
    const lines = text.split('\n');
    
    // Simple table detection - look for lines with consistent delimiters
    let tableLines: string[] = [];
    let inTable = false;
    let tableId = 0;
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // Detect table patterns (multiple tabs or pipes or consistent spacing)
      const isTableRow = this.isTableRow(trimmedLine);
      
      if (isTableRow) {
        if (!inTable) {
          inTable = true;
          tableLines = [];
        }
        tableLines.push(trimmedLine);
      } else {
        if (inTable && tableLines.length > 1) {
          // Process collected table
          const table = this.parseTableLines(tableLines, `table_${++tableId}`);
          if (table) {
            tables.push(table);
          }
        }
        inTable = false;
        tableLines = [];
      }
    }
    
    return tables;
  }

  private extractHtmlTables($: cheerio.CheerioAPI): Table[] {
    const tables: Table[] = [];
    
    $('table').each((index: number, element: any) => {
      const $table = $(element);
      const caption = $table.find('caption').text().trim();
      
      // Extract headers
      const headers: string[] = [];
      $table.find('thead tr th, tr:first-child th, tr:first-child td').each((_: number, th: any) => {
        headers.push($(th).text().trim());
      });
      
      // Extract rows
      const rows: string[][] = [];
      $table.find('tbody tr, tr').slice(headers.length > 0 ? 1 : 0).each((_: number, tr: any) => {
        const row: string[] = [];
        $(tr).find('td, th').each((_: number, td: any) => {
          row.push($(td).text().trim());
        });
        if (row.length > 0) {
          rows.push(row);
        }
      });
      
      tables.push({
        id: `table_${index + 1}`,
        caption: caption || undefined,
        headers,
        rows,
      });
    });
    
    return tables;
  }

  private async performIntelligentChunking(
    structure: DocumentStructure,
    chunkSize: number,
    overlap: number,
    semanticChunking: boolean
  ): Promise<EnhancedChunk[]> {
    const chunks: EnhancedChunk[] = [];
    
    // Process sections with structure awareness
    for (const section of structure.sections) {
      const sectionChunks = await this.chunkSection(section, chunkSize, overlap, semanticChunking);
      chunks.push(...sectionChunks);
    }
    
    // Process tables separately
    for (const table of structure.tables) {
      const tableChunk = this.createTableChunk(table);
      chunks.push(tableChunk);
    }
    
    return chunks;
  }

  private async chunkSection(
    section: Section,
    chunkSize: number,
    overlap: number,
    semanticChunking: boolean
  ): Promise<EnhancedChunk[]> {
    const chunks: EnhancedChunk[] = [];
    
    // If section is small enough, keep as single chunk
    const tokenCount = this.estimateTokenCount(section.content);
    if (tokenCount <= chunkSize) {
      chunks.push({
        content: section.content,
        metadata: {
          type: 'text',
          level: section.level,
          sectionTitle: section.title,
          pageNumber: section.pageNumber,
          position: section.position,
          semanticDensity: this.calculateSemanticDensity(section.content),
          readabilityScore: this.calculateReadabilityScore(section.content),
        }
      });
      return chunks;
    }
    
    // Split large sections intelligently
    if (semanticChunking) {
      return this.semanticChunking(section, chunkSize, overlap);
    } else {
      return this.simpleChunking(section, chunkSize, overlap);
    }
  }

  private semanticChunking(section: Section, chunkSize: number, overlap: number): EnhancedChunk[] {
    const chunks: EnhancedChunk[] = [];
    const sentences = this.splitIntoSentences(section.content);
    
    let currentChunk = '';
    let currentTokens = 0;
    
    for (const sentence of sentences) {
      const sentenceTokens = this.estimateTokenCount(sentence);
      
      if (currentTokens + sentenceTokens > chunkSize && currentChunk.trim()) {
        // Create chunk with overlap
        chunks.push({
          content: currentChunk.trim(),
          metadata: {
            type: 'text',
            level: section.level,
            sectionTitle: section.title,
            pageNumber: section.pageNumber,
            semanticDensity: this.calculateSemanticDensity(currentChunk),
            readabilityScore: this.calculateReadabilityScore(currentChunk),
          }
        });
        
        // Start new chunk with overlap
        const overlapText = this.getOverlapText(currentChunk, overlap);
        currentChunk = overlapText + (overlapText ? ' ' : '') + sentence;
        currentTokens = this.estimateTokenCount(currentChunk);
      } else {
        currentChunk += (currentChunk ? ' ' : '') + sentence;
        currentTokens += sentenceTokens;
      }
    }
    
    if (currentChunk.trim()) {
      chunks.push({
        content: currentChunk.trim(),
        metadata: {
          type: 'text',
          level: section.level,
          sectionTitle: section.title,
          pageNumber: section.pageNumber,
          semanticDensity: this.calculateSemanticDensity(currentChunk),
          readabilityScore: this.calculateReadabilityScore(currentChunk),
        }
      });
    }
    
    return chunks;
  }

  private simpleChunking(section: Section, chunkSize: number, overlap: number): EnhancedChunk[] {
    // Fallback to simple word-based chunking
    const words = section.content.split(/\s+/);
    const chunks: EnhancedChunk[] = [];
    const wordsPerChunk = Math.floor(chunkSize * 0.75); // Rough conversion
    
    for (let i = 0; i < words.length; i += wordsPerChunk - overlap) {
      const chunkWords = words.slice(i, i + wordsPerChunk);
      const content = chunkWords.join(' ');
      
      chunks.push({
        content,
        metadata: {
          type: 'text',
          level: section.level,
          sectionTitle: section.title,
          pageNumber: section.pageNumber,
          semanticDensity: this.calculateSemanticDensity(content),
          readabilityScore: this.calculateReadabilityScore(content),
        }
      });
    }
    
    return chunks;
  }

  private createTableChunk(table: Table): EnhancedChunk {
    // Convert table to structured text
    let content = '';
    
    if (table.caption) {
      content += `Table: ${table.caption}\n\n`;
    }
    
    // Add headers
    if (table.headers.length > 0) {
      content += table.headers.join(' | ') + '\n';
      content += table.headers.map(() => '---').join(' | ') + '\n';
    }
    
    // Add rows
    for (const row of table.rows) {
      content += row.join(' | ') + '\n';
    }
    
    return {
      content: content.trim(),
      metadata: {
        type: 'table',
        tableId: table.id,
        pageNumber: table.pageNumber,
        position: table.position,
        semanticDensity: this.calculateSemanticDensity(content),
        readabilityScore: this.calculateReadabilityScore(content),
      }
    };
  }

  private async processEnhancedChunk(
    documentId: string,
    enhancedChunk: EnhancedChunk,
    chunkIndex: number
  ): Promise<void> {
    try {
      // Create embedding for the chunk
      const embedding = await vectorStore.createEmbedding(enhancedChunk.content);
      
      // Create chunk record with enhanced metadata
      const chunk = await storage.createDocumentChunk({
        documentId,
        content: enhancedChunk.content,
        chunkIndex,
        metadata: {
          ...enhancedChunk.metadata,
          wordCount: enhancedChunk.content.split(/\s+/).length,
          tokenCount: this.estimateTokenCount(enhancedChunk.content),
          createdAt: new Date().toISOString(),
          processor: 'docling-inspired',
        }
      });

      // Store in vector database with enhanced metadata
      await vectorStore.upsertVector(
        chunk.id,
        embedding,
        {
          documentId,
          chunkIndex,
          content: enhancedChunk.content.substring(0, 500),
          type: enhancedChunk.metadata.type,
          sectionTitle: enhancedChunk.metadata.sectionTitle,
          level: enhancedChunk.metadata.level,
          pageNumber: enhancedChunk.metadata.pageNumber,
          semanticDensity: enhancedChunk.metadata.semanticDensity,
          readabilityScore: enhancedChunk.metadata.readabilityScore,
          processor: 'docling-inspired'
        }
      );

      // Update chunk with vector ID
      await storage.updateDocumentChunk(chunk.id, { vectorId: chunk.id });
    } catch (error) {
      console.error('Error processing enhanced chunk:', error);
      throw error;
    }
  }

  // Helper methods
  private detectHeading(line: string): { level: number; title: string } | null {
    // Detect markdown-style headings
    const mdMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (mdMatch) {
      return { level: mdMatch[1].length, title: mdMatch[2].trim() };
    }
    
    // Detect numbered headings
    const numberedMatch = line.match(/^(\d+(?:\.\d+)*)\s+(.+)$/);
    if (numberedMatch) {
      const level = numberedMatch[1].split('.').length;
      return { level, title: numberedMatch[2].trim() };
    }
    
    // Detect all caps headings
    if (line === line.toUpperCase() && line.length > 3 && line.length < 100) {
      return { level: 1, title: line };
    }
    
    return null;
  }

  private isHeading(tagName: string): boolean {
    return /^h[1-6]$/i.test(tagName);
  }

  private isTableRow(line: string): boolean {
    // Detect table rows by delimiter patterns
    const tabCount = (line.match(/\t/g) || []).length;
    const pipeCount = (line.match(/\|/g) || []).length;
    
    return tabCount >= 2 || pipeCount >= 2;
  }

  private parseTableLines(lines: string[], id: string): Table | null {
    if (lines.length < 2) return null;
    
    // Determine delimiter
    const delimiter = lines[0].includes('\t') ? '\t' : '|';
    
    // Parse headers (first line)
    const headers = lines[0].split(delimiter).map(h => h.trim()).filter(h => h);
    
    // Parse rows
    const rows: string[][] = [];
    for (let i = 1; i < lines.length; i++) {
      const row = lines[i].split(delimiter).map(c => c.trim()).filter(c => c);
      if (row.length > 0) {
        rows.push(row);
      }
    }
    
    return { id, headers, rows };
  }

  private organizeSectionHierarchy(sections: Section[]): Section[] {
    // Organize flat sections into hierarchical structure
    const organized: Section[] = [];
    const stack: Section[] = [];
    
    for (const section of sections) {
      // Pop sections with equal or higher level
      while (stack.length > 0 && stack[stack.length - 1].level >= section.level) {
        stack.pop();
      }
      
      if (stack.length === 0) {
        organized.push(section);
      } else {
        stack[stack.length - 1].subsections.push(section);
      }
      
      stack.push(section);
    }
    
    return organized;
  }

  private structureToText(structure: DocumentStructure): string {
    let text = '';
    
    // Add title
    if (structure.title) {
      text += `# ${structure.title}\n\n`;
    }
    
    // Add sections
    text += this.sectionsToText(structure.sections);
    
    // Add tables
    for (const table of structure.tables) {
      text += '\n\n' + this.tableToText(table);
    }
    
    return text;
  }

  private sectionsToText(sections: Section[], depth: number = 0): string {
    let text = '';
    
    for (const section of sections) {
      const prefix = '#'.repeat(section.level + depth);
      text += `${prefix} ${section.title}\n\n${section.content}\n\n`;
      
      if (section.subsections.length > 0) {
        text += this.sectionsToText(section.subsections, depth);
      }
    }
    
    return text;
  }

  private tableToText(table: Table): string {
    let text = '';
    
    if (table.caption) {
      text += `**${table.caption}**\n\n`;
    }
    
    if (table.headers.length > 0) {
      text += table.headers.join(' | ') + '\n';
      text += table.headers.map(() => '---').join(' | ') + '\n';
    }
    
    for (const row of table.rows) {
      text += row.join(' | ') + '\n';
    }
    
    return text;
  }

  private countSections(sections: Section[]): number {
    let count = sections.length;
    for (const section of sections) {
      count += this.countSections(section.subsections);
    }
    return count;
  }

  private extractTitleFromText(text: string): string | null {
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length === 0) return null;
    
    // First non-empty line is likely the title
    const firstLine = lines[0].trim();
    if (firstLine.length > 3 && firstLine.length < 200) {
      return firstLine;
    }
    
    return null;
  }

  private detectLanguage(text: string): string {
    // Simple language detection - can be improved
    const sample = text.substring(0, 1000);
    
    // English indicators
    const englishWords = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of'];
    const englishCount = englishWords.filter(word => 
      new RegExp(`\\b${word}\\b`, 'i').test(sample)
    ).length;
    
    return englishCount > 3 ? 'en' : 'unknown';
  }

  private splitIntoSentences(text: string): string[] {
    return text
      .split(/(?<=[.!?])\s+(?=[A-Z])/)
      .filter(sentence => sentence.trim().length > 10);
  }

  private estimateTokenCount(text: string): number {
    const chars = text.length;
    const words = text.split(/\s+/).filter(w => w.length > 0).length;
    
    // Use improved estimation
    const charBasedTokens = chars / 3.5;
    const wordBasedTokens = words * 1.3;
    
    const weight = Math.min(chars / 1000, 0.8);
    const estimatedTokens = (charBasedTokens * weight) + (wordBasedTokens * (1 - weight));
    
    return Math.ceil(Math.max(estimatedTokens, words * 0.8));
  }

  private getOverlapText(text: string, overlapTokens: number): string {
    if (!text.trim() || overlapTokens <= 0) return '';
    
    const words = text.split(/\s+/).filter(w => w.length > 0);
    const overlapWords = Math.min(
      Math.floor(overlapTokens * 0.8),
      Math.floor(words.length * 0.3),
      words.length
    );
    
    return words.slice(-overlapWords).join(' ');
  }

  private calculateSemanticDensity(text: string): number {
    // Simple semantic density calculation
    const words = text.split(/\s+/).filter(w => w.length > 0);
    const uniqueWords = new Set(words.map(w => w.toLowerCase()));
    
    return uniqueWords.size / words.length;
  }

  private calculateReadabilityScore(text: string): number {
    // Simplified readability score (0-100)
    const sentences = this.splitIntoSentences(text).length;
    const words = text.split(/\s+/).filter(w => w.length > 0).length;
    const complexWords = text.split(/\s+/).filter(w => w.length > 6).length;
    
    if (sentences === 0 || words === 0) return 0;
    
    const avgWordsPerSentence = words / sentences;
    const complexWordRatio = complexWords / words;
    
    // Flesch-like formula (simplified)
    const score = 100 - (avgWordsPerSentence * 1.5) - (complexWordRatio * 100);
    
    return Math.max(0, Math.min(100, score));
  }

  private formatJsonData(data: any): string {
    if (Array.isArray(data)) {
      return data.map((item, index) => {
        if (typeof item === 'object' && item !== null) {
          return `Item ${index + 1}:\n${this.formatJsonObject(item)}\n`;
        } else {
          return `Item ${index + 1}: ${String(item)}\n`;
        }
      }).join('\n');
    } else if (typeof data === 'object' && data !== null) {
      return this.formatJsonObject(data);
    } else {
      return String(data);
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

  private async buildEnhancedKnowledgeGraph(documentId: string, structure: DocumentStructure): Promise<void> {
    // Extract entities from structure (simplified for now)
    const entities = new Set<string>();
    
    // Extract from title and content
    const allText = this.structureToText(structure);
    const medicalTerms = [
      'diabetes', 'insulin', 'blood glucose', 'hypoglycemia', 'hyperglycemia',
      'HbA1c', 'metformin', 'glucagon', 'ketones', 'neuropathy',
      'retinopathy', 'nephropathy', 'blood pressure', 'cholesterol'
    ];
    
    for (const term of medicalTerms) {
      const regex = new RegExp(`\\b${term}\\b`, 'gi');
      if (regex.test(allText)) {
        entities.add(term.toLowerCase());
      }
    }
    
    // Create entities and relationships (simplified)
    for (const entityName of Array.from(entities)) {
      try {
        await storage.createEntity({
          name: entityName,
          type: 'medical_term',
          description: `Medical term found in document`,
          metadata: { 
            documentId,
            processor: 'docling-inspired'
          }
        });
      } catch (error) {
        // Entity might already exist
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

export const doclingInspiredProcessor = new DoclingInspiredProcessor();