/**
 * Hybrid Search Implementation: BM25 + Vector Embeddings
 * Combines keyword-based and semantic search for better retrieval accuracy and speed
 */

import { vectorStore } from './vectorStore';
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
}

interface BM25Result {
  id: string;
  score: number;
  title: string;
  content: string;
  metadata: Record<string, any>;
}

interface HybridSearchOptions {
  topK?: number;
  minScore?: number;
  bm25Weight?: number;
  embeddingWeight?: number;
  filters?: Record<string, any>;
  boostRecent?: boolean;
}

export class HybridSearch {
  private documents: Map<string, { title: string; content: string; metadata: Record<string, any> }> = new Map();
  private termFrequency: Map<string, Map<string, number>> = new Map(); // term -> docId -> frequency
  private docLength: Map<string, number> = new Map();
  private avgDocLength: number = 0;
  private totalDocs: number = 0;

  constructor() {
    this.initializeIndex();
  }

  private async initializeIndex(): Promise<void> {
    // In a production system, this would load from your document database
    // For now, we'll build the BM25 index as documents are added
    console.log('Hybrid search index initialized');
  }

  // Add documents to the BM25 index
  addDocument(id: string, title: string, content: string, metadata: Record<string, any> = {}): void {
    const fullText = `${title} ${content}`;
    const tokens = this.tokenize(fullText);
    
    this.documents.set(id, { title, content, metadata });
    this.docLength.set(id, tokens.length);
    
    // Update term frequencies
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

  private calculateBM25Score(query: string, docId: string): number {
    const tokens = this.tokenize(query);
    const docLength = this.docLength.get(docId) || 0;
    const k1 = 1.5; // Term frequency saturation parameter
    const b = 0.75;  // Length normalization parameter

    let score = 0;

    tokens.forEach(term => {
      const termFreqInDoc = this.termFrequency.get(term)?.get(docId) || 0;
      const docsContainingTerm = this.termFrequency.get(term)?.size || 0;
      
      if (docsContainingTerm === 0) return;

      // IDF calculation
      const idf = Math.log((this.totalDocs - docsContainingTerm + 0.5) / (docsContainingTerm + 0.5));
      
      // TF component
      const tf = (termFreqInDoc * (k1 + 1)) / 
                 (termFreqInDoc + k1 * (1 - b + b * (docLength / this.avgDocLength)));

      score += idf * tf;
    });

    return score;
  }

  private async getBM25Results(query: string, topK: number = 10): Promise<BM25Result[]> {
    const scores: Array<{ id: string; score: number }> = [];

    this.documents.forEach((doc, id) => {
      const score = this.calculateBM25Score(query, id);
      if (score > 0) {
        scores.push({ id, score });
      }
    });

    // Sort by score descending
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

  async search(query: string, options: HybridSearchOptions = {}): Promise<SearchResult[]> {
    const {
      topK = RAG_CONFIG.retrieval.topK,
      minScore = RAG_CONFIG.retrieval.minScore,
      bm25Weight = RAG_CONFIG.retrieval.bm25Weight,
      embeddingWeight = RAG_CONFIG.retrieval.embeddingWeight,
      filters,
      boostRecent = true,
    } = options;

    try {
      // Get BM25 results (keyword-based)
      const bm25Results = await this.getBM25Results(query, topK * 2);

      // Get vector search results (semantic)
      const vectorResults = await this.getVectorResults(query, topK * 2, filters);

      // Combine and rerank results
      const hybridResults = await this.combineResults(
        bm25Results,
        vectorResults,
        bm25Weight,
        embeddingWeight,
        boostRecent
      );

      // Filter by minimum score and return top K
      return hybridResults
        .filter(result => result.score >= minScore)
        .slice(0, topK);

    } catch (error) {
      console.error('Hybrid search error:', error);
      // Fallback to vector search only
      return await this.getVectorResults(query, topK, filters);
    }
  }

  private async getVectorResults(query: string, topK: number, filters?: Record<string, any>): Promise<SearchResult[]> {
    try {
      // This would typically call your vector store's search method
      // For now, return empty array as placeholder
      return [];
    } catch (error) {
      console.error('Vector search error:', error);
      return [];
    }
  }

  private async combineResults(
    bm25Results: BM25Result[],
    vectorResults: SearchResult[],
    bm25Weight: number,
    embeddingWeight: number,
    boostRecent: boolean
  ): Promise<SearchResult[]> {
    const combinedResults = new Map<string, SearchResult>();

    // Normalize BM25 scores (0-1 range)
    const maxBM25Score = Math.max(...bm25Results.map(r => r.score), 1);
    
    // Process BM25 results
    bm25Results.forEach(result => {
      const normalizedScore = result.score / maxBM25Score;
      const searchResult: SearchResult = {
        id: result.id,
        title: result.title,
        excerpt: this.extractExcerpt(result.content, 200),
        score: normalizedScore * bm25Weight,
        type: result.metadata.type || 'document',
        pageNumber: result.metadata.pageNumber,
        section: result.metadata.section,
        clickable: true,
        recency: this.calculateRecency(result.metadata.createdAt),
        relevance: normalizedScore,
      };
      
      combinedResults.set(result.id, searchResult);
    });

    // Process and combine vector results
    vectorResults.forEach(result => {
      const existing = combinedResults.get(result.id);
      if (existing) {
        // Combine scores
        existing.score = existing.score + (result.score * embeddingWeight);
        existing.relevance = Math.max(existing.relevance, result.relevance);
      } else {
        // Add new result with embedding weight
        const searchResult: SearchResult = {
          ...result,
          score: result.score * embeddingWeight,
        };
        combinedResults.set(result.id, searchResult);
      }
    });

    // Convert to array and apply recency boost
    let results = Array.from(combinedResults.values());
    
    if (boostRecent) {
      results = results.map(result => ({
        ...result,
        score: result.score * (1 + result.recency * 0.1), // 10% boost for recent docs
      }));
    }

    // Sort by final combined score
    results.sort((a, b) => b.score - a.score);

    return results;
  }

  private extractExcerpt(content: string, maxLength: number): string {
    if (content.length <= maxLength) return content;
    
    const excerpt = content.substring(0, maxLength);
    const lastSpace = excerpt.lastIndexOf(' ');
    
    return lastSpace > maxLength * 0.7 
      ? excerpt.substring(0, lastSpace) + '...'
      : excerpt + '...';
  }

  private calculateRecency(createdAt?: string | Date): number {
    if (!createdAt) return 0;
    
    const date = typeof createdAt === 'string' ? new Date(createdAt) : createdAt;
    const now = new Date();
    const diffDays = (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24);
    
    // Recent documents (< 30 days) get higher recency scores
    if (diffDays < 7) return 1.0;
    if (diffDays < 30) return 0.8;
    if (diffDays < 90) return 0.6;
    if (diffDays < 365) return 0.4;
    return 0.2;
  }

  // Method to preload documents from storage
  async loadDocumentsFromStorage(): Promise<void> {
    try {
      // This would load existing documents from your database
      // and add them to the BM25 index
      console.log('Loading documents into hybrid search index...');
      // Implementation depends on your storage structure
    } catch (error) {
      console.error('Error loading documents into search index:', error);
    }
  }

  // Get search statistics
  getSearchStats(): { totalDocs: number; avgDocLength: number; vocabSize: number } {
    return {
      totalDocs: this.totalDocs,
      avgDocLength: this.avgDocLength,
      vocabSize: this.termFrequency.size,
    };
  }
}

export const hybridSearch = new HybridSearch();