import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { getAITutorResponse } from "./services/openai";
import { insertChatMessageSchema, insertModuleVideoSchema, insertCourseSchema, insertModuleSchema } from "@shared/schema";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { ragService } from "./ragService";
import {
  ObjectStorageService,
  ObjectNotFoundError,
} from "./objectStorage";
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

  // Create course - Protected route
  app.post("/api/courses", isAuthenticated, async (req: any, res) => {
    try {
      const courseData = insertCourseSchema.parse(req.body);
      const course = await storage.createCourse(courseData);
      res.json(course);
    } catch (error) {
      res.status(500).json({ message: "Failed to create course" });
    }
  });

  // Update course - Protected route
  app.patch("/api/courses/:id", isAuthenticated, async (req: any, res) => {
    try {
      const courseData = insertCourseSchema.partial().parse(req.body);
      const course = await storage.updateCourse(req.params.id, courseData);
      if (!course) {
        return res.status(404).json({ message: "Course not found" });
      }
      res.json(course);
    } catch (error) {
      res.status(500).json({ message: "Failed to update course" });
    }
  });

  // Delete course - Protected route
  app.delete("/api/courses/:id", isAuthenticated, async (req: any, res) => {
    try {
      await storage.deleteCourse(req.params.id);
      res.json({ message: "Course deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete course" });
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

  // Create module - Protected route
  app.post("/api/modules", isAuthenticated, async (req: any, res) => {
    try {
      const moduleData = insertModuleSchema.parse(req.body);
      const module = await storage.createModule(moduleData);
      res.json(module);
    } catch (error) {
      console.error("Error creating module:", error);
      res.status(500).json({ message: "Failed to create module" });
    }
  });

  // Update module - Protected route
  app.patch("/api/modules/:id", isAuthenticated, async (req: any, res) => {
    try {
      const moduleData = insertModuleSchema.partial().parse(req.body);
      const module = await storage.updateModule(req.params.id, moduleData);
      if (!module) {
        return res.status(404).json({ message: "Module not found" });
      }
      res.json(module);
    } catch (error) {
      console.error("Error updating module:", error);
      res.status(500).json({ message: "Failed to update module" });
    }
  });

  // Delete module - Protected route
  app.delete("/api/modules/:id", isAuthenticated, async (req: any, res) => {
    try {
      await storage.deleteModule(req.params.id);
      res.json({ message: "Module deleted successfully" });
    } catch (error) {
      console.error("Error deleting module:", error);
      res.status(500).json({ message: "Failed to delete module" });
    }
  });

  // Get videos for a module
  app.get("/api/modules/:moduleId/videos", async (req, res) => {
    try {
      const videos = await storage.getVideosByModule(req.params.moduleId);
      res.json(videos);
    } catch (error) {
      res.status(500).json({ message: "Failed to get videos" });
    }
  });

  // Add video to module - Protected route
  app.post("/api/modules/:moduleId/videos", isAuthenticated, async (req: any, res) => {
    try {
      const videoData = insertModuleVideoSchema.parse({
        ...req.body,
        moduleId: req.params.moduleId,
      });
      const video = await storage.createVideo(videoData);
      res.json(video);
    } catch (error) {
      res.status(500).json({ message: "Failed to add video" });
    }
  });

  // Delete video - Protected route
  app.delete("/api/videos/:id", isAuthenticated, async (req: any, res) => {
    try {
      await storage.deleteVideo(req.params.id);
      res.json({ message: "Video deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete video" });
    }
  });

  // Object storage routes for video uploads
  app.post("/api/objects/upload", isAuthenticated, async (req, res) => {
    const objectStorageService = new ObjectStorageService();
    try {
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      res.json({ uploadURL });
    } catch (error) {
      console.error("Error getting upload URL:", error);
      res.status(500).json({ error: "Failed to get upload URL" });
    }
  });

  // Update video ACL policy after upload - Protected route
  app.put("/api/videos/:videoId/url", isAuthenticated, async (req: any, res) => {
    if (!req.body.videoUrl) {
      return res.status(400).json({ error: "videoUrl is required" });
    }

    const userId = req.user.claims.sub;

    try {
      const objectStorageService = new ObjectStorageService();
      const objectPath = await objectStorageService.trySetObjectEntityAclPolicy(
        req.body.videoUrl,
        {
          owner: userId,
          visibility: "public", // Videos should be accessible to all authenticated users
        },
      );

      // Update the video record with the normalized object path
      await storage.updateVideo(req.params.videoId, { videoUrl: objectPath });

      res.status(200).json({
        objectPath: objectPath,
      });
    } catch (error) {
      console.error("Error setting video URL:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Serve uploaded objects - Protected route
  app.get("/objects/:objectPath(*)", isAuthenticated, async (req: any, res) => {
    const userId = req.user?.claims?.sub;
    const objectStorageService = new ObjectStorageService();
    try {
      const objectFile = await objectStorageService.getObjectEntityFile(
        req.path,
      );
      objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      console.error("Error accessing object:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.sendStatus(404);
      }
      return res.sendStatus(500);
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
        sources: ragResponse.sources,
        timestamp: new Date().toISOString()
      });

      // Return response with sources information
      res.json({ 
        message: {
          ...chatMessage,
          sources: ragResponse.sources || []
        }
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

  // Clear all chat messages for a course
  app.delete("/api/chat/:courseId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      console.log(`Deleting chat messages for user ${userId} and course ${req.params.courseId}`);
      await storage.deleteChatMessages(userId, req.params.courseId);
      console.log(`Successfully deleted chat messages for user ${userId} and course ${req.params.courseId}`);
      res.json({ message: "Chat messages cleared successfully" });
    } catch (error) {
      console.error("Error clearing chat messages:", error);
      res.status(500).json({ message: "Failed to clear chat messages" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}