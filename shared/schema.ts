import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, json, timestamp, index, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table for Replit Auth
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  role: text("role").notNull().default("care_worker"), // care_worker, nurse, manager
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const courses = pgTable("courses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull().default("diabetes"),
});

export const modules = pgTable("modules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  courseId: varchar("course_id").references(() => courses.id).notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  videoUrl: text("video_url"),
  duration: text("duration"),
  content: json("content"), // Learning objectives, key takeaways, etc.
  orderIndex: integer("order_index").notNull(),
});

export const userProgress = pgTable("user_progress", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  courseId: varchar("course_id").references(() => courses.id).notNull(),
  moduleId: varchar("module_id").references(() => modules.id),
  completed: boolean("completed").default(false),
  progress: integer("progress").default(0), // 0-100
  lastAccessed: text("last_accessed"),
});

export const chatMessages = pgTable("chat_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  courseId: varchar("course_id").references(() => courses.id).notNull(),
  message: text("message").notNull(),
  response: text("response").notNull(),
  timestamp: text("timestamp").notNull(),
  confidence: integer("confidence"),
  sources: json("sources"),
  usedRAG: boolean("used_rag").default(false),
});

export const resources = pgTable("resources", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  type: text("type").notNull(), // pdf, guideline, policy
  url: text("url").notNull(),
  category: text("category").notNull(), // NICE, NHS, CQC
});

// Document storage for RAG system
export const documents = pgTable("documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  content: text("content").notNull(),
  source: text("source").notNull(), // filename or URL
  documentType: text("document_type").notNull(), // NICE, NHS, CQC, Oxford_Handbook
  category: text("category").notNull(), // diabetes, guidelines, procedures
  metadata: json("metadata"), // page numbers, sections, etc.
  vectorId: text("vector_id"), // Pinecone vector ID
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Document chunks for granular retrieval
export const documentChunks = pgTable("document_chunks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  documentId: varchar("document_id").references(() => documents.id).notNull(),
  content: text("content").notNull(),
  chunkIndex: integer("chunk_index").notNull(),
  vectorId: text("vector_id").unique(), // Pinecone vector ID
  metadata: json("metadata"), // page, section, context
  createdAt: timestamp("created_at").defaultNow(),
});

// Knowledge graph entities
export const entities = pgTable("entities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  type: text("type").notNull(), // medication, procedure, condition, guideline
  description: text("description"),
  metadata: json("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Knowledge graph relationships
export const entityRelationships = pgTable("entity_relationships", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fromEntityId: varchar("from_entity_id").references(() => entities.id).notNull(),
  toEntityId: varchar("to_entity_id").references(() => entities.id).notNull(),
  relationshipType: text("relationship_type").notNull(), // treats, causes, related_to, procedure_for
  confidence: integer("confidence").default(100), // 0-100 confidence score
  source: text("source"), // document or manual
  createdAt: timestamp("created_at").defaultNow(),
});

// Enhanced chat messages with RAG context
export const ragChatMessages = pgTable("rag_chat_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  courseId: varchar("course_id").references(() => courses.id),
  message: text("message").notNull(),
  response: text("response").notNull(),
  sources: json("sources"), // Array of source documents and chunks
  confidence: integer("confidence").default(0), // Response confidence 0-100
  agentTrace: json("agent_trace"), // Which agents were involved
  timestamp: timestamp("timestamp").defaultNow(),
});

// Document processing jobs
export const processingJobs = pgTable("processing_jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  documentId: varchar("document_id").references(() => documents.id),
  status: text("status").notNull().default("pending"), // pending, processing, completed, failed
  jobType: text("job_type").notNull(), // vectorization, entity_extraction, graph_building
  progress: integer("progress").default(0), // 0-100
  errorMessage: text("error_message"),
  metadata: json("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true, updatedAt: true });
export const insertCourseSchema = createInsertSchema(courses).omit({ id: true });
export const insertModuleSchema = createInsertSchema(modules).omit({ id: true });
export const insertUserProgressSchema = createInsertSchema(userProgress).omit({ id: true });
export const insertChatMessageSchema = createInsertSchema(chatMessages).omit({ id: true });
export const insertResourceSchema = createInsertSchema(resources).omit({ id: true });
export const insertDocumentSchema = createInsertSchema(documents).omit({ id: true, createdAt: true, updatedAt: true });
export const insertDocumentChunkSchema = createInsertSchema(documentChunks).omit({ id: true, createdAt: true });
export const insertEntitySchema = createInsertSchema(entities).omit({ id: true, createdAt: true });
export const insertEntityRelationshipSchema = createInsertSchema(entityRelationships).omit({ id: true, createdAt: true });
export const insertRagChatMessageSchema = createInsertSchema(ragChatMessages).omit({ id: true, timestamp: true });
export const insertProcessingJobSchema = createInsertSchema(processingJobs).omit({ id: true, createdAt: true, updatedAt: true });

// Types
export type User = typeof users.$inferSelect;
export type Course = typeof courses.$inferSelect;
export type Module = typeof modules.$inferSelect;
export type UserProgress = typeof userProgress.$inferSelect;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type Resource = typeof resources.$inferSelect;
export type Document = typeof documents.$inferSelect;
export type DocumentChunk = typeof documentChunks.$inferSelect;
export type Entity = typeof entities.$inferSelect;
export type EntityRelationship = typeof entityRelationships.$inferSelect;
export type RagChatMessage = typeof ragChatMessages.$inferSelect;
export type ProcessingJob = typeof processingJobs.$inferSelect;

// Chat message types
export interface ChatResponse {
  message?: ChatMessage;
  id?: string;
  response?: string;
  content?: string;
  sources?: Array<{
    id: string;
    title: string;
    excerpt: string;
    score: number;
    type: string;
  }>;
  confidence?: number;
  followUpQuestions?: string[];
  usedRAG?: boolean;
  timestamp?: Date;
}

export type InsertUser = z.infer<typeof insertUserSchema>;
export type UpsertUser = typeof users.$inferInsert;
export type InsertCourse = z.infer<typeof insertCourseSchema>;
export type InsertModule = z.infer<typeof insertModuleSchema>;
export type InsertUserProgress = z.infer<typeof insertUserProgressSchema>;
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
export type InsertResource = z.infer<typeof insertResourceSchema>;
export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type InsertDocumentChunk = z.infer<typeof insertDocumentChunkSchema>;
export type InsertEntity = z.infer<typeof insertEntitySchema>;
export type InsertEntityRelationship = z.infer<typeof insertEntityRelationshipSchema>;
export type InsertRagChatMessage = z.infer<typeof insertRagChatMessageSchema>;
export type InsertProcessingJob = z.infer<typeof insertProcessingJobSchema>;
