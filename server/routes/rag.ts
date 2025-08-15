import type { Express } from "express";
import { isAuthenticated } from "../replitAuth";
import { storage } from "../storage";
import { documentProcessor } from "../services/documentProcessor";
import { vectorStore } from "../services/vectorStore";
import { ragOrchestrator } from "../services/ragAgents";
import { enhancedRagOrchestrator } from "../services/enhancedRagOrchestrator";
import { insertDocumentSchema, insertRagChatMessageSchema } from "@shared/schema";
import multer from "multer";
import path from "path";
import fs from "fs/promises";

// Final deduplication function as safety net
function finalDeduplication(content: string): string {
  if (!content) return content;
  
  console.log('Final deduplication - Original length:', content.length);
  
  // STEP 1: Direct half-and-half duplication check (most common case)
  const halfLength = Math.floor(content.length / 2);
  if (halfLength > 50) {
    const firstHalf = content.substring(0, halfLength);
    const secondHalf = content.substring(halfLength);
    
    // Remove whitespace and punctuation for comparison
    const normalizeForComparison = (text: string) => text
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    
    const normalizedFirst = normalizeForComparison(firstHalf);
    const normalizedSecond = normalizeForComparison(secondHalf);
    
    // Check if second half matches first half (complete duplication)
    const similarity = calculateSimilarity(normalizedFirst, normalizedSecond);
    console.log('Half-to-half similarity:', similarity);
    
    if (similarity > 0.85) { // 85% similarity indicates duplication
      console.log('COMPLETE DUPLICATION DETECTED - Keeping only first half');
      content = firstHalf.trim();
      // Ensure it ends properly
      if (!content.endsWith('.') && !content.endsWith('!') && !content.endsWith('?')) {
        content += '.';
      }
    }
  }
  
  // STEP 2: Sentence-level deduplication for remaining content
  const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 10);
  const uniqueSentences: string[] = [];
  const seenNormalized = new Set<string>();
  
  for (const sentence of sentences) {
    const clean = sentence.trim();
    if (clean.length < 15) continue;
    
    const normalized = clean.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    
    if (!seenNormalized.has(normalized)) {
      seenNormalized.add(normalized);
      uniqueSentences.push(clean);
    } else {
      console.log('Duplicate sentence removed:', clean.substring(0, 50) + '...');
    }
  }
  
  const finalResult = uniqueSentences.join('. ') + '.';
  console.log('Final length:', finalResult.length, '| Reduction:', Math.round((1 - finalResult.length / content.length) * 100) + '%');
  
  return finalResult;
}

// Helper function to calculate text similarity
function calculateSimilarity(text1: string, text2: string): number {
  if (!text1 || !text2) return 0;
  
  // Use longest common subsequence approach
  const words1 = text1.split(' ');
  const words2 = text2.split(' ');
  
  // Simple similarity check: how many words match in order
  let matches = 0;
  const minLength = Math.min(words1.length, words2.length);
  
  for (let i = 0; i < minLength; i++) {
    if (words1[i] === words2[i]) {
      matches++;
    }
  }
  
  return matches / Math.max(words1.length, words2.length);
}

// Configure multer for document uploads
const documentStorage = multer.diskStorage({
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
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: documentStorage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow PDFs, DOCX, HTML, TXT, and JSON files
    const allowedTypes = ['.pdf', '.docx', '.html', '.htm', '.txt', '.json'];
    const ext = path.extname(file.originalname).toLowerCase();
    
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF, DOCX, HTML, TXT, and JSON files are allowed!'));
    }
  }
});

