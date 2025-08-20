
import type { Express } from "express";
import { isAuthenticated } from "../replitAuth";
import { storage } from "../storage";
import { vectorStore } from "../services/vectorStore";

interface CustomChunk {
  title: string;
  description: string;
  source: string;
  content: string;
  tags: string[];
  chunkIndex?: number;
}

interface CustomDocumentUpload {
  documentTitle: string;
  documentType: string;
  category: string;
  source: string;
  chunks: CustomChunk[];
}

export async function registerCustomChunkRoutes(app: Express) {
  // Upload pre-structured document with custom chunks
  app.post("/api/custom-chunks/upload", isAuthenticated, async (req, res) => {
    try {
      const { documentTitle, documentType, category, source, chunks }: CustomDocumentUpload = req.body;

      if (!documentTitle || !chunks || !Array.isArray(chunks) || chunks.length === 0) {
        return res.status(400).json({ 
          message: "Document title and chunks array are required" 
        });
      }

      console.log(`📝 Creating custom document: ${documentTitle} with ${chunks.length} pre-structured chunks`);

      // Create document record
      const document = await storage.createDocument({
        title: documentTitle,
        content: chunks.map(chunk => chunk.content).join('\n\n'),
        source: source || `custom-upload-${Date.now()}`,
        documentType: documentType || 'guideline',
        category: category || 'diabetes',
        metadata: {
          customChunks: true,
          totalChunks: chunks.length,
          processedAt: new Date().toISOString(),
          uploadMethod: 'custom-structured'
        }
      });

      console.log(`✅ Document created: ${document.id}`);

      // Process each custom chunk
      let successCount = 0;
      let errorCount = 0;

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        try {
          console.log(`🔄 Processing chunk ${i + 1}/${chunks.length}: ${chunk.title}`);

          // Create embedding for the chunk content
          const embedding = await vectorStore.createEmbedding(chunk.content);

          // Create chunk record with custom metadata
          const dbChunk = await storage.createDocumentChunk({
            documentId: document.id,
            content: chunk.content,
            chunkIndex: chunk.chunkIndex || i,
            metadata: {
              title: chunk.title,
              description: chunk.description,
              tags: chunk.tags,
              source: chunk.source,
              customChunk: true,
              wordCount: chunk.content.split(/\s+/).length,
              createdAt: new Date().toISOString()
            }
          });

          // Store in vector database with enhanced metadata
          await vectorStore.upsertVector(
            dbChunk.id,
            embedding,
            {
              documentId: document.id,
              chunkIndex: chunk.chunkIndex || i,
              title: chunk.title,
              description: chunk.description,
              tags: chunk.tags.join(', '),
              source: chunk.source,
              content: chunk.content.substring(0, 500), // Preview for metadata
              type: 'custom_chunk',
              category: category || 'diabetes',
              documentType: documentType || 'guideline'
            }
          );

          // Update chunk with vector ID
          await storage.updateDocumentChunk(dbChunk.id, { vectorId: dbChunk.id });

          successCount++;
          console.log(`✅ Successfully processed chunk: ${chunk.title}`);
        } catch (error) {
          errorCount++;
          console.error(`❌ Error processing chunk ${chunk.title}:`, error);
        }
      }

      console.log(`🎉 Custom chunk upload completed: ${successCount} success, ${errorCount} errors`);

      res.json({
        message: "Custom chunks uploaded successfully",
        documentId: document.id,
        documentTitle,
        totalChunks: chunks.length,
        successCount,
        errorCount,
        chunks: chunks.map((chunk, index) => ({
          index,
          title: chunk.title,
          tags: chunk.tags,
          wordCount: chunk.content.split(/\s+/).length
        }))
      });
    } catch (error) {
      console.error("Custom chunk upload error:", error);
      res.status(500).json({ 
        message: "Failed to upload custom chunks",
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get custom chunks for a document
  app.get("/api/custom-chunks/document/:documentId", isAuthenticated, async (req, res) => {
    try {
      const { documentId } = req.params;
      
      const document = await storage.getDocument(documentId);
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }

      const chunks = await storage.getDocumentChunks(documentId);
      
      // Format chunks with their custom metadata
      const formattedChunks = chunks.map(chunk => ({
        id: chunk.id,
        chunkIndex: chunk.chunkIndex,
        content: chunk.content,
        title: chunk.metadata?.title || `Chunk ${chunk.chunkIndex + 1}`,
        description: chunk.metadata?.description || '',
        tags: chunk.metadata?.tags || [],
        source: chunk.metadata?.source || document.source,
        wordCount: chunk.metadata?.wordCount || 0,
        hasVector: !!chunk.vectorId
      }));

      res.json({
        document: {
          id: document.id,
          title: document.title,
          category: document.category,
          documentType: document.documentType,
          totalChunks: chunks.length
        },
        chunks: formattedChunks
      });
    } catch (error) {
      console.error("Error fetching custom chunks:", error);
      res.status(500).json({ message: "Failed to fetch custom chunks" });
    }
  });

  // Validate chunk structure before upload
  app.post("/api/custom-chunks/validate", isAuthenticated, async (req, res) => {
    try {
      const { chunks }: { chunks: CustomChunk[] } = req.body;

      if (!chunks || !Array.isArray(chunks)) {
        return res.status(400).json({ message: "Chunks array is required" });
      }

      const validationResults = chunks.map((chunk, index) => {
        const errors = [];
        const warnings = [];

        // Required fields validation
        if (!chunk.title) errors.push("Title is required");
        if (!chunk.content) errors.push("Content is required");
        if (!chunk.tags || !Array.isArray(chunk.tags)) errors.push("Tags array is required");

        // Content quality checks
        if (chunk.content && chunk.content.length < 50) {
          warnings.push("Content is very short (less than 50 characters)");
        }
        if (chunk.content && chunk.content.length > 5000) {
          warnings.push("Content is very long (more than 5000 characters)");
        }

        // Tags validation
        if (chunk.tags && chunk.tags.length === 0) {
          warnings.push("No tags provided");
        }

        return {
          index,
          title: chunk.title || `Chunk ${index + 1}`,
          isValid: errors.length === 0,
          errors,
          warnings,
          wordCount: chunk.content ? chunk.content.split(/\s+/).length : 0
        };
      });

      const totalValid = validationResults.filter(r => r.isValid).length;
      const totalInvalid = validationResults.filter(r => !r.isValid).length;

      res.json({
        summary: {
          totalChunks: chunks.length,
          validChunks: totalValid,
          invalidChunks: totalInvalid,
          canUpload: totalInvalid === 0
        },
        results: validationResults
      });
    } catch (error) {
      console.error("Chunk validation error:", error);
      res.status(500).json({ message: "Failed to validate chunks" });
    }
  });
}
