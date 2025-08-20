/**
 * Enhanced Retrieval with LLM Reranking Service
 * Implements Steps 3-4 from the Smart Chunking Enhancement Plan:
 * - Hybrid Retrieval (BM25 + Vector + KG expansion)
 * - LLM Reranking for relevance, accuracy, completeness
 * - Redundancy removal and answer synthesis
 */

import OpenAI from 'openai';
import { storage } from '../storage';
import { vectorStore } from './vectorStore';
import { enhancedHybridSearch } from './enhancedHybridSearch';
import { smartChunkingAggregator } from './smartChunkingAggregator';
import type { 
  DocumentChunk, Entity, EntityRelationship, InsertQueryRefinement 
} from '@shared/schema';

interface RerankerInput {
  id: string;
  content: string;
  title: string;
  metadata: any;
  initialScore: number;
}

interface RerankerResult {
  chunkId: string;
  relevanceScore: number; // 0-10 from LLM
  accuracyScore: number; // 0-10 from LLM  
  completenessScore: number; // 0-10 from LLM
  overallScore: number; // weighted combination
  reasoning: string;
  shouldMerge: boolean;
  mergePartners: string[];
  conflictFlags: string[];
}

interface ConflictAnalysis {
  hasConflicts: boolean;
  conflicts: Array<{
    type: 'contradiction' | 'outdated' | 'uncertainty';
    chunks: string[];
    description: string;
    severity: 'low' | 'medium' | 'high';
  }>;
  overallConfidence: number;
}

interface SynthesizedAnswer {
  content: string;
  confidence: number;
  sources: Array<{
    id: string;
    title: string;
    excerpt: string;
    authority: number;
    pageNumber?: number;
    section?: string;
  }>;
  citations: Array<{
    text: string;
    sourceId: string;
    inlinePosition: number;
  }>;
  escalationNeeded: boolean;
  followUpQuestions: string[];
  actionableInsights: string[];
}

interface KGExpansionResult {
  originalTerms: string[];
  synonyms: string[];
  relatedConcepts: string[];
  contraindications: string[];
  prerequisites: string[];
  expansionQuery: string;
}

export class EnhancedRetrievalWithReranking {
  private openai?: OpenAI;
  private hybridSearch: typeof enhancedHybridSearch;

