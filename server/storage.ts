import {
  users,
  courses,
  modules,
  moduleVideos,
  userProgress,
  videoProgress,
  chatMessages,
  resources,
  documents,
  documentChunks,
  type User,
  type Course,
  type Module,
  type ModuleVideo,
  type UserProgress,
  type VideoProgress,
  type ChatMessage,
  type Resource,
  type Document,
  type DocumentChunk,
  type InsertUser,
  type UpsertUser,
  type InsertCourse,
  type InsertModule,
  type InsertModuleVideo,
  type InsertUserProgress,
  type InsertVideoProgress,
  type InsertChatMessage,
  type InsertResource,
  type InsertDocument,
  type InsertDocumentChunk,
} from "@shared/schema";
import { db } from "./db";
import { eq, and } from "drizzle-orm";

// Interface for storage operations
export interface IStorage {
  // User operations (required for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Course operations
  getCourses(): Promise<Course[]>;
  getCourse(id: string): Promise<Course | undefined>;
  createCourse(course: InsertCourse): Promise<Course>;
  
  // Module operations
  getModulesByCourse(courseId: string): Promise<Module[]>;
  getModule(id: string): Promise<Module | undefined>;
  createModule(module: InsertModule): Promise<Module>;
  
  // Video operations
  getVideosByModule(moduleId: string): Promise<ModuleVideo[]>;
  createVideo(video: InsertModuleVideo): Promise<ModuleVideo>;
  deleteVideo(id: string): Promise<void>;
  
  // Progress operations
  getProgressByCourse(userId: string, courseId: string): Promise<UserProgress[]>;
  getUserProgress(userId: string, courseId: string): Promise<UserProgress[]>;
  updateProgress(progress: InsertUserProgress): Promise<UserProgress>;
  updateUserProgress(progress: InsertUserProgress): Promise<UserProgress>;
  
  // Video progress operations
  getVideoProgress(userId: string, videoId: string): Promise<VideoProgress | undefined>;
  updateVideoProgress(progress: InsertVideoProgress): Promise<VideoProgress>;
  
  // Chat operations
  getChatMessages(userId: string, courseId: string): Promise<ChatMessage[]>;
  createChatMessage(message: InsertChatMessage): Promise<ChatMessage>;
  
  // Resource operations
  getResources(): Promise<Resource[]>;
  
  // Document operations
  getDocuments(): Promise<Document[]>;
  createDocument(document: InsertDocument): Promise<Document>;
  getDocumentChunks(documentId: string): Promise<DocumentChunk[]>;
  createDocumentChunk(chunk: InsertDocumentChunk): Promise<DocumentChunk>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // Course operations
  async getCourses(): Promise<Course[]> {
    return await db.select().from(courses);
  }

  async getCourse(id: string): Promise<Course | undefined> {
    const [course] = await db.select().from(courses).where(eq(courses.id, id));
    return course;
  }

  async createCourse(course: InsertCourse): Promise<Course> {
    const [newCourse] = await db.insert(courses).values(course).returning();
    return newCourse;
  }

  // Module operations
  async getModulesByCourse(courseId: string): Promise<Module[]> {
    return await db.select().from(modules).where(eq(modules.courseId, courseId));
  }

  async getModule(id: string): Promise<Module | undefined> {
    const [module] = await db.select().from(modules).where(eq(modules.id, id));
    return module;
  }

  async createModule(module: InsertModule): Promise<Module> {
    const [newModule] = await db.insert(modules).values(module).returning();
    return newModule;
  }

  // Video operations
  async getVideosByModule(moduleId: string): Promise<ModuleVideo[]> {
    return await db.select().from(moduleVideos).where(eq(moduleVideos.moduleId, moduleId));
  }

  async createVideo(video: InsertModuleVideo): Promise<ModuleVideo> {
    const [newVideo] = await db.insert(moduleVideos).values(video).returning();
    return newVideo;
  }

  async deleteVideo(id: string): Promise<void> {
    await db.delete(moduleVideos).where(eq(moduleVideos.id, id));
  }

  // Progress operations
  async getProgressByCourse(userId: string, courseId: string): Promise<UserProgress[]> {
    return await db.select().from(userProgress).where(
      and(eq(userProgress.userId, userId), eq(userProgress.courseId, courseId))
    );
  }

  async getUserProgress(userId: string, courseId: string): Promise<UserProgress[]> {
    return await db.select().from(userProgress).where(
      and(eq(userProgress.userId, userId), eq(userProgress.courseId, courseId))
    );
  }

  async updateProgress(progress: InsertUserProgress): Promise<UserProgress> {
    const [updatedProgress] = await db
      .insert(userProgress)
      .values(progress)
      .onConflictDoUpdate({
        target: [userProgress.userId, userProgress.courseId, userProgress.moduleId],
        set: progress,
      })
      .returning();
    return updatedProgress;
  }

  async updateUserProgress(progress: InsertUserProgress): Promise<UserProgress> {
    return this.updateProgress(progress);
  }

  // Video progress operations
  async getVideoProgress(userId: string, videoId: string): Promise<VideoProgress | undefined> {
    const [progress] = await db
      .select()
      .from(videoProgress)
      .where(and(eq(videoProgress.userId, userId), eq(videoProgress.videoId, videoId)));
    return progress;
  }

  async updateVideoProgress(progress: InsertVideoProgress): Promise<VideoProgress> {
    const [updatedProgress] = await db
      .insert(videoProgress)
      .values(progress)
      .onConflictDoUpdate({
        target: [videoProgress.userId, videoProgress.videoId],
        set: progress,
      })
      .returning();
    return updatedProgress;
  }

  // Chat operations
  async getChatMessages(userId: string, courseId: string): Promise<ChatMessage[]> {
    return await db
      .select()
      .from(chatMessages)
      .where(and(eq(chatMessages.userId, userId), eq(chatMessages.courseId, courseId)));
  }

  async createChatMessage(message: InsertChatMessage): Promise<ChatMessage> {
    const [newMessage] = await db.insert(chatMessages).values(message).returning();
    return newMessage;
  }

  // Resource operations
  async getResources(): Promise<Resource[]> {
    return await db.select().from(resources);
  }

  // Document operations
  async getDocuments(): Promise<Document[]> {
    return await db.select().from(documents);
  }

  async createDocument(document: InsertDocument): Promise<Document> {
    const [newDocument] = await db.insert(documents).values(document).returning();
    return newDocument;
  }

  async getDocumentChunks(documentId: string): Promise<DocumentChunk[]> {
    return await db.select().from(documentChunks).where(eq(documentChunks.documentId, documentId));
  }

  async createDocumentChunk(chunk: InsertDocumentChunk): Promise<DocumentChunk> {
    const [newChunk] = await db.insert(documentChunks).values(chunk).returning();
    return newChunk;
  }
}

export const storage = new DatabaseStorage();