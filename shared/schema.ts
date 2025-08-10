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

// Notifications
export const notifications = pgTable("notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  type: text("type").notNull().default("info"), // info, success, warning, error
  read: boolean("read").default(false),
  actionUrl: text("action_url"), // Optional URL to navigate to when clicked
  metadata: json("metadata"), // Additional data like course completion, new document, etc.
  createdAt: timestamp("created_at").defaultNow(),
});

// Enhanced chat summaries for efficient history management
export const chatSummaries = pgTable("chat_summaries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  courseId: varchar("course_id").references(() => courses.id),
  summary: text("summary").notNull(),
  agentType: text("agent_type"), // medical_specialist, compliance_officer, learning_facilitator
  messageCount: integer("message_count").default(0),
  tokenCount: integer("token_count").default(0),
  lastUpdated: timestamp("last_updated").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Query cache for performance optimization
export const queryCache = pgTable("query_cache", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  queryHash: text("query_hash").unique().notNull(),
  query: text("query").notNull(),
  response: text("response").notNull(),
  sources: json("sources"),
  confidence: integer("confidence").default(0),
  hitCount: integer("hit_count").default(1),
  lastAccessed: timestamp("last_accessed").defaultNow(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// User feedback for response quality
export const responseFeedback = pgTable("response_feedback", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  messageId: varchar("message_id").references(() => ragChatMessages.id),
  rating: integer("rating").notNull(), // 1 (thumbs down) to 5 (thumbs up)
  feedbackType: text("feedback_type"), // helpful, incorrect, unclear, off_topic
  comments: text("comments"),
  responseTime: integer("response_time"), // milliseconds
  createdAt: timestamp("created_at").defaultNow(),
});

// Analytics for monitoring and optimization
export const ragAnalytics = pgTable("rag_analytics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  eventType: text("event_type").notNull(), // query, response, cache_hit, agent_pruning
  userId: varchar("user_id").references(() => users.id),
  queryType: text("query_type"), // educational, clinical, emergency
  agentsUsed: json("agents_used"), // Array of agent names
  retrievalHits: integer("retrieval_hits").default(0),
  confidence: integer("confidence").default(0),
  responseTime: integer("response_time"), // milliseconds
  tokenUsage: json("token_usage"), // {prompt: number, completion: number}
  cacheHit: boolean("cache_hit").default(false),
  metadata: json("metadata"),
  timestamp: timestamp("timestamp").defaultNow(),
});

// Intent classification for routing optimization
export const intentClassification = pgTable("intent_classification", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  query: text("query").notNull(),
  intent: text("intent").notNull(), // faq, educational, clinical, emergency
  confidence: integer("confidence").default(0),
  modelUsed: text("model_used"), // gpt-4o, gpt-4o-mini
  processingTime: integer("processing_time"), // milliseconds
  createdAt: timestamp("created_at").defaultNow(),
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
export const insertNotificationSchema = createInsertSchema(notifications).omit({ id: true, createdAt: true });
export const insertChatSummarySchema = createInsertSchema(chatSummaries).omit({ id: true, createdAt: true, lastUpdated: true });
export const insertQueryCacheSchema = createInsertSchema(queryCache).omit({ id: true, createdAt: true, lastAccessed: true });
export const insertResponseFeedbackSchema = createInsertSchema(responseFeedback).omit({ id: true, createdAt: true });
export const insertRagAnalyticsSchema = createInsertSchema(ragAnalytics).omit({ id: true, timestamp: true });
export const insertIntentClassificationSchema = createInsertSchema(intentClassification).omit({ id: true, createdAt: true });

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
export type Notification = typeof notifications.$inferSelect;
export type ChatSummary = typeof chatSummaries.$inferSelect;
export type QueryCache = typeof queryCache.$inferSelect;
export type ResponseFeedback = typeof responseFeedback.$inferSelect;
export type RagAnalytics = typeof ragAnalytics.$inferSelect;
export type IntentClassification = typeof intentClassification.$inferSelect;

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
    pageNumber?: number;
    section?: string;
    clickable?: boolean;
  }>;
  confidence?: number;
  followUpQuestions?: string[];
  suggestedActions?: Array<{
    label: string;
    action: string;
    url?: string;
  }>;
  usedRAG?: boolean;
  cacheHit?: boolean;
  agentsUsed?: string[];
  responseTime?: number;
  streamable?: boolean;
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
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type InsertChatSummary = z.infer<typeof insertChatSummarySchema>;
export type InsertQueryCache = z.infer<typeof insertQueryCacheSchema>;
export type InsertResponseFeedback = z.infer<typeof insertResponseFeedbackSchema>;
export type InsertRagAnalytics = z.infer<typeof insertRagAnalyticsSchema>;
export type InsertIntentClassification = z.infer<typeof insertIntentClassificationSchema>;
