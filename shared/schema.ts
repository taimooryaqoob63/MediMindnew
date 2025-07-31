import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  name: text("name").notNull(),
  role: text("role").notNull().default("care_worker"), // care_worker, nurse, manager
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

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({ id: true });
export const insertCourseSchema = createInsertSchema(courses).omit({ id: true });
export const insertModuleSchema = createInsertSchema(modules).omit({ id: true });
export const insertUserProgressSchema = createInsertSchema(userProgress).omit({ id: true });
export const insertChatMessageSchema = createInsertSchema(chatMessages).omit({ id: true });
export const insertResourceSchema = createInsertSchema(resources).omit({ id: true });

// Types
export type User = typeof users.$inferSelect;
export type Course = typeof courses.$inferSelect;
export type Module = typeof modules.$inferSelect;
export type UserProgress = typeof userProgress.$inferSelect;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type Resource = typeof resources.$inferSelect;

export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertCourse = z.infer<typeof insertCourseSchema>;
export type InsertModule = z.infer<typeof insertModuleSchema>;
export type InsertUserProgress = z.infer<typeof insertUserProgressSchema>;
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
export type InsertResource = z.infer<typeof insertResourceSchema>;
