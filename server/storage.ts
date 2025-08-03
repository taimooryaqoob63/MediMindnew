import { 
  type User, type Course, type Module, type Video, type UserProgress, type ChatMessage, type Resource,
  type Document, type DocumentChunk,
  type InsertUser, type InsertCourse, type InsertModule, type InsertVideo, type InsertUserProgress, 
  type InsertChatMessage, type InsertResource, type InsertDocument, type InsertDocumentChunk,
  type UpsertUser,
  users, courses, modules, videos, userProgress, chatMessages, resources, documents, documentChunks
} from "@shared/schema";
import { randomUUID } from "crypto";
import { db } from "./db";
import { eq, and } from "drizzle-orm";

export interface IStorage {
  // Users - Replit Auth compatible
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  createUser(user: InsertUser): Promise<User>;

  // Courses
  getCourses(): Promise<Course[]>;
  getCourse(id: string): Promise<Course | undefined>;
  createCourse(course: InsertCourse): Promise<Course>;

  // Modules
  getModulesByCourse(courseId: string): Promise<Module[]>;
  getModule(id: string): Promise<Module | undefined>;
  createModule(module: InsertModule): Promise<Module>;
  updateModule(id: string, updates: Partial<InsertModule>): Promise<Module>;
  deleteModule(id: string): Promise<boolean>;

  // Videos
  getVideosByModule(moduleId: string): Promise<Video[]>;
  getVideo(id: string): Promise<Video | undefined>;
  createVideo(video: InsertVideo): Promise<Video>;
  updateVideo(id: string, updates: Partial<InsertVideo>): Promise<Video>;
  deleteVideo(id: string): Promise<boolean>;

  // User Progress
  getUserProgress(userId: string, courseId: string): Promise<UserProgress[]>;
  updateUserProgress(progress: InsertUserProgress): Promise<UserProgress>;

  // Chat Messages
  getChatMessages(userId: string, courseId: string): Promise<ChatMessage[]>;
  createChatMessage(message: InsertChatMessage): Promise<ChatMessage>;

  // Resources
  getResources(): Promise<Resource[]>;
  createResource(resource: InsertResource): Promise<Resource>;

  // Documents - RAG functionality
  getDocuments(userId?: string): Promise<Document[]>;
  getDocument(id: string): Promise<Document | undefined>;
  createDocument(document: InsertDocument): Promise<Document>;
  updateDocument(id: string, updates: Partial<InsertDocument>): Promise<Document>;
  deleteDocument(id: string): Promise<boolean>;

  // Document Chunks - RAG functionality
  getDocumentChunks(documentId: string): Promise<DocumentChunk[]>;
  createDocumentChunk(chunk: InsertDocumentChunk): Promise<DocumentChunk>;
  searchDocumentChunks(embedding: number[], limit?: number): Promise<DocumentChunk[]>;
  deleteDocumentChunks(documentId: string): Promise<boolean>;