export function registerRAGRoutes(app: Express) {
  // Initialize vector store
  app.post("/api/rag/initialize", isAuthenticated, async (req, res) => {
    try {
      if (!process.env.PINECONE_API_KEY) {
        return res.status(400).json({ 
          message: "Pinecone API key required for RAG functionality" 
        });
      }
      
      await vectorStore.initialize();
      res.json({ message: "Vector store initialized successfully" });
    } catch (error) {
      console.error("Vector store initialization error:", error);
      res.status(500).json({ message: "Failed to initialize vector store" });
    }
  });

  // Get verification data
  app.get("/api/rag/verification", isAuthenticated, async (req, res) => {
    try {
      // Get document counts
      const documents = await storage.getAllDocuments();
      const jobs = await storage.getProcessingJobs();
      
      // Count documents with chunks
      let documentsWithChunks = 0;
      let totalChunks = 0;
      
      for (const doc of documents) {
        const chunks = await storage.getDocumentChunks(doc.id);
        if (chunks.length > 0) {
          documentsWithChunks++;
          totalChunks += chunks.length;
        }
      }

      // Categorize jobs
      const completedJobs = jobs.filter(job => job.status === 'completed');
      const processingJobs = jobs.filter(job => job.status === 'processing');
      const failedJobs = jobs.filter(job => job.status === 'failed');

      // Count documents by category
      const documentsByCategory: Record<string, number> = {};
      documents.forEach(doc => {
        documentsByCategory[doc.category] = (documentsByCategory[doc.category] || 0) + 1;
      });

      res.json({
        totalDocuments: documents.length,
        documentsWithChunks,
        completedJobs,
        processingJobs,
        failedJobs,
        totalChunks,
        documentsByCategory
      });
    } catch (error) {
      console.error('Verification endpoint error:', error);
      res.status(500).json({ message: 'Failed to load verification data' });
    }
  });

  // Upload and process document
  app.post("/api/rag/documents/upload", isAuthenticated, upload.single('document'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'No document file uploaded' });
      }

      const { documentType = 'guideline', category = 'diabetes' } = req.body;
      const filePath = req.file.path;

      // Start document processing
      const documentId = await documentProcessor.processDocument(
        filePath,
        documentType,
        category
      );

      res.json({
        message: 'Document uploaded and processing started',
        documentId,
        filename: req.file.filename,
        originalName: req.file.originalname,
        size: req.file.size
      });
    } catch (error) {
      console.error('Document upload error:', error);
      res.status(500).json({ message: 'Failed to upload document' });
    }
  });

  // Get all documents
  app.get("/api/rag/documents", isAuthenticated, async (req, res) => {
    try {
      const documents = await storage.getDocuments();
      res.json(documents);
    } catch (error) {
      console.error("Error fetching documents:", error);
      res.status(500).json({ message: "Failed to fetch documents" });
    }
  });

  // Get document by ID
  app.get("/api/rag/documents/:id", isAuthenticated, async (req, res) => {
    try {
      const document = await storage.getDocument(req.params.id);
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }
      res.json(document);
    } catch (error) {
      console.error("Error fetching document:", error);
      res.status(500).json({ message: "Failed to fetch document" });
    }
  });

  // Delete document
  app.delete("/api/rag/documents/:id", isAuthenticated, async (req, res) => {
    try {
      const document = await storage.getDocument(req.params.id);
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }

      // Delete document chunks from vector store
      const chunks = await storage.getDocumentChunks(req.params.id);
      for (const chunk of chunks) {
        if (chunk.vectorId) {
          await vectorStore.deleteVector(chunk.vectorId);
        }
        await storage.deleteDocumentChunk(chunk.id);
      }

      // Delete document
      await storage.deleteDocument(req.params.id);

      res.json({ message: "Document deleted successfully" });
    } catch (error) {
      console.error("Error deleting document:", error);
      res.status(500).json({ message: "Failed to delete document" });
    }
  });

  // Enhanced RAG chat endpoint with multi-agent processing
  app.post("/api/rag/chat", isAuthenticated, async (req, res) => {
    try {
      const { message, courseId, conversationHistory } = req.body;
      const user = req.user as any;

      if (!message) {
        return res.status(400).json({ message: "Message is required" });
      }

      // Create user object for the enhanced orchestrator
      const userObj = {
        id: user.claims.sub,
        email: user.claims.email || user.claims.global_name || null,
        firstName: user.claims.given_name || null,
        lastName: user.claims.family_name || null,
        profileImageUrl: user.claims.picture || null,
        role: 'care_worker' as const,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Process query with Enhanced RAG Orchestrator
      const response = await enhancedRagOrchestrator.processQuery(
        message, 
        userObj, 
        courseId, 
        conversationHistory
      );

      // Final deduplication before sending to user (safety net)
      if (response.content) {
        response.content = finalDeduplication(response.content);
      }

      // Store the enhanced chat message
      const chatMessage = await storage.createRagChatMessage({
        userId: user.claims.sub,
        courseId: courseId || null,
        message,
        response: response.content || '',
        sources: response.sources || [],
        confidence: response.confidence || 0,
        agentTrace: { 
          agents: response.agentsUsed || [],
          responseTime: response.responseTime || 0,
          cacheHit: response.cacheHit || false,
          usedRAG: response.usedRAG || false
        }
      });

      res.json({
        ...response,
        id: chatMessage.id,
        timestamp: chatMessage.timestamp
      });
    } catch (error) {
      console.error("Enhanced RAG chat error:", error);
      res.status(500).json({ 
        message: "I'm experiencing technical difficulties. Please consult your local healthcare guidelines for immediate assistance.",
        confidence: 0,
        sources: [],
        usedRAG: false,
        agentsUsed: ['error_handler']
      });
    }
  });

  // Get RAG chat history
  app.get("/api/rag/chat/:courseId?", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const { courseId } = req.params;
      
      const messages = await storage.getRagChatMessages(user.claims.sub, courseId);
      res.json(messages);
    } catch (error) {
      console.error("Error fetching chat history:", error);
      res.status(500).json({ message: "Failed to fetch chat history" });
    }
  });

  // Get processing jobs
  app.get("/api/rag/jobs", isAuthenticated, async (req, res) => {
    try {
      const jobs = await storage.getProcessingJobs();
      res.json(jobs);
    } catch (error) {
      console.error("Error fetching processing jobs:", error);
      res.status(500).json({ message: "Failed to fetch processing jobs" });
    }
  });

  // Get entities
  app.get("/api/rag/entities", isAuthenticated, async (req, res) => {
    try {
      const entities = await storage.getEntities();
      res.json(entities);
    } catch (error) {
      console.error("Error fetching entities:", error);
      res.status(500).json({ message: "Failed to fetch entities" });
    }
  });

  // Get entity relationships
  app.get("/api/rag/relationships/:entityId?", isAuthenticated, async (req, res) => {
    try {
      const { entityId } = req.params;
      const relationships = await storage.getEntityRelationships(entityId);
      res.json(relationships);
    } catch (error) {
      console.error("Error fetching relationships:", error);
      res.status(500).json({ message: "Failed to fetch relationships" });
    }
  });

  // Feedback collection endpoint
  app.post("/api/rag/feedback", isAuthenticated, async (req, res) => {
    try {
      const { messageId, rating, feedbackType, comments, responseTime } = req.body;
      const user = req.user as any;

      if (!messageId || rating === undefined) {
        return res.status(400).json({ message: "Message ID and rating are required" });
      }

      await enhancedRagOrchestrator.collectFeedback(
        user.claims.sub,
        messageId,
        rating,
        feedbackType,
        comments,
        responseTime
      );

      res.json({ message: "Feedback collected successfully" });
    } catch (error) {
      console.error("Error collecting feedback:", error);
      res.status(500).json({ message: "Failed to collect feedback" });
    }
  });

  // Document verification endpoint
  app.get("/api/rag/documents/verify", isAuthenticated, async (req, res) => {
    try {
      const documents = await storage.getDocuments();
      const jobs = await storage.getProcessingJobs();
      
      const documentStats = {
        totalDocuments: documents.length,
        documentsWithChunks: 0,
        totalChunks: 0,
        recentDocuments: documents.slice(-10), // Last 10 documents
        processingJobs: jobs.filter(job => job.status === 'processing'),
        completedJobs: jobs.filter(job => job.status === 'completed'),
        failedJobs: jobs.filter(job => job.status === 'failed'),
        documentsByCategory: {} as Record<string, number>,
        documentsByType: {} as Record<string, number>,
        vectorStoreStatus: 'unknown' as string,
        chunkDistribution: [] as Array<{documentId: string, title: string, chunkCount: number, hasVectors: boolean}>
      };



  // Recent uploads status endpoint
  app.get("/api/rag/status/recent", isAuthenticated, async (req, res) => {
    try {
      const documents = await storage.getDocuments();
      const jobs = await storage.getProcessingJobs();
      
      // Get documents from the last hour
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const recentDocs = documents.filter(doc => new Date(doc.createdAt) > oneHourAgo);
      
      // Get recent jobs
      const recentJobs = jobs.filter(job => new Date(job.createdAt) > oneHourAgo);
      
      const status = {
        recentDocuments: recentDocs.length,
        recentJobs: recentJobs.length,
        completedRecently: recentJobs.filter(job => job.status === 'completed').length,
        failedRecently: recentJobs.filter(job => job.status === 'failed').length,
        processingNow: recentJobs.filter(job => job.status === 'processing').length,
        details: await Promise.all(recentDocs.map(async (doc) => {
          const chunks = await storage.getDocumentChunks(doc.id);
          const relatedJob = recentJobs.find(job => job.metadata?.filePath?.includes(doc.title.split('.')[0]));
          return {
            id: doc.id,
            title: doc.title,
            category: doc.category,
            documentType: doc.documentType,
            chunkCount: chunks.length,
            hasVectors: chunks.some(chunk => chunk.vectorId),
            jobStatus: relatedJob?.status || 'unknown',
            createdAt: doc.createdAt
          };
        }))
      };
      
      res.json(status);
    } catch (error) {
      console.error("Error getting recent status:", error);
      res.status(500).json({ message: "Failed to get recent status" });
    }
  });

      // Get chunk counts and categorize documents
      for (const doc of documents) {
        const chunks = await storage.getDocumentChunks(doc.id);
        if (chunks.length > 0) {
          documentStats.documentsWithChunks++;
        }
        documentStats.totalChunks += chunks.length;
        
        // Check if chunks have vector IDs
        const hasVectors = chunks.some(chunk => chunk.vectorId);
        
        documentStats.chunkDistribution.push({
          documentId: doc.id,
          title: doc.title,
          chunkCount: chunks.length,
          hasVectors
        });
        
        // Categorize by document category and type
        documentStats.documentsByCategory[doc.category] = (documentStats.documentsByCategory[doc.category] || 0) + 1;
        documentStats.documentsByType[doc.documentType] = (documentStats.documentsByType[doc.documentType] || 0) + 1;
      }

      // Test vector store connection
      try {
        if (process.env.PINECONE_API_KEY && process.env.OPENAI_API_KEY) {
          // Try a simple query to test the vector store
          const testEmbedding = await vectorStore.createEmbedding("test query");
          const testResults = await vectorStore.queryVectors(testEmbedding, 1);
          documentStats.vectorStoreStatus = 'connected';
        } else {
          documentStats.vectorStoreStatus = 'missing_api_keys';
        }
      } catch (error) {
        documentStats.vectorStoreStatus = 'connection_error';
      }

      res.json(documentStats);
    } catch (error) {
      console.error("Error verifying documents:", error);
      res.status(500).json({ message: "Failed to verify documents" });
    }
  });

  // Analytics endpoint for monitoring (admin only)
  app.get("/api/rag/analytics", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      
      // Simple role check - in production would need proper admin role verification
      if (user.claims.email && user.claims.email.includes('admin')) {
        const analytics = await storage.getRagAnalytics();
        res.json(analytics);
      } else {
        res.status(403).json({ message: "Access denied" });
      }
    } catch (error) {
      console.error("Error fetching analytics:", error);
      res.status(500).json({ message: "Failed to fetch analytics" });
    }
  });
}