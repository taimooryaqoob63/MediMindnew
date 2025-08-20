/**
 * Enhanced Confidence & Escalation System
 * Calculates multi-dimensional confidence scores with explainable reasoning
 */

interface ConfidenceFeatures {
  sourceAuthority: number; // 0-100: NICE/NHS/CQC weighting
  rerankerRelevance: number; // 0-100: Average LLM reranker scores  
  kgConsistency: number; // 0-100: Fraction of claims matched to KG triples
  recencyCoverage: number; // 0-100: Percentage of recent citations
  debateAgreement: number; // 0-100: Multi-agent consensus level
  citationDensity: number; // 0-100: Claims-to-citations ratio
  queryComplexity: number; // 0-100: Query difficulty assessment
}

interface ConfidenceExplanation {
  score: number; // 0-100 overall confidence
  level: 'low' | 'medium' | 'high';
  explanations: string[];
  escalationRequired: boolean;
  escalationType?: 'partial' | 'full';
  evidencePacket?: EvidencePacket;
}

interface EvidencePacket {
  query: string;
  analysis: string;
  topSources: Array<{
    id: string;
    title: string;
    excerpt: string;
    score: number;
    metadata: Record<string, any>;
  }>;
  kgTriples: Array<{
    triple: string;
    confidence: number;
    provenance: string;
  }>;
  agentDebateResults: Array<{
    agent: string;
    position: string;
    confidence: number;
  }>;
  issues: string[];
}

export class EnhancedConfidenceCalculator {
  private readonly CONFIDENCE_THRESHOLDS = {
    LOW: 60,      // Below this: escalate to human
    MEDIUM: 75,   // 60-75: answer with caution tag  
    HIGH: 75      // 75+: proceed normally
  };

  private readonly FEATURE_WEIGHTS = {
    sourceAuthority: 0.20,      // 20% - Authority of sources
    rerankerRelevance: 0.15,    // 15% - LLM reranker assessment
    kgConsistency: 0.15,        // 15% - Knowledge graph support
    recencyCoverage: 0.15,      // 15% - Recent source coverage
    debateAgreement: 0.20,      // 20% - Multi-agent consensus
    citationDensity: 0.10,      // 10% - Citation completeness
    queryComplexity: 0.05       // 5%  - Query difficulty adjustment
  };

  /**
   * Calculate comprehensive confidence score with explainable features
   */
  calculateResponseConfidence(
    sources: any[],
    kgFacts: any[],
    rerankerScores: number[],
    debateResults: any[],
    query: string,
    responseContent: string
  ): ConfidenceExplanation {
    // Calculate individual confidence features
    const features = this.calculateConfidenceFeatures(
      sources,
      kgFacts,
      rerankerScores,
      debateResults,
      query,
      responseContent
    );

    // Compute weighted overall score
    const overallScore = this.computeWeightedScore(features);

    // Generate explanations
    const explanations = this.generateExplanations(features);

    // Determine confidence level and escalation needs
    const level = this.determineConfidenceLevel(overallScore);
    const escalationRequired = overallScore < this.CONFIDENCE_THRESHOLDS.LOW;
    const escalationType = overallScore < 40 ? 'full' : 'partial';

    // Create evidence packet for escalation
    const evidencePacket = escalationRequired ? 
      this.createEvidencePacket(query, sources, kgFacts, debateResults, features) :
      undefined;

    const result: ConfidenceExplanation = {
      score: Math.round(overallScore * 100) / 100,
      level,
      explanations,
      escalationRequired,
      escalationType: escalationRequired ? escalationType : undefined,
      evidencePacket
    };

    return result;
  }

  /**
   * Calculate individual confidence features
   */
  private calculateConfidenceFeatures(
    sources: any[],
    kgFacts: any[],
    rerankerScores: number[],
    debateResults: any[],
    query: string,
    responseContent: string
  ): ConfidenceFeatures {
    return {
      sourceAuthority: this.calculateSourceAuthority(sources),
      rerankerRelevance: this.calculateRerankerRelevance(rerankerScores),
      kgConsistency: this.calculateKGConsistency(responseContent, kgFacts),
      recencyCoverage: this.calculateRecencyCoverage(sources),
      debateAgreement: this.calculateDebateAgreement(debateResults),
      citationDensity: this.calculateCitationDensity(responseContent, sources),
      queryComplexity: this.assessQueryComplexity(query)
    };
  }

  /**
   * Source Authority: Weight by NICE/NHS/CQC authority
   */
  private calculateSourceAuthority(sources: any[]): number {
    if (sources.length === 0) return 0;

    const authorityScores = sources.map(source => {
      const sourceType = source.metadata?.source || source.source || 'other';
      switch (sourceType.toLowerCase()) {
        case 'nice': return 100;
        case 'nhs': return 95;
        case 'cqc': return 90;
        case 'who': return 85;
        case 'peer_reviewed': return 80;
        case 'other': return 70;
        default: return 60;
      }
    });

    return authorityScores.reduce((sum, score) => sum + score, 0) / sources.length;
  }

