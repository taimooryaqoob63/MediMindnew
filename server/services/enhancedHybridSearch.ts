/**
 * Enhanced Hybrid Search: BM25 + Vector + LLM Reranker + KG Expansion
 * Implements Reciprocal Rank Fusion with confidence-based reranking
 */

import OpenAI from 'openai';
import { vectorStore } from './vectorStore';
import { storage } from '../storage';
import { RAG_CONFIG } from '../config/ragConfiguration';

interface SearchResult {
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
}

interface BM25Result {
  id: string;
  score: number;
  title: string;
  content: string;
  metadata: Record<string, any>;
}

interface VectorResult {
  id: string;
  score: number;
  metadata: Record<string, any>;
}

interface RerankerResult {
  id: string;
  score: number; // 0-10 scale from LLM
  reasoning: string;
}

interface KGExpansion {
  originalTerms: string[];
  synonyms: string[];
  relatedConcepts: string[];
  contraindications: string[];
  ageGroups: string[];
}

interface EnhancedSearchOptions {
  topK?: number;
  minScore?: number;
  bm25Weight?: number;
  embeddingWeight?: number;
  filters?: Record<string, any>;
  boostRecent?: boolean;
  useKGExpansion?: boolean;
  useLLMReranker?: boolean;
  queryType?: 'clinical' | 'educational' | 'faq';
}

export class EnhancedHybridSearch {
  private openai?: OpenAI;
  private documents: Map<string, { 
    title: string; 
    content: string; 
    metadata: Record<string, any>;
    embeddings?: number[];
  }> = new Map();
  
  // BM25 components
  private termFrequency: Map<string, Map<string, number>> = new Map();
  private docLength: Map<string, number> = new Map();
  private avgDocLength: number = 0;
  private totalDocs: number = 0;

