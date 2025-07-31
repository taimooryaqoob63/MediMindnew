import { 
  type User, type Course, type Module, type UserProgress, type ChatMessage, type Resource,
  type InsertUser, type InsertCourse, type InsertModule, type InsertUserProgress, 
  type InsertChatMessage, type InsertResource, type UpsertUser,
  users, courses, modules, userProgress, chatMessages, resources
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

  // User Progress
  getUserProgress(userId: string, courseId: string): Promise<UserProgress[]>;
  updateUserProgress(progress: InsertUserProgress): Promise<UserProgress>;

  // Chat Messages
  getChatMessages(userId: string, courseId: string): Promise<ChatMessage[]>;
  createChatMessage(message: InsertChatMessage): Promise<ChatMessage>;

  // Resources
  getResources(): Promise<Resource[]>;
  createResource(resource: InsertResource): Promise<Resource>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    try {
      const userWithDefaults = {
        ...userData,
        email: userData.email ?? null,
        firstName: userData.firstName ?? null,
        lastName: userData.lastName ?? null,
        profileImageUrl: userData.profileImageUrl ?? null,
        role: userData.role || "care_worker",
        updatedAt: new Date(),
      };

      const [user] = await db
        .insert(users)
        .values(userWithDefaults)
        .onConflictDoUpdate({
          target: users.id,
          set: {
            ...userWithDefaults,
            updatedAt: new Date(),
          },
        })
        .returning();
      return user;
    } catch (error) {
      console.error("Error upserting user:", error);
      throw new Error("Failed to create or update user");
    }
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const userWithDefaults = { 
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
    const [createdUser] = await db.insert(users).values(userWithDefaults).returning();
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

  async getUserProgress(userId: string, courseId: string): Promise<UserProgress[]> {
    return await db.select().from(userProgress)
      .where(and(eq(userProgress.userId, userId), eq(userProgress.courseId, courseId)));
  }

  async updateUserProgress(insertProgress: InsertUserProgress): Promise<UserProgress> {
    const existing = await db.select().from(userProgress)
      .where(
        and(
          eq(userProgress.userId, insertProgress.userId),
          eq(userProgress.courseId, insertProgress.courseId),
          eq(userProgress.moduleId, insertProgress.moduleId || "")
        )
      );
    
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

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.email === username);
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    if (!userData.id) {
      throw new Error("User ID is required for upsert operation");
    }
    const existingUser = this.users.get(userData.id);
    const userWithDefaults: User = {
      id: userData.id,
      email: userData.email ?? null,
      firstName: userData.firstName ?? null,
      lastName: userData.lastName ?? null,
      profileImageUrl: userData.profileImageUrl ?? null,
      role: userData.role || "care_worker",
      createdAt: existingUser?.createdAt || new Date(),
      updatedAt: new Date()
    };
    this.users.set(userData.id, userWithDefaults);
    return userWithDefaults;
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
