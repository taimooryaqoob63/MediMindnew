
import type { Express } from "express";
import { isAuthenticated } from "../replitAuth";
import { customChunkEmbedder, type StructuredChunk } from "../services/customChunkEmbedder";

export function registerCustomChunkRoutes(app: Express) {
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
