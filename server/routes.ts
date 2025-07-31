import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { getAITutorResponse } from "./services/openai";
import { insertChatMessageSchema, insertModuleSchema } from "@shared/schema";
import { setupAuth, isAuthenticated } from "./replitAuth";
import multer from "multer";
import path from "path";
import fs from "fs";
import express from "express";

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup multer for video uploads
  const storage_multer = multer.diskStorage({
    destination: function (req, file, cb) {
      const uploadPath = 'uploads/videos';
      if (!fs.existsSync(uploadPath)) {
        fs.mkdirSync(uploadPath, { recursive: true });
      }
      cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
  });

  const upload = multer({ 
    storage: storage_multer,
    fileFilter: (req, file, cb) => {
      const allowedTypes = /mp4|avi|mov|wmv|flv|webm|mkv/;
      const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
      const mimetype = allowedTypes.test(file.mimetype);
      
      if (mimetype && extname) {
        return cb(null, true);
      } else {
        cb(new Error('Only video files are allowed'));
      }
    },
    limits: {
      fileSize: 500 * 1024 * 1024 // 500MB limit
    }
  });

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

  // Video upload and module management routes (Protected)
  
  // Upload video and create/update module
  app.post("/api/modules/upload", isAuthenticated, upload.single('video'), async (req: any, res) => {
    try {
      const { courseId, title, description, duration, orderIndex, moduleId } = req.body;
      
      if (!req.file) {
        return res.status(400).json({ message: "No video file uploaded" });
      }

      const videoUrl = `/uploads/videos/${req.file.filename}`;
      
      const moduleData = {
        courseId,
        title,
        description,
        videoUrl,
        duration,
        orderIndex: parseInt(orderIndex),
        content: null
      };

      let module;
      if (moduleId) {
        // Update existing module
        module = await storage.updateModule(moduleId, moduleData);
      } else {
        // Create new module
        module = await storage.createModule(moduleData);
      }

      res.json(module);
    } catch (error) {
      console.error('Video upload error:', error);
      res.status(500).json({ message: "Failed to upload video and create module" });
    }
  });

  // Update module without video
  app.put("/api/modules/:id", isAuthenticated, async (req, res) => {
    try {
      const { title, description, duration, orderIndex, content } = req.body;
      const moduleData = {
        title,
        description,
        duration,
        orderIndex: parseInt(orderIndex),
        content
      };

      const module = await storage.updateModule(req.params.id, moduleData);
      res.json(module);
    } catch (error) {
      console.error('Module update error:', error);
      res.status(500).json({ message: "Failed to update module" });
    }
  });

  // Delete module
  app.delete("/api/modules/:id", isAuthenticated, async (req, res) => {
    try {
      await storage.deleteModule(req.params.id);
      res.json({ message: "Module deleted successfully" });
    } catch (error) {
      console.error('Module delete error:', error);
      res.status(500).json({ message: "Failed to delete module" });
    }
  });

  // Create new course
  app.post("/api/courses", isAuthenticated, async (req, res) => {
    try {
      const { title, description, category } = req.body;
      const course = await storage.createCourse({ title, description, category });
      res.json(course);
    } catch (error) {
      console.error('Course creation error:', error);
      res.status(500).json({ message: "Failed to create course" });
    }
  });

  // Serve uploaded videos
  app.use('/uploads', (req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
  });
  
  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

  const httpServer = createServer(app);
  return httpServer;
}
