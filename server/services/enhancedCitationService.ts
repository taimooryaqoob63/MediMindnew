/**
 * Enhanced Citation Enforcement Service
 * Implements inline citation resolution, fact-checking, and authoritative source validation
 */

import OpenAI from 'openai';
import { storage } from '../storage';

interface CitationContext {
  sourceId: string;
  docId: string;
  title: string;
  section: string[];
  page?: number;
  version: string;
  source: 'NICE' | 'NHS' | 'CQC' | 'other';
  publishedAt: string;
  refIds: string[];
}

interface KGFact {
  id: string;
  triple: string;
  confidence: number;
  provenance: {
    docId: string;
    section: string;
    refId: string;
  };
}

interface FactCheckResult {
  claim: string;
  supported: boolean;
  confidence: number;
  supportingSources: string[];
  reasoning: string;
}

export interface EnhancedCitationResult {
  content: string;
  citations: Array<{
    id: string;
    inlineRef: string;
    fullReference: string;
    authority: number; // 0-100
    recency: number; // 0-100
  }>;
  kgFacts: KGFact[];
  factCheckResults: FactCheckResult[];
  unsupportedClaims: string[];
  confidenceScore: number;
}

export class EnhancedCitationService {
  private openai?: OpenAI;
  
  constructor() {
    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
    }
  }

  /**
   * Main citation enforcement method
   * Processes response content and enforces citation requirements
   */
  async enforceInlineCitations(
    content: string,
    sources: any[],
    kgFacts: KGFact[] = []
  ): Promise<EnhancedCitationResult> {
    try {
      console.log(`📝 Enforcing citations for content (${content.length} chars, ${sources.length} sources, ${kgFacts.length} KG facts)`);

      // Step 1: Map sources to citation contexts
      const citationContexts = await this.buildCitationContexts(sources);

      // Step 2: Add inline citations to content
      const citedContent = await this.addInlineCitations(content, citationContexts, kgFacts);

      // Step 3: Fact-check claims against sources
      const factCheckResults = await this.performFactCheck(content, citationContexts, kgFacts);

      // Step 4: Identify unsupported claims
      const unsupportedClaims = this.identifyUnsupportedClaims(content, factCheckResults);

      // Step 5: Calculate confidence score
      const confidenceScore = this.calculateCitationConfidence(citationContexts, factCheckResults, kgFacts);

      // Step 6: Generate full citation references
      const citations = this.generateFullCitations(citationContexts);

      console.log(`✅ Citation enforcement complete: ${citations.length} citations, confidence: ${confidenceScore}%`);

      return {
        content: citedContent,
        citations,
        kgFacts,
        factCheckResults,
        unsupportedClaims,
        confidenceScore
      };

    } catch (error) {
      console.error('Citation enforcement error:', error);
      return {
        content,
        citations: [],
        kgFacts,
        factCheckResults: [],
        unsupportedClaims: [],
        confidenceScore: 0
      };
    }
  }

  /**
   * Build citation contexts from source metadata
   */
  private async buildCitationContexts(sources: any[]): Promise<CitationContext[]> {
    const contexts: CitationContext[] = [];

    for (let i = 0; i < sources.length; i++) {
      const source = sources[i];
      
      try {
        // Get full document metadata if available
        const doc = source.documentId ? await storage.getDocument(source.documentId) : null;
        
        const context: CitationContext = {
          sourceId: `S${i + 1}`,
          docId: source.documentId || source.id || `unknown-${i}`,
          title: source.title || doc?.title || 'Untitled Document',
          section: source.metadata?.sectionPath || source.section || [],
          page: source.metadata?.page || source.pageNumber,
          version: source.metadata?.version || doc?.metadata?.version || 'v1.0',
          source: source.metadata?.source || doc?.metadata?.docSource || 'other',
          publishedAt: source.metadata?.publishedAt || doc?.metadata?.publishedAt || new Date().toISOString(),
          refIds: source.metadata?.refIds || []
        };

        contexts.push(context);
      } catch (error) {
        console.warn(`Failed to build citation context for source ${i}:`, error);
      }
    }

    return contexts;
  }

  /**
   * Add inline citations to content using AI
   */
  private async addInlineCitations(
    content: string,
    contexts: CitationContext[],
    kgFacts: KGFact[]
  ): Promise<string> {
    if (!this.openai) {
      return content;
    }

    try {
      const citationPrompt = `Add inline citations to this medical content. Use the format: "according to [SOURCE]" or "as stated in [SOURCE]" where [SOURCE] uses the provided source IDs.

Available Sources:
${contexts.map(ctx => `${ctx.sourceId}: ${this.formatShortReference(ctx)}`).join('\n')}

Available KG Facts:
${kgFacts.map((fact, i) => `[KG${i + 1}]: ${fact.triple} (confidence: ${fact.confidence}%)`).join('\n')}

Original Content:
${content}

Requirements:
1. Every factual claim must have a citation
2. Use [S#] for document sources, [KG#] for knowledge graph facts
3. Prefer authoritative sources (NICE/NHS/CQC) over others
4. Include publication year for guidelines
5. Keep the content natural and readable

Return only the content with inline citations added:`;

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: citationPrompt }],
        temperature: 0.1,
        max_tokens: 2000
      });

      const citedContent = completion.choices[0]?.message?.content || content;
      return citedContent;

    } catch (error) {
      console.error('Error adding inline citations:', error);
      return content;
    }
  }

  /**
   * Perform fact-checking against available sources
   */
  private async performFactCheck(
    content: string,
    contexts: CitationContext[],
    kgFacts: KGFact[]
  ): Promise<FactCheckResult[]> {
    if (!this.openai) {
      return [];
    }

    try {
      // Extract claims from content
      const claims = await this.extractClaims(content);
      const results: FactCheckResult[] = [];

      for (const claim of claims) {
        const factCheckResult = await this.checkClaimAgainstSources(claim, contexts, kgFacts);
        results.push(factCheckResult);
      }

      return results;

    } catch (error) {
      console.error('Fact-checking error:', error);
      return [];
    }
  }

  /**
   * Extract factual claims from content
   */
  private async extractClaims(content: string): Promise<string[]> {
    if (!this.openai) {
      return [];
    }

    try {
      const extractionPrompt = `Extract specific factual claims from this medical content. Focus on:
- Clinical recommendations
- Dosage information
- Diagnostic criteria
- Treatment protocols
- Contraindications
- Numerical values and ranges

Content:
${content}

Return as JSON array of claims:
{"claims": ["claim1", "claim2", ...]}`;

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: extractionPrompt }],
        temperature: 0.1,
        max_tokens: 1000
      });

      const response = completion.choices[0]?.message?.content;
      if (response) {
        const parsed = JSON.parse(response);
        return parsed.claims || [];
      }

    } catch (error) {
      console.error('Claim extraction error:', error);
    }

    return [];
  }

  /**
   * Check individual claim against available sources
   */
  private async checkClaimAgainstSources(
    claim: string,
    contexts: CitationContext[],
    kgFacts: KGFact[]
  ): Promise<FactCheckResult> {
    if (!this.openai) {
      return {
        claim,
        supported: false,
        confidence: 0,
        supportingSources: [],
        reasoning: 'AI fact-checking unavailable'
      };
    }

    try {
      const checkPrompt = `Verify this medical claim against the available sources and knowledge graph facts.

Claim: "${claim}"

Available Sources:
${contexts.map(ctx => `${ctx.sourceId}: ${this.formatFullReference(ctx)}`).join('\n')}

Available KG Facts:
${kgFacts.map(fact => `${fact.triple} (confidence: ${fact.confidence}%, source: ${fact.provenance.docId})`).join('\n')}

Respond with JSON:
{
  "supported": true/false,
  "confidence": 0-100,
  "supportingSources": ["S1", "KG2", ...],
  "reasoning": "Brief explanation"
}`;

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: checkPrompt }],
        temperature: 0.1,
        max_tokens: 500
      });

      const response = completion.choices[0]?.message?.content;
      if (response) {
        const result = JSON.parse(response);
        return {
          claim,
          supported: result.supported,
          confidence: result.confidence,
          supportingSources: result.supportingSources || [],
          reasoning: result.reasoning
        };
      }

    } catch (error) {
      console.error('Claim verification error:', error);
    }

    return {
      claim,
      supported: false,
      confidence: 0,
      supportingSources: [],
      reasoning: 'Verification failed'
    };
  }

  /**
   * Identify claims that lack sufficient source support
   */
  private identifyUnsupportedClaims(content: string, factCheckResults: FactCheckResult[]): string[] {
    const unsupported = factCheckResults
      .filter(result => !result.supported || result.confidence < 70)
      .map(result => result.claim);

    return unsupported;
  }

  /**
   * Calculate overall citation confidence score
   */
  private calculateCitationConfidence(
    contexts: CitationContext[],
    factCheckResults: FactCheckResult[],
    kgFacts: KGFact[]
  ): number {
    let totalScore = 0;
    let factors = 0;

    // Authority weighting (NICE/NHS/CQC get higher scores)
    const authorityScore = contexts.reduce((sum, ctx) => {
      const weight = this.getAuthorityWeight(ctx.source);
      return sum + weight;
    }, 0) / Math.max(contexts.length, 1);
    totalScore += authorityScore * 30; // 30% weight
    factors += 30;

    // Fact-check results
    const supportedClaims = factCheckResults.filter(r => r.supported).length;
    const factCheckScore = supportedClaims / Math.max(factCheckResults.length, 1) * 100;
    totalScore += factCheckScore * 25; // 25% weight
    factors += 25;

    // KG consistency
    const avgKGConfidence = kgFacts.reduce((sum, fact) => sum + fact.confidence, 0) / Math.max(kgFacts.length, 1);
    totalScore += avgKGConfidence * 20; // 20% weight
    factors += 20;

    // Recency coverage
    const recentSources = contexts.filter(ctx => this.isRecent(ctx.publishedAt)).length;
    const recencyScore = recentSources / Math.max(contexts.length, 1) * 100;
    totalScore += recencyScore * 25; // 25% weight
    factors += 25;

    return Math.round(totalScore / factors * 100) / 100;
  }

  /**
   * Get authority weight for source type
   */
  private getAuthorityWeight(source: CitationContext['source']): number {
    switch (source) {
      case 'NICE': return 100;
      case 'NHS': return 95;
      case 'CQC': return 90;
      case 'other': return 70;
      default: return 60;
    }
  }

  /**
   * Check if source is recent (within last 2 years for guidelines)
   */
  private isRecent(publishedAt: string): boolean {
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
    return new Date(publishedAt) >= twoYearsAgo;
  }

  /**
   * Generate full citation references
   */
  private generateFullCitations(contexts: CitationContext[]): Array<{
    id: string;
    inlineRef: string;
    fullReference: string;
    authority: number;
    recency: number;
  }> {
    return contexts.map(ctx => ({
      id: ctx.sourceId,
      inlineRef: `[${ctx.sourceId}]`,
      fullReference: this.formatFullReference(ctx),
      authority: this.getAuthorityWeight(ctx.source),
      recency: this.isRecent(ctx.publishedAt) ? 100 : 50
    }));
  }

  /**
   * Format short reference for inline use
   */
  private formatShortReference(ctx: CitationContext): string {
    const year = new Date(ctx.publishedAt).getFullYear();
    return `${ctx.source} ${ctx.title} (${year})`;
  }

  /**
   * Format full academic-style reference
   */
  private formatFullReference(ctx: CitationContext): string {
    const year = new Date(ctx.publishedAt).getFullYear();
    const section = ctx.section.length > 0 ? `, Section: ${ctx.section.join(' > ')}` : '';
    const page = ctx.page ? `, p. ${ctx.page}` : '';
    const version = ctx.version !== 'v1.0' ? ` (${ctx.version})` : '';
    
    return `${ctx.source}. ${ctx.title}${version}. ${year}${section}${page}`;
  }

  /**
   * Remove unsupported claims from content
   */
  async removeUnsupportedClaims(content: string, unsupportedClaims: string[]): Promise<string> {
    if (!this.openai || unsupportedClaims.length === 0) {
      return content;
    }

    try {
      const removalPrompt = `Remove or downgrade these unsupported claims from the content:

Unsupported claims to remove:
${unsupportedClaims.map((claim, i) => `${i + 1}. ${claim}`).join('\n')}

Original content:
${content}

Rules:
1. Remove claims that cannot be verified
2. For partially supported claims, add "further research may be needed" qualifier
3. Maintain content flow and readability
4. Mark any remaining uncertain claims with appropriate disclaimers

Return the revised content:`;

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: removalPrompt }],
        temperature: 0.1,
        max_tokens: 2000
      });

      return completion.choices[0]?.message?.content || content;

    } catch (error) {
      console.error('Error removing unsupported claims:', error);
      return content;
    }
  }
}

export const enhancedCitationService = new EnhancedCitationService();