  // Video management
  getVideosByModule(moduleId: string): Promise<Video[]>;
  createVideo(video: InsertVideo): Promise<Video>;
  updateVideo(id: string, updates: Partial<InsertVideo>): Promise<Video>;
  deleteVideo(id: string): Promise<boolean>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    try {
      const [user] = await db
        .insert(users)
        .values({
          ...userData,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: users.id,
          set: {
            ...userData,
            updatedAt: new Date(),
          },
        })
        .returning();
      return user;
    } catch (error) {
      console.error("Error upserting user:", error);
      throw new Error("Failed to upsert user");
    }
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { 
      ...insertUser, 
      id,
      role: insertUser.role || "care_worker",
      createdAt: new Date(),
      updatedAt: new Date()
    };
    const [createdUser] = await db.insert(users).values(user).returning();
    return createdUser;
  }

  async getCourses(): Promise<Course[]> {
    return await db.select().from(courses);
  }

  async getCourse(id: string): Promise<Course | undefined> {
    const [course] = await db.select().from(courses).where(eq(courses.id, id));
    return course || undefined;
  }

  async createCourse(insertCourse: InsertCourse): Promise<Course> {
    const [course] = await db.insert(courses).values(insertCourse).returning();
    return course;
  }

  async getModulesByCourse(courseId: string): Promise<Module[]> {
    return await db.select().from(modules)
      .where(eq(modules.courseId, courseId))
      .orderBy(modules.orderIndex);
  }

  async getModule(id: string): Promise<Module | undefined> {
    const [module] = await db.select().from(modules).where(eq(modules.id, id));
    return module || undefined;
  }

  async createModule(insertModule: InsertModule): Promise<Module> {
    const [module] = await db.insert(modules).values(insertModule).returning();
    return module;
  }

  async updateModule(id: string, updates: Partial<InsertModule>): Promise<Module> {
    const [module] = await db
      .update(modules)
      .set(updates)
      .where(eq(modules.id, id))
      .returning();
    return module;
  }

  async deleteModule(id: string): Promise<boolean> {
    try {
      // First delete all videos for this module
      await db.delete(videos).where(eq(videos.moduleId, id));
      // Then delete the module
      await db.delete(modules).where(eq(modules.id, id));
      return true;
    } catch (error) {
      console.error("Error deleting module:", error);
      return false;
    }
  }

  // Video methods
  async getVideosByModule(moduleId: string): Promise<Video[]> {
    return await db.select().from(videos)
      .where(eq(videos.moduleId, moduleId))
      .orderBy(videos.orderIndex);
  }

  async getVideo(id: string): Promise<Video | undefined> {
    const [video] = await db.select().from(videos).where(eq(videos.id, id));
    return video || undefined;
  }

  async createVideo(insertVideo: InsertVideo): Promise<Video> {
    const [video] = await db.insert(videos).values(insertVideo).returning();
    return video;
  }

  async updateVideo(id: string, updates: Partial<InsertVideo>): Promise<Video> {
    const [video] = await db
      .update(videos)
      .set(updates)
      .where(eq(videos.id, id))
      .returning();
    return video;
  }

  async deleteVideo(id: string): Promise<boolean> {
    try {
      await db.delete(videos).where(eq(videos.id, id));
      return true;
    } catch (error) {
      console.error("Error deleting video:", error);
      return false;
    }
  }

  async getUserProgress(userId: string, courseId: string): Promise<UserProgress[]> {
    return await db.select().from(userProgress)
      .where(and(eq(userProgress.userId, userId), eq(userProgress.courseId, courseId)));
  }

  async updateUserProgress(insertProgress: InsertUserProgress): Promise<UserProgress> {
    const existing = await db.select().from(userProgress)
      .where(and(
        eq(userProgress.userId, insertProgress.userId),
        eq(userProgress.courseId, insertProgress.courseId),
        eq(userProgress.moduleId, insertProgress.moduleId || "")
      ));
    
    if (existing.length > 0) {
      const [updated] = await db
        .update(userProgress)
        .set(insertProgress)
        .where(eq(userProgress.id, existing[0].id))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(userProgress).values(insertProgress).returning();
      return created;
    }
  }

  async getChatMessages(userId: string, courseId: string): Promise<ChatMessage[]> {
    return await db.select().from(chatMessages)
      .where(and(eq(chatMessages.userId, userId), eq(chatMessages.courseId, courseId)))
      .orderBy(chatMessages.timestamp);
  }

  async createChatMessage(insertMessage: InsertChatMessage): Promise<ChatMessage> {
    const [message] = await db.insert(chatMessages).values(insertMessage).returning();
    return message;
  }

  async getResources(): Promise<Resource[]> {
    return await db.select().from(resources);
  }

  async createResource(insertResource: InsertResource): Promise<Resource> {
    const [resource] = await db.insert(resources).values(insertResource).returning();
    return resource;
  }

  // Documents - RAG functionality
  async getDocuments(userId?: string): Promise<Document[]> {
    if (userId) {
      return await db.select().from(documents)
        .where(eq(documents.uploadedBy, userId))
        .orderBy(documents.uploadedAt);
    }
    return await db.select().from(documents).orderBy(documents.uploadedAt);
  }

  async getDocument(id: string): Promise<Document | undefined> {
    const [document] = await db.select().from(documents).where(eq(documents.id, id));
    return document || undefined;
  }

  async createDocument(insertDocument: InsertDocument): Promise<Document> {
    const [document] = await db.insert(documents).values(insertDocument).returning();
    return document;
  }

  async updateDocument(id: string, updates: Partial<InsertDocument>): Promise<Document> {
    const [document] = await db
      .update(documents)
      .set(updates)
      .where(eq(documents.id, id))
      .returning();
    return document;
  }

  async deleteDocument(id: string): Promise<boolean> {
    try {
      // First delete all chunks for this document
      await db.delete(documentChunks).where(eq(documentChunks.documentId, id));
      // Then delete the document
      await db.delete(documents).where(eq(documents.id, id));
      return true;
    } catch (error) {
      console.error("Error deleting document:", error);
      return false;
    }
  }

  // Document Chunks - RAG functionality
  async getDocumentChunks(documentId: string): Promise<DocumentChunk[]> {
    return await db.select().from(documentChunks)
      .where(eq(documentChunks.documentId, documentId))
      .orderBy(documentChunks.chunkIndex);
  }

  async createDocumentChunk(insertChunk: InsertDocumentChunk): Promise<DocumentChunk> {
    const [chunk] = await db.insert(documentChunks).values(insertChunk).returning();
    return chunk;
  }

  async searchDocumentChunks(embedding: number[], limit: number = 5): Promise<DocumentChunk[]> {
    // This is a simplified implementation - in practice you'd use vector similarity search
    // For now, we'll return all chunks and let the RAG service handle similarity matching
    const chunks = await db.select().from(documentChunks).limit(limit * 3);
    return chunks.slice(0, limit);
  }

  async deleteDocumentChunks(documentId: string): Promise<boolean> {
    try {
      await db.delete(documentChunks).where(eq(documentChunks.documentId, documentId));
      return true;
    } catch (error) {
      console.error("Error deleting document chunks:", error);
      return false;
    }
  }

  // Video management methods
  async getVideosByModule(moduleId: string): Promise<Video[]> {
    return await db.select().from(videos)
      .where(eq(videos.moduleId, moduleId))
      .orderBy(videos.orderIndex);
  }

  async createVideo(insertVideo: InsertVideo): Promise<Video> {
    const [video] = await db.insert(videos).values(insertVideo).returning();
    return video;
  }

  async getVideo(id: string): Promise<Video | undefined> {
    const [video] = await db.select().from(videos).where(eq(videos.id, id));
    return video || undefined;
  }

  async updateVideo(id: string, updates: Partial<InsertVideo>): Promise<Video> {
    const [video] = await db
      .update(videos)
      .set(updates)
      .where(eq(videos.id, id))
      .returning();
    return video;
  }

  async deleteVideo(id: string): Promise<boolean> {
    try {
      await db.delete(videos).where(eq(videos.id, id));
      return true;
    } catch (error) {
      console.error("Error deleting video:", error);
      return false;
    }
  }
}

