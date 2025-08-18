import OpenAI from 'openai';
import { vectorStore } from './vectorStore';
import { storage } from '../storage';
import { RAG_CONFIG, getGenerationSettings, shouldEscalateToHuman, validateCitations } from '../config/ragConfiguration';
import { nlpIntentDetector } from './nlpIntentDetector';
import { enhancedHybridSearch } from './enhancedHybridSearch';
import { humanEscalationService } from './humanEscalationService';
import { enhancedCitationService } from './enhancedCitationService';
import { enhancedMultiAgentSystem } from './enhancedMultiAgentSystem';
import { enhancedConfidenceCalculator } from './enhancedConfidenceCalculator';
import type { 
  User, ChatResponse, InsertRagAnalytics, InsertChatSummary, InsertQueryCache, 
  InsertIntentClassification, InsertResponseFeedback 
} from '@shared/schema';
import crypto from 'crypto';

interface SuperEnhancedQueryAnalysis {
  intent: string;
  queryType: 'faq' | 'educational' | 'clinical' | 'emergency';
  entities: string[];
  linkedKGNodes: Array<{ id: string; name: string; type: string }>;
  expandedTerms: {
    synonyms: string[];
    relatedConcepts: string[];
    contraindications: string[];
    ageGroups: string[];
  };
  complexity: 'simple' | 'moderate' | 'complex';
  requiresSpecialistKnowledge: boolean;
  requiresComplianceCheck: boolean;
  suggestedFilters: Record<string, any>;
  confidence: number;
}

interface SuperEnhancedRetrievalResult {
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
    source: string;
    docType: string;
    metadata: Record<string, any>;
    llmScore?: number;
    llmReasoning?: string;
  }>;
  kgFacts: Array<{
    id: string;
    triple: string;
    confidence: number;
    provenance: string;
  }>;
  totalRetrieved: number;
  fusionMethod: 'bm25_vector_rerank' | 'vector_only' | 'bm25_only';
  rerankerUsed: boolean;
  cacheHit: boolean;
}

interface SuperEnhancedAgentResponse {
  finalContent: string;
  debateRounds: Array<{
    round: string;
    agent: string;
    content: string;
    confidence: number;
    flags: string[];
  }>;
  consensusReached: boolean;
  confidence: number;
  citations: string[];
  flags: string[];
  processingTime: number;
}

export class SuperEnhancedRagOrchestrator {
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
      console.log(`🚀 Super Enhanced RAG processing: "${query}"`);
      
      // Step 1: Enhanced Query Analysis with KG Entity Linking
      const analysis = await this.performSuperEnhancedAnalysis(query, conversationHistory);
      console.log(`🔍 Analysis: ${analysis.queryType}, complexity: ${analysis.complexity}, entities: ${analysis.entities.length}`);

      // Step 2: Emergency Detection (existing logic)
      const intentAnalysis = await nlpIntentDetector.analyzeIntent(query, conversationHistory?.join('\n'));
      const emergencyCheck = {
        isEmergency: intentAnalysis.isEmergency,
        confidence: intentAnalysis.confidence,
        detectedKeywords: intentAnalysis.emergencyKeywords || []
      };

      if (emergencyCheck.isEmergency && emergencyCheck.confidence > RAG_CONFIG.safety.emergencyDetection.confidenceThreshold) {
        return this.handleEmergencyQuery(query, emergencyCheck);
      }

      // Step 3: Enhanced Hybrid Retrieval (BM25 + Vector + KG + Reranker)
      const retrievalResult = await this.performSuperEnhancedRetrieval(query, analysis);
      console.log(`📚 Retrieved: ${retrievalResult.sources.length} sources, ${retrievalResult.kgFacts.length} KG facts`);

      // Step 4: Multi-Agent Debate Processing
      const agentResponse = await this.performMultiAgentDebate(query, analysis, retrievalResult);
      console.log(`🤖 Agent consensus: ${agentResponse.consensusReached}, confidence: ${agentResponse.confidence}%`);

      // Step 5: Enhanced Citation Enforcement with Fact-Checking
      const citationResult = await enhancedCitationService.enforceInlineCitations(
        agentResponse.finalContent,
        retrievalResult.sources,
        retrievalResult.kgFacts
      );
      console.log(`📝 Citations: ${citationResult.citations.length}, fact-check confidence: ${citationResult.confidenceScore}%`);