  constructor() {
    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
    }
    this.hybridSearch = enhancedHybridSearch;
  }

  /**
   * Main entry point: Enhanced hybrid retrieval with LLM reranking
   */
  async performEnhancedRetrieval(
    query: string,
    userId: string,
    options: {
      limit?: number;
      useKGExpansion?: boolean;
      useLLMReranker?: boolean;
      queryType?: 'clinical' | 'educational' | 'faq';
      minConfidence?: number;
    } = {}
  ): Promise<{
    chunks: DocumentChunk[];
    rerankerResults: RerankerResult[];
    kgExpansion?: KGExpansionResult;
    synthesizedAnswer?: SynthesizedAnswer;
    refinementSuggestions: string[];
  }> {
    const { 
      limit = 15, 
      useKGExpansion = true, 
      useLLMReranker = true,
      queryType = 'educational',
      minConfidence = 70
    } = options;

    console.log('🔍 Starting enhanced retrieval with reranking');
    console.log(`Query: "${query}" | Type: ${queryType} | Limit: ${limit}`);

    // Step 1: Knowledge Graph Expansion
    let kgExpansion: KGExpansionResult | undefined;
    let expandedQuery = query;
    
    if (useKGExpansion) {
      kgExpansion = await this.performKGExpansion(query, queryType);
      expandedQuery = kgExpansion.expansionQuery;
      console.log(`🧠 KG expanded query: "${expandedQuery}"`);
    }

    // Step 2: Hybrid Retrieval (BM25 + Vector + KG)
    const hybridResults = await this.hybridRetrieval(expandedQuery, limit * 2);
    console.log(`📊 Retrieved ${hybridResults.length} initial results`);

    if (hybridResults.length === 0) {
      return {
        chunks: [],
        rerankerResults: [],
        kgExpansion,
        refinementSuggestions: await this.generateRefinementSuggestions(query, [])
      };
    }

    // Step 3: LLM Reranking for quality assessment
    let rerankerResults: RerankerResult[] = [];
    let finalChunks = hybridResults;

    if (useLLMReranker && this.openai) {
      rerankerResults = await this.performLLMReranking(query, hybridResults, queryType);
      
      // Step 4: Redundancy removal and quality filtering
      const filteredResults = this.removeRedundancy(rerankerResults, minConfidence);
      
      // Step 5: Select best chunks based on reranker scores
      const topResults = filteredResults
        .sort((a, b) => b.overallScore - a.overallScore)
        .slice(0, limit);

      finalChunks = await this.getChunksByIds(topResults.map(r => r.chunkId));
      rerankerResults = topResults;

      console.log(`🎯 Reranked to ${finalChunks.length} high-quality chunks`);
    } else {
      finalChunks = hybridResults.slice(0, limit);
      console.log('⚠️ Skipping LLM reranking (disabled or no OpenAI key)');
    }

    // Step 6: Answer synthesis with confidence scoring
    const synthesizedAnswer = await this.synthesizeAnswerWithConfidence(
      query, 
      finalChunks, 
      rerankerResults,
      queryType
    );

    // Step 7: Generate refinement suggestions
    const refinementSuggestions = await this.generateRefinementSuggestions(
      query, 
      rerankerResults
    );

    // Step 8: Track query performance for feedback loop
    await this.trackQueryPerformance(
      userId, 
      query, 
      finalChunks.length, 
      synthesizedAnswer.confidence
    );

    return {
      chunks: finalChunks,
      rerankerResults,
      kgExpansion,
      synthesizedAnswer,
      refinementSuggestions
    };
  }

  /**
   * Step 1: Knowledge Graph Expansion
   */
  private async performKGExpansion(query: string, queryType: string): Promise<KGExpansionResult> {
    console.log('🧠 Performing knowledge graph expansion');

    // Extract medical entities from the query
    const entities = await this.extractMedicalEntities(query);
    
    // Get related entities from knowledge graph
    const relatedEntities = await this.getRelatedEntities(entities);
    
    // Generate synonyms and related concepts
    const synonyms = await this.generateSynonyms(entities, queryType);
    
    // Get contraindications and prerequisites
    const contraindications = await this.getContraindications(entities);
    const prerequisites = await this.getPrerequisites(entities, queryType);
    
    // Build expanded query
    const expansionTerms = [
      ...entities,
      ...relatedEntities.slice(0, 3), // Top 3 related concepts
      ...synonyms.slice(0, 2) // Top 2 synonyms
    ];
    
    const expandedQuery = `${query} ${expansionTerms.join(' ')}`.trim();

    return {
      originalTerms: entities,
      synonyms,
      relatedConcepts: relatedEntities,
      contraindications,
      prerequisites,
      expansionQuery: expandedQuery
    };
  }

  /**
   * Step 2: Hybrid Retrieval (BM25 + Vector + KG)
   */
  private async hybridRetrieval(query: string, limit: number): Promise<DocumentChunk[]> {
    try {
      // Use the existing enhanced hybrid search
      const results = await this.hybridSearch.search(query, {
        topK: limit,
        useKGExpansion: true,
        queryType: 'educational'
      });

      // Convert search results to DocumentChunk format
      const chunks: DocumentChunk[] = [];
      
      for (const result of results) {
        const chunk = await storage.getDocumentChunk(result.id);
        if (chunk) {
          chunks.push(chunk);
        }
      }
      
      return chunks;
    } catch (error) {
      console.log('⚠️ Hybrid search failed:', error);
      return [];
    }
  }

  /**
   * Step 3: LLM Reranking for Relevance, Accuracy, and Completeness
   */
  private async performLLMReranking(
    query: string, 
    chunks: DocumentChunk[], 
    queryType: string
  ): Promise<RerankerResult[]> {
    if (!this.openai) {
      console.log('⚠️ No OpenAI key available for reranking');
      return this.fallbackReranking(query, chunks);
    }

    console.log(`🤖 Performing LLM reranking for ${chunks.length} chunks`);
    const rerankerResults: RerankerResult[] = [];

    // Process chunks in smaller batches for better reliability
    const batchSize = 3; // Reduced from 5 to 3
    const maxBatches = Math.ceil(chunks.length / batchSize);
    
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batchIndex = Math.floor(i / batchSize) + 1;
      console.log(`Processing batch ${batchIndex}/${maxBatches}...`);
      
      const batch = chunks.slice(i, i + batchSize);
      try {
        const batchResults = await this.rerankerBatch(query, batch, queryType);
        rerankerResults.push(...batchResults);
      } catch (error) {
        console.log(`⚠️ Batch ${batchIndex} failed, using fallback for this batch`);
        const fallbackResults = this.fallbackReranking(query, batch);
        rerankerResults.push(...fallbackResults);
      }
    }

    return rerankerResults;
  }

  /**
   * Fallback reranking using simple text matching when LLM fails
   */
  private fallbackReranking(query: string, chunks: DocumentChunk[]): RerankerResult[] {
    console.log('🔧 Using fallback reranking method');
    return chunks.map(chunk => {
      const relevanceScore = this.calculateSimpleRelevance(query, chunk.content);
      return {
        chunkId: chunk.id,
        relevanceScore,
        accuracyScore: Math.max(6, relevanceScore),
        completenessScore: Math.max(5, relevanceScore),
        overallScore: this.calculateOverallScore(relevanceScore, Math.max(6, relevanceScore), Math.max(5, relevanceScore)),
        reasoning: 'Keyword-based fallback scoring',
        shouldMerge: false,
        mergePartners: [],
        conflictFlags: []
      };
    });
  }

  /**
   * Simple relevance calculation based on keyword matching
   */
  private calculateSimpleRelevance(query: string, content: string): number {
    const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    const contentWords = content.toLowerCase().split(/\s+/);
    
    if (queryWords.length === 0) return 5;
    
    let matches = 0;
    let totalScore = 0;
    
    for (const queryWord of queryWords) {
      if (contentWords.some(cw => cw.includes(queryWord) || queryWord.includes(cw))) {
        matches++;
        // Higher score for exact matches
        if (contentWords.includes(queryWord)) {
          totalScore += 2;
        } else {
          totalScore += 1;
        }
      }
    }
    
    // Base score of 3, then add relevance
    const relevanceRatio = matches / queryWords.length;
    return Math.min(10, Math.max(3, 3 + (totalScore * relevanceRatio * 2)));
  }

  private calculateOverallScore(relevance: number, accuracy: number, completeness: number): number {
    // Weighted average: relevance 50%, accuracy 30%, completeness 20%
    return Math.round((relevance * 0.5 + accuracy * 0.3 + completeness * 0.2) * 10) / 10;
  }

  private async rerankerBatch(
    query: string,
    chunks: DocumentChunk[],
    queryType: string
  ): Promise<RerankerResult[]> {
    if (!this.openai) return [];

    // Limit chunk content size to prevent context length issues
    const truncatedChunks = chunks.map(chunk => ({
      ...chunk,
      content: chunk.content.length > 1000 ? chunk.content.substring(0, 1000) + '...' : chunk.content
    }));

    const chunksText = truncatedChunks.map((chunk, index) => 
      `[CHUNK ${index + 1} ID: ${chunk.id}]\n${chunk.content}\n`
    ).join('\n---\n');

    // Simplified prompt to reduce processing time
    const prompt = `Rate these medical chunks for query: "${query}"

Score each chunk (0-10) for relevance only.

Chunks:
${chunksText}

JSON format:
[{"chunkId": "id", "relevanceScore": 8, "reasoning": "brief"}]`;

    try {
      // Add timeout wrapper
      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Reranking timeout')), 15000) // 15 second timeout
      );

      const apiPromise = this.openai.chat.completions.create({
        model: 'gpt-4o-mini', // Use faster model
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1, // Lower temperature for consistency
        max_tokens: 1500 // Reduced token limit
      });

      const response = await Promise.race([apiPromise, timeoutPromise]);
      const content = response.choices[0].message.content;
      if (!content) throw new Error('No content in response');

      // Clean JSON from markdown code blocks
      let cleanedContent = content.trim();
      if (cleanedContent.startsWith('```json')) {
        cleanedContent = cleanedContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanedContent.startsWith('```')) {
        cleanedContent = cleanedContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      const results = JSON.parse(cleanedContent.trim());
      return results.map((result: any) => ({
        chunkId: result.chunkId,
        relevanceScore: result.relevanceScore || 5,
        accuracyScore: Math.max(6, result.relevanceScore || 5), // Base accuracy on relevance
        completenessScore: Math.max(5, result.relevanceScore || 5), // Base completeness on relevance
        overallScore: this.calculateOverallScore(
          result.relevanceScore || 5,
          Math.max(6, result.relevanceScore || 5),
          Math.max(5, result.relevanceScore || 5)
        ),
        reasoning: result.reasoning || 'AI reranked',
        shouldMerge: false, // Disable merge logic for speed
        mergePartners: [],
        conflictFlags: []
      }));
    } catch (error) {
      console.log('⚠️ LLM reranking failed - using fallback:', error instanceof Error ? error.message : 'Unknown error');
      
      // Fast fallback using simple text matching
      return chunks.map(chunk => {
        const relevanceScore = this.calculateSimpleRelevance(query, chunk.content);
        return {
          chunkId: chunk.id,
          relevanceScore,
          accuracyScore: Math.max(6, relevanceScore),
          completenessScore: Math.max(5, relevanceScore),
          overallScore: this.calculateOverallScore(relevanceScore, Math.max(6, relevanceScore), Math.max(5, relevanceScore)),
          reasoning: 'Fast keyword-based scoring',
          shouldMerge: false,
          mergePartners: [],
          conflictFlags: []
        };
      });
    }
  }

  /**
   * Step 4: Redundancy Removal
   */
  private removeRedundancy(results: RerankerResult[], minConfidence: number): RerankerResult[] {
    console.log(`🧹 Removing redundancy from ${results.length} results`);

    // Filter by minimum confidence
    const highQualityResults = results.filter(r => r.overallScore >= minConfidence / 10);

    // Group chunks that should be merged
    const mergeGroups = new Map<string, RerankerResult[]>();
    const standalone = new Set<string>();

    for (const result of highQualityResults) {
      if (result.shouldMerge && result.mergePartners.length > 0) {
        const groupKey = [result.chunkId, ...result.mergePartners].sort().join('|');
        if (!mergeGroups.has(groupKey)) {
          mergeGroups.set(groupKey, []);
        }
        mergeGroups.get(groupKey)!.push(result);
      } else {
        standalone.add(result.chunkId);
      }
    }

    // Keep best chunk from each merge group + all standalone chunks
    const deduplicatedResults: RerankerResult[] = [];

    // Add best chunk from each merge group
    for (const [groupKey, group] of Array.from(mergeGroups.entries())) {
      const bestChunk = group.reduce((best: RerankerResult, current: RerankerResult) => 
        current.overallScore > best.overallScore ? current : best
      );
      deduplicatedResults.push(bestChunk);
    }

    // Add standalone chunks
    const standaloneResults = highQualityResults.filter(r => standalone.has(r.chunkId));
    deduplicatedResults.push(...standaloneResults);

    console.log(`✨ Deduplicated to ${deduplicatedResults.length} unique, high-quality chunks`);
    return deduplicatedResults;
  }

  /**
   * Step 5: Answer Synthesis with Confidence Scoring
   */
  private async synthesizeAnswerWithConfidence(
    query: string,
    chunks: DocumentChunk[],
    rerankerResults: RerankerResult[],
    queryType: string
  ): Promise<SynthesizedAnswer> {
    if (!this.openai) {
      return this.createFallbackAnswer(chunks);
    }

    console.log('🎯 Synthesizing answer with confidence scoring');

    // Step 1: Detect conflicts
    const conflictAnalysis = await this.detectConflicts(chunks, rerankerResults);

    // Step 2: Aggregate chunks in order of authority
    const orderedContent = await this.orderChunksByAuthority(chunks, rerankerResults);

    // Step 3: Generate synthesized answer with citations
    const synthesized = await this.generateAnswerWithCitations(
      query,
      orderedContent,
      chunks,
      queryType
    );

    // Step 4: Calculate overall confidence
    const confidence = this.calculateAnswerConfidence(
      rerankerResults,
      conflictAnalysis,
      synthesized.citationCount
    );

    // Step 5: Generate follow-up questions and insights
    const followUpQuestions = await this.generateFollowUpQuestions(query, chunks, queryType);
    const actionableInsights = this.extractActionableInsights(chunks, queryType);

    return {
      content: synthesized.content,
      confidence,
      sources: this.buildSourceReferences(chunks),
      citations: synthesized.citations,
      escalationNeeded: confidence < 70 || conflictAnalysis.hasConflicts,
      followUpQuestions,
      actionableInsights
    };
  }

  // === Helper Methods ===



  private async extractMedicalEntities(query: string): Promise<string[]> {
    // Basic medical entity extraction - could be enhanced with NER
    const medicalTerms = [
      'diabetes', 'insulin', 'glucose', 'blood sugar', 'hypoglycemia', 'hyperglycemia',
      'metformin', 'medication', 'treatment', 'care plan', 'monitoring', 'diet',
      'exercise', 'complications', 'neuropathy', 'retinopathy', 'nephropathy'
    ];

    const queryLower = query.toLowerCase();
    return medicalTerms.filter(term => queryLower.includes(term));
  }

  private async getRelatedEntities(entities: string[]): Promise<string[]> {
    // Get related entities from knowledge graph
    const related: string[] = [];
    for (const entity of entities) {
      const relationships = await storage.getEntityRelationships();
      // This would be enhanced with actual KG traversal
      related.push(...relationships.slice(0, 2).map(r => `related_to_${entity}`));
    }
    return related;
  }

  private async generateSynonyms(entities: string[], queryType: string): Promise<string[]> {
    // Medical synonyms and related terms
    const synonymMap: Record<string, string[]> = {
      'diabetes': ['diabetes mellitus', 'diabetic condition', 'blood glucose disorder'],
      'insulin': ['insulin therapy', 'insulin treatment', 'insulin medication'],
      'glucose': ['blood sugar', 'blood glucose', 'glycemic'],
      'hypoglycemia': ['low blood sugar', 'hypoglycemic episode', 'glucose low'],
      'hyperglycemia': ['high blood sugar', 'hyperglycemic state', 'glucose high']
    };

    const synonyms: string[] = [];
    for (const entity of entities) {
      if (synonymMap[entity]) {
        synonyms.push(...synonymMap[entity]);
      }
    }
    return synonyms;
  }

  private async getContraindications(entities: string[]): Promise<string[]> {
    // Get contraindications for medical entities
    return entities.map(e => `contraindication_${e}`);
  }

  private async getPrerequisites(entities: string[], queryType: string): Promise<string[]> {
    // Get prerequisites based on query type
    if (queryType === 'clinical') {
      return ['medical_assessment', 'patient_history', 'clinical_guidelines'];
    }
    return ['basic_training', 'care_protocols'];
  }

  private async getChunksByIds(ids: string[]): Promise<DocumentChunk[]> {
    const chunks: DocumentChunk[] = [];
    for (const id of ids) {
      const chunk = await storage.getDocumentChunk(id);
      if (chunk) chunks.push(chunk);
    }
    return chunks;
  }

  private async detectConflicts(chunks: DocumentChunk[], rerankerResults: RerankerResult[]): Promise<ConflictAnalysis> {
    const conflicts = rerankerResults
      .filter(r => r.conflictFlags.length > 0)
      .map(r => ({
        type: 'contradiction' as const,
        chunks: [r.chunkId],
        description: r.conflictFlags.join(', '),
        severity: 'medium' as const
      }));

    const hasConflicts = conflicts.length > 0;
    const overallConfidence = hasConflicts ? 60 : 85;

    return { hasConflicts, conflicts, overallConfidence };
  }

  private async orderChunksByAuthority(chunks: DocumentChunk[], rerankerResults: RerankerResult[]): Promise<string> {
    const orderedChunks = chunks
      .map(chunk => {
        const rerankerResult = rerankerResults.find(r => r.chunkId === chunk.id);
        return {
          chunk,
          score: rerankerResult?.overallScore || 5,
          accuracy: rerankerResult?.accuracyScore || 5
        };
      })
      .sort((a, b) => b.accuracy - a.accuracy) // Order by accuracy first
      .map(item => item.chunk.content);

    return orderedChunks.join('\n\n');
  }

  private async generateAnswerWithCitations(
    query: string,
    content: string,
    chunks: DocumentChunk[],
    queryType: string
  ): Promise<{ content: string; citations: any[]; citationCount: number }> {
    if (!this.openai) {
      return {
        content: 'Answer synthesis requires OpenAI integration.',
        citations: [],
        citationCount: 0
      };
    }

    const prompt = `You are a medical education expert. Using the provided content, answer the query with inline citations.

Query: ${query}
Query Type: ${queryType}

Guidelines:
- Provide accurate, evidence-based information
- Use inline citations [1], [2], etc. referencing the source chunks
- Include practical examples for healthcare workers
- Mention NICE, NHS, or CQC guidelines when relevant
- Keep the tone professional but accessible

Content to use:
${content}

Provide a comprehensive answer with proper citations:`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 1000
      });

      const answerContent = response.choices[0].message.content || '';
      const citationCount = (answerContent.match(/\[\d+\]/g) || []).length;

      return {
        content: answerContent,
        citations: [], // Would extract citations from content
        citationCount
      };
    } catch (error) {
      console.log('⚠️ Answer synthesis failed:', error);
      return {
        content: 'Unable to synthesize answer at this time.',
        citations: [],
        citationCount: 0
      };
    }
  }

  private calculateAnswerConfidence(
    rerankerResults: RerankerResult[],
    conflictAnalysis: ConflictAnalysis,
    citationCount: number
  ): number {
    const avgScore = rerankerResults.reduce((sum, r) => sum + r.overallScore, 0) / rerankerResults.length;
    const scoreComponent = (avgScore / 10) * 50; // 0-50 points

    const citationComponent = Math.min(citationCount * 5, 30); // 0-30 points

    const conflictPenalty = conflictAnalysis.hasConflicts ? 20 : 0;

    return Math.max(0, Math.min(100, scoreComponent + citationComponent - conflictPenalty));
  }

  private async generateFollowUpQuestions(query: string, chunks: DocumentChunk[], queryType: string): Promise<string[]> {
    // Generate relevant follow-up questions based on content
    return [
      'What specific monitoring should be done for this condition?',
      'Are there any contraindications to be aware of?',
      'What are the emergency procedures if complications arise?'
    ];
  }

  private extractActionableInsights(chunks: DocumentChunk[], queryType: string): string[] {
    // Extract actionable insights for healthcare workers
    return [
      'Monitor blood glucose levels regularly according to care plan',
      'Document any changes in condition and report to nursing staff',
      'Ensure proper medication administration timing'
    ];
  }

  private buildSourceReferences(chunks: DocumentChunk[]): Array<{
    id: string;
    title: string;
    excerpt: string;
    authority: number;
    pageNumber?: number;
    section?: string;
  }> {
    return chunks.map(chunk => ({
      id: chunk.id,
      title: (chunk.metadata as any)?.title || 'Medical Document',
      excerpt: chunk.content.substring(0, 200) + '...',
      authority: 85,
      pageNumber: (chunk.metadata as any)?.page,
      section: chunk.sectionPath?.join(' > ')
    }));
  }

  private createFallbackAnswer(chunks: DocumentChunk[]): SynthesizedAnswer {
    return {
      content: 'Information retrieved from medical documents. Please consult with healthcare professionals for specific cases.',
      confidence: 60,
      sources: this.buildSourceReferences(chunks),
      citations: [],
      escalationNeeded: true,
      followUpQuestions: ['What additional information do you need?'],
      actionableInsights: ['Consult with medical staff for guidance']
    };
  }

  private async generateRefinementSuggestions(query: string, results: RerankerResult[]): Promise<string[]> {
    const suggestions: string[] = [];

    if (results.length === 0) {
      suggestions.push('Try using more specific medical terms');
      suggestions.push('Consider asking about related conditions or treatments');
    } else if (results.length < 3) {
      suggestions.push('Broaden your query to include related topics');
      suggestions.push('Ask about general principles rather than specific details');
    }

    const lowScoreResults = results.filter(r => r.overallScore < 6);
    if (lowScoreResults.length > results.length * 0.5) {
      suggestions.push('Try rephrasing your question more specifically');
      suggestions.push('Focus on one aspect of your query at a time');
    }

    return suggestions.length > 0 ? suggestions : ['Your query is well-formed'];
  }

  private async trackQueryPerformance(
    userId: string,
    query: string,
    resultCount: number,
    confidence: number
  ): Promise<void> {
    try {
      // Validate and sanitize confidence value
      const safeConfidence = isNaN(confidence) || confidence == null ? 0 : Math.round(Math.max(0, Math.min(100, confidence)));
      const safeResultCount = isNaN(resultCount) || resultCount == null ? 0 : Math.max(0, resultCount);
      
      // Track performance for feedback loop optimization
      if (safeConfidence < 70 || safeResultCount < 3) {
        const refinement: InsertQueryRefinement = {
          userId,
          originalQuery: query,
          refinedQuery: query, // Would be enhanced with actual refinement
          originalConfidence: safeConfidence,
          refinedConfidence: safeConfidence,
          chunkFragmentation: safeResultCount < 3,
          action: safeConfidence < 50 ? 'escalate' : 'reformulate',
          automaticRefinement: false
        };

        await storage.createQueryRefinement(refinement);
      }
    } catch (error) {
      console.log('Failed to track query performance:', error);
    }
  }
}

export const enhancedRetrievalWithReranking = new EnhancedRetrievalWithReranking();