import { useCallback, useEffect } from "react";

// Simple analytics event types
export interface AnalyticsEvent {
  event: string;
  properties?: Record<string, any>;
  timestamp?: number;
  sessionId?: string;
  userId?: string;
}

// Track user flows and friction points
export interface UserFlow {
  flowId: string;
  step: string;
  timestamp: number;
  duration?: number;
  success?: boolean;
  errorMessage?: string;
}

class SimpleAnalytics {
  private sessionId: string;
  private userId?: string;
  private events: AnalyticsEvent[] = [];
  private flows: Map<string, UserFlow[]> = new Map();

  constructor() {
    this.sessionId = Date.now().toString(36) + Math.random().toString(36).substr(2);
    this.loadFromStorage();
  }

  setUserId(userId: string) {
    this.userId = userId;
  }

  track(event: string, properties?: Record<string, any>) {
    const analyticsEvent: AnalyticsEvent = {
      event,
      properties,
      timestamp: Date.now(),
      sessionId: this.sessionId,
      userId: this.userId,
    };

    this.events.push(analyticsEvent);
    this.saveToStorage();

    // Console log for development
    if (process.env.NODE_ENV === "development") {
      console.log("📊 Analytics:", analyticsEvent);
    }
  }

  // Track user flows to identify friction points
  startFlow(flowId: string, initialStep: string) {
    const flow: UserFlow = {
      flowId,
      step: initialStep,
      timestamp: Date.now(),
    };

    if (!this.flows.has(flowId)) {
      this.flows.set(flowId, []);
    }
    this.flows.get(flowId)!.push(flow);
    this.saveToStorage();
  }

  updateFlow(flowId: string, step: string, success?: boolean, errorMessage?: string) {
    const flowSteps = this.flows.get(flowId);
    if (!flowSteps || flowSteps.length === 0) return;

    const lastStep = flowSteps[flowSteps.length - 1];
    const now = Date.now();
    
    // Update last step duration
    lastStep.duration = now - lastStep.timestamp;
    lastStep.success = success;
    lastStep.errorMessage = errorMessage;

    // Add new step
    const newStep: UserFlow = {
      flowId,
      step,
      timestamp: now,
    };
    flowSteps.push(newStep);
    this.saveToStorage();
  }

  completeFlow(flowId: string, success: boolean = true) {
    const flowSteps = this.flows.get(flowId);
    if (!flowSteps || flowSteps.length === 0) return;

    const lastStep = flowSteps[flowSteps.length - 1];
    lastStep.duration = Date.now() - lastStep.timestamp;
    lastStep.success = success;

    // Track completion
    this.track("flow_completed", {
      flowId,
      totalSteps: flowSteps.length,
      totalDuration: flowSteps.reduce((sum, step) => sum + (step.duration || 0), 0),
      success,
      steps: flowSteps.map(s => ({ step: s.step, duration: s.duration, success: s.success })),
    });

    this.saveToStorage();
  }

  // Get analytics data for debugging/monitoring
  getEvents(limit?: number): AnalyticsEvent[] {
    return limit ? this.events.slice(-limit) : this.events;
  }

  getFlows(): Map<string, UserFlow[]> {
    return this.flows;
  }

  // Export data for external analytics tools
  exportData() {
    return {
      sessionId: this.sessionId,
      userId: this.userId,
      events: this.events,
      flows: Object.fromEntries(this.flows),
      timestamp: Date.now(),
    };
  }

  private saveToStorage() {
    try {
      const data = {
        events: this.events.slice(-100), // Keep last 100 events
        flows: Object.fromEntries(this.flows),
        sessionId: this.sessionId,
        userId: this.userId,
      };
      localStorage.setItem("medimind-analytics", JSON.stringify(data));
    } catch (error) {
      console.warn("Failed to save analytics to localStorage:", error);
    }
  }

  private loadFromStorage() {
    try {
      const data = localStorage.getItem("medimind-analytics");
      if (data) {
        const parsed = JSON.parse(data);
        this.events = parsed.events || [];
        this.flows = new Map(Object.entries(parsed.flows || {}));
        this.userId = parsed.userId;
      }
    } catch (error) {
      console.warn("Failed to load analytics from localStorage:", error);
    }
  }
}

// Singleton instance
const analytics = new SimpleAnalytics();

// React hook for analytics
export function useAnalytics() {
  const track = useCallback((event: string, properties?: Record<string, any>) => {
    analytics.track(event, properties);
  }, []);

  const startFlow = useCallback((flowId: string, initialStep: string) => {
    analytics.startFlow(flowId, initialStep);
  }, []);

  const updateFlow = useCallback((flowId: string, step: string, success?: boolean, errorMessage?: string) => {
    analytics.updateFlow(flowId, step, success, errorMessage);
  }, []);

  const completeFlow = useCallback((flowId: string, success: boolean = true) => {
    analytics.completeFlow(flowId, success);
  }, []);

  const setUserId = useCallback((userId: string) => {
    analytics.setUserId(userId);
  }, []);

  return {
    track,
    startFlow,
    updateFlow,
    completeFlow,
    setUserId,
    getEvents: () => analytics.getEvents(),
    getFlows: () => analytics.getFlows(),
    exportData: () => analytics.exportData(),
  };
}

// Common tracking events
export const trackEvents = {
  // Page views
  pageView: (page: string) => ({ event: "page_view", properties: { page } }),
  
  // User actions
  videoPlay: (moduleId: string, progress: number) => ({ 
    event: "video_play", 
    properties: { moduleId, progress } 
  }),
  videoComplete: (moduleId: string, duration: number) => ({ 
    event: "video_complete", 
    properties: { moduleId, duration } 
  }),
  
  // AI interactions
  chatMessage: (query: string, responseTime: number) => ({ 
    event: "chat_message", 
    properties: { queryLength: query.length, responseTime } 
  }),
  chatResponseReceived: (confidence?: number, sources?: number) => ({ 
    event: "chat_response_received", 
    properties: { confidence, sources } 
  }),
  
  // Learning progress
  moduleStarted: (moduleId: string) => ({ 
    event: "module_started", 
    properties: { moduleId } 
  }),
  moduleCompleted: (moduleId: string, timeSpent: number) => ({ 
    event: "module_completed", 
    properties: { moduleId, timeSpent } 
  }),
  
  // Errors and friction
  error: (errorType: string, message: string, location: string) => ({ 
    event: "error", 
    properties: { errorType, message, location } 
  }),
  networkError: (endpoint: string, statusCode?: number) => ({ 
    event: "network_error", 
    properties: { endpoint, statusCode } 
  }),
  
  // Feature usage
  featureUsed: (feature: string, context?: string) => ({ 
    event: "feature_used", 
    properties: { feature, context } 
  }),
};

// Common user flows
export const userFlows = {
  onboarding: "onboarding",
  videoLearning: "video_learning",
  aiChat: "ai_chat",
  courseCompletion: "course_completion",
  documentUpload: "document_upload",
};

export default analytics;