      // Step 6: Enhanced Confidence Calculation
      const confidenceResult = enhancedConfidenceCalculator.calculateResponseConfidence(
        retrievalResult.sources,
        retrievalResult.kgFacts,
        retrievalResult.sources.map(s => s.llmScore || 5),
        agentResponse.debateRounds.map(r => ({ agent: r.agent, confidence: r.confidence, hasDisagreement: r.flags.length > 0, consensusReached: true })),
        query,
        citationResult.content
      );
      console.log(`📊 Final confidence: ${confidenceResult.score}% (${confidenceResult.level})`);

      // Step 7: Escalation Decision
      if (confidenceResult.escalationRequired) {
        console.log(`🚨 Escalating to human: ${confidenceResult.escalationType}`);
        try {
          if (humanEscalationService?.escalateQuery) {
            await humanEscalationService.escalateQuery(
              query,
              user.id,
              confidenceResult.evidencePacket,
              confidenceResult.score
            );
          } else {
            console.log('📝 Human escalation service not available, logging for review');
          }
        } catch (escalationError) {
          console.error('Human escalation failed:', escalationError);
        }
      }

      // Step 8: Final Response Assembly
      const finalResponse = await this.assembleFinalResponse(
        query,
        citationResult,
        confidenceResult,
        retrievalResult,
        agentResponse,
        analysis
      );

      // Step 9: Analytics and Caching
      await this.recordAnalytics(query, user.id, analysis, retrievalResult, confidenceResult, Date.now() - startTime);

      console.log(`✅ Super Enhanced RAG complete in ${Date.now() - startTime}ms`);
      
