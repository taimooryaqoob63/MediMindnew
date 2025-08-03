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
  transcript: json("transcript").$type<Array<{
    start: number;
    end: number;
    text: string;
  }>>(), // Word-level transcript with timestamps
  transcriptText: text("transcript_text"), // Full transcript text for search
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
  sources: json("sources").$type<Array<{
    fileName: string;
    pageNumber?: number;
    content: string;
    relevanceScore: number;
  }>>(),
  timestamp: text("timestamp").notNull(),
});

// New table for uploaded videos
export const uploadedVideos = pgTable("uploaded_videos", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  title: text("title").notNull(),
  description: text("description"),
  objectPath: text("object_path").notNull(), // Path in object storage
  duration: text("duration"),
  transcript: json("transcript").$type<Array<{
    start: number;
    end: number;
    text: string;
  }>>(), // Word-level transcript with timestamps
  transcriptText: text("transcript_text"), // Full transcript text for search
  transcriptionStatus: text("transcription_status").notNull().default("pending"), // pending, processing, completed, failed
  uploadedAt: timestamp("uploaded_at").defaultNow(),
});

export const resources = pgTable("resources", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  type: text("type").notNull(), // pdf, guideline, policy
  url: text("url").notNull(),
  category: text("category").notNull(), // NICE, NHS, CQC
});

// RAG Document storage
export const documents = pgTable("documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fileName: text("file_name").notNull(),
  originalName: text("original_name").notNull(),
  filePath: text("file_path").notNull(),
  fileSize: integer("file_size"),
  mimeType: text("mime_type"),
  uploadedBy: varchar("uploaded_by").references(() => users.id).notNull(),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
  processed: boolean("processed").default(false),
  chunkCount: integer("chunk_count").default(0),
});

// RAG Document chunks with embeddings
export const documentChunks = pgTable("document_chunks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  documentId: varchar("document_id").references(() => documents.id).notNull(),
  content: text("content").notNull(),
  chunkIndex: integer("chunk_index").notNull(),
  embedding: text("embedding"), // Stored as JSON string of number array
  metadata: json("metadata"), // Additional metadata like page numbers, etc.
  createdAt: timestamp("created_at").defaultNow(),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true, updatedAt: true });
export const insertCourseSchema = createInsertSchema(courses).omit({ id: true });
export const insertModuleSchema = createInsertSchema(modules).omit({ id: true });
export const insertUserProgressSchema = createInsertSchema(userProgress).omit({ id: true });
export const insertChatMessageSchema = createInsertSchema(chatMessages).omit({ id: true });
export const insertResourceSchema = createInsertSchema(resources).omit({ id: true });
export const insertDocumentSchema = createInsertSchema(documents).omit({ id: true, uploadedAt: true });
export const insertDocumentChunkSchema = createInsertSchema(documentChunks).omit({ id: true, createdAt: true });
export const insertUploadedVideoSchema = createInsertSchema(uploadedVideos).omit({ id: true, uploadedAt: true });

// Types
export type User = typeof users.$inferSelect;
export type Course = typeof courses.$inferSelect;
export type Module = typeof modules.$inferSelect;
export type UserProgress = typeof userProgress.$inferSelect;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type Resource = typeof resources.$inferSelect;
export type UploadedVideo = typeof uploadedVideos.$inferSelect;
export type Document = typeof documents.$inferSelect;
export type DocumentChunk = typeof documentChunks.$inferSelect;

export type InsertUser = z.infer<typeof insertUserSchema>;
export type UpsertUser = typeof users.$inferInsert;
export type InsertCourse = z.infer<typeof insertCourseSchema>;
export type InsertModule = z.infer<typeof insertModuleSchema>;
export type InsertUserProgress = z.infer<typeof insertUserProgressSchema>;
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
export type InsertResource = z.infer<typeof insertResourceSchema>;
export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type InsertDocumentChunk = z.infer<typeof insertDocumentChunkSchema>;
export type InsertUploadedVideo = z.infer<typeof insertUploadedVideoSchema>;