  constructor() {
    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
    }
    this.initializeIndex();
  }

  private async initializeIndex(): Promise<void> {
    console.log('🔍 Initializing enhanced hybrid search index...');
    await this.loadDocumentsFromStorage();
  }

  // Add document with enhanced metadata and embeddings
  async addDocument(
    id: string, 
    title: string, 
    content: string, 
    metadata: Record<string, any> = {}
  ): Promise<void> {
    const fullText = `${title} ${content}`;
    const tokens = this.tokenize(fullText);
    
    // Store document with enhanced metadata
    this.documents.set(id, { 
      title, 
      content, 
      metadata: {
        ...metadata,
        indexedAt: new Date().toISOString(),
        tokenCount: tokens.length
      }
    });
    
    this.docLength.set(id, tokens.length);
    
    // Build BM25 index
    const termCounts = new Map<string, number>();
    tokens.forEach(term => {
      termCounts.set(term, (termCounts.get(term) || 0) + 1);
    });

    termCounts.forEach((count, term) => {
      if (!this.termFrequency.has(term)) {
        this.termFrequency.set(term, new Map());
      }
      this.termFrequency.get(term)!.set(id, count);
    });

    this.totalDocs++;
    this.updateAvgDocLength();
  }

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(token => token.length > 2 && !this.isStopWord(token));
  }

  private isStopWord(word: string): boolean {
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 
      'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
      'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should'
    ]);
    return stopWords.has(word);
  }

  private updateAvgDocLength(): void {
    const totalLength = Array.from(this.docLength.values()).reduce((sum, len) => sum + len, 0);
    this.avgDocLength = totalLength / this.totalDocs;
  }

  // Knowledge Graph expansion for query enrichment
  private async expandQueryWithKG(query: string): Promise<KGExpansion> {
    try {
      // Get entities related to the query
      const entities = await storage.getEntities();
      const queryTerms = this.tokenize(query);
      
      const expansion: KGExpansion = {
        originalTerms: queryTerms,
        synonyms: [],
        relatedConcepts: [],
        contraindications: [],
        ageGroups: []
      };

      // Find matching entities and their relationships
      for (const entity of entities) {
        const entityTokens = this.tokenize(entity.name);
        const hasMatch = entityTokens.some(token => queryTerms.includes(token));
        
        if (hasMatch) {
          // Get relationships for this entity
          const relationships = await storage.getEntityRelationships(entity.id);
          
          for (const rel of relationships) {
            // Get related entity
            const relatedEntity = entities.find(e => e.id === rel.toEntityId);
            if (relatedEntity) {
              switch (rel.relationshipType) {
                case 'synonym':
                case 'alternative_name':
                  if (expansion.synonyms.length < 5) {
                    expansion.synonyms.push(relatedEntity.name);
                  }
                  break;
                case 'treats':
                case 'related_to':
                case 'associated_with':
                  if (expansion.relatedConcepts.length < 5) {
                    expansion.relatedConcepts.push(relatedEntity.name);
                  }
                  break;
                case 'contraindicated_in':
                case 'contraindication':
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
        }
      }

      return expansion;
    } catch (error) {
      console.error('KG expansion error:', error);
      return {
        originalTerms: this.tokenize(query),
        synonyms: [],
        relatedConcepts: [],
        contraindications: [],
        ageGroups: []
      };
    }
  }

  private async getBM25Results(
    query: string, 
    expansion: KGExpansion, 
    topK: number = 50
  ): Promise<BM25Result[]> {
    // Build expanded query with original + synonyms + related concepts
    const expandedTerms = [
      ...expansion.originalTerms,
      ...expansion.synonyms.slice(0, 3), // Limit to prevent query drift
      ...expansion.relatedConcepts.slice(0, 2)
    ];

    const scores: Array<{ id: string; score: number }> = [];

    this.documents.forEach((doc, id) => {
      let totalScore = 0;
      
      // Score for original query
      const originalScore = this.calculateBM25Score(query, id);
      totalScore += originalScore * 1.0; // Full weight for original
      
      // Score for expanded terms (lower weight)
      for (const term of expansion.synonyms.slice(0, 3)) {
        const synonymScore = this.calculateBM25Score(term, id);
        totalScore += synonymScore * 0.7; // 70% weight for synonyms
      }
      
      for (const term of expansion.relatedConcepts.slice(0, 2)) {
        const relatedScore = this.calculateBM25Score(term, id);
        totalScore += relatedScore * 0.5; // 50% weight for related concepts
      }

      if (totalScore > 0) {
        scores.push({ id, score: totalScore });
      }
    });

    scores.sort((a, b) => b.score - a.score);

    return scores.slice(0, topK).map(({ id, score }) => {
      const doc = this.documents.get(id)!;
      return {
        id,
        score,
        title: doc.title,
        content: doc.content,
        metadata: doc.metadata,
      };
    });
  }

  private calculateBM25Score(query: string, docId: string): number {
    const tokens = this.tokenize(query);
    const docLength = this.docLength.get(docId) || 0;
    const k1 = 1.5;
    const b = 0.75;

    let score = 0;

    tokens.forEach(term => {
      const termFreqInDoc = this.termFrequency.get(term)?.get(docId) || 0;
      const docsContainingTerm = this.termFrequency.get(term)?.size || 0;
      
      if (docsContainingTerm === 0) return;

      const idf = Math.log((this.totalDocs - docsContainingTerm + 0.5) / (docsContainingTerm + 0.5));
      const tf = (termFreqInDoc * (k1 + 1)) / 
                 (termFreqInDoc + k1 * (1 - b + b * (docLength / this.avgDocLength)));

      score += idf * tf;
    });

    return score;
  }

  private async getVectorResults(
    query: string, 
    expansion: KGExpansion, 
    topK: number = 50,
    filters?: Record<string, any>
  ): Promise<VectorResult[]> {
    try {
      // Create multiple semantic queries
      const queries = [query];
      
      // Add expanded variant if we have good expansions
      if (expansion.synonyms.length > 0 || expansion.relatedConcepts.length > 0) {
        const expandedQuery = `${query} ${expansion.synonyms.slice(0, 2).join(' ')} ${expansion.relatedConcepts.slice(0, 1).join(' ')}`;
        queries.push(expandedQuery);
      }

      const allResults: VectorResult[] = [];

      for (const searchQuery of queries) {
        const results = await vectorStore.query(searchQuery, topK, filters);
        
        // Convert to VectorResult format
        const vectorResults = results.map((result: any, index: number) => ({
          id: result.id,
          score: result.score * (queries.length > 1 && searchQuery !== query ? 0.8 : 1.0), // Reduce score for expanded queries
          metadata: result.metadata || {}
        }));

        allResults.push(...vectorResults);
      }

      // Deduplicate and return top K
      const uniqueResults = new Map<string, VectorResult>();
      allResults.forEach(result => {
        const existing = uniqueResults.get(result.id);
        if (!existing || result.score > existing.score) {
          uniqueResults.set(result.id, result);
        }
      });

      return Array.from(uniqueResults.values())
        .sort((a, b) => b.score - a.score)
        .slice(0, topK);

    } catch (error) {
      console.error('Vector search error:', error);
      return [];
    }
  }

  // Reciprocal Rank Fusion
  private fuseResults(
    bm25Results: BM25Result[], 
    vectorResults: VectorResult[],
    bm25Weight: number = 0.3,
    vectorWeight: number = 0.7
  ): SearchResult[] {
    const k = 60; // RRF constant
    const fusedScores = new Map<string, { score: number; result: any; sources: string[] }>();

    // Process BM25 results
    bm25Results.forEach((result, rank) => {
      const rrfScore = bm25Weight / (k + rank + 1);
      fusedScores.set(result.id, {
        score: rrfScore,
        result: result,
        sources: ['bm25']
      });
    });

    // Process vector results and combine
    vectorResults.forEach((result, rank) => {
      const rrfScore = vectorWeight / (k + rank + 1);
      const existing = fusedScores.get(result.id);
      
      if (existing) {
        existing.score += rrfScore;
        existing.sources.push('vector');
      } else {
        // Get document for this vector result
        const doc = this.documents.get(result.id);
        if (doc) {
          fusedScores.set(result.id, {
            score: rrfScore,
            result: {
              id: result.id,
              score: result.score,
              title: doc.title,
              content: doc.content,
              metadata: { ...doc.metadata, ...result.metadata }
            },
            sources: ['vector']
          });
        }
      }
    });

    // Convert to SearchResult format
    return Array.from(fusedScores.entries())
      .map(([id, data]) => ({
        id,
        title: data.result.title || '',
        excerpt: this.extractExcerpt(data.result.content || '', 200),
        score: data.result.score || data.score,
        type: data.result.metadata?.docType || 'document',
        pageNumber: data.result.metadata?.page,
        section: data.result.metadata?.sectionPath?.join(' > '),
        clickable: true,
        recency: this.calculateRecency(data.result.metadata?.publishedAt),
        relevance: data.score,
        source: data.result.metadata?.source || 'unknown',
        docType: data.result.metadata?.docType || 'unknown',
        metadata: {
          ...data.result.metadata,
          fusionSources: data.sources,
          rrfScore: data.score
        }
      }))
      .sort((a, b) => b.score - a.score);
  }

  // LLM-based cross-reranking
  private async rerankeWithLLM(
    query: string,
    results: SearchResult[],
    topK: number = 12
  ): Promise<SearchResult[]> {
    if (!this.openai || results.length === 0) {
      return results.slice(0, topK);
    }

    try {
      const rerankerPrompt = `You are a medical content reranker. Score each passage 0-10 based on how directly it answers the question.

Question: "${query}"

Consider:
- Specificity and directness of the answer
- Medical accuracy and authority of source
- Presence of actionable clinical detail
- Relevance to the specific query

Passages to rank:
${results.map((result, i) => `
Passage ${i + 1}:
Title: ${result.title}
Source: ${result.source} (${result.docType})
Content: ${result.excerpt}
`).join('\n')}

Respond with JSON only:
{
  "rankings": [
    {"passage": 1, "score": 8, "reasoning": "Direct answer with clinical detail"},
    {"passage": 2, "score": 6, "reasoning": "Relevant but less specific"}
  ]
}`;

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: rerankerPrompt }],
        temperature: 0.1,
        max_tokens: 1000
      });

      const response = completion.choices[0]?.message?.content;
      if (!response) {
        return results.slice(0, topK);
      }

      const rankings = JSON.parse(response).rankings;
      
      // Apply LLM scores with boosting
      const rerankedResults = results.map((result, index) => {
        const ranking = rankings.find((r: any) => r.passage === index + 1);
        const llmScore = ranking ? ranking.score / 10 : 0.5; // Default middle score
        
        return {
          ...result,
          score: result.score * (0.3) + llmScore * (0.7), // 70% LLM weight
          metadata: {
            ...result.metadata,
            llmScore: ranking?.score || 0,
            llmReasoning: ranking?.reasoning || 'No LLM assessment'
          }
        };
      });

      return rerankedResults
        .sort((a, b) => b.score - a.score)
        .slice(0, topK);

    } catch (error) {
      console.error('LLM reranking error:', error);
      // Fallback to original ranking
      return results.slice(0, topK);
    }
  }

  // Apply recency boost for clinical queries
  private applyRecencyBoost(results: SearchResult[], queryType?: string): SearchResult[] {
    if (queryType !== 'clinical') {
      return results;
    }

    const cutoffDate = new Date();
    cutoffDate.setFullYear(cutoffDate.getFullYear() - 1); // Boost docs from last year

    return results.map(result => {
      const publishedAt = result.metadata?.publishedAt ? new Date(result.metadata.publishedAt) : null;
      const isRecent = publishedAt && publishedAt >= cutoffDate;
      
      return {
        ...result,
        score: result.score * (isRecent ? 1.2 : 1.0), // 20% boost for recent clinical content
        metadata: {
          ...result.metadata,
          recencyBoost: isRecent
        }
      };
    });
  }

  // Main search method with enhanced pipeline
  async search(query: string, options: EnhancedSearchOptions = {}): Promise<SearchResult[]> {
    const {
      topK = RAG_CONFIG.retrieval.topK,
      minScore = RAG_CONFIG.retrieval.minScore,
      bm25Weight = RAG_CONFIG.retrieval.bm25Weight,
      embeddingWeight = RAG_CONFIG.retrieval.embeddingWeight,
      filters,
      boostRecent = true,
      useKGExpansion = true,
      useLLMReranker = true,
      queryType = 'educational'
    } = options;

    console.log(`🔍 Enhanced hybrid search: "${query}" (${queryType})`);

    try {
      // Step 1: KG expansion for query enrichment
      const expansion = useKGExpansion ? 
        await this.expandQueryWithKG(query) : 
        { originalTerms: this.tokenize(query), synonyms: [], relatedConcepts: [], contraindications: [], ageGroups: [] };

      if (expansion.synonyms.length > 0 || expansion.relatedConcepts.length > 0) {
        console.log(`🔗 KG expansion: +${expansion.synonyms.length} synonyms, +${expansion.relatedConcepts.length} related concepts`);
      }

      // Step 2: Dual retrieval - BM25 + Vector
      const [bm25Results, vectorResults] = await Promise.all([
        this.getBM25Results(query, expansion, topK * 2),
        this.getVectorResults(query, expansion, topK * 2, filters)
      ]);

      console.log(`📊 Retrieved ${bm25Results.length} BM25 + ${vectorResults.length} vector results`);

      // Step 3: Reciprocal Rank Fusion
      let fusedResults = this.fuseResults(bm25Results, vectorResults, bm25Weight, embeddingWeight);
      
      // Step 4: Apply recency boost for clinical queries
      if (boostRecent) {
        fusedResults = this.applyRecencyBoost(fusedResults, queryType);
      }

      // Step 5: LLM reranking (top 30 → top K)
      const preRerankCount = Math.min(30, fusedResults.length);
      const finalResults = useLLMReranker ? 
        await this.rerankeWithLLM(query, fusedResults.slice(0, preRerankCount), topK) :
        fusedResults.slice(0, topK);

      // Step 6: Final filtering by minimum score
      const filteredResults = finalResults.filter(result => result.score >= minScore);

      console.log(`✅ Enhanced search complete: ${filteredResults.length} results (min score: ${minScore})`);

      return filteredResults;

    } catch (error) {
      console.error('Enhanced hybrid search error:', error);
      // Fallback to basic vector search
      try {
        const fallbackResults = await vectorStore.query(query, topK, filters);
        return fallbackResults.map((result: any) => ({
          id: result.id,
          title: result.metadata?.title || '',
          excerpt: this.extractExcerpt(result.metadata?.content || '', 200),
          score: result.score,
          type: result.metadata?.type || 'document',
          pageNumber: result.metadata?.pageNumber,
          section: result.metadata?.section,
          clickable: true,
          recency: this.calculateRecency(result.metadata?.createdAt),
          relevance: result.score,
          source: result.metadata?.source || 'unknown',
          docType: result.metadata?.docType || 'unknown',
          metadata: result.metadata
        }));
      } catch (fallbackError) {
        console.error('Fallback search also failed:', fallbackError);
        return [];
      }
    }
  }

  private extractExcerpt(content: string, maxLength: number): string {
    if (content.length <= maxLength) return content;
    
    const excerpt = content.substring(0, maxLength);
    const lastSpace = excerpt.lastIndexOf(' ');
    
    return lastSpace > maxLength * 0.7 
      ? excerpt.substring(0, lastSpace) + '...'
      : excerpt + '...';
  }

  private calculateRecency(publishedAt?: string | Date): number {
    if (!publishedAt) return 0;
    
    const date = typeof publishedAt === 'string' ? new Date(publishedAt) : publishedAt;
    const now = new Date();
    const diffDays = (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24);
    
    if (diffDays < 30) return 1.0;
    if (diffDays < 90) return 0.8;
    if (diffDays < 365) return 0.6;
    if (diffDays < 730) return 0.4;
    return 0.2;
  }

  private async loadDocumentsFromStorage(): Promise<void> {
    try {
      console.log('📚 Loading document chunks into enhanced hybrid search index...');
      
      // Load document chunks from storage and add to index
      const chunks = await storage.getAllDocumentChunks() || [];
      for (const chunk of chunks) {
        // Get the parent document for additional metadata
        const parentDoc = await storage.getDocument(chunk.documentId);
        const combinedMetadata = {
          ...(chunk.metadata || {}),
          documentTitle: parentDoc?.title,
          documentType: parentDoc?.documentType,
          category: parentDoc?.category,
          source: parentDoc?.source,
          chunkIndex: chunk.chunkIndex,
          chunkType: chunk.chunkType,
          tokenCount: chunk.tokenCount,
          publishedAt: parentDoc?.createdAt
        };
        
        // Use chunk content and enhanced metadata
        const chunkTitle = `${parentDoc?.title || 'Document'} - Chunk ${chunk.chunkIndex + 1}`;
        await this.addDocument(chunk.id, chunkTitle, chunk.content, combinedMetadata);
      }
      
      console.log(`✅ Loaded ${chunks.length} document chunks into enhanced index`);
    } catch (error) {
      console.error('Error loading document chunks into enhanced search index:', error);
    }
  }

  // Enhanced search statistics
  getSearchStats(): { 
    totalDocs: number; 
    avgDocLength: number; 
    vocabSize: number;
    enhancedFeatures: string[];
  } {
    return {
      totalDocs: this.totalDocs,
      avgDocLength: this.avgDocLength,
      vocabSize: this.termFrequency.size,
      enhancedFeatures: [
        'Knowledge Graph Expansion',
        'Reciprocal Rank Fusion',
        'LLM Cross-Reranking',
        'Multi-embedding Models',
        'Recency Boosting',
        'Clinical Query Detection'
      ]
    };
  }
}

export const enhancedHybridSearch = new EnhancedHybridSearch();