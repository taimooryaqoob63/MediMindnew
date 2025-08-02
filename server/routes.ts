import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { getAITutorResponse } from "./services/openai";
import { insertChatMessageSchema } from "@shared/schema";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { ragService } from "./ragService";
import multer from "multer";
import path from "path";
import fs from "fs";

// Configure multer for file uploads
const uploadsDir = path.join(process.cwd(), "uploaded_documents");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const upload = multer({
  dest: uploadsDir,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(new Error("Only PDF files are allowed"));
    }
  },
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Public routes (no auth required)
  app.get("/api/courses", async (req, res) => {
    try {
      const courses = await storage.getCourses();
      res.json(courses);
    } catch (error) {
      res.status(500).json({ message: "Failed to get courses" });
    }
  });



  // Get course by ID
  app.get("/api/courses/:id", async (req, res) => {
    try {
      const course = await storage.getCourse(req.params.id);
      if (!course) {
        return res.status(404).json({ message: "Course not found" });
      }
      res.json(course);
    } catch (error) {
      res.status(500).json({ message: "Failed to get course" });
    }
  });

  // Get modules for a course
  app.get("/api/courses/:courseId/modules", async (req, res) => {
    try {
      const modules = await storage.getModulesByCourse(req.params.courseId);
      res.json(modules);
    } catch (error) {
      res.status(500).json({ message: "Failed to get modules" });
    }
  });

  // Get specific module
  app.get("/api/modules/:id", async (req, res) => {
    try {
      const module = await storage.getModule(req.params.id);
      if (!module) {
        return res.status(404).json({ message: "Module not found" });
      }
      res.json(module);
    } catch (error) {
      res.status(500).json({ message: "Failed to get module" });
    }
  });

  // Get user progress for a course - Protected route
  app.get("/api/progress/:courseId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const progress = await storage.getUserProgress(userId, req.params.courseId);
      res.json(progress);
    } catch (error) {
      res.status(500).json({ message: "Failed to get progress" });
    }
  });

  // Update user progress - Protected route
  app.post("/api/progress", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const progressData = {
        ...req.body,
        userId,
        lastAccessed: new Date().toISOString()
      };
      const progress = await storage.updateUserProgress(progressData);
      res.json(progress);
    } catch (error) {
      res.status(500).json({ message: "Failed to update progress" });
    }
  });

  // Get chat messages - Protected route
  app.get("/api/chat/:courseId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const messages = await storage.getChatMessages(userId, req.params.courseId);
      res.json(messages);
    } catch (error) {
      res.status(500).json({ message: "Failed to get chat messages" });
    }
  });

  // Send chat message and get AI response with RAG - Protected route
  app.post("/api/chat", isAuthenticated, async (req: any, res) => {
    try {
      const { message, courseId, context } = req.body;
      const userId = req.user.claims.sub;
      
      if (!message || !courseId) {
        return res.status(400).json({ message: "Message and courseId are required" });
      }

      // Use RAG service for enhanced responses
      const ragResponse = await ragService.generateRAGResponse({
        question: message,
        context: context || "",
        topK: 5
      });
      
      // Save chat message with RAG response
      const chatMessage = await storage.createChatMessage({
        userId,
        courseId,
        message,
        response: ragResponse.answer,
        timestamp: new Date().toISOString()
      });

      // Return response with document sources
      res.json({ 
        message: chatMessage,
        sources: ragResponse.sources
      });
    } catch (error) {
      console.error('RAG Chat error:', error);
      // Fallback to basic AI response if RAG fails
      try {
        const aiResponse = await getAITutorResponse(req.body.message, req.body.context);
        const chatMessage = await storage.createChatMessage({
          userId: req.user.claims.sub,
          courseId: req.body.courseId,
          message: req.body.message,
          response: aiResponse.response,
          timestamp: new Date().toISOString()
        });
        res.json({ 
          message: chatMessage
        });
      } catch (fallbackError) {
        console.error('Fallback chat error:', fallbackError);
        res.status(500).json({ message: "Failed to process chat message" });
      }
    }
  });

  // Get resources
  app.get("/api/resources", async (req, res) => {
    try {
      const resources = await storage.getResources();
      res.json(resources);
    } catch (error) {
      res.status(500).json({ message: "Failed to get resources" });
    }
  });

  // RAG Document Management Routes

  // Upload PDF document - Protected route
  app.post("/api/documents/upload", isAuthenticated, upload.single("pdf"), async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const file = req.file;

      if (!file) {
        return res.status(400).json({ message: "No PDF file provided" });
      }

      if (file.mimetype !== "application/pdf") {
        // Clean up uploaded file
        fs.unlinkSync(file.path);
        return res.status(400).json({ message: "Only PDF files are allowed" });
      }

      // Process the PDF document with RAG service
      const document = await ragService.processPDFDocument(
        file.path,
        file.filename,
        file.originalname,
        userId
      );

      res.json({
        message: "Document uploaded and processed successfully",
        document: {
          id: document.id,
          originalName: document.originalName,
          fileSize: document.fileSize,
          chunkCount: document.chunkCount,
          processed: document.processed,
          uploadedAt: document.uploadedAt
        }
      });
    } catch (error) {
      console.error("Document upload error:", error);
      // Clean up file if processing failed
      if (req.file) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (cleanupError) {
          console.error("Failed to cleanup uploaded file:", cleanupError);
        }
      }
      res.status(500).json({ message: "Failed to upload and process document" });
    }
  });

  // Get user's uploaded documents - Protected route
  app.get("/api/documents", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const documents = await ragService.getStoredDocuments(userId);
      
      // Return sanitized document info
      const documentList = documents.map(doc => ({
        id: doc.id,
        originalName: doc.originalName,
        fileSize: doc.fileSize,
        chunkCount: doc.chunkCount,
        processed: doc.processed,
        uploadedAt: doc.uploadedAt
      }));

      res.json(documentList);
    } catch (error) {
      console.error("Get documents error:", error);
      res.status(500).json({ message: "Failed to get documents" });
    }
  });

  // Delete document - Protected route
  app.delete("/api/documents/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const documentId = req.params.id;

      // Verify user owns the document
      const document = await storage.getDocument(documentId);
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }

      if (document.uploadedBy !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Delete document and its chunks
      const success = await ragService.deleteDocument(documentId);
      
      if (success) {
        // Clean up the physical file
        try {
          if (fs.existsSync(document.filePath)) {
            fs.unlinkSync(document.filePath);
          }
        } catch (fileError) {
          console.error("Failed to delete physical file:", fileError);
          // Don't fail the request if file cleanup fails
        }
        
        res.json({ message: "Document deleted successfully" });
      } else {
        res.status(500).json({ message: "Failed to delete document" });
      }
    } catch (error) {
      console.error("Delete document error:", error);
      res.status(500).json({ message: "Failed to delete document" });
    }
  });

  // Get document processing status - Protected route
  app.get("/api/documents/:id/status", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const documentId = req.params.id;

      const document = await storage.getDocument(documentId);
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }

      if (document.uploadedBy !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      res.json({
        id: document.id,
        originalName: document.originalName,
        processed: document.processed,
        chunkCount: document.chunkCount,
        uploadedAt: document.uploadedAt
      });
    } catch (error) {
      console.error("Get document status error:", error);
      res.status(500).json({ message: "Failed to get document status" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
