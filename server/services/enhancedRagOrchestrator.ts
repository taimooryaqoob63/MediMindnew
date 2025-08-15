import OpenAI from 'openai';
import { vectorStore } from './vectorStore';
import { storage } from '../storage';
import { RAG_CONFIG, getGenerationSettings, shouldEscalateToHuman, validateCitations } from '../config/ragConfiguration';
import { nlpIntentDetector } from './nlpIntentDetector';
import { hybridSearch } from './hybridSearch';
import { humanEscalationService } from './humanEscalationService';
import { citationEnforcementService } from './citationEnforcementService';
import type { 
  User, ChatResponse, InsertRagAnalytics, InsertChatSummary, InsertQueryCache, 
  InsertIntentClassification, InsertResponseFeedback 
} from '@shared/schema';
import crypto from 'crypto';

interface QueryAnalysis {
  intent: string;
  queryType: 'faq' | 'educational' | 'clinical' | 'emergency';
  entities: string[];
  complexity: 'simple' | 'moderate' | 'complex';
  requiresSpecialistKnowledge: boolean;
  requiresComplianceCheck: boolean;
  suggestedFilters: Record<string, any>;
  confidence: number;
}

interface EnhancedAgentResponse {
  content: string;
  confidence: number;
  sources: any[];
  followUpQuestions?: string[];
  suggestedActions?: Array<{label: string; action: string; url?: string}>;
  agentName: string;
  responseTime: number;
  tokenUsage: {
    prompt: number;
    completion: number;
  };
}

interface RetrievalResult {
  sources: Array<{
    id: string;
    title: string;
    excerpt: string;
    score: number;
    type: string;
    pageNumber?: number;
    section?: string;
    clickable?: boolean;
    recency: number;
    relevance: number;
  }>;
  totalRetrieved: number;
  cacheHit: boolean;
}

interface AgentContext {
  summary: string;
  recentInteractions: string[];
  roleSpecificContext: Record<string, any>;
}

export class EnhancedRagOrchestrator {
  private openai?: OpenAI;
  private maxTokenLimit = RAG_CONFIG.performance.maxTokensPerQuery;

