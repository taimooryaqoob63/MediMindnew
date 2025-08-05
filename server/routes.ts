import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { getAITutorResponse } from "./services/openai";
import { insertChatMessageSchema, insertModuleSchema } from "@shared/schema";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { registerRAGRoutes } from "./routes/rag";
import multer from "multer";
import path from "path";
import fs from "fs/promises";
import express from "express";

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Register RAG routes
  registerRAGRoutes(app);

  // Configure multer for video uploads
  const storage_config = multer.diskStorage({
    destination: async (req, file, cb) => {
      const uploadDir = './uploads/videos';
      try {
        await fs.mkdir(uploadDir, { recursive: true });
        cb(null, uploadDir);
      } catch (error) {
        cb(error as Error, uploadDir);
      }
    },
    filename: (req, file, cb) => {
      // Create unique filename with timestamp
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
  });

  const upload = multer({
    storage: storage_config,
    limits: {
      fileSize: 500 * 1024 * 1024, // 500MB limit
    },
    fileFilter: (req, file, cb) => {
      // Allow only video files
      if (file.mimetype.startsWith('video/')) {
        cb(null, true);
      } else {
        cb(new Error('Only video files are allowed!'));
      }
    }
  });

  // Serve uploaded videos statically
  app.use('/uploads', async (req, res, next) => {
    // Add basic security check
    if (req.path.includes('..') || req.path.includes('~')) {
      return res.status(400).json({ message: 'Invalid path' });
    }
    next();
  });
  app.use('/uploads', express.static('./uploads'));

  // Video upload route - Protected
  app.post('/api/upload/video', isAuthenticated, upload.single('video'), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'No video file uploaded' });
      }

      const videoUrl = `/uploads/videos/${req.file.filename}`;
      
      res.json({
        message: 'Video uploaded successfully',
        videoUrl,
        originalName: req.file.originalname,
        filename: req.file.filename,
        size: req.file.size
      });
    } catch (error) {
      console.error('Video upload error:', error);
      res.status(500).json({ message: 'Failed to upload video' });
    }
  });

  // Create or update module with video - Protected
  app.post('/api/modules', isAuthenticated, async (req: any, res) => {
    try {
      const moduleData = insertModuleSchema.parse(req.body);
      const module = await storage.createModule(moduleData);
      res.json(module);
    } catch (error) {
      console.error('Module creation error:', error);
      res.status(500).json({ message: 'Failed to create module' });
    }
  });

  // Update module - Protected
  app.put('/api/modules/:id', isAuthenticated, async (req: any, res) => {
    try {
      const moduleData = req.body;
      const module = await storage.updateModule(req.params.id, moduleData);
      if (!module) {
        return res.status(404).json({ message: 'Module not found' });
      }
      res.json(module);
    } catch (error) {
      console.error('Module update error:', error);
      res.status(500).json({ message: 'Failed to update module' });
    }
  });

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

  // Create module - Protected route
  app.post("/api/modules", isAuthenticated, async (req, res) => {
    try {
      const validation = insertModuleSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          message: "Invalid module data", 
          errors: validation.error.issues 
        });
      }

      const module = await storage.createModule(validation.data);
      res.status(201).json(module);
    } catch (error) {
      console.error("Error creating module:", error);
      res.status(500).json({ message: "Failed to create module" });
    }
  });

  // Update module - Protected route
  app.patch("/api/modules/:id", isAuthenticated, async (req, res) => {
    try {
      const module = await storage.updateModule(req.params.id, req.body);
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
  app.delete("/api/modules/:id", isAuthenticated, async (req, res) => {
    try {
      const success = await storage.deleteModule(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Module not found" });
      }
      res.json({ message: "Module deleted successfully" });
    } catch (error) {
      console.error("Error deleting module:", error);
      res.status(500).json({ message: "Failed to delete module" });
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

  // Send chat message and get AI response - Protected route
  app.post("/api/chat", isAuthenticated, async (req: any, res) => {
    try {
      const { message, courseId, context } = req.body;
      const userId = req.user.claims.sub;
      
      if (!message || !courseId) {
        return res.status(400).json({ message: "Message and courseId are required" });
      }

      // Get AI response
      const aiResponse = await getAITutorResponse(message, context);
      
      // Save chat message
      const chatMessage = await storage.createChatMessage({
        userId,
        courseId,
        message,
        response: aiResponse.response,
        timestamp: new Date().toISOString()
      });

      res.json({ 
        message: chatMessage,
        suggestedQuestions: aiResponse.suggestedQuestions 
      });
    } catch (error) {
      console.error('Chat error:', error);
      res.status(500).json({ message: "Failed to process chat message" });
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

  const httpServer = createServer(app);
  return httpServer;
}
