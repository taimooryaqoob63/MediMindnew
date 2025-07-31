import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { getAITutorResponse } from "./services/openai";
import { insertChatMessageSchema } from "@shared/schema";
import { setupAuth, isAuthenticated } from "./replitAuth";

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

  // Upload video file - Protected route
  app.post("/api/videos/upload", isAuthenticated, async (req: any, res) => {
    try {
      const multer = require('multer');
      const { Client } = require('@replit/object-storage');
      
      const upload = multer({ storage: multer.memoryStorage() });
      
      upload.single('video')(req, res, async (err: any) => {
        if (err) {
          return res.status(400).json({ message: "Error uploading file" });
        }
        
        if (!req.file) {
          return res.status(400).json({ message: "No video file provided" });
        }
        
        const client = new Client();
        const fileName = `videos/${Date.now()}-${req.file.originalname}`;
        
        await client.uploadFromBytes(fileName, req.file.buffer, {
          contentType: req.file.mimetype
        });
        
        const videoUrl = `/api/videos/${fileName}`;
        res.json({ videoUrl, fileName });
      });
    } catch (error) {
      console.error('Video upload error:', error);
      res.status(500).json({ message: "Failed to upload video" });
    }
  });

  // Serve video files
  app.get("/api/videos/*", async (req, res) => {
    try {
      const { Client } = require('@replit/object-storage');
      const client = new Client();
      const fileName = req.params[0];
      
      const fileBuffer = await client.downloadAsBytes(fileName);
      
      res.setHeader('Content-Type', 'video/mp4');
      res.setHeader('Accept-Ranges', 'bytes');
      res.send(fileBuffer);
    } catch (error) {
      console.error('Video serve error:', error);
      res.status(404).json({ message: "Video not found" });
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
