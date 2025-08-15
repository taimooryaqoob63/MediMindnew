/**
 * Human-in-the-Loop Escalation Service
 * Handles confidence-based escalation to human supervisors or clinicians
 */

import { storage } from '../storage';
import { RAG_CONFIG, shouldEscalateToHuman } from '../config/ragConfiguration';
import type { User, InsertRagAnalytics, ChatResponse } from '@shared/schema';

interface EscalationRequest {
  id: string;
  userId: string;
  query: string;
  confidence: number;
  context: string;
  urgencyLevel: 'low' | 'medium' | 'high' | 'critical';
  sources: any[];
  aiResponse: string;
  escalationType: 'confidence' | 'emergency' | 'clinical_complexity' | 'user_request';
  timestamp: Date;
  status: 'pending' | 'reviewed' | 'resolved' | 'escalated_further';
  assignedTo?: string;
  reviewNotes?: string;
}

interface SupervisorResponse {
  approved: boolean;
  modifiedResponse?: string;
  additionalSources?: any[];
  confidence: number;
  reviewNotes: string;
  followUpRequired: boolean;
}

interface EscalationOptions {
  includeContext?: boolean;
  suggestAlternatives?: boolean;
  allowDirectResponse?: boolean;
  timeoutMinutes?: number;
}

export class HumanEscalationService {
  private pendingEscalations = new Map<string, EscalationRequest>();
  private escalationQueue: string[] = [];
  private reviewTimeout = 30; // minutes

  constructor() {
    this.initializeService();
  }

  private async initializeService(): Promise<void> {
    // Load any pending escalations from storage
    console.log('Human escalation service initialized');
  }

  async evaluateForEscalation(
    query: string,
    response: ChatResponse,
    user: User,
    context?: string,
    urgencyLevel: 'low' | 'medium' | 'high' | 'critical' = 'low'
  ): Promise<{
    shouldEscalate: boolean;
    escalationResponse?: ChatResponse;
    escalationId?: string;
  }> {
    const confidence = response.confidence || 0;

    // Check if escalation is needed based on configuration
    if (!shouldEscalateToHuman(confidence)) {
      return { shouldEscalate: false };
    }

    // Create escalation request
    const escalationId = await this.createEscalationRequest({
      userId: user.id,
      query,
      confidence,
      context: context || '',
      urgencyLevel,
      sources: response.sources || [],
      aiResponse: response.content,
      escalationType: this.determineEscalationType(confidence, urgencyLevel, query),
    });

    // Generate escalation response for user
    const escalationResponse = this.generateEscalationResponse(
      response,
      confidence,
      urgencyLevel,
      escalationId
    );

    return {
      shouldEscalate: true,
      escalationResponse,
      escalationId,
    };
  }