  constructor() {
    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
    }
  }

  async processQuery(
    query: string,
    user: User,
    courseId?: string,
    conversationHistory?: string[]
  ): Promise<ChatResponse> {
    const startTime = Date.now();
    
    try {
      // Step 1: Enhanced emergency and intent detection
      const intentAnalysis = await nlpIntentDetector.analyzeIntent(query, conversationHistory?.join('\n'));
      const emergencyCheck = {
        isEmergency: intentAnalysis.isEmergency,
        keywords: intentAnalysis.entities,
        urgencyLevel: intentAnalysis.urgencyLevel
      };

      // Step 2: Check cache
      const cacheResult = await this.checkQueryCache(query);
      if (cacheResult) {
        await this.logAnalytics({
          eventType: 'cache_hit',
          userId: user.id,
          queryType: 'cached',
          cacheHit: true,
          responseTime: Date.now() - startTime,
        });
        
        // Add emergency disclaimer to cached responses if needed
        if (emergencyCheck.isEmergency) {
          return this.addEmergencyDisclaimer(cacheResult, emergencyCheck.keywords);
        }
        return cacheResult;
      }

      // Step 3: Intent analysis
      const analysis = await this.analyzeQueryWithIntent(query, user);
      
      // Step 4: Agent context
      const agentContext = await this.getAgentContext(user.id, courseId);

      // Step 5: Dynamic retrieval
      const retrievalResult = await this.dynamicRetrieval(query, analysis, agentContext);

      // Step 6: Agent pruning
      const selectedAgents = this.pruneAgents(analysis);

      // Step 7: Parallel processing
      const agentResponses = await this.processAgentsInParallel(
        query, 
        retrievalResult, 
        user, 
        analysis, 
        selectedAgents,
        agentContext
      );

      // Step 8: Synthesize response
      const finalResponse = await this.synthesizeFinalResponse(
        agentResponses, 
        analysis, 
        retrievalResult
      );

      // Step 9: Enhanced citation validation with audit trail
      const citationValidation = await citationEnforcementService.validateCitations(
        finalResponse.sources || [],
        analysis.queryType,
        finalResponse.content,
        user.id
      );
      
      if (!citationValidation.isValid && finalResponse.confidence && finalResponse.confidence > 60) {
        finalResponse.confidence = Math.max(citationValidation.confidence, 30);
        
        // Add citation recommendations to response
        if (citationValidation.recommendations.length > 0) {
          finalResponse.content += `\n\n**Note**: ${citationValidation.recommendations.join(' ')}`;
        }
      }

      // Step 10: Check for human escalation
      const escalationResult = await humanEscalationService.evaluateForEscalation(
        query,
        finalResponse,
        user,
        conversationHistory?.join('\n'),
        emergencyCheck.urgencyLevel
      );

      if (escalationResult.shouldEscalate) {
        // Return escalation response instead of AI response
        const escalationResponse = escalationResult.escalationResponse!;
        
        await this.logAnalytics({
          eventType: 'escalation',
          userId: user.id,
          queryType: analysis.queryType,
          confidence: finalResponse.confidence || 0,
          responseTime: Date.now() - startTime,
          metadata: { escalationId: escalationResult.escalationId }
        });

        return escalationResponse;
      }

      // Step 11: Add emergency disclaimer if needed
      const responseWithDisclaimer = emergencyCheck.isEmergency 
        ? this.addEmergencyDisclaimer(finalResponse, emergencyCheck.keywords, emergencyCheck.urgencyLevel)
        : finalResponse;

      // Step 12: Cache if appropriate (cache original response, not the one with disclaimer)
      if (analysis.queryType === 'faq' || (finalResponse.confidence && finalResponse.confidence > RAG_CONFIG.performance.cacheThreshold)) {
        await this.cacheResponse(query, finalResponse);
      }

      // Step 13: Update summaries
      await this.updateAgentSummaries(user.id, courseId, query, finalResponse, selectedAgents);

      // Step 14: Log analytics
      await this.logAnalytics({
        eventType: 'response',
        userId: user.id,
        queryType: analysis.queryType,
        agentsUsed: selectedAgents,
        retrievalHits: retrievalResult.totalRetrieved,
        confidence: finalResponse.confidence || 0,
        responseTime: Date.now() - startTime,
        tokenUsage: this.calculateTotalTokenUsage(agentResponses),
        cacheHit: false,
      });

      return {
        content: responseWithDisclaimer.content,
        sources: responseWithDisclaimer.sources || finalResponse.sources,
        confidence: responseWithDisclaimer.confidence || finalResponse.confidence,
        followUpQuestions: finalResponse.followUpQuestions,
        suggestedActions: responseWithDisclaimer.suggestedActions || finalResponse.suggestedActions,
        usedRAG: true,
        cacheHit: false,
        agentsUsed: 'agentsUsed' in responseWithDisclaimer ? responseWithDisclaimer.agentsUsed : selectedAgents,
        responseTime: Date.now() - startTime,
        streamable: true,
      };

    } catch (error) {
      console.error('Enhanced RAG processing error:', error);
      
      await this.logAnalytics({
        eventType: 'error',
        userId: user.id,
        queryType: 'error',
        responseTime: Date.now() - startTime,
        metadata: { error: (error as Error).message },
      });

      return {
        content: "I'm experiencing technical difficulties. Please consult your local healthcare guidelines for immediate assistance.",
        confidence: 0,
        sources: [],
        usedRAG: false,
        agentsUsed: ['error_handler'],
        responseTime: Date.now() - startTime,
      };
    }
  }

  // Deprecated - replaced by NLP intent detection
  private checkEmergencyKeywords(query: string): { isEmergency: boolean; keywords: string[] } {
    // Fallback for when NLP analysis fails
    const emergencyKeywords = [
      'emergency', 'urgent', 'immediate', 'critical', 'severe', 'danger',
      'unconscious', 'seizure', 'stroke', 'heart attack', 'hypoglycemia',
      'ketoacidosis', 'diabetic coma', 'blood sugar', 'insulin shock'
    ];
    
    const queryLower = query.toLowerCase();
    const foundKeywords = emergencyKeywords.filter(keyword => 
      queryLower.includes(keyword)
    );
    
    return {
      isEmergency: foundKeywords.length > 0,
      keywords: foundKeywords
    };
  }

  private addEmergencyDisclaimer(response: ChatResponse, keywords: string[], urgencyLevel?: string): ChatResponse {
    let emergencyDisclaimer = '';
    
    if (urgencyLevel === 'critical' || urgencyLevel === 'high') {
      emergencyDisclaimer = `

---

🚨 **CRITICAL SAFETY NOTICE**: This appears to be a high-urgency medical situation (${keywords.join(', ')}).

**IMMEDIATE ACTIONS REQUIRED:**
• **CALL 999 NOW** if someone is in immediate danger
• Activate your facility's emergency response protocols
• Contact your supervising clinician or on-call doctor immediately
• Begin first aid if trained and safe to do so
• Document everything for CQC compliance

⚠️ **CRITICAL**: Do not rely solely on AI guidance for emergency situations. Human medical expertise is essential.`;
    } else {
      emergencyDisclaimer = `

---

🚨 **IMPORTANT SAFETY NOTICE**: Your query contains emergency-related terms (${keywords.join(', ')}). 

**If this is an actual emergency:**
• **CALL 999 IMMEDIATELY** for emergency medical assistance
• Follow your institution's emergency protocols
• Contact your on-call medical professional
• Document as required by CQC guidelines

⚠️ **This is educational content only. AI cannot replace emergency medical care or institutional protocols.**`;
    }

    return {
      ...response,
      content: response.content + emergencyDisclaimer,
      confidence: Math.min(response.confidence || 0, 85), // Reduce confidence for emergency-flagged content
      suggestedActions: [
        ...(response.suggestedActions || []),
        { label: "Call 999", action: "emergency_call", url: "tel:999" },
        { label: "Emergency Protocols", action: "view_protocols", url: "/emergency-protocols" }
      ],
      agentsUsed: [...(response.agentsUsed || []), 'emergency_disclaimer']
    };
  }

  private async handleEmergencyResponse(keywords: string[]): Promise<ChatResponse> {
    return {
      content: `🚨 EMERGENCY DETECTED: This appears to be an urgent medical situation. Please:

1. **CALL 999 IMMEDIATELY** for emergency medical assistance
2. Follow your care home's emergency protocols
3. Contact the on-call medical professional
4. Document the incident as required by CQC guidelines

Keywords detected: ${keywords.join(', ')}

⚠️ AI systems cannot provide emergency medical care. This is an automated safety response.`,
      confidence: 100,
      sources: [],
      suggestedActions: [
        { label: "Call 999", action: "emergency_call", url: "tel:999" },
        { label: "Emergency Protocols", action: "view_protocols", url: "/emergency-protocols" },
        { label: "Incident Documentation", action: "document_incident", url: "/incident-form" }
      ],
      usedRAG: false,
      agentsUsed: ['emergency_handler'],
      responseTime: 0,
    };
  }

  private async checkQueryCache(query: string): Promise<ChatResponse | null> {
    try {
      const queryHash = crypto.createHash('sha256').update(query.toLowerCase().trim()).digest('hex');
      const cached = await storage.getQueryCache(queryHash);
      
      if (cached && new Date() < new Date(cached.expiresAt)) {
        await storage.updateQueryCacheHit(cached.id);
        
        return {
          content: cached.response,
          sources: cached.sources as any[],
          confidence: cached.confidence || 0,
          usedRAG: true,
          cacheHit: true,
          responseTime: 0,
        };
      }
    } catch (error) {
      console.error('Cache check error:', error);
    }
    
    return null;
  }

  private async analyzeQueryWithIntent(query: string, user: User): Promise<QueryAnalysis> {
    if (!this.openai) {
      throw new Error('OpenAI not configured');
    }

    const startTime = Date.now();
    const prompt = `Analyze this healthcare query for intent classification and routing optimization:

Query: "${query}"
User Role: ${user.role}

Provide JSON response with:
{
  "intent": "What user wants to accomplish",
  "queryType": "faq|educational|clinical|emergency",
  "entities": ["medical terms, procedures, conditions"],
  "complexity": "simple|moderate|complex",
  "requiresSpecialistKnowledge": boolean,
  "requiresComplianceCheck": boolean,
  "suggestedFilters": {"category": "diabetes", "type": "NICE"},
  "confidence": 0-100
}`;

    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.1,
        max_tokens: 500,
      });

      const analysisText = response.choices[0]?.message?.content;
      if (!analysisText) {
        throw new Error('No analysis received');
      }

      // Clean up any markdown formatting if present
      const cleanedText = analysisText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const analysis = JSON.parse(cleanedText);
      
      await storage.createIntentClassification({
        query,
        intent: analysis.intent || 'unknown',
        confidence: analysis.confidence || 50,
        modelUsed: "gpt-4o-mini",
        processingTime: Date.now() - startTime,
      });

      return analysis;
    } catch (error) {
      console.error('Intent analysis error:', error);
      return {
        intent: 'general_inquiry',
        queryType: 'educational',
        entities: [],
        complexity: 'moderate',
        requiresSpecialistKnowledge: false,
        requiresComplianceCheck: false,
        suggestedFilters: { category: 'diabetes' },
        confidence: 50,
      };
    }
  }

  private async getAgentContext(userId: string, courseId?: string): Promise<AgentContext> {
    try {
      const summaries = await storage.getChatSummaries(userId, courseId);
      
      const summary = summaries.length > 0 
        ? summaries.map(s => `${s.agentType}: ${s.summary}`).join('\n')
        : 'No previous interactions recorded.';

      const recentInteractions = summaries
        .filter(s => s.lastUpdated && s.lastUpdated > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
        .map(s => s.summary)
        .slice(-5);

      return {
        summary,
        recentInteractions,
        roleSpecificContext: {
          userRole: 'care_worker',
          focusAreas: ['diabetes', 'medication_management', 'emergency_response'],
        },
      };
    } catch (error) {
      console.error('Context retrieval error:', error);
      return {
        summary: 'No context available',
        recentInteractions: [],
        roleSpecificContext: {},
      };
    }
  }

  private async dynamicRetrieval(
    query: string, 
    analysis: QueryAnalysis, 
    context: AgentContext
  ): Promise<RetrievalResult> {
    try {
      const filters = {
        ...analysis.suggestedFilters,
        ...(analysis.queryType === 'clinical' && { recency_weight: 1.5 }),
        ...(analysis.requiresComplianceCheck && { compliance_focused: true }),
      };

      const limit = analysis.complexity === 'complex' ? 15 : 
                   analysis.complexity === 'moderate' ? 10 : 5;

      const results = await vectorStore.searchSimilar(query, limit, filters);
      
      const enhancedResults = results.map(result => ({
        ...result,
        recency: this.calculateRecencyScore(result),
        relevance: this.calculateRelevanceScore(result, analysis),
      }));

      enhancedResults.sort((a, b) => 
        (b.score * 0.6 + b.relevance * 0.3 + b.recency * 0.1) - 
        (a.score * 0.6 + a.relevance * 0.3 + a.recency * 0.1)
      );

      return {
        sources: enhancedResults,
        totalRetrieved: enhancedResults.length,
        cacheHit: false,
      };
    } catch (error) {
      console.error('Dynamic retrieval error:', error);
      return {
        sources: [],
        totalRetrieved: 0,
        cacheHit: false,
      };
    }
  }

  private calculateRecencyScore(result: any): number {
    const daysSinceUpdate = Math.random() * 365;
    return Math.max(0, 100 - (daysSinceUpdate / 365) * 100);
  }

  private calculateRelevanceScore(result: any, analysis: QueryAnalysis): number {
    let score = 70;
    
    analysis.entities.forEach(entity => {
      if (result.excerpt?.toLowerCase().includes(entity.toLowerCase())) {
        score += 10;
      }
    });

    if (analysis.queryType === 'clinical' && result.type === 'medical_guideline') {
      score += 15;
    }
    
    if (analysis.requiresComplianceCheck && result.type === 'regulation') {
      score += 20;
    }

    return Math.min(100, score);
  }

  private pruneAgents(analysis: QueryAnalysis): string[] {
    const selectedAgents: string[] = [];

    if (analysis.queryType === 'educational' || analysis.queryType === 'faq') {
      selectedAgents.push('learning_facilitator');
    }

    if (analysis.queryType === 'clinical' || analysis.requiresSpecialistKnowledge) {
      selectedAgents.push('medical_specialist');
    }

    if (analysis.requiresComplianceCheck || analysis.queryType === 'clinical') {
      selectedAgents.push('compliance_officer');
    }

    if (selectedAgents.length === 0) {
      selectedAgents.push('learning_facilitator');
    }

    return selectedAgents;
  }

  private async processAgentsInParallel(
    query: string,
    retrieval: RetrievalResult,
    user: User,
    analysis: QueryAnalysis,
    selectedAgents: string[],
    context: AgentContext
  ): Promise<EnhancedAgentResponse[]> {
    const agentPromises = selectedAgents.map(agentType => 
      this.processSingleAgent(query, retrieval, user, analysis, agentType, context)
    );

    const results = await Promise.allSettled(agentPromises);
    
    return results
      .filter((result): result is PromiseFulfilledResult<EnhancedAgentResponse> => 
        result.status === 'fulfilled'
      )
      .map(result => result.value);
  }

  private async processSingleAgent(
    query: string,
    retrieval: RetrievalResult,
    user: User,
    analysis: QueryAnalysis,
    agentType: string,
    context: AgentContext
  ): Promise<EnhancedAgentResponse> {
    const startTime = Date.now();
    
    if (!this.openai) {
      throw new Error('OpenAI not configured');
    }

    const agentPrompts: Record<string, string> = {
      medical_specialist: `You are a medical specialist providing evidence-based guidance on diabetes care. Focus on clinical accuracy, medication management, and patient safety.`,
      compliance_officer: `You are a healthcare compliance officer ensuring adherence to NICE guidelines, NHS standards, and CQC requirements.`,
      learning_facilitator: `You are an educational specialist helping healthcare workers understand diabetes care concepts.`
    };

    const systemPrompt = agentPrompts[agentType] || agentPrompts.learning_facilitator;
    const contextWindow = this.buildContextWindow(retrieval.sources, analysis);

    try {
      // Get appropriate generation settings based on query analysis
      const generationSettings = getGenerationSettings(analysis.queryType);
      
      const response = await this.openai.chat.completions.create({
        model: generationSettings.model,
        messages: [
          { role: "system", content: systemPrompt },
          { 
            role: "user", 
            content: `Context: ${contextWindow}\n\nUser Role: ${user.role}\n\nQuery: ${query}\n\nProvide a comprehensive response based on the available context.`
          }
        ],
        temperature: generationSettings.temperature,
        top_p: generationSettings.topP,
        max_tokens: generationSettings.maxTokens,
      });

      const content = response.choices[0]?.message?.content || '';
      const tokenUsage = {
        prompt: response.usage?.prompt_tokens || 0,
        completion: response.usage?.completion_tokens || 0,
      };

      return {
        content,
        confidence: this.calculateResponseConfidence(content, retrieval.sources),
        sources: retrieval.sources,
        followUpQuestions: this.extractFollowUpQuestions(content),
        suggestedActions: this.extractSuggestedActions(content, agentType),
        agentName: agentType,
        responseTime: Date.now() - startTime,
        tokenUsage,
      };
    } catch (error) {
      console.error(`Agent ${agentType} processing error:`, error);
      return {
        content: `Unable to process query with ${agentType}. Please try again.`,
        confidence: 0,
        sources: [],
        agentName: agentType,
        responseTime: Date.now() - startTime,
        tokenUsage: { prompt: 0, completion: 0 },
      };
    }
  }

  private buildContextWindow(sources: any[], analysis: QueryAnalysis): string {
    const tokenBudget = analysis.complexity === 'complex' ? 4000 : 
                       analysis.complexity === 'moderate' ? 2500 : 1500;

    let context = '';
    let currentTokens = 0;

    for (const source of sources) {
      const sourceText = `Title: ${source.title}\nContent: ${source.excerpt}\nType: ${source.type}\nRelevance: ${source.score}\n\n`;
      const estimatedTokens = sourceText.length / 4;

      if (currentTokens + estimatedTokens <= tokenBudget) {
        context += sourceText;
        currentTokens += estimatedTokens;
      } else {
        break;
      }
    }

    return context || 'No relevant context found in knowledge base.';
  }

  private calculateResponseConfidence(content: string, sources: any[]): number {
    let confidence = RAG_CONFIG.safety.minResponseConfidence;

    // Source quality scoring
    if (sources.length > 0) {
      const avgSourceScore = sources.reduce((sum, source) => sum + (source.score || 0), 0) / sources.length;
      confidence += Math.min(25, avgSourceScore * 25);
      confidence += Math.min(15, sources.length * 3);
    }

    // Content quality indicators
    if (content.length > 200) confidence += 8;
    if (content.length > 500) confidence += 5;
    
    // Authoritative guideline references (weighted higher)
    if (content.includes('NICE') || content.includes('NHS')) confidence += 12;
    if (content.includes('CQC')) confidence += 8;
    
    // Clinical terminology and structure
    if (content.includes('mg/dl') || content.includes('mmol/L') || content.includes('HbA1c')) confidence += 5;
    
    // Evidence-based language
    if (content.includes('evidence shows') || content.includes('studies indicate') || content.includes('research demonstrates')) confidence += 8;

    return Math.min(100, Math.max(RAG_CONFIG.safety.minResponseConfidence, confidence));
  }

  private extractFollowUpQuestions(content: string): string[] {
    const questions: string[] = [];
    
    if (content.includes('medication')) {
      questions.push('What are the specific dosage guidelines for this medication?');
    }
    if (content.includes('diabetes')) {
      questions.push('How should blood glucose levels be monitored?');
    }
    if (content.includes('emergency')) {
      questions.push('What are the emergency protocols for this situation?');
    }

    return questions.slice(0, 3);
  }

  private extractSuggestedActions(content: string, agentType: string): Array<{label: string; action: string; url?: string}> {
    const actions: Array<{label: string; action: string; url?: string}> = [];

    if (agentType === 'medical_specialist') {
      actions.push(
        { label: 'View Clinical Guidelines', action: 'view_guidelines', url: '/guidelines' },
        { label: 'Check Drug Interactions', action: 'drug_check', url: '/drug-checker' }
      );
    } else if (agentType === 'compliance_officer') {
      actions.push(
        { label: 'Review Compliance Checklist', action: 'compliance_check', url: '/compliance' },
        { label: 'Document Procedure', action: 'document', url: '/documentation' }
      );
    } else if (agentType === 'learning_facilitator') {
      actions.push(
        { label: 'Start Related Training', action: 'training', url: '/training' },
        { label: 'Practice Scenarios', action: 'practice', url: '/scenarios' }
      );
    }

    return actions.slice(0, 2);
  }

  private async synthesizeFinalResponse(
    agentResponses: EnhancedAgentResponse[],
    analysis: QueryAnalysis,
    retrieval: RetrievalResult
  ): Promise<EnhancedAgentResponse> {
    if (agentResponses.length === 0) {
      throw new Error('No agent responses to synthesize');
    }

    if (agentResponses.length === 1) {
      return agentResponses[0];
    }

    if (!this.openai) {
      return agentResponses[0];
    }

    const agentOutputs = agentResponses.map(response => 
      `${response.agentName}: ${response.content}`
    ).join('\n\n---\n\n');

    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are an expert healthcare information synthesizer. Combine the following expert responses into a comprehensive, coherent answer."
          },
          {
            role: "user",
            content: `Query Type: ${analysis.queryType}\nComplexity: ${analysis.complexity}\n\nExpert Responses:\n${agentOutputs}\n\nSynthesize these into a unified response.`
          }
        ],
        temperature: 0.2,
        max_tokens: 1200,
      });

      const synthesizedContent = response.choices[0]?.message?.content || agentResponses[0].content;
      
      const allSources = agentResponses.flatMap(r => r.sources);
      const uniqueSources = allSources.filter((source, index, array) => 
        array.findIndex(s => s.id === source.id) === index
      );

      const allQuestions = agentResponses.flatMap(r => r.followUpQuestions || []);
      const uniqueQuestions = Array.from(new Set(allQuestions)).slice(0, 3);

      const allActions = agentResponses.flatMap(r => r.suggestedActions || []);
      const uniqueActions = allActions.filter((action, index, array) => 
        array.findIndex(a => a.label === action.label) === index
      ).slice(0, 4);

      return {
        content: synthesizedContent,
        confidence: Math.round(agentResponses.reduce((sum, r) => sum + r.confidence, 0) / agentResponses.length),
        sources: uniqueSources,
        followUpQuestions: uniqueQuestions,
        suggestedActions: uniqueActions,
        agentName: 'synthesized',
        responseTime: Math.max(...agentResponses.map(r => r.responseTime)),
        tokenUsage: agentResponses.reduce((sum, r) => ({
          prompt: sum.prompt + r.tokenUsage.prompt,
          completion: sum.completion + r.tokenUsage.completion,
        }), { prompt: 0, completion: 0 }),
      };
    } catch (error) {
      console.error('Synthesis error:', error);
      return agentResponses[0];
    }
  }

  private async cacheResponse(query: string, response: EnhancedAgentResponse): Promise<void> {
    try {
      const queryHash = crypto.createHash('sha256').update(query.toLowerCase().trim()).digest('hex');
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      await storage.createQueryCache({
        queryHash,
        query,
        response: response.content,
        sources: response.sources,
        confidence: response.confidence,
        expiresAt,
      });
    } catch (error) {
      console.error('Cache storage error:', error);
    }
  }

  private async updateAgentSummaries(
    userId: string,
    courseId: string | undefined,
    query: string,
    response: EnhancedAgentResponse,
    agentsUsed: string[]
  ): Promise<void> {
    try {
      for (const agentType of agentsUsed) {
        const existingSummary = await storage.getChatSummary(userId, courseId, agentType);
        
        if (existingSummary) {
          const updatedSummary = `${existingSummary.summary}\n\nQ: ${query.slice(0, 100)}...\nA: ${response.content.slice(0, 200)}...`;
          
          await storage.updateChatSummary(existingSummary.id, {
            summary: updatedSummary.slice(-2000),
            messageCount: (existingSummary.messageCount || 0) + 1,
            tokenCount: (existingSummary.tokenCount || 0) + response.tokenUsage.prompt + response.tokenUsage.completion,
          });
        } else {
          await storage.createChatSummary({
            userId,
            courseId: courseId || null,
            agentType,
            summary: `Q: ${query.slice(0, 100)}...\nA: ${response.content.slice(0, 200)}...`,
            messageCount: 1,
            tokenCount: response.tokenUsage.prompt + response.tokenUsage.completion,
          });
        }
      }
    } catch (error) {
      console.error('Summary update error:', error);
    }
  }

  private calculateTotalTokenUsage(responses: EnhancedAgentResponse[]): any {
    return responses.reduce((total, response) => ({
      prompt: total.prompt + response.tokenUsage.prompt,
      completion: total.completion + response.tokenUsage.completion,
    }), { prompt: 0, completion: 0 });
  }

  private async logAnalytics(analytics: Partial<InsertRagAnalytics>): Promise<void> {
    try {
      await storage.createRagAnalytics({
        eventType: analytics.eventType || 'query',
        userId: analytics.userId || null,
        queryType: analytics.queryType || null,
        agentsUsed: analytics.agentsUsed || null,
        retrievalHits: analytics.retrievalHits || 0,
        confidence: analytics.confidence || 0,
        responseTime: analytics.responseTime || null,
        tokenUsage: analytics.tokenUsage || null,
        cacheHit: analytics.cacheHit || false,
        metadata: analytics.metadata || null,
      });
    } catch (error) {
      console.error('Analytics logging error:', error);
    }
  }

  async collectFeedback(
    userId: string,
    messageId: string,
    rating: number,
    feedbackType?: string,
    comments?: string,
    responseTime?: number
  ): Promise<void> {
    try {
      await storage.createResponseFeedback({
        userId,
        messageId,
        rating,
        feedbackType: feedbackType || null,
        comments: comments || null,
        responseTime: responseTime || null,
      });
    } catch (error) {
      console.error('Feedback collection error:', error);
    }
  }
}

export const enhancedRagOrchestrator = new EnhancedRagOrchestrator();