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
    // Allow PDFs, DOCX, HTML, and TXT files
    const allowedTypes = ['.pdf', '.docx', '.html', '.htm', '.txt'];
    const ext = path.extname(file.originalname).toLowerCase();
    
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF, DOCX, HTML, and TXT files are allowed!'));
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
        documentsByCategory: {} as Record<string, number>
      };

      // Get chunk counts and categorize documents
      for (const doc of documents) {
        const chunks = await storage.getDocumentChunks(doc.id);
        if (chunks.length > 0) {
          documentStats.documentsWithChunks++;
        }
        documentStats.totalChunks += chunks.length;
        
        // Categorize by document category
        if (!documentStats.documentsByCategory[doc.category]) {
          documentStats.documentsByCategory[doc.category] = 0;
        }
        documentStats.documentsByCategory[doc.category]++;
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