  private async createEscalationRequest(params: {
    userId: string;
    query: string;
    confidence: number;
    context: string;
    urgencyLevel: 'low' | 'medium' | 'high' | 'critical';
    sources: any[];
    aiResponse: string;
    escalationType: 'confidence' | 'emergency' | 'clinical_complexity' | 'user_request';
  }): Promise<string> {
    const escalationId = `esc_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    
    const escalationRequest: EscalationRequest = {
      id: escalationId,
      ...params,
      timestamp: new Date(),
      status: 'pending',
    };

    // Store in memory (in production, this would go to database)
    this.pendingEscalations.set(escalationId, escalationRequest);
    
    // Add to priority queue based on urgency
    this.addToQueue(escalationId, params.urgencyLevel);

    // Log the escalation
    await this.logEscalation(escalationRequest);

    return escalationId;
  }

  private determineEscalationType(
    confidence: number,
    urgencyLevel: string,
    query: string
  ): 'confidence' | 'emergency' | 'clinical_complexity' | 'user_request' {
    if (urgencyLevel === 'critical' || urgencyLevel === 'high') {
      return 'emergency';
    }
    
    if (confidence < RAG_CONFIG.safety.humanEscalationThreshold.lower) {
      return 'confidence';
    }
    
    // Check for clinical complexity indicators
    const complexityIndicators = [
      'drug interaction', 'multiple conditions', 'contraindication',
      'complication', 'adverse reaction', 'specialist', 'complex'
    ];
    
    if (complexityIndicators.some(indicator => 
      query.toLowerCase().includes(indicator))) {
      return 'clinical_complexity';
    }
    
    return 'confidence';
  }

  private addToQueue(escalationId: string, urgencyLevel: string): void {
    // Priority queue: critical/high first, then chronological
    if (urgencyLevel === 'critical' || urgencyLevel === 'high') {
      this.escalationQueue.unshift(escalationId);
    } else {
      this.escalationQueue.push(escalationId);
    }
  }

  private generateEscalationResponse(
    originalResponse: ChatResponse,
    confidence: number,
    urgencyLevel: string,
    escalationId: string
  ): ChatResponse {
    let escalationMessage = '';
    let suggestedActions: Array<{label: string; action: string; url?: string}> = [];

    if (urgencyLevel === 'critical' || urgencyLevel === 'high') {
      escalationMessage = `
🚨 **Clinical Review Required**

While I've provided information below, this query requires immediate review by a qualified healthcare professional due to its urgency and clinical nature.

**Escalation ID**: ${escalationId}

**Immediate Actions**:
• Contact your supervising clinician or on-call doctor
• Follow your facility's emergency protocols if applicable
• Document all observations and actions taken

---

**AI-Generated Response** (Confidence: ${confidence}%):
${originalResponse.content}

⚠️ **Important**: This AI response is pending clinical review and should not be acted upon without professional oversight.`;

      suggestedActions = [
        { label: "Contact Supervisor", action: "contact_supervisor", url: "/escalation/supervisor" },
        { label: "Emergency Protocols", action: "emergency_protocols", url: "/emergency-protocols" },
        { label: "Document Incident", action: "document_incident", url: "/incident-reporting" },
      ];

    } else {
      escalationMessage = `
📋 **Response Under Review**

I've generated a response to your query, but given the clinical nature and moderate confidence level (${confidence}%), I'm requesting review from a healthcare supervisor to ensure accuracy.

**Escalation ID**: ${escalationId}

**Preliminary Response**:
${originalResponse.content}

**Next Steps**:
• A qualified supervisor will review this response shortly
• You'll be notified when the review is complete
• In the meantime, you can continue with routine care protocols
• For urgent matters, please contact your supervising clinician directly

💡 **Alternative Actions**: While waiting for review, you might find these helpful:`;

      suggestedActions = [
        { label: "Check Care Plan", action: "check_care_plan", url: "/care-plans" },
        { label: "Review Guidelines", action: "review_guidelines", url: "/guidelines" },
        { label: "Contact Supervisor", action: "contact_supervisor", url: "/escalation/supervisor" },
        { label: "Training Resources", action: "training_resources", url: "/training" },
      ];
    }

    return {
      ...originalResponse,
      content: escalationMessage,
      confidence: confidence,
      suggestedActions: suggestedActions,
      followUpQuestions: [
        "Can you provide more context about the situation?",
        "What is the resident's current care plan?",
        "Are there any immediate safety concerns?",
      ],
      usedRAG: true,
      agentsUsed: [...(originalResponse.agentsUsed || []), 'human_escalation'],
    };
  }

  // Method for supervisors to review escalated queries
  async reviewEscalation(
    escalationId: string,
    supervisorId: string,
    response: SupervisorResponse
  ): Promise<{ success: boolean; finalResponse?: ChatResponse }> {
    const escalation = this.pendingEscalations.get(escalationId);
    if (!escalation) {
      return { success: false };
    }

    // Update escalation status
    escalation.status = 'reviewed';
    escalation.assignedTo = supervisorId;
    escalation.reviewNotes = response.reviewNotes;

    // Create final response for user
    const finalResponse: ChatResponse = {
      content: response.modifiedResponse || escalation.aiResponse,
      confidence: response.confidence,
      sources: response.additionalSources || escalation.sources,
      followUpQuestions: this.generateFollowUpQuestions(response),
      suggestedActions: this.generateSupervisorActions(response),
      usedRAG: true,
      agentsUsed: ['human_supervisor', 'ai_assistant'],
      cacheHit: false,
      responseTime: Date.now() - escalation.timestamp.getTime(),
      streamable: false,
    };

    // Log the review
    await this.logReview(escalation, supervisorId, response);

    // Remove from pending if fully resolved
    if (!response.followUpRequired) {
      this.pendingEscalations.delete(escalationId);
      this.escalationQueue = this.escalationQueue.filter(id => id !== escalationId);
    }

    return { success: true, finalResponse };
  }

  private generateFollowUpQuestions(response: SupervisorResponse): string[] {
    const questions = [];
    
    if (response.followUpRequired) {
      questions.push(
        "Is there any additional context needed?",
        "Should we schedule a follow-up review?",
        "Are there specific protocols to follow?"
      );
    } else {
      questions.push(
        "Do you need clarification on any part of this guidance?",
        "Are there related topics you'd like to explore?",
        "How can we prevent similar situations in the future?"
      );
    }
    
    return questions;
  }

  private generateSupervisorActions(response: SupervisorResponse): Array<{label: string; action: string; url?: string}> {
    const actions = [];
    
    if (response.approved) {
      actions.push(
        { label: "Implement Guidance", action: "implement_guidance" },
        { label: "Update Care Plan", action: "update_care_plan", url: "/care-plans" }
      );
    }
    
    if (response.followUpRequired) {
      actions.push(
        { label: "Schedule Follow-up", action: "schedule_followup" },
        { label: "Set Reminder", action: "set_reminder" }
      );
    }
    
    actions.push(
      { label: "Provide Feedback", action: "provide_feedback", url: "/feedback" },
      { label: "Additional Training", action: "additional_training", url: "/training" }
    );
    
    return actions;
  }

  // Get pending escalations for supervisor dashboard
  async getPendingEscalations(supervisorId?: string): Promise<EscalationRequest[]> {
    const pending = Array.from(this.pendingEscalations.values())
      .filter(esc => esc.status === 'pending')
      .sort((a, b) => {
        // Sort by urgency first, then by timestamp
        const urgencyOrder = { critical: 4, high: 3, medium: 2, low: 1 };
        const urgencyDiff = urgencyOrder[b.urgencyLevel] - urgencyOrder[a.urgencyLevel];
        if (urgencyDiff !== 0) return urgencyDiff;
        return a.timestamp.getTime() - b.timestamp.getTime();
      });

    return pending;
  }

  // Get escalation statistics
  getEscalationStats(): {
    pending: number;
    resolved: number;
    avgResponseTime: number;
    escalationRate: number;
  } {
    const all = Array.from(this.pendingEscalations.values());
    const pending = all.filter(e => e.status === 'pending').length;
    const resolved = all.filter(e => e.status === 'resolved').length;
    
    // Calculate average response time for resolved escalations
    const resolvedEscalations = all.filter(e => e.status === 'resolved');
    const avgResponseTime = resolvedEscalations.length > 0
      ? resolvedEscalations.reduce((sum, e) => sum + (Date.now() - e.timestamp.getTime()), 0) / resolvedEscalations.length
      : 0;

    return {
      pending,
      resolved,
      avgResponseTime,
      escalationRate: all.length > 0 ? (pending / all.length) * 100 : 0,
    };
  }

  private async logEscalation(escalation: EscalationRequest): Promise<void> {
    try {
      // TODO: Implement proper analytics logging when storage method is available
      console.log(`Escalation logged: ${escalation.id} - Type: ${escalation.escalationType} - Urgency: ${escalation.urgencyLevel}`);
    } catch (error) {
      console.error('Error logging escalation:', error);
    }
  }

  private async logReview(
    escalation: EscalationRequest,
    supervisorId: string,
    response: SupervisorResponse
  ): Promise<void> {
    try {
      // TODO: Implement proper analytics logging when storage method is available
      console.log(`Review logged: ${escalation.id} by ${supervisorId} - Approved: ${response.approved}`);
    } catch (error) {
      console.error('Error logging review:', error);
    }
  }
}

export const humanEscalationService = new HumanEscalationService();