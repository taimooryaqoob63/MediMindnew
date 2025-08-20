
import type { Express } from "express";
import { isAuthenticated } from "../replitAuth";
import { customChunkEmbedder, type StructuredChunk } from "../services/customChunkEmbedder";
import multer from "multer";
import mammoth from "mammoth";
import path from "path";
import fs from "fs/promises";

// Configure multer for Word document uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = './uploads/documents';
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error as Error, uploadDir);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'word-doc-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow only .docx files
    if (file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      cb(null, true);
    } else {
      cb(new Error('Only .docx files are allowed!'));
    }
  }
});

// Helper function to parse Word document content into structured chunks
async function parseWordDocumentToChunks(filePath: string, originalName: string): Promise<StructuredChunk[]> {
  try {
    console.log(`📄 Processing Word document: ${originalName}`);
    
    // Extract text from .docx file
    const result = await mammoth.extractRawText({ path: filePath });
    const fullText = result.value;
    
    if (!fullText.trim()) {
      throw new Error('No text content found in the document');
    }

    console.log(`📝 Extracted ${fullText.length} characters from document`);

    // Parse the text to identify headings and content
    const lines = fullText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    const chunks: StructuredChunk[] = [];
    
    let currentChunk: Partial<StructuredChunk> | null = null;
    let contentLines: string[] = [];

    for (const line of lines) {
      // Detect headings (lines that are short and likely to be headings)
      const isHeading = line.length < 100 && 
                       (line.match(/^[A-Z\s]{5,}$/) || // All caps headings
                        line.match(/^\d+\.?\d*\.?\d*\s+[A-Z]/) || // Numbered headings
                        line.match(/^[A-Z][^.!?]*$/) || // Capitalized single sentences
                        line.split(' ').length <= 8); // Short phrases

      if (isHeading && line.length > 5) {
        // Save previous chunk if it exists
        if (currentChunk && currentChunk.title && contentLines.length > 0) {
          const content = contentLines.join('\n\n').trim();
          if (content.length > 20) { // Only save chunks with substantial content
            chunks.push({
              title: currentChunk.title,
              description: content.length > 150 ? content.substring(0, 150) + '...' : content,
              content: content,
              source: originalName.replace('.docx', ''),
              tags: extractTagsFromContent(content)
            });
          }
        }

        // Start new chunk
        currentChunk = {
          title: line
        };
        contentLines = [];
      } else {
        // This is content
        if (currentChunk) {
          contentLines.push(line);
        } else {
          // If no heading found yet, treat this as content for a general chunk
          if (!currentChunk) {
            currentChunk = {
              title: "Introduction" // Default title
            };
          }
          contentLines.push(line);
        }
      }
    }

    // Don't forget the last chunk
    if (currentChunk && currentChunk.title && contentLines.length > 0) {
      const content = contentLines.join('\n\n').trim();
      if (content.length > 20) {
        chunks.push({
          title: currentChunk.title,
          description: content.length > 150 ? content.substring(0, 150) + '...' : content,
          content: content,
          source: originalName.replace('.docx', ''),
          tags: extractTagsFromContent(content)
        });
      }
    }

    console.log(`✅ Parsed document into ${chunks.length} structured chunks`);
    
    // Clean up the uploaded file
    try {
      await fs.unlink(filePath);
    } catch (error) {
      console.warn('Could not delete temporary file:', error);
    }

    return chunks;

  } catch (error) {
    console.error('❌ Error parsing Word document:', error);
    throw error;
  }
}

// Helper function to extract relevant tags from content
function extractTagsFromContent(content: string): string[] {
  const commonMedicalTerms = [
    'diabetes', 'insulin', 'glucose', 'blood sugar', 'medication', 'treatment',
    'patient care', 'nursing', 'clinical', 'diagnosis', 'symptoms', 'prevention',
    'management', 'therapy', 'healthcare', 'medical', 'emergency', 'monitoring'
  ];

  const tags: string[] = [];
  const contentLower = content.toLowerCase();

  // Find matching medical terms
  for (const term of commonMedicalTerms) {
    if (contentLower.includes(term)) {
      tags.push(term);
    }
  }

  // Add some generic tags based on content length and structure
  if (content.includes('step') || content.includes('procedure')) {
    tags.push('procedure');
  }
  if (content.includes('emergency') || content.includes('urgent')) {
    tags.push('emergency');
  }
  if (content.includes('medication') || content.includes('drug')) {
    tags.push('medication');
  }

  // Ensure we always have at least one tag
  if (tags.length === 0) {
    tags.push('general');
  }

  // Limit to 5 tags maximum
  return tags.slice(0, 5);
}