      return finalResponse;

    } catch (error) {
      console.error('Super Enhanced RAG error:', error);
      
      // Fallback to basic response
      return {
        content: "I apologize, but I'm having difficulty processing your query at the moment. Please try rephrasing your question or contact support if the issue persists.",
        sources: [],
        confidence: 0,
        followUpQuestions: [],
        suggestedActions: [],
        processingTimeMs: Date.now() - startTime,
        debugInfo: {
          error: error instanceof Error ? error.message : 'Unknown error',
          stage: 'super_enhanced_rag',
          fallback: true
        }
      };
    }
  }

  /**
   * Enhanced query analysis with KG entity linking and expansion
   */
  private async performSuperEnhancedAnalysis(
    query: string, 
    conversationHistory?: string[]
  ): Promise<SuperEnhancedQueryAnalysis> {
    try {
      // Base analysis
      const baseAnalysis = await nlpIntentDetector.analyzeIntent(query, conversationHistory?.join('\n'));

      // Entity linking to KG
      const entities = await storage.getEntities();
      const linkedNodes: Array<{ id: string; name: string; type: string }> = [];
      const queryTokens = query.toLowerCase().split(/\s+/);

      for (const entity of entities) {
        const entityTokens = entity.name.toLowerCase().split(/\s+/);
        const hasMatch = entityTokens.some(token => queryTokens.includes(token));
        
        if (hasMatch) {
          linkedNodes.push({
            id: entity.id,
            name: entity.name,
            type: entity.type
          });
        }
      }

      // KG expansion
      const expandedTerms = await this.expandQueryWithKnowledgeGraph(linkedNodes);

      return {
        intent: baseAnalysis.intent || 'general_inquiry',
        queryType: baseAnalysis.queryType || 'educational',
        entities: baseAnalysis.entities || [],
        linkedKGNodes: linkedNodes,
        expandedTerms,
        complexity: baseAnalysis.complexity || 'moderate',
        requiresSpecialistKnowledge: baseAnalysis.requiresSpecialistKnowledge || false,
        requiresComplianceCheck: baseAnalysis.requiresComplianceCheck || true,
        suggestedFilters: baseAnalysis.suggestedFilters || {},
        confidence: baseAnalysis.confidence || 75
      };

    } catch (error) {
      console.error('Enhanced analysis error:', error);
      // Fallback to basic analysis
      return {
        intent: 'general_inquiry',
        queryType: 'educational',
        entities: [],
        linkedKGNodes: [],
        expandedTerms: { synonyms: [], relatedConcepts: [], contraindications: [], ageGroups: [] },
        complexity: 'moderate',
        requiresSpecialistKnowledge: false,
        requiresComplianceCheck: true,
        suggestedFilters: {},
        confidence: 50
      };
    }
  }

  /**
   * Expand query using knowledge graph relationships
   */
  private async expandQueryWithKnowledgeGraph(
    linkedNodes: Array<{ id: string; name: string; type: string }>
  ): Promise<{
    synonyms: string[];
    relatedConcepts: string[];
    contraindications: string[];
    ageGroups: string[];
  }> {
    const expansion = {
      synonyms: [] as string[],
      relatedConcepts: [] as string[],
      contraindications: [] as string[],
      ageGroups: [] as string[]
    };

    try {
      for (const node of linkedNodes.slice(0, 5)) { // Limit to prevent excessive expansion
        const relationships = await storage.getEntityRelationships(node.id);
        const entities = await storage.getEntities();
        
        for (const rel of relationships) {
          const relatedEntity = entities.find(e => e.id === rel.toEntityId);
          if (!relatedEntity) continue;

          switch (rel.relationshipType.toLowerCase()) {
            case 'synonym':
            case 'alternative_name':
              if (expansion.synonyms.length < 5) {
                expansion.synonyms.push(relatedEntity.name);
              }
              break;
            case 'treats':
            case 'related_to':
            case 'associated_with':
            case 'monitors':
              if (expansion.relatedConcepts.length < 5) {
                expansion.relatedConcepts.push(relatedEntity.name);
              }
              break;
            case 'contraindicated_in':
            case 'adverse_effect':
              if (expansion.contraindications.length < 3) {
                expansion.contraindications.push(relatedEntity.name);
              }
              break;
            case 'age_group':
            case 'population':
              if (expansion.ageGroups.length < 3) {
                expansion.ageGroups.push(relatedEntity.name);
              }
              break;
          }
        }
      }
    } catch (error) {
      console.error('KG expansion error:', error);
    }

    return expansion;
  }

  /**
   * Super enhanced retrieval with hybrid search and reranking
   */
  private async performSuperEnhancedRetrieval(
    query: string,
    analysis: SuperEnhancedQueryAnalysis
  ): Promise<SuperEnhancedRetrievalResult> {
    try {
      // Perform enhanced hybrid search with KG expansion and LLM reranking
      const searchResults = await enhancedHybridSearch.search(query, {
        topK: RAG_CONFIG.retrieval.topK,
        minScore: RAG_CONFIG.retrieval.minScore,
        bm25Weight: RAG_CONFIG.retrieval.bm25Weight,
        embeddingWeight: RAG_CONFIG.retrieval.embeddingWeight,
        filters: analysis.suggestedFilters,
        boostRecent: analysis.queryType === 'clinical',
        useKGExpansion: true,
        useLLMReranker: true,
        queryType: analysis.queryType
      });

      // Get KG facts for linked entities
      const kgFacts: Array<{ id: string; triple: string; confidence: number; provenance: string }> = [];
      
      for (const node of analysis.linkedKGNodes.slice(0, 10)) {
        const relationships = await storage.getEntityRelationships(node.id);
        const entities = await storage.getEntities();
        
        for (const rel of relationships.slice(0, 3)) {
          const toEntity = entities.find(e => e.id === rel.toEntityId);
          if (toEntity) {
            kgFacts.push({
              id: `kg-${rel.id}`,
              triple: `${node.name} ${rel.relationshipType} ${toEntity.name}`,
              confidence: rel.confidence || 80,
              provenance: rel.source || 'knowledge_graph'
            });
          }
        }
      }

      return {
        sources: searchResults,
        kgFacts,
        totalRetrieved: searchResults.length,
        fusionMethod: searchResults.length > 0 ? 'bm25_vector_rerank' : 'vector_only',
        rerankerUsed: searchResults.some(s => s.llmScore !== undefined),
        cacheHit: false // TODO: implement caching
      };

    } catch (error) {
      console.error('Enhanced retrieval error:', error);
      return {
        sources: [],
        kgFacts: [],
        totalRetrieved: 0,
        fusionMethod: 'vector_only',
        rerankerUsed: false,
        cacheHit: false
      };
    }
  }

  /**
   * Multi-agent debate processing
   */
  private async performMultiAgentDebate(
    query: string,
    analysis: SuperEnhancedQueryAnalysis,
    retrievalResult: SuperEnhancedRetrievalResult
  ): Promise<SuperEnhancedAgentResponse> {
    try {
      const context = {
        query,
        queryType: analysis.queryType,
        structuredFacts: retrievalResult.kgFacts,
        evidencePassages: retrievalResult.sources.slice(0, 12).map(source => ({
          id: source.id,
          content: source.excerpt,
          source: `${source.source} - ${source.title}`,
          score: source.score,
          metadata: source.metadata
        }))
      };

      const debateResult = await enhancedMultiAgentSystem.processWithDebate(context);

      return {
        finalContent: debateResult.finalContent,
        debateRounds: debateResult.debateRounds.flatMap(round => 
          round.responses.map(response => ({
            round: round.round,
            agent: response.agent,
            content: response.content,
            confidence: response.confidence,
            flags: response.flags
          }))
        ),
        consensusReached: debateResult.consensusReached,
        confidence: debateResult.confidence,
        citations: debateResult.citations,
        flags: debateResult.flags,
        processingTime: debateResult.processingTime
      };

    } catch (error) {
      console.error('Multi-agent debate error:', error);
      // Fallback to simple response generation
      return {
        finalContent: "I apologize, but I'm having difficulty generating a comprehensive response. Please try rephrasing your question.",
        debateRounds: [],
        consensusReached: false,
        confidence: 30,
        citations: [],
        flags: ['agent_processing_failed'],
        processingTime: 0
      };
    }
  }

  /**
   * Handle emergency queries with immediate response
   */
  private handleEmergencyQuery(query: string, emergencyCheck: any): ChatResponse {
    return {
      content: `🚨 **MEDICAL EMERGENCY DETECTED**

This appears to be a medical emergency situation. Please take immediate action:

1. **Call emergency services immediately**: 999 (UK) or your local emergency number
2. **If in a care facility**: Contact the on-duty nurse or physician immediately
3. **Follow established emergency protocols** for your facility

**Important**: This AI system cannot provide emergency medical treatment. Only qualified medical professionals can assess and treat emergency conditions.

If this is not an emergency, please rephrase your question to be more specific about the information you're seeking.

---
*Emergency detection confidence: ${Math.round(emergencyCheck.confidence * 100)}%*
*Keywords detected: ${emergencyCheck.detectedKeywords.join(', ')}*`,
      sources: [],
      confidence: 95,
      followUpQuestions: [
        "What are the emergency protocols in our care facility?",
        "How do I contact emergency services?",
        "What information should I gather before calling for help?"
      ],
      suggestedActions: [
        { label: "Call 999", action: "emergency_call", url: "tel:999" },
        { label: "Emergency Protocols", action: "view_protocols", url: "/emergency-protocols" }
      ],
      processingTimeMs: 50,
      debugInfo: {
        emergencyDetected: true,
        confidence: emergencyCheck.confidence
      }
    };
  }

  /**
   * Assemble final response with all enhancements
   */
  private async assembleFinalResponse(
    query: string,
    citationResult: any,
    confidenceResult: any,
    retrievalResult: SuperEnhancedRetrievalResult,
    agentResponse: SuperEnhancedAgentResponse,
    analysis: SuperEnhancedQueryAnalysis
  ): Promise<ChatResponse> {
    
    // Generate follow-up questions based on context
    const followUpQuestions = this.generateContextualFollowUps(query, analysis, retrievalResult);

    // Generate suggested actions
    const suggestedActions = this.generateSuggestedActions(analysis, retrievalResult);

    // Add confidence banner if needed
    let finalContent = citationResult.content;
    if (confidenceResult.level === 'medium') {
      finalContent = `⚠️ **Please Note**: This response has moderate confidence. Consider consulting with a healthcare professional for complex cases.\n\n${finalContent}`;
    } else if (confidenceResult.level === 'low') {
      finalContent = `⚠️ **Caution**: This response has lower confidence. Professional medical review is recommended.\n\n${finalContent}`;
    }

    // Add citation references
    if (citationResult.citations.length > 0) {
      finalContent += '\n\n**Sources:**\n';
      citationResult.citations.forEach((citation: any) => {
        finalContent += `${citation.inlineRef} ${citation.fullReference}\n`;
      });
    }

    return {
      content: finalContent,
      sources: retrievalResult.sources.slice(0, 8), // Top 8 sources for display
      confidence: confidenceResult.score,
      followUpQuestions,
      suggestedActions,
      processingTimeMs: agentResponse.processingTime,
      debugInfo: {
        queryType: analysis.queryType,
        complexity: analysis.complexity,
        entitiesFound: analysis.entities.length,
        kgFactsUsed: retrievalResult.kgFacts.length,
        consensusReached: agentResponse.consensusReached,
        citationCount: citationResult.citations.length,
        confidenceLevel: confidenceResult.level,
        escalationRequired: confidenceResult.escalationRequired,
        enhancedRAG: true
      }
    };
  }

  /**
   * Generate contextual follow-up questions
   */
  private generateContextualFollowUps(
    query: string,
    analysis: SuperEnhancedQueryAnalysis,
    retrievalResult: SuperEnhancedRetrievalResult
  ): string[] {
    const followUps: string[] = [];

    // Based on query type
    switch (analysis.queryType) {
      case 'clinical':
        followUps.push(
          "What are the contraindications for this treatment?",
          "How should I monitor the patient's response?",
          "When should I escalate to a healthcare professional?"
        );
        break;
      case 'educational':
        followUps.push(
          "Can you provide a practical example?",
          "What are the key points to remember?",
          "How can I explain this to patients or families?"
        );
        break;
      case 'faq':
        followUps.push(
          "Are there any exceptions to this guidance?",
          "How often should this be reviewed?",
          "What documentation is required?"
        );
        break;
    }

    // Based on entities found
    if (analysis.entities.some(e => e.toLowerCase().includes('diabetes'))) {
      followUps.push("What are the signs of diabetic complications I should watch for?");
    }

    if (analysis.entities.some(e => e.toLowerCase().includes('medication'))) {
      followUps.push("How do I handle medication errors or missed doses?");
    }

    return followUps.slice(0, 3); // Limit to 3 follow-ups
  }

  /**
   * Generate suggested actions based on context
   */
  private generateSuggestedActions(
    analysis: SuperEnhancedQueryAnalysis,
    retrievalResult: SuperEnhancedRetrievalResult
  ): Array<{ label: string; action: string; url?: string }> {
    const actions: Array<{ label: string; action: string; url?: string }> = [];

    // Standard actions based on query type
    if (analysis.queryType === 'clinical') {
      actions.push(
        { label: "View Care Protocols", action: "view_protocols", url: "/protocols" },
        { label: "Contact Supervisor", action: "contact_supervisor" }
      );
    }

    // Actions based on sources found
    const niceGuidelinesSources = retrievalResult.sources.filter(s => s.source === 'NICE');
    if (niceGuidelinesSources.length > 0) {
      actions.push(
        { label: "View NICE Guidelines", action: "view_nice_guidelines", url: "/guidelines/nice" }
      );
    }

    // Educational actions
    if (analysis.queryType === 'educational') {
      actions.push(
        { label: "Take Related Quiz", action: "take_quiz", url: "/quiz" },
        { label: "Bookmark This Topic", action: "bookmark_topic" }
      );
    }

    return actions.slice(0, 4); // Limit to 4 actions
  }

  /**
   * Record comprehensive analytics
   */
  private async recordAnalytics(
    query: string,
    userId: string,
    analysis: SuperEnhancedQueryAnalysis,
    retrievalResult: SuperEnhancedRetrievalResult,
    confidenceResult: any,
    processingTime: number
  ): Promise<void> {
    try {
      await storage.createRagAnalytics({
        userId,
        query,
        queryType: analysis.queryType,
        confidence: confidenceResult.score,
        sourcesRetrieved: retrievalResult.totalRetrieved,
        processingTimeMs: processingTime,
        escalatedToHuman: confidenceResult.escalationRequired,
        metadata: {
          enhanced: true,
          complexity: analysis.complexity,
          entitiesFound: analysis.entities.length,
          kgFactsUsed: retrievalResult.kgFacts.length,
          fusionMethod: retrievalResult.fusionMethod,
          rerankerUsed: retrievalResult.rerankerUsed,
          confidenceLevel: confidenceResult.level,
          expandedTermsCount: Object.values(analysis.expandedTerms).flat().length
        }
      });
    } catch (error) {
      console.error('Analytics recording error:', error);
    }
  }
}

export const superEnhancedRagOrchestrator = new SuperEnhancedRagOrchestrator();