export class MemStorage implements IStorage {
  private users: Map<string, User> = new Map();
  private courses: Map<string, Course> = new Map();
  private modules: Map<string, Module> = new Map();
  private videos: Map<string, Video> = new Map();
  private userProgress: Map<string, UserProgress> = new Map();
  private chatMessages: Map<string, ChatMessage> = new Map();
  private resources: Map<string, Resource> = new Map();

  constructor() {
    this.initializeData();
  }

  private initializeData() {
    // Create sample user
    const sampleUser: User = {
      id: "user-1",
      email: "jane.doe@example.com",
      firstName: "Jane",
      lastName: "Doe",
      profileImageUrl: null,
      role: "care_worker",
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.users.set(sampleUser.id, sampleUser);

    // Create diabetes course
    const diabetesCourse: Course = {
      id: "course-1",
      title: "Diabetes Management Training",
      description: "Comprehensive training on diabetes care for healthcare workers",
      category: "diabetes"
    };
    this.courses.set(diabetesCourse.id, diabetesCourse);

    // Create modules
    const modules: Module[] = [
      {
        id: "module-1",
        courseId: "course-1",
        title: "Understanding Diabetes",
        description: "Learn about Type 1 and Type 2 diabetes, their causes, and key symptoms to watch for in care home residents.",
        videoUrl: "https://www.youtube.com/embed/qgtd5pW3Q0A", // NHS Diabetes Types Education
        duration: "12:45",
        content: {
          learningObjectives: [
            "Identify the key differences between Type 1 and Type 2 diabetes",
            "Recognize early warning signs and symptoms in residents",
            "Understand risk factors and prevention strategies",
            "Apply NICE guidelines in daily care practices"
          ],
          keyTakeaways: [
            {
              title: "Type 1 vs Type 2 Diabetes",
              description: "Type 1 is an autoimmune condition typically diagnosed in childhood, while Type 2 develops gradually and is often linked to lifestyle factors."
            },
            {
              title: "Warning Signs to Monitor",
              description: "Watch for increased thirst, frequent urination, unexplained weight loss, fatigue, and slow-healing wounds."
            }
          ]
        },
        orderIndex: 1
      },
      {
        id: "module-2",
        courseId: "course-1",
        title: "Blood Glucose Monitoring",
        description: "Master the techniques and best practices for accurate blood glucose testing.",
        videoUrl: "https://www.youtube.com/embed/2uDhZkk2ZHE", // Blood Sugar Testing Technique
        duration: "15:30",
        content: {
          learningObjectives: [
            "Demonstrate proper blood glucose testing technique",
            "Interpret blood glucose readings accurately",
            "Maintain testing equipment properly",
            "Document results according to care plans"
          ]
        },
        orderIndex: 2
      },
      {
        id: "module-3",
        courseId: "course-1",
        title: "Insulin Administration",
        description: "Safe and effective insulin administration techniques and protocols.",
        videoUrl: "https://www.youtube.com/embed/YiI9a7cpMyk", // Insulin Injection Technique
        duration: "18:20",
        content: {
          learningObjectives: [
            "Prepare insulin injections safely",
            "Demonstrate proper injection techniques",
            "Understand different insulin types and timing",
            "Manage insulin storage requirements"
          ]
        },
        orderIndex: 3
      },
      {
        id: "module-4",
        courseId: "course-1",
        title: "Emergency Procedures",
        description: "Recognize and respond to diabetes-related emergencies.",
        videoUrl: "https://www.youtube.com/embed/bmXJV13zOH4", // Diabetes Emergency Response
        duration: "14:15",
        content: {
          learningObjectives: [
            "Identify signs of hypoglycemia and hyperglycemia",
            "Implement emergency response protocols",
            "Administer emergency treatments safely",
            "Communicate effectively with medical professionals"
          ]
        },
        orderIndex: 4
      },
      {
        id: "module-5",
        courseId: "course-1",
        title: "Documentation & Compliance",
        description: "Proper documentation and regulatory compliance for diabetes care.",
        videoUrl: "https://www.youtube.com/embed/WZaWbPpXMp8", // Healthcare Documentation Best Practices
        duration: "10:45",
        content: {
          learningObjectives: [
            "Complete accurate care documentation",
            "Understand CQC requirements",
            "Maintain proper records",
            "Ensure compliance with local policies"
          ]
        },
        orderIndex: 5
      }
    ];

    modules.forEach(module => this.modules.set(module.id, module));

    // Create sample progress
    const progress: UserProgress = {
      id: "progress-1",
      userId: "user-1",
      courseId: "course-1",
      moduleId: "module-1",
      completed: true,
      progress: 100,
      lastAccessed: new Date().toISOString()
    };
    this.userProgress.set(progress.id, progress);

    // Create resources
    const resources: Resource[] = [
      {
        id: "resource-1",
        title: "NICE Guidelines",
        type: "pdf",
        url: "https://example.com/nice-guidelines.pdf",
        category: "NICE"
      },
      {
        id: "resource-2",
        title: "NHS Best Practices",
        type: "pdf",
        url: "https://example.com/nhs-practices.pdf",
        category: "NHS"
      },
      {
        id: "resource-3",
        title: "CQC Requirements",
        type: "pdf",
        url: "https://example.com/cqc-requirements.pdf",
        category: "CQC"
      }
    ];

    resources.forEach(resource => this.resources.set(resource.id, resource));
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async upsertUser(user: UpsertUser): Promise<User> {
    const existingUser = this.users.get(user.id);
    if (existingUser) {
      const updatedUser: User = {
        ...existingUser,
        ...user,
        updatedAt: new Date()
      };
      this.users.set(user.id, updatedUser);
      return updatedUser;
    } else {
      const newUser: User = {
        ...user,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      this.users.set(user.id, newUser);
      return newUser;
    }
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { 
      ...insertUser, 
      id,
      role: insertUser.role || "care_worker",
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.users.set(id, user);
    return user;
  }

  async getCourses(): Promise<Course[]> {
    return Array.from(this.courses.values());
  }

  async getCourse(id: string): Promise<Course | undefined> {
    return this.courses.get(id);
  }

  async createCourse(insertCourse: InsertCourse): Promise<Course> {
    const id = randomUUID();
    const course: Course = { 
      ...insertCourse, 
      id,
      category: insertCourse.category || "diabetes"
    };
    this.courses.set(id, course);
    return course;
  }

  async getModulesByCourse(courseId: string): Promise<Module[]> {
    return Array.from(this.modules.values())
      .filter(module => module.courseId === courseId)
      .sort((a, b) => a.orderIndex - b.orderIndex);
  }

  async getModule(id: string): Promise<Module | undefined> {
    return this.modules.get(id);
  }

  async createModule(insertModule: InsertModule): Promise<Module> {
    const id = randomUUID();
    const module: Module = { 
      ...insertModule, 
      id,
      content: insertModule.content || null,
      duration: insertModule.duration || null,
      videoUrl: insertModule.videoUrl || null,
      createdAt: new Date()
    };
    this.modules.set(id, module);
    return module;
  }

  async updateModule(id: string, updates: Partial<InsertModule>): Promise<Module> {
    const existing = this.modules.get(id);
    if (!existing) {
      throw new Error("Module not found");
    }
    const updated = { ...existing, ...updates };
    this.modules.set(id, updated);
    return updated;
  }

  async deleteModule(id: string): Promise<boolean> {
    this.modules.delete(id);
    return true;
  }

  // Video methods for MemStorage
  async getVideosByModule(moduleId: string): Promise<Video[]> {
    return Array.from(this.videos.values())
      .filter(video => video.moduleId === moduleId)
      .sort((a, b) => a.orderIndex - b.orderIndex);
  }

  async getVideo(id: string): Promise<Video | undefined> {
    return this.videos.get(id);
  }

  async createVideo(insertVideo: InsertVideo): Promise<Video> {
    const id = randomUUID();
    const video: Video = { 
      ...insertVideo, 
      id,
      description: insertVideo.description || null,
      duration: insertVideo.duration || null,
      fileSize: insertVideo.fileSize || null,
      createdAt: new Date()
    };
    this.videos.set(id, video);
    return video;
  }

  async updateVideo(id: string, updates: Partial<InsertVideo>): Promise<Video> {
    const existing = this.videos.get(id);
    if (!existing) {
      throw new Error("Video not found");
    }
    const updated = { ...existing, ...updates };
    this.videos.set(id, updated);
    return updated;
  }

  async deleteVideo(id: string): Promise<boolean> {
    this.videos.delete(id);
    return true;
  }

  async getUserProgress(userId: string, courseId: string): Promise<UserProgress[]> {
    return Array.from(this.userProgress.values())
      .filter(progress => progress.userId === userId && progress.courseId === courseId);
  }

  async updateUserProgress(insertProgress: InsertUserProgress): Promise<UserProgress> {
    const existing = Array.from(this.userProgress.values())
      .find(p => p.userId === insertProgress.userId && 
                 p.courseId === insertProgress.courseId && 
                 p.moduleId === insertProgress.moduleId);
    
    if (existing) {
      const updated = { ...existing, ...insertProgress };
      this.userProgress.set(existing.id, updated);
      return updated;
    } else {
      const id = randomUUID();
      const progress: UserProgress = { 
        ...insertProgress, 
        id,
        progress: insertProgress.progress ?? 0,
        completed: insertProgress.completed ?? false,
        lastAccessed: insertProgress.lastAccessed ?? new Date().toISOString(),
        moduleId: insertProgress.moduleId ?? null
      };
      this.userProgress.set(id, progress);
      return progress;
    }
  }

  async getChatMessages(userId: string, courseId: string): Promise<ChatMessage[]> {
    return Array.from(this.chatMessages.values())
      .filter(msg => msg.userId === userId && msg.courseId === courseId)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }

  async createChatMessage(insertMessage: InsertChatMessage): Promise<ChatMessage> {
    const id = randomUUID();
    const message: ChatMessage = { ...insertMessage, id };
    this.chatMessages.set(id, message);
    return message;
  }

  async getResources(): Promise<Resource[]> {
    return Array.from(this.resources.values());
  }

  async createResource(insertResource: InsertResource): Promise<Resource> {
    const id = randomUUID();
    const resource: Resource = { ...insertResource, id };
    this.resources.set(id, resource);
    return resource;
  }

  // Add missing methods for full IStorage implementation
  async getDocuments(userId?: string): Promise<Document[]> {
    return []; // MemStorage doesn't store documents
  }

  async getDocument(id: string): Promise<Document | undefined> {
    return undefined; // MemStorage doesn't store documents
  }

  async createDocument(insertDocument: InsertDocument): Promise<Document> {
    throw new Error("MemStorage doesn't support document storage");
  }

  async updateDocument(id: string, updates: Partial<InsertDocument>): Promise<Document> {
    throw new Error("MemStorage doesn't support document storage");
  }

  async deleteDocument(id: string): Promise<boolean> {
    return false; // MemStorage doesn't store documents
  }

  async getDocumentChunks(documentId: string): Promise<DocumentChunk[]> {
    return []; // MemStorage doesn't store document chunks
  }

  async createDocumentChunk(insertChunk: InsertDocumentChunk): Promise<DocumentChunk> {
    throw new Error("MemStorage doesn't support document chunk storage");
  }

  async searchDocumentChunks(embedding: number[], limit: number = 5): Promise<DocumentChunk[]> {
    return []; // MemStorage doesn't support vector search
  }

  async deleteDocumentChunks(documentId: string): Promise<boolean> {
    return false; // MemStorage doesn't store document chunks
  }

  // Video management methods
  async getVideosByModule(moduleId: string): Promise<Video[]> {
    return Array.from(this.videos.values())
      .filter(video => video.moduleId === moduleId)
      .sort((a, b) => a.orderIndex - b.orderIndex);
  }

  async createVideo(insertVideo: InsertVideo): Promise<Video> {
    const id = randomUUID();
    const video: Video = { 
      ...insertVideo, 
      id,
      createdAt: new Date()
    };
    this.videos.set(id, video);
    return video;
  }

  async getVideo(id: string): Promise<Video | undefined> {
    return this.videos.get(id);
  }

  async updateVideo(id: string, updates: Partial<InsertVideo>): Promise<Video> {
    const video = this.videos.get(id);
    if (!video) {
      throw new Error("Video not found");
    }
    const updated = { ...video, ...updates };
    this.videos.set(id, updated);
    return updated;
  }

  async deleteVideo(id: string): Promise<boolean> {
    return this.videos.delete(id);
  }
}

// Use DatabaseStorage for production with Replit Auth
export const storage = new DatabaseStorage();

// Initialize sample data in database
async function initializeSampleData() {
  try {
    // Check if data already exists
    const existingCourses = await storage.getCourses();
    if (existingCourses.length > 0) {
      return; // Data already initialized
    }

    // Create diabetes course
    const course = await storage.createCourse({
      title: "Diabetes Management Training",
      description: "Comprehensive training on diabetes care for healthcare workers",
      category: "diabetes"
    });

    // Create modules
    const moduleData = [
      {
        courseId: course.id,
        title: "Understanding Diabetes",
        description: "Learn about Type 1 and Type 2 diabetes, their causes, and key symptoms to watch for in care home residents.",
        videoUrl: "https://www.youtube.com/embed/qgtd5pW3Q0A", // NHS Diabetes Types Education
        duration: "12:45",
        content: {
          learningObjectives: [
            "Identify the key differences between Type 1 and Type 2 diabetes",
            "Recognize early warning signs and symptoms in residents",
            "Understand risk factors and prevention strategies",
            "Apply NICE guidelines in daily care practices"
          ],
          keyTakeaways: [
            {
              title: "Type 1 vs Type 2 Diabetes",
              description: "Type 1 is an autoimmune condition typically diagnosed in childhood, while Type 2 develops gradually and is often linked to lifestyle factors."
            },
            {
              title: "Warning Signs to Monitor",
              description: "Watch for increased thirst, frequent urination, unexplained weight loss, fatigue, and slow-healing wounds."
            }
          ]
        },
        orderIndex: 1
      },
      {
        courseId: course.id,
        title: "Blood Glucose Monitoring",
        description: "Master the techniques and best practices for accurate blood glucose testing.",
        videoUrl: "https://www.youtube.com/embed/2uDhZkk2ZHE", // Blood Sugar Testing Technique
        duration: "15:30",
        content: {
          learningObjectives: [
            "Demonstrate proper blood glucose testing technique",
            "Interpret blood glucose readings accurately",
            "Maintain testing equipment properly",
            "Document results according to care plans"
          ]
        },
        orderIndex: 2
      },
      {
        courseId: course.id,
        title: "Insulin Administration",
        description: "Safe and effective insulin administration techniques and protocols.",
        videoUrl: "https://www.youtube.com/embed/YiI9a7cpMyk", // Insulin Injection Technique
        duration: "18:20",
        content: {
          learningObjectives: [
            "Prepare insulin injections safely",
            "Demonstrate proper injection techniques",
            "Understand different insulin types and timing",
            "Manage insulin storage requirements"
          ]
        },
        orderIndex: 3
      }
    ];

    for (const moduleInfo of moduleData) {
      await storage.createModule(moduleInfo);
    }

    // Create resources
    const resourceData = [
      {
        title: "NICE Guidelines",
        type: "pdf",
        url: "https://example.com/nice-guidelines.pdf",
        category: "NICE"
      },
      {
        title: "NHS Best Practices",
        type: "pdf",
        url: "https://example.com/nhs-practices.pdf",
        category: "NHS"
      }
    ];

    for (const resourceInfo of resourceData) {
      await storage.createResource(resourceInfo);
    }

    console.log("Sample data initialized successfully");
  } catch (error) {
    console.log("Sample data may already exist or database not ready:", error);
  }
}

// Initialize data when module loads
initializeSampleData();