export function registerCustomChunkRoutes(app: Express) {
  // Process Word document and extract structured chunks
  app.post("/api/custom-chunks/process-word", isAuthenticated, upload.single('document'), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ 
          message: "No document file uploaded" 
        });
      }

      console.log(`📥 Received Word document: ${req.file.originalname} (${req.file.size} bytes)`);

      const chunks = await parseWordDocumentToChunks(req.file.path, req.file.originalname);

      if (chunks.length === 0) {
        return res.status(400).json({
          message: "Could not extract any structured content from the document. Please ensure your document has clear headings and content."
        });
      }

      res.json({
        message: `Successfully extracted ${chunks.length} structured chunks from Word document`,
        chunks,
        originalFileName: req.file.originalname,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Word document processing error:', error);
      res.status(500).json({
        message: 'Failed to process Word document',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
  // Embed multiple structured chunks
  app.post("/api/custom-chunks/embed", isAuthenticated, async (req, res) => {
    try {
      const { chunks } = req.body;

      if (!chunks || !Array.isArray(chunks)) {
        return res.status(400).json({ 
          message: "Invalid request: 'chunks' array is required" 
        });
      }

      // Validate chunk structure
      for (const chunk of chunks) {
        if (!chunk.title || !chunk.description || !chunk.content || !chunk.source || !Array.isArray(chunk.tags)) {
          return res.status(400).json({
            message: "Invalid chunk structure. Each chunk must have: title, description, content, source, and tags (array)"
          });
        }
      }

      console.log(`📥 Received ${chunks.length} chunks for embedding`);

      const result = await customChunkEmbedder.embedAndStoreChunks(chunks);

      res.json({
        message: `Embedding completed: ${result.processedChunks}/${chunks.length} chunks processed`,
        success: result.success,
        processedChunks: result.processedChunks,
        totalChunks: chunks.length,
        errors: result.errors,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Custom chunk embedding error:', error);
      res.status(500).json({
        message: 'Failed to embed chunks',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Embed a single structured chunk
  app.post("/api/custom-chunks/embed-single", isAuthenticated, async (req, res) => {
    try {
      const chunk: StructuredChunk = req.body;

      if (!chunk.title || !chunk.description || !chunk.content || !chunk.source || !Array.isArray(chunk.tags)) {
        return res.status(400).json({
          message: "Invalid chunk structure. Must have: title, description, content, source, and tags (array)"
        });
      }

      console.log(`📥 Received single chunk for embedding: "${chunk.title}"`);

      const result = await customChunkEmbedder.embedChunk(chunk);

      if (result.success) {
        res.json({
          message: 'Chunk embedded successfully',
          success: true,
          chunkId: result.chunkId,
          timestamp: new Date().toISOString()
        });
      } else {
        res.status(500).json({
          message: 'Failed to embed chunk',
          success: false,
          error: result.error
        });
      }

    } catch (error) {
      console.error('❌ Single chunk embedding error:', error);
      res.status(500).json({
        message: 'Failed to embed chunk',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Search embedded chunks
  app.post("/api/custom-chunks/search", isAuthenticated, async (req, res) => {
    try {
      const { query, namespace, topK = 5 } = req.body;

      if (!query) {
        return res.status(400).json({ 
          message: "Query is required" 
        });
      }

      console.log(`🔍 Search request: "${query}" in namespace: ${namespace || 'all'}`);

      const results = await customChunkEmbedder.searchChunks(query, namespace, topK);

      res.json({
        query,
        namespace: namespace || 'all',
        results,
        count: results.length,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Custom chunk search error:', error);
      res.status(500).json({
        message: 'Failed to search chunks',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get namespaces info (useful for debugging)
  app.get("/api/custom-chunks/namespaces", isAuthenticated, async (req, res) => {
    try {
      const { Pinecone } = await import('@pinecone-database/pinecone');
      const pinecone = new Pinecone({
        apiKey: process.env.PINECONE_API_KEY!,
      });

      const indexName = process.env.PINECONE_INDEX_NAME || 'medimind-rag';
      const index = pinecone.index(indexName);
      
      const stats = await index.describeIndexStats();
      
      res.json({
        indexName,
        totalVectors: stats.totalRecordCount || 0,
        dimension: stats.dimension,
        namespaces: stats.namespaces || {},
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Failed to get namespace info:', error);
      res.status(500).json({
        message: 'Failed to get namespace information',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
}