  /**
   * Reranker Relevance: Average LLM reranker assessment scores
   */
  private calculateRerankerRelevance(rerankerScores: number[]): number {
    if (rerankerScores.length === 0) return 50; // Default middle score

    // Convert 0-10 LLM scores to 0-100 percentage
    const percentageScores = rerankerScores.map(score => (score / 10) * 100);
    return percentageScores.reduce((sum, score) => sum + score, 0) / percentageScores.length;
  }

  /**
   * KG Consistency: Fraction of claims supported by knowledge graph
   */
  private calculateKGConsistency(responseContent: string, kgFacts: any[]): number {
    if (kgFacts.length === 0) return 50; // Neutral if no KG data

    // Simple heuristic: count KG references in content
    const kgReferences = (responseContent.match(/\[KG\d+\]/g) || []).length;
    const availableFacts = kgFacts.length;

    if (availableFacts === 0) return 50;

    // Score based on KG fact confidence and usage
    const avgKGConfidence = kgFacts.reduce((sum, fact) => sum + (fact.confidence || 80), 0) / kgFacts.length;
    const usageScore = Math.min(kgReferences / availableFacts, 1) * 100;

    return (avgKGConfidence * 0.7) + (usageScore * 0.3);
  }

  /**
   * Recency Coverage: Percentage of citations from recent sources
   */
  private calculateRecencyCoverage(sources: any[]): number {
    if (sources.length === 0) return 0;

    const currentDate = new Date();
    const thresholdDate = new Date(currentDate.getFullYear() - 2, currentDate.getMonth(), currentDate.getDate());

    const recentSources = sources.filter(source => {
      const publishedAt = source.metadata?.publishedAt || source.publishedAt;
      if (!publishedAt) return false;
      return new Date(publishedAt) >= thresholdDate;
    }).length;

    return (recentSources / sources.length) * 100;
  }

  /**
   * Debate Agreement: Multi-agent consensus measurement
   */
  private calculateDebateAgreement(debateResults: any[]): number {
    if (debateResults.length === 0) return 75; // Default good score if no debate

    // Measure agreement between agents
    const agreements = debateResults.filter(result => 
      !result.hasDisagreement && result.consensusReached
    ).length;

    const consensusScore = (agreements / debateResults.length) * 100;

    // Also factor in individual agent confidence
    const avgAgentConfidence = debateResults.reduce((sum, result) => 
      sum + (result.confidence || 75), 0
    ) / debateResults.length;

    return (consensusScore * 0.6) + (avgAgentConfidence * 0.4);
  }

  /**
   * Citation Density: Claims-to-citations ratio
   */
  private calculateCitationDensity(responseContent: string, sources: any[]): number {
    // Count sentences with factual claims (simplified heuristic)
    const sentences = responseContent.split(/[.!?]+/).filter(s => s.trim().length > 10);
    const factualSentences = sentences.filter(sentence => 
      /\b(should|must|recommended|evidence|study|research|guideline)\b/i.test(sentence)
    ).length;

    // Count citations in content
    const citations = (responseContent.match(/\[(S\d+|KG\d+)\]/g) || []).length;

    if (factualSentences === 0) return 100; // No claims need no citations
    if (citations === 0) return 0; // Claims with no citations

    const citationRatio = Math.min(citations / factualSentences, 1);
    return citationRatio * 100;
  }

  /**
   * Query Complexity: Assess difficulty/specificity of query
   */
  private assessQueryComplexity(query: string): number {
    // Higher complexity queries should have adjusted confidence expectations
    const complexityIndicators = [
      /dosage|dose|mg|ml|units/i,           // Specific dosing
      /contraindication|adverse|side effect/i, // Safety concerns
      /pediatric|geriatric|pregnancy/i,      // Special populations
      /emergency|urgent|critical/i,          // Emergency scenarios
      /differential diagnosis/i,             // Complex diagnosis
      /multiple|combination|interaction/i    // Multi-factor scenarios
    ];

    const complexityScore = complexityIndicators.reduce((score, pattern) => 
      score + (pattern.test(query) ? 1 : 0), 0
    );

    // Convert to 0-100 scale (higher complexity = lower adjustment factor)
    return Math.max(100 - (complexityScore * 15), 20);
  }

