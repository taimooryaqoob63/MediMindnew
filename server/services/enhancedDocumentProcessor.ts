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
    chunkSize: 1000,
    chunkOverlap: 200,
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
      const existingDocs = await storage.getDocuments();
      for (const doc of existingDocs) {
        if (doc.metadata && typeof doc.metadata === 'object' && 'simHash' in doc.metadata) {
          if (doc.metadata.simHash === simHash) {
            return doc.id;
          }
        }
      }
    } catch (error) {
      console.log('Duplicate check not available:', error);
    }
    return null;
  }

  // Simulate Docling-like structured parsing
  private async parseWithDoclingStructure(content: string, filePath: string): Promise<DoclingStructure> {
    // This simulates what Docling would provide - structured document parsing
    const lines = content.split('\n');
    const sections: DoclingStructure['sections'] = [];
    const references: string[] = [];
    const pageNumbers: Record<string, number> = {};
    
    let currentSection: DoclingStructure['sections'][0] | null = null;
    let currentPage = 1;

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;

      // Detect headings (simplified - look for numbered sections or all caps)
      const headingMatch = trimmedLine.match(/^(\d+\.?\d*\.?\d*)\s+(.+)$/);
      const isHeading = headingMatch || /^[A-Z\s]{5,}$/.test(trimmedLine);

      if (isHeading) {
        // Save previous section
        if (currentSection) {
          sections.push(currentSection);
        }

        // Start new section
        currentSection = {
          heading: headingMatch ? headingMatch[2] : trimmedLine,
          level: headingMatch ? (headingMatch[1].split('.').length) : 1,
          paragraphs: [],
          tables: [],
          figures: []
        };
      } else if (currentSection) {
        // Add to current section
        if (trimmedLine.includes('Table') && trimmedLine.includes(':')) {
          // Detect table
          const tableId = `T${currentSection.tables.length + 1}`;
          currentSection.tables.push({
            id: tableId,
            caption: trimmedLine,
            data: []
          });
        } else if (trimmedLine.includes('Figure') && trimmedLine.includes(':')) {
          // Detect figure
          const figureId = `F${currentSection.figures.length + 1}`;
          currentSection.figures.push({
            id: figureId,
            caption: trimmedLine,
            description: ''
          });
        } else if (trimmedLine.includes('doi:') || trimmedLine.includes('NICE:')) {
          // Detect reference
          references.push(trimmedLine);
        } else {
          // Regular paragraph
          currentSection.paragraphs.push(trimmedLine);
        }

        // Track page numbers (simplified)
        if (trimmedLine.includes('Page ') || currentSection.paragraphs.length % 20 === 0) {
          pageNumbers[trimmedLine.substring(0, 50)] = currentPage++;
        }
      }
    }

    // Add final section
    if (currentSection) {
      sections.push(currentSection);
    }

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
    switch (docType) {
      case 'guideline':
        return nodeType === 'table' ? { size: 800, overlap: 100 } : { size: 900, overlap: 150 };
      case 'faq':
        return { size: 1200, overlap: 150 };
      case 'paper':
        return { size: 1000, overlap: 200 };
      default:
        return { size: 800, overlap: 150 };
    }
  }

  // Structure-aware chunking
  private async chunkDocumentStructured(
    structure: DoclingStructure,
    docType: string,
    maxTokens: number = 1000
  ): Promise<Array<{ content: string; metadata: Partial<EnhancedMetadata> }>> {
    const chunks: Array<{ content: string; metadata: Partial<EnhancedMetadata> }> = [];

    for (const section of structure.sections) {
      const sectionPath = [section.heading];

      // Process paragraphs
      for (const paragraph of section.paragraphs) {
        const { size, overlap } = this.getAdaptiveChunkSize(docType, 'paragraph');
        
        if (paragraph.length > size) {
          // Apply sliding window for long paragraphs
          const words = paragraph.split(/\s+/);
          for (let i = 0; i < words.length; i += size - overlap) {
            const chunk = words.slice(i, i + size).join(' ');
            if (chunk.trim()) {
              chunks.push({
                content: chunk,
                metadata: {
                  sectionPath,
                  nodeType: 'paragraph',
                  page: structure.pageNumbers[paragraph.substring(0, 50)]
                }
              });
            }
          }
        } else {
          // Keep short paragraphs as single chunks
          chunks.push({
            content: paragraph,
            metadata: {
              sectionPath,
              nodeType: 'paragraph',
              page: structure.pageNumbers[paragraph.substring(0, 50)]
            }
          });
        }
      }

      // Process tables
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

      // Process figures
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

    return chunks;
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
      const content = await this.extractTextContent(filePath);
      
      if (!content.trim()) {
        throw new Error('No text content extracted from document');
      }

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
    const jsonData = JSON.parse(jsonContent);
    return JSON.stringify(jsonData, null, 2);
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
      guidelines: structure.references
    };

    const extractedEntities = [];

    for (const [category, terms] of Object.entries(medicalEntities)) {
      for (const term of terms) {
        const regex = new RegExp(`\\b${term}\\b`, 'gi');
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
    console.log(`Building enhanced knowledge graph for document ${documentId}`);
    
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