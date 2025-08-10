import { 
  type User, type Course, type Module, type UserProgress, type ChatMessage, type Resource,
  type Document, type DocumentChunk, type Entity, type EntityRelationship, type RagChatMessage, type ProcessingJob,
  type Notification, type ChatSummary, type QueryCache, type ResponseFeedback, type RagAnalytics, type IntentClassification,
  type InsertUser, type InsertCourse, type InsertModule, type InsertUserProgress, 
  type InsertChatMessage, type InsertResource, type UpsertUser,
  type InsertDocument, type InsertDocumentChunk, type InsertEntity, type InsertEntityRelationship, 
  type InsertRagChatMessage, type InsertProcessingJob, type InsertNotification,
  type InsertChatSummary, type InsertQueryCache, type InsertResponseFeedback, type InsertRagAnalytics, type InsertIntentClassification,
  users, courses, modules, userProgress, chatMessages, resources,
  documents, documentChunks, entities, entityRelationships, ragChatMessages, processingJobs, notifications,
  chatSummaries, queryCache, responseFeedback, ragAnalytics, intentClassification
} from "@shared/schema";
import { randomUUID } from "crypto";
import { db } from "./db";
import { eq, and, sql, ilike, inArray, desc, isNull } from "drizzle-orm";

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
  updateModule(id: string, updates: Partial<InsertModule>): Promise<Module | undefined>;
  deleteModule(id: string): Promise<boolean>;

  // User Progress
  getUserProgress(userId: string, courseId: string): Promise<UserProgress[]>;
  updateUserProgress(progress: InsertUserProgress): Promise<UserProgress>;

  // Chat Messages
  getChatMessages(userId: string, courseId: string): Promise<ChatMessage[]>;
  createChatMessage(message: InsertChatMessage): Promise<ChatMessage>;

  // Resources
  getResources(): Promise<Resource[]>;
  createResource(resource: InsertResource): Promise<Resource>;

  // Documents
  getDocuments(): Promise<Document[]>;
  getDocument(id: string): Promise<Document | undefined>;
  createDocument(document: InsertDocument): Promise<Document>;
  updateDocument(id: string, updates: Partial<InsertDocument>): Promise<Document | undefined>;
  deleteDocument(id: string): Promise<boolean>;

  // Document Chunks
  getDocumentChunks(documentId: string): Promise<DocumentChunk[]>;
  getDocumentChunk(id: string): Promise<DocumentChunk | undefined>;
  createDocumentChunk(chunk: InsertDocumentChunk): Promise<DocumentChunk>;
  updateDocumentChunk(id: string, updates: Partial<InsertDocumentChunk>): Promise<DocumentChunk | undefined>;
  deleteDocumentChunk(id: string): Promise<boolean>;

  // Entities
  getEntities(): Promise<Entity[]>;
  getEntity(id: string): Promise<Entity | undefined>;
  createEntity(entity: InsertEntity): Promise<Entity>;
  updateEntity(id: string, updates: Partial<InsertEntity>): Promise<Entity | undefined>;
  deleteEntity(id: string): Promise<boolean>;

  // Entity Relationships
  getEntityRelationships(entityId?: string): Promise<EntityRelationship[]>;
  createEntityRelationship(relationship: InsertEntityRelationship): Promise<EntityRelationship>;

  // RAG Chat Messages
  getRagChatMessages(userId: string, courseId?: string): Promise<RagChatMessage[]>;
  createRagChatMessage(message: InsertRagChatMessage): Promise<RagChatMessage>;

  // Processing Jobs
  getProcessingJobs(): Promise<ProcessingJob[]>;
  getProcessingJob(id: string): Promise<ProcessingJob | undefined>;
  createProcessingJob(job: InsertProcessingJob): Promise<ProcessingJob>;
  updateProcessingJob(id: string, updates: Partial<InsertProcessingJob>): Promise<ProcessingJob | undefined>;

  // Notifications
  getNotifications(userId: string): Promise<Notification[]>;
  getUnreadNotifications(userId: string): Promise<Notification[]>;
  createNotification(notification: InsertNotification): Promise<Notification>;
  markNotificationAsRead(id: string): Promise<boolean>;
  markAllNotificationsAsRead(userId: string): Promise<boolean>;

  // Chat Summaries
  getChatSummaries(userId: string, courseId?: string): Promise<ChatSummary[]>;
  getChatSummary(userId: string, courseId?: string, agentType?: string | null): Promise<ChatSummary | undefined>;
  createChatSummary(summary: InsertChatSummary): Promise<ChatSummary>;
  updateChatSummary(id: string, updates: Partial<InsertChatSummary>): Promise<ChatSummary | undefined>;

  // Query Cache
  getQueryCache(queryHash: string): Promise<QueryCache | undefined>;
  createQueryCache(cache: InsertQueryCache): Promise<QueryCache>;
  updateQueryCacheHit(id: string): Promise<void>;

  // Response Feedback
  createResponseFeedback(feedback: InsertResponseFeedback): Promise<ResponseFeedback>;
  getResponseFeedback(messageId: string): Promise<ResponseFeedback[]>;

  // RAG Analytics
  createRagAnalytics(analytics: InsertRagAnalytics): Promise<RagAnalytics>;
  getRagAnalytics(filters?: Partial<RagAnalytics>): Promise<RagAnalytics[]>;

  // Intent Classification
  createIntentClassification(classification: InsertIntentClassification): Promise<IntentClassification>;
  getIntentClassifications(query?: string): Promise<IntentClassification[]>;
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
    const user = { 
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

  async updateModule(id: string, updates: Partial<InsertModule>): Promise<Module | undefined> {
    const [module] = await db
      .update(modules)
      .set(updates)
      .where(eq(modules.id, id))
      .returning();
    return module || undefined;
  }

  async deleteModule(id: string): Promise<boolean> {
    const result = await db.delete(modules).where(eq(modules.id, id));
    return (result.rowCount ?? 0) > 0;
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

  // Documents
  async getDocuments(): Promise<Document[]> {
    return await db.select().from(documents);
  }

  async getDocument(id: string): Promise<Document | undefined> {
    const [document] = await db.select().from(documents).where(eq(documents.id, id));
    return document || undefined;
  }

  async createDocument(insertDocument: InsertDocument): Promise<Document> {
    const [document] = await db.insert(documents).values(insertDocument).returning();
    return document;
  }

  async updateDocument(id: string, updates: Partial<InsertDocument>): Promise<Document | undefined> {
    const [document] = await db
      .update(documents)
      .set(updates)
      .where(eq(documents.id, id))
      .returning();
    return document || undefined;
  }

  async deleteDocument(id: string): Promise<boolean> {
    const result = await db.delete(documents).where(eq(documents.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Document Chunks
  async getDocumentChunks(documentId: string): Promise<DocumentChunk[]> {
    return await db.select().from(documentChunks)
      .where(eq(documentChunks.documentId, documentId));
  }

  async getDocumentChunk(id: string): Promise<DocumentChunk | undefined> {
    const [chunk] = await db.select().from(documentChunks).where(eq(documentChunks.id, id));
    return chunk || undefined;
  }

  async createDocumentChunk(insertChunk: InsertDocumentChunk): Promise<DocumentChunk> {
    const [chunk] = await db.insert(documentChunks).values(insertChunk).returning();
    return chunk;
  }

  async updateDocumentChunk(id: string, updates: Partial<InsertDocumentChunk>): Promise<DocumentChunk | undefined> {
    const [chunk] = await db
      .update(documentChunks)
      .set(updates)
      .where(eq(documentChunks.id, id))
      .returning();
    return chunk || undefined;
  }

  async deleteDocumentChunk(id: string): Promise<boolean> {
    const result = await db.delete(documentChunks).where(eq(documentChunks.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Entities
  async getEntities(): Promise<Entity[]> {
    return await db.select().from(entities);
  }

  async getEntity(id: string): Promise<Entity | undefined> {
    const [entity] = await db.select().from(entities).where(eq(entities.id, id));
    return entity || undefined;
  }

  async createEntity(insertEntity: InsertEntity): Promise<Entity> {
    const [entity] = await db.insert(entities).values(insertEntity).returning();
    return entity;
  }

  async updateEntity(id: string, updates: Partial<InsertEntity>): Promise<Entity | undefined> {
    const [entity] = await db
      .update(entities)
      .set(updates)
      .where(eq(entities.id, id))
      .returning();
    return entity || undefined;
  }

  async deleteEntity(id: string): Promise<boolean> {
    const result = await db.delete(entities).where(eq(entities.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Entity Relationships
  async getEntityRelationships(entityId?: string): Promise<EntityRelationship[]> {
    if (entityId) {
      return await db.select().from(entityRelationships)
        .where(eq(entityRelationships.fromEntityId, entityId));
    }
    return await db.select().from(entityRelationships);
  }

  async createEntityRelationship(insertRelationship: InsertEntityRelationship): Promise<EntityRelationship> {
    const [relationship] = await db.insert(entityRelationships).values(insertRelationship).returning();
    return relationship;
  }

  // RAG Chat Messages
  async getRagChatMessages(userId: string, courseId?: string): Promise<RagChatMessage[]> {
    if (courseId) {
      return await db.select().from(ragChatMessages)
        .where(and(eq(ragChatMessages.userId, userId), eq(ragChatMessages.courseId, courseId)))
        .orderBy(ragChatMessages.timestamp);
    }
    
    return await db.select().from(ragChatMessages)
      .where(eq(ragChatMessages.userId, userId))
      .orderBy(ragChatMessages.timestamp);
  }

  async createRagChatMessage(insertMessage: InsertRagChatMessage): Promise<RagChatMessage> {
    const [message] = await db.insert(ragChatMessages).values(insertMessage).returning();
    return message;
  }

  // Processing Jobs
  async getProcessingJobs(): Promise<ProcessingJob[]> {
    return await db.select().from(processingJobs);
  }

  async getProcessingJob(id: string): Promise<ProcessingJob | undefined> {
    const [job] = await db.select().from(processingJobs).where(eq(processingJobs.id, id));
    return job || undefined;
  }

  async createProcessingJob(insertJob: InsertProcessingJob): Promise<ProcessingJob> {
    const [job] = await db.insert(processingJobs).values(insertJob).returning();
    return job;
  }

  async updateProcessingJob(id: string, updates: Partial<InsertProcessingJob>): Promise<ProcessingJob | undefined> {
    const [job] = await db
      .update(processingJobs)
      .set(updates)
      .where(eq(processingJobs.id, id))
      .returning();
    return job || undefined;
  }

  // Notifications
  async getNotifications(userId: string): Promise<Notification[]> {
    return await db.select().from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(notifications.createdAt);
  }

  async getUnreadNotifications(userId: string): Promise<Notification[]> {
    return await db.select().from(notifications)
      .where(and(eq(notifications.userId, userId), eq(notifications.read, false)))
      .orderBy(notifications.createdAt);
  }

  async createNotification(insertNotification: InsertNotification): Promise<Notification> {
    const [notification] = await db.insert(notifications).values(insertNotification).returning();
    return notification;
  }

  async markNotificationAsRead(id: string): Promise<boolean> {
    const result = await db
      .update(notifications)
      .set({ read: true })
      .where(eq(notifications.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async markAllNotificationsAsRead(userId: string): Promise<boolean> {
    const result = await db
      .update(notifications)
      .set({ read: true })
      .where(eq(notifications.userId, userId));
    return (result.rowCount ?? 0) > 0;
  }

  // Chat Summaries
  async getChatSummaries(userId: string, courseId?: string): Promise<ChatSummary[]> {
    if (courseId) {
      return await db.select().from(chatSummaries)
        .where(and(eq(chatSummaries.userId, userId), eq(chatSummaries.courseId, courseId)));
    }
    
    return await db.select().from(chatSummaries).where(eq(chatSummaries.userId, userId));
  }

  async getChatSummary(userId: string, courseId?: string, agentType?: string | null): Promise<ChatSummary | undefined> {
    let conditions = [eq(chatSummaries.userId, userId)];
    
    if (courseId) {
      conditions.push(eq(chatSummaries.courseId, courseId));
    }
    
    if (agentType !== undefined) {
      if (agentType === null) {
        conditions.push(isNull(chatSummaries.agentType));
      } else {
        conditions.push(eq(chatSummaries.agentType, agentType));
      }
    }
    
    const [summary] = await db.select().from(chatSummaries).where(and(...conditions));
    return summary || undefined;
  }

  async createChatSummary(summary: InsertChatSummary): Promise<ChatSummary> {
    const [created] = await db.insert(chatSummaries).values(summary).returning();
    return created;
  }

  async updateChatSummary(id: string, updates: Partial<InsertChatSummary>): Promise<ChatSummary | undefined> {
    const [updated] = await db.update(chatSummaries)
      .set({ ...updates, lastUpdated: new Date() })
      .where(eq(chatSummaries.id, id))
      .returning();
    return updated || undefined;
  }

  // Query Cache
  async getQueryCache(queryHash: string): Promise<QueryCache | undefined> {
    const [cached] = await db.select().from(queryCache).where(eq(queryCache.queryHash, queryHash));
    return cached || undefined;
  }

  async createQueryCache(cache: InsertQueryCache): Promise<QueryCache> {
    const [created] = await db.insert(queryCache).values(cache).returning();
    return created;
  }

  async updateQueryCacheHit(id: string): Promise<void> {
    await db.update(queryCache)
      .set({ 
        hitCount: sql`${queryCache.hitCount} + 1`,
        lastAccessed: new Date()
      })
      .where(eq(queryCache.id, id));
  }

  // Response Feedback
  async createResponseFeedback(feedback: InsertResponseFeedback): Promise<ResponseFeedback> {
    const [created] = await db.insert(responseFeedback).values(feedback).returning();
    return created;
  }

  async getResponseFeedback(messageId: string): Promise<ResponseFeedback[]> {
    return await db.select().from(responseFeedback).where(eq(responseFeedback.messageId, messageId));
  }

  // RAG Analytics
  async createRagAnalytics(analytics: InsertRagAnalytics): Promise<RagAnalytics> {
    const [created] = await db.insert(ragAnalytics).values(analytics).returning();
    return created;
  }

  async getRagAnalytics(filters?: Partial<RagAnalytics>): Promise<RagAnalytics[]> {
    // Basic implementation - could be enhanced with proper filtering
    return await db.select().from(ragAnalytics);
  }

  // Intent Classification
  async createIntentClassification(classification: InsertIntentClassification): Promise<IntentClassification> {
    const [created] = await db.insert(intentClassification).values(classification).returning();
    return created;
  }

  async getIntentClassifications(query?: string): Promise<IntentClassification[]> {
    if (query) {
      return await db.select().from(intentClassification).where(eq(intentClassification.query, query));
    }
    return await db.select().from(intentClassification);
  }
}

export class MemStorage implements IStorage {
  private users: Map<string, User> = new Map();
  private courses: Map<string, Course> = new Map();
  private modules: Map<string, Module> = new Map();
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
        videoUrl: "https://example.com/video1",
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
        videoUrl: "https://example.com/video2",
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
        videoUrl: "https://example.com/video3",
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
        videoUrl: "https://example.com/video4",
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
        videoUrl: "https://example.com/video5",
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

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.email === email);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { 
      ...insertUser, 
      id,
      email: insertUser.email ?? null,
      firstName: insertUser.firstName ?? null,
      lastName: insertUser.lastName ?? null,
      profileImageUrl: insertUser.profileImageUrl ?? null,
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
      videoUrl: insertModule.videoUrl || null
    };
    this.modules.set(id, module);
    return module;
  }

  async updateModule(id: string, updates: Partial<InsertModule>): Promise<Module | undefined> {
    const existing = this.modules.get(id);
    if (!existing) {
      return undefined;
    }
    const updated = { ...existing, ...updates };
    this.modules.set(id, updated);
    return updated;
  }

  async deleteModule(id: string): Promise<boolean> {
    return this.modules.delete(id);
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

  // Add upsertUser method
  async upsertUser(user: UpsertUser): Promise<User> {
    const existingUser = this.users.get(user.id!);
    if (existingUser) {
      const updated = { ...existingUser, ...user, updatedAt: new Date() };
      this.users.set(user.id!, updated);
      return updated;
    } else {
      const newUser: User = {
        id: user.id!,
        email: user.email ?? null,
        firstName: user.firstName ?? null,
        lastName: user.lastName ?? null,
        profileImageUrl: user.profileImageUrl ?? null,
        role: user.role ?? "care_worker",
        createdAt: new Date(),
        updatedAt: new Date()
      };
      this.users.set(user.id!, newUser);
      return newUser;
    }
  }

  // RAG-related methods (stub implementations for MemStorage)
  async getDocuments(): Promise<Document[]> {
    return [];
  }

  async getDocument(id: string): Promise<Document | undefined> {
    return undefined;
  }

  async createDocument(document: InsertDocument): Promise<Document> {
    const id = randomUUID();
    const newDoc: Document = {
      ...document,
      id,
      metadata: document.metadata ?? null,
      vectorId: document.vectorId ?? null,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    return newDoc;
  }

  async updateDocument(id: string, updates: Partial<InsertDocument>): Promise<Document | undefined> {
    return undefined;
  }

  async deleteDocument(id: string): Promise<boolean> {
    return false;
  }

  async getDocumentChunks(documentId: string): Promise<DocumentChunk[]> {
    return [];
  }

  async getDocumentChunk(id: string): Promise<DocumentChunk | undefined> {
    return undefined;
  }

  async createDocumentChunk(chunk: InsertDocumentChunk): Promise<DocumentChunk> {
    const id = randomUUID();
    const newChunk: DocumentChunk = {
      ...chunk,
      id,
      metadata: chunk.metadata ?? null,
      vectorId: chunk.vectorId ?? null,
      createdAt: new Date()
    };
    return newChunk;
  }

  async updateDocumentChunk(id: string, updates: Partial<InsertDocumentChunk>): Promise<DocumentChunk | undefined> {
    return undefined;
  }

  async deleteDocumentChunk(id: string): Promise<boolean> {
    return false;
  }

  async getEntities(): Promise<Entity[]> {
    return [];
  }

  async getEntity(id: string): Promise<Entity | undefined> {
    return undefined;
  }

  async createEntity(entity: InsertEntity): Promise<Entity> {
    const id = randomUUID();
    const newEntity: Entity = {
      ...entity,
      id,
      description: entity.description ?? null,
      metadata: entity.metadata ?? null,
      createdAt: new Date()
    };
    return newEntity;
  }

  async updateEntity(id: string, updates: Partial<InsertEntity>): Promise<Entity | undefined> {
    return undefined;
  }

  async deleteEntity(id: string): Promise<boolean> {
    return false;
  }

  async getEntityRelationships(entityId?: string): Promise<EntityRelationship[]> {
    return [];
  }

  async createEntityRelationship(relationship: InsertEntityRelationship): Promise<EntityRelationship> {
    const id = randomUUID();
    const newRelationship: EntityRelationship = {
      ...relationship,
      id,
      confidence: relationship.confidence ?? 100,
      source: relationship.source ?? null,
      createdAt: new Date()
    };
    return newRelationship;
  }

  async getRagChatMessages(userId: string, courseId?: string): Promise<RagChatMessage[]> {
    return [];
  }

  async createRagChatMessage(message: InsertRagChatMessage): Promise<RagChatMessage> {
    const id = randomUUID();
    const newMessage: RagChatMessage = {
      ...message,
      id,
      courseId: message.courseId ?? null,
      confidence: message.confidence ?? 0,
      sources: message.sources ?? null,
      agentTrace: message.agentTrace ?? null,
      timestamp: new Date()
    };
    return newMessage;
  }

  async getProcessingJobs(): Promise<ProcessingJob[]> {
    return [];
  }

  async getProcessingJob(id: string): Promise<ProcessingJob | undefined> {
    return undefined;
  }

  async createProcessingJob(job: InsertProcessingJob): Promise<ProcessingJob> {
    const id = randomUUID();
    const newJob: ProcessingJob = {
      ...job,
      id,
      status: job.status ?? "pending",
      progress: job.progress ?? 0,
      errorMessage: job.errorMessage ?? null,
      metadata: job.metadata ?? null,
      documentId: job.documentId ?? null,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    return newJob;
  }

  async updateProcessingJob(id: string, updates: Partial<InsertProcessingJob>): Promise<ProcessingJob | undefined> {
    return undefined;
  }

  // Notifications
  async getNotifications(userId: string): Promise<Notification[]> {
    // Return some sample notifications for demo
    const sampleNotifications: Notification[] = [
      {
        id: "notif-1",
        userId,
        title: "Course Progress Update",
        message: "You've completed 2 of 3 modules in Diabetes Management Training",
        type: "info",
        read: false,
        actionUrl: "/training",
        metadata: { courseId: "course-1", progress: 67 },
        createdAt: new Date(Date.now() - 1000 * 60 * 30) // 30 minutes ago
      },
      {
        id: "notif-2",
        userId,
        title: "New Document Available",
        message: "Updated NICE guidelines for diabetes care have been uploaded",
        type: "info",
        read: false,
        actionUrl: "/documents",
        metadata: { documentType: "NICE", category: "diabetes" },
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2) // 2 hours ago
      }
    ];
    return sampleNotifications;
  }

  async getUnreadNotifications(userId: string): Promise<Notification[]> {
    const all = await this.getNotifications(userId);
    return all.filter(n => !n.read);
  }

  async createNotification(notification: InsertNotification): Promise<Notification> {
    const id = randomUUID();
    const newNotification: Notification = {
      ...notification,
      id,
      type: notification.type ?? "info",
      read: notification.read ?? false,
      actionUrl: notification.actionUrl ?? null,
      metadata: notification.metadata ?? null,
      createdAt: new Date()
    };
    return newNotification;
  }

  async markNotificationAsRead(id: string): Promise<boolean> {
    return true; // Always succeed in memory storage
  }

  async markAllNotificationsAsRead(userId: string): Promise<boolean> {
    return true; // Always succeed in memory storage
  }

  // Stub implementations for new schema tables in MemStorage
  async getChatSummaries(userId: string, courseId?: string): Promise<ChatSummary[]> {
    return [];
  }

  async getChatSummary(userId: string, courseId?: string, agentType?: string | null): Promise<ChatSummary | undefined> {
    return undefined;
  }

  async createChatSummary(summary: InsertChatSummary): Promise<ChatSummary> {
    const id = randomUUID();
    const newSummary: ChatSummary = {
      ...summary,
      id,
      courseId: summary.courseId || null,
      agentType: summary.agentType || null,
      messageCount: summary.messageCount ?? 0,
      tokenCount: summary.tokenCount ?? 0,
      lastUpdated: new Date(),
      createdAt: new Date()
    };
    return newSummary;
  }

  async updateChatSummary(id: string, updates: Partial<InsertChatSummary>): Promise<ChatSummary | undefined> {
    return undefined;
  }

  async getQueryCache(queryHash: string): Promise<QueryCache | undefined> {
    return undefined;
  }

  async createQueryCache(cache: InsertQueryCache): Promise<QueryCache> {
    const id = randomUUID();
    const newCache: QueryCache = {
      ...cache,
      id,
      confidence: cache.confidence || null,
      sources: cache.sources || null,
      hitCount: cache.hitCount ?? 1,
      lastAccessed: new Date(),
      createdAt: new Date()
    };
    return newCache;
  }

  async updateQueryCacheHit(id: string): Promise<void> {
    // No-op in memory storage
  }

  async createResponseFeedback(feedback: InsertResponseFeedback): Promise<ResponseFeedback> {
    const id = randomUUID();
    const newFeedback: ResponseFeedback = {
      ...feedback,
      id,
      messageId: feedback.messageId || null,
      feedbackType: feedback.feedbackType || null,
      comments: feedback.comments || null,
      responseTime: feedback.responseTime ?? null,
      createdAt: new Date()
    };
    return newFeedback;
  }

  async getResponseFeedback(messageId: string): Promise<ResponseFeedback[]> {
    return [];
  }

  async createRagAnalytics(analytics: InsertRagAnalytics): Promise<RagAnalytics> {
    const id = randomUUID();
    const newAnalytics: RagAnalytics = {
      ...analytics,
      id,
      userId: analytics.userId ?? null,
      queryType: analytics.queryType ?? null,
      agentsUsed: analytics.agentsUsed ?? null,
      retrievalHits: analytics.retrievalHits ?? 0,
      confidence: analytics.confidence ?? 0,
      responseTime: analytics.responseTime ?? null,
      tokenUsage: analytics.tokenUsage ?? null,
      cacheHit: analytics.cacheHit ?? false,
      metadata: analytics.metadata ?? null,
      timestamp: new Date()
    };
    return newAnalytics;
  }

  async getRagAnalytics(filters?: Partial<RagAnalytics>): Promise<RagAnalytics[]> {
    return [];
  }

  async createIntentClassification(classification: InsertIntentClassification): Promise<IntentClassification> {
    const id = randomUUID();
    const newClassification: IntentClassification = {
      ...classification,
      id,
      confidence: classification.confidence || null,
      modelUsed: classification.modelUsed || null,
      processingTime: classification.processingTime ?? null,
      createdAt: new Date()
    };
    return newClassification;
  }

  async getIntentClassifications(query?: string): Promise<IntentClassification[]> {
    return [];
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
        videoUrl: "https://example.com/video1",
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
        videoUrl: "https://example.com/video2",
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
        videoUrl: "https://example.com/video3",
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