  /**
   * Compute weighted overall confidence score
   */
  private computeWeightedScore(features: ConfidenceFeatures): number {
    let weightedSum = 0;
    let totalWeight = 0;

    for (const [feature, weight] of Object.entries(this.FEATURE_WEIGHTS)) {
      const featureValue = features[feature as keyof ConfidenceFeatures];
      weightedSum += featureValue * weight;
      totalWeight += weight;
    }

    return weightedSum / totalWeight;
  }

  /**
   * Generate human-readable explanations for confidence score
   */
  private generateExplanations(features: ConfidenceFeatures): string[] {
    const explanations: string[] = [];

    // Source authority
    if (features.sourceAuthority >= 90) {
      explanations.push("High authority sources (NICE/NHS guidelines)");
    } else if (features.sourceAuthority >= 70) {
      explanations.push("Good source authority");
    } else {
      explanations.push("Limited authoritative sources");
    }

    // Reranker relevance
    if (features.rerankerRelevance >= 80) {
      explanations.push("Highly relevant content matches");
    } else if (features.rerankerRelevance >= 60) {
      explanations.push("Adequate content relevance");
    } else {
      explanations.push("Questionable content relevance");
    }

    // KG consistency
    if (features.kgConsistency >= 80) {
      explanations.push("Strong knowledge graph support");
    } else if (features.kgConsistency >= 60) {
      explanations.push("Moderate knowledge graph alignment");
    } else {
      explanations.push("Limited knowledge graph validation");
    }

    // Recency
    if (features.recencyCoverage >= 70) {
      explanations.push("Recent and up-to-date sources");
    } else if (features.recencyCoverage >= 40) {
      explanations.push("Mix of recent and older sources");
    } else {
      explanations.push("Primarily older sources");
    }

    // Debate agreement
    if (features.debateAgreement >= 85) {
      explanations.push("Strong multi-agent consensus");
    } else if (features.debateAgreement >= 70) {
      explanations.push("Good agent agreement");
    } else {
      explanations.push("Conflicting expert opinions");
    }

    return explanations;
  }

  /**
   * Determine confidence level category
   */
  private determineConfidenceLevel(score: number): 'low' | 'medium' | 'high' {
    if (score < this.CONFIDENCE_THRESHOLDS.LOW) return 'low';
    if (score < this.CONFIDENCE_THRESHOLDS.MEDIUM) return 'medium';
    return 'high';
  }

  /**
   * Create evidence packet for human escalation
   */
  private createEvidencePacket(
    query: string,
    sources: any[],
    kgFacts: any[],
    debateResults: any[],
    features: ConfidenceFeatures
  ): EvidencePacket {
    return {
      query,
      analysis: `Multi-dimensional confidence analysis with ${Object.keys(features).length} factors evaluated`,
      topSources: sources.slice(0, 5).map(source => ({
        id: source.id || 'unknown',
        title: source.title || 'Untitled',
        excerpt: source.excerpt || source.content?.substring(0, 200) || '',
        score: source.score || 0,
        metadata: source.metadata || {}
      })),
      kgTriples: kgFacts.slice(0, 10).map(fact => ({
        triple: fact.triple || `${fact.subject || 'Unknown'} ${fact.predicate || 'relates to'} ${fact.object || 'Unknown'}`,
        confidence: fact.confidence || 0,
        provenance: fact.provenance?.docId || 'Unknown source'
      })),
      agentDebateResults: debateResults.map(result => ({
        agent: result.agent || 'Unknown Agent',
        position: result.position || result.recommendation || 'No position recorded',
        confidence: result.confidence || 0
      })),
      issues: this.identifyIssues(features)
    };
  }

  /**
   * Identify specific issues affecting confidence
   */
  private identifyIssues(features: ConfidenceFeatures): string[] {
    const issues: string[] = [];

    if (features.sourceAuthority < 70) {
      issues.push("Insufficient authoritative medical sources");
    }

    if (features.rerankerRelevance < 60) {
      issues.push("Poor content-query relevance match");
    }

    if (features.kgConsistency < 60) {
      issues.push("Limited knowledge graph validation");
    }

    if (features.recencyCoverage < 40) {
      issues.push("Primarily outdated sources");
    }

    if (features.debateAgreement < 70) {
      issues.push("Significant disagreement between expert agents");
    }

    if (features.citationDensity < 60) {
      issues.push("Insufficient citation coverage for claims");
    }

    if (features.queryComplexity < 40) {
      issues.push("High complexity query requiring specialist review");
    }

    return issues;
  }

  /**
   * Get confidence threshold for escalation decision
   */
  getEscalationThresholds(): { lower: number; upper: number } {
    return {
      lower: this.CONFIDENCE_THRESHOLDS.LOW,
      upper: this.CONFIDENCE_THRESHOLDS.HIGH
    };
  }
}

export const enhancedConfidenceCalculator = new EnhancedConfidenceCalculator();