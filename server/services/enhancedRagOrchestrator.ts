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
      
      // Citation validation affects confidence but warnings are not shown to users
      if (!citationValidation.isValid && finalResponse.confidence && finalResponse.confidence > 60) {
        finalResponse.confidence = Math.max(citationValidation.confidence, 30);
        // Citation enforcement still works internally, but warning messages are not appended to user response
        // The citations themselves will still be displayed, just not the warning text
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
    
    // Enhance system prompt to emphasize citation requirements and prevent repetition
    const enhancedSystemPrompt = `${systemPrompt}

CRITICAL REQUIREMENTS:
1. You must reference and cite the source materials provided in your response. When mentioning information from the context, explicitly reference it (e.g., "According to the NICE guidelines provided..." or "As stated in the NHS documentation..."). This is essential for medical accuracy and compliance.
2. NEVER repeat the same sentence, phrase, or information twice in your response. Each sentence must be unique and add new value.
3. Keep responses concise and eliminate redundancy.`;

    try {
      // Get appropriate generation settings based on query analysis
      const generationSettings = getGenerationSettings(analysis.queryType);
      
      const response = await this.openai.chat.completions.create({
        model: generationSettings.model,
        messages: [
          { role: "system", content: enhancedSystemPrompt },
          { 
            role: "user", 
            content: `Context from authoritative sources: ${contextWindow}\n\nUser Role: ${user.role}\n\nQuery: ${query}\n\nProvide a comprehensive response based on the available context. Remember to cite the sources and include specific guidance from NICE, NHS, or CQC documentation when available.`
          }
        ],
        temperature: generationSettings.temperature,
        top_p: generationSettings.topP,
        max_tokens: generationSettings.maxTokens,
      });

      let content = response.choices[0]?.message?.content || '';
      
      // LOG RAW AI OUTPUT - Critical for debugging duplication source (INDIVIDUAL AGENT)
      console.log(`=== RAW AI OUTPUT ANALYSIS (${agentType.toUpperCase()}) ===`);
      console.log(`Raw ${agentType} AI response length:`, content.length);
      console.log(`Raw ${agentType} AI content (first 500 chars):`, JSON.stringify(content.substring(0, 500)));
      console.log(`Raw ${agentType} AI content (last 500 chars):`, JSON.stringify(content.substring(Math.max(0, content.length - 500))));
      
      // FORENSIC STRING ANALYSIS - Check for invisible characters
      const forensicAnalysis = this.findStringDifference(content);
      if (forensicAnalysis.hasIssues) {
        console.log(`FORENSIC ANALYSIS DETECTED ISSUES IN ${agentType.toUpperCase()}:`, {
          issues: forensicAnalysis.issues,
          invisibleCharCount: forensicAnalysis.invisibleChars.length,
          invisibleChars: forensicAnalysis.invisibleChars.slice(0, 10)
        });
        // Use forensically cleaned content
        content = forensicAnalysis.normalizedContent;
        console.log(`Using forensically normalized content for ${agentType}:`, content.length, 'chars');
      }
      
      // Apply deduplication to individual agent responses
      content = this.deduplicateContent(content);
      
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
      console.log('Single agent response - no synthesis needed. Agent:', agentResponses[0].agentName);
      return agentResponses[0];
    }

    if (!this.openai) {
      return agentResponses[0];
    }

    const agentOutputs = agentResponses.map(response => 
      `${response.agentName}: ${response.content}`
    ).join('\n\n---\n\n');

    try {
      // Get appropriate token limits based on query type
      const queryType = analysis.requiresSpecialistKnowledge ? 'clinical' : 'educational';
      const genSettings = getGenerationSettings(queryType);
      
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system", 
            content: `You are an expert healthcare information synthesizer. Your critical task:

CRITICAL ANTI-REPETITION RULES:
1. NEVER, under any circumstances, repeat the same sentence twice
2. NEVER duplicate any paragraph or section of text
3. Each piece of information must appear exactly ONCE in your response
4. If multiple sources say the same thing, combine into ONE unique sentence
5. Vary sentence structure completely - avoid any repetitive patterns
6. Do not restate information using different words
7. STOP writing immediately if you find yourself about to repeat something

RESPONSE STRUCTURE (NO REPETITION):
- Maximum ${genSettings.maxTokens} tokens
- Single cohesive response with unique sentences only
- Brief explanation → Practical example → Key steps → Next action
- Each sentence must add NEW information
- No redundant explanations or restatements

FINAL CHECK: Review your complete response. If ANY sentence appears twice or conveys the same information as another sentence, you have FAILED the task.`
          },
          {
            role: "user",
            content: `Query Type: ${analysis.queryType}\nComplexity: ${analysis.complexity}\n\nExpert Responses to synthesize:\n${agentOutputs}\n\nCreate ONE unified response with ZERO repetition. Each sentence must be unique and add new value.`
          }
        ],
        temperature: 0.05, // Extremely low temperature 
        max_tokens: Math.min(genSettings.maxTokens, 400), // Limit response length
        presence_penalty: 2.0, // Maximum possible penalty
        frequency_penalty: 2.0, // Maximum possible penalty  
        top_p: 0.5, // Very focused token selection
        stop: ["As there is no specific", "Carbon dioxide (CO2) is a", "As a care worker"], // Stop tokens to prevent repetition
      });

      let synthesizedContent = response.choices[0]?.message?.content || agentResponses[0].content;
      
      // LOG RAW AI OUTPUT - Critical for debugging duplication source
      console.log('=== RAW AI OUTPUT ANALYSIS ===');
      console.log('Raw AI response length:', synthesizedContent.length);
      console.log('Raw AI content (first 500 chars):', JSON.stringify(synthesizedContent.substring(0, 500)));
      console.log('Raw AI content (last 500 chars):', JSON.stringify(synthesizedContent.substring(Math.max(0, synthesizedContent.length - 500))));
      
      // FORENSIC STRING ANALYSIS - Check for invisible characters
      const forensicAnalysis = this.findStringDifference(synthesizedContent);
      if (forensicAnalysis.hasIssues) {
        console.log('FORENSIC ANALYSIS DETECTED ISSUES:', forensicAnalysis);
        // Use normalized content if issues were found
        synthesizedContent = forensicAnalysis.normalizedContent;
        console.log('Using forensically normalized content:', synthesizedContent.length, 'chars');
      }
      
      console.log('Pre-deduplication synthesized content length:', synthesizedContent.length);
      
      // Apply immediate aggressive deduplication to synthesized content
      synthesizedContent = this.aggressiveDeduplication(synthesizedContent);
      
      // Additional deduplication check for sentences
      synthesizedContent = this.deduplicateContent(synthesizedContent);
      
      console.log('Post-deduplication synthesized content length:', synthesizedContent.length);
      
      const allSources = agentResponses.flatMap(r => r.sources);
      const uniqueSources = allSources.filter((source, index, array) => 
        array.findIndex(s => s.id === source.id) === index
      );

      // Ensure citations are always included in the response
      if (uniqueSources.length > 0 && !synthesizedContent.includes('References') && !synthesizedContent.includes('Sources')) {
        const citationSection = this.formatCitationSection(uniqueSources);
        synthesizedContent += '\n\n' + citationSection;
      }

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

  private deduplicateContent(content: string): string {
    if (!content) return content;
    
    console.log('Deduplication input length:', content.length);
    console.log('Content preview:', content.substring(0, 200) + '...');
    
    // Additional forensic analysis for duplication tracing
    const hasNonAscii = /[^\x20-\x7E]/.test(content);
    const charCodes = content.split('').map(c => c.charCodeAt(0)).filter(c => c > 127).slice(0, 20);
    if (hasNonAscii) {
      console.log('Non-ASCII characters detected. First 20 codes:', charCodes);
    }
    
    // STEP 1: Ultra-aggressive exact duplication detection
    const words = content.split(/\s+/);
    if (words.length > 30) {
      // Check for word-level exact duplication with wide range
      for (let offset = -30; offset <= 30; offset++) {
        const splitPoint = Math.floor(words.length / 2) + offset;
        if (splitPoint < 10 || splitPoint > words.length - 10) continue;
        
        const firstWords = words.slice(0, splitPoint);
        const secondWords = words.slice(splitPoint);
        
        // Check for exact word sequence match
        if (firstWords.length > 20 && secondWords.length > 20) {
          const firstText = firstWords.join(' ').trim();
          const secondText = secondWords.join(' ').trim();
          
          // Direct text comparison (most accurate)
          if (firstText === secondText && firstText.length > 100) {
            console.log('EXACT WORD-FOR-WORD DUPLICATION DETECTED at offset', offset, '- Using first part only');
            return firstText;
          }
          
          // Check if second part starts with first part exactly
          if (secondText.startsWith(firstText.substring(0, Math.min(firstText.length, 500)))) {
            console.log('SUBSTRING DUPLICATION DETECTED at offset', offset, '- Using first part only');
            return firstText;
          }
          
          // Check for 95%+ similarity
          const similarity = this.calculateExactSimilarity(firstText, secondText);
          if (similarity > 0.95 && firstText.length > 200) {
            console.log('HIGH SIMILARITY DUPLICATION DETECTED at offset', offset, 'similarity:', similarity, '- Using first part only');
            return firstText;
          }
        }
      }
    }
    
    // Step 2: Remove exact consecutive duplicates with multiple regex patterns
    const originalLength = content.length;
    
    // Pattern 1: Large chunk duplication
    content = content.replace(/(.{50,}?)\s*\1+/gi, '$1');
    
    // Pattern 2: Sentence-ending duplication
    content = content.replace(/(.{30,}?[.!?])\s*\1+/gi, '$1');
    
    // Pattern 3: Paragraph-level duplication
    content = content.replace(/(.*?[.!?])\s*\1+/gi, '$1');
    
    if (content.length !== originalLength) {
      console.log('REGEX DUPLICATES REMOVED, reduced by:', originalLength - content.length, 'characters');
    }
    
    // Step 3: Enhanced sentence-level deduplication
    const sentenceParts = content.split(/([.!?]+)/);
    const rebuiltContent: string[] = [];
    const seenNormalized = new Set<string>();
    
    for (let i = 0; i < sentenceParts.length; i += 2) {
      const sentence = sentenceParts[i]?.trim();
      const punctuation = sentenceParts[i + 1] || '';
      
      if (!sentence || sentence.length < 15) {
        if (sentence) rebuiltContent.push(sentence + punctuation);
        continue;
      }
      
      // Aggressive normalization with forensic cleaning
      const normalized = sentence.toLowerCase()
        .replace(/[\u200B-\u200D\uFEFF\u2060\u2061]/g, '') // Remove zero-width chars
        .replace(/[\u00A0]/g, ' ') // Replace non-breaking spaces
        .replace(/[\u2000-\u200A\u202F\u205F\u3000]/g, ' ') // Replace unusual spaces
        .replace(/[^\w\s]/g, '')
        .replace(/\s+/g, ' ')
        .replace(/\b(the|a|an|and|or|but|in|on|at|to|for|of|with|by|is|are|was|were|that|this)\b/g, '')
        .trim();
      
      if (!seenNormalized.has(normalized)) {
        seenNormalized.add(normalized);
        rebuiltContent.push(sentence + punctuation);
      } else {
        console.log('Sentence duplicate removed:', sentence.substring(0, 50) + '...');
      }
    }
    
    const result = rebuiltContent.join('');
    console.log('Deduplication output length:', result.length, 'reduction:', Math.round((1 - result.length / content.length) * 100) + '%');
    
    // Final safety check for any remaining exact duplications
    return this.finalSafetyDeduplication(result);
  }

  private formatCitationSection(sources: any[]): string {
    if (sources.length === 0) return '';
    
    const citations = sources.map((source, index) => {
      const sourceNumber = index + 1;
      const title = source.title || 'Untitled Document';
      const type = source.type || 'Document';
      const url = source.url ? ` Available at: ${source.url}` : '';
      
      return `[${sourceNumber}] ${title} (${type})${url}`;
    }).join('\n');
    
    return `## References

${citations}

**Note**: All medical guidance should be verified with current NICE guidelines, NHS protocols, and your local care home policies. In emergencies, always call 999 and follow your facility's emergency procedures.`;
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

  private calculateExactSimilarity(text1: string, text2: string): number {
    if (!text1 || !text2) return 0;
    
    const words1 = text1.toLowerCase().split(/\s+/);
    const words2 = text2.toLowerCase().split(/\s+/);
    
    if (words1.length === 0 || words2.length === 0) return 0;
    
    // Calculate sequential word matches from the beginning
    let matches = 0;
    const minLength = Math.min(words1.length, words2.length);
    
    for (let i = 0; i < minLength; i++) {
      if (words1[i] === words2[i]) {
        matches++;
      } else {
        break; // Stop at first mismatch for more accurate similarity
      }
    }
    
    return matches / minLength;
  }
  
  private finalSafetyDeduplication(content: string): string {
    if (!content) return content;
    
    // Final brute-force check for exact repetition
    const lines = content.split('\n').filter(line => line.trim());
    const uniqueLines: string[] = [];
    const seenLines = new Set<string>();
    
    for (const line of lines) {
      const normalized = line.toLowerCase()
        .replace(/[\u200B-\u200D\uFEFF\u2060\u2061]/g, '') // Remove zero-width chars
        .replace(/[\u00A0]/g, ' ') // Replace non-breaking spaces
        .replace(/[\u2000-\u200A\u202F\u205F\u3000]/g, ' ') // Replace unusual spaces
        .replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
      if (normalized.length > 10 && !seenLines.has(normalized)) {
        seenLines.add(normalized);
        uniqueLines.push(line);
      } else if (normalized.length <= 10) {
        uniqueLines.push(line);
      }
    }
    
    return uniqueLines.join('\n');
  }

  private aggressiveDeduplication(content: string): string {
    if (!content) return content;
    
    console.log('AGGRESSIVE DEDUPLICATION - Input length:', content.length);
    
    // Step 1: Check for exact half-duplication (most common case)
    const normalizedContent = content.toLowerCase()
      .replace(/[\u200B-\u200D\uFEFF\u2060\u2061]/g, '') // Remove zero-width chars
      .replace(/[\u00A0]/g, ' ') // Replace non-breaking spaces
      .replace(/[\u2000-\u200A\u202F\u205F\u3000]/g, ' ') // Replace unusual spaces
      .replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
    const words = normalizedContent.split(' ');
    
    if (words.length > 40) {
      const halfPoint = Math.floor(words.length / 2);
      
      // Try multiple offsets around the midpoint
      for (let offset = -15; offset <= 15; offset++) {
        const splitPoint = halfPoint + offset;
        if (splitPoint < 10 || splitPoint > words.length - 10) continue;
        
        const firstHalf = words.slice(0, splitPoint).join(' ');
        const secondHalf = words.slice(splitPoint).join(' ');
        
        // Check for exact match
        if (firstHalf === secondHalf && firstHalf.length > 100) {
          console.log('EXACT HALF-DUPLICATION DETECTED at offset', offset, '- Using first half');
          const originalWords = content.split(' ');
          return originalWords.slice(0, splitPoint).join(' ').trim();
        }
        
        // Check for high similarity
        if (firstHalf.length > 100 && secondHalf.length > 100) {
          const similarity = this.calculateExactSimilarity(firstHalf, secondHalf);
          if (similarity > 0.9) {
            console.log('HIGH SIMILARITY HALF-DUPLICATION DETECTED at offset', offset, 'similarity:', similarity, '- Using first half');
            const originalWords = content.split(' ');
            return originalWords.slice(0, splitPoint).join(' ').trim();
          }
        }
      }
    }
    
    // Step 2: Remove consecutive exact duplicates
    let result = content;
    const patterns = [
      /(.{100,}?[.!?])\s*\1+/gi,  // Large sentence duplicates
      /(.{50,}?)\s*\1+/gi,        // Medium chunk duplicates
      /(.{30,}?[.!?])\s*\1+/gi    // Small sentence duplicates
    ];
    
    for (const pattern of patterns) {
      const beforeLength = result.length;
      result = result.replace(pattern, '$1');
      if (result.length < beforeLength) {
        console.log('Pattern duplicate removed, reduced by:', beforeLength - result.length, 'characters');
      }
    }
    
    console.log('AGGRESSIVE DEDUPLICATION - Output length:', result.length, 'reduction:', Math.round((1 - result.length / content.length) * 100) + '%');
    
    return result;
  }

  /**
   * Forensic String Analysis - Detects invisible characters and text anomalies
   * that might be breaking deduplication logic
   */
  private findStringDifference(content: string): {
    hasIssues: boolean;
    invisibleChars: Array<{char: string, code: number, position: number}>;
    normalizedContent: string;
    issues: string[];
  } {
    const issues: string[] = [];
    const invisibleChars: Array<{char: string, code: number, position: number}> = [];
    
    // Check for invisible/problematic characters
    for (let i = 0; i < content.length; i++) {
      const char = content[i];
      const charCode = char.charCodeAt(0);
      
      // Check for various invisible/problematic characters
      if (
        charCode === 8203 || // Zero-width space
        charCode === 8204 || // Zero-width non-joiner
        charCode === 8205 || // Zero-width joiner
        charCode === 65279 || // Byte order mark
        charCode === 8288 || // Word joiner
        charCode === 8289 || // Function application
        (charCode >= 8206 && charCode <= 8207) || // Left-to-right/Right-to-left marks
        (charCode >= 8234 && charCode <= 8238) || // Directional formatting characters
        charCode === 160 || // Non-breaking space
        charCode === 173 // Soft hyphen
      ) {
        invisibleChars.push({
          char: char,
          code: charCode,
          position: i
        });
      }
    }
    
    if (invisibleChars.length > 0) {
      issues.push(`Found ${invisibleChars.length} invisible characters`);
    }
    
    // Check for unusual whitespace patterns
    const unusualWhitespace = content.match(/[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g);
    if (unusualWhitespace) {
      issues.push(`Found ${unusualWhitespace.length} unusual whitespace characters`);
    }
    
    // Check for repeated identical chunks (forensic duplicate detection)
    const words = content.split(/\s+/);
    if (words.length > 20) {
      const midPoint = Math.floor(words.length / 2);
      const firstHalf = words.slice(0, midPoint).join(' ');
      const secondHalf = words.slice(midPoint).join(' ');
      
      if (firstHalf === secondHalf) {
        issues.push('Detected exact duplicate halves in content');
      } else if (secondHalf.startsWith(firstHalf.substring(0, 100))) {
        issues.push('Detected potential partial duplication pattern');
      }
    }
    
    // Normalize content by removing invisible characters
    const normalizedContent = content
      .replace(/[\u200B-\u200D\uFEFF\u2060\u2061]/g, '') // Remove zero-width chars
      .replace(/[\u00A0]/g, ' ') // Replace non-breaking spaces with regular spaces
      .replace(/[\u2000-\u200A\u202F\u205F\u3000]/g, ' ') // Replace unusual spaces
      .replace(/[\u00AD]/g, '') // Remove soft hyphens
      .replace(/[\u202A-\u202E]/g, '') // Remove directional marks
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
    
    return {
      hasIssues: issues.length > 0,
      invisibleChars,
      normalizedContent,
      issues
    };
  }
}

export const enhancedRagOrchestrator = new EnhancedRagOrchestrator();