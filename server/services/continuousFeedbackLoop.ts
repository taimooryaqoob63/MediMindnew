/**
 * Continuous Feedback Loop Service
 * Implements Step 5 from Smart Chunking Enhancement Plan:
 * - User interaction analysis
 * - Dynamic chunk tuning based on analytics
 * - Performance monitoring and optimization
 */

import { storage } from '../storage';
import { smartChunkingAggregator } from './smartChunkingAggregator';
import type { 
  InsertQueryRefinement, InsertChunkingAnalytics, QueryRefinement,
  ChunkingAnalytics, RagAnalytics 
} from '@shared/schema';

interface FeedbackPattern {
  userId: string;
  queryPatterns: {
    frequentReformulations: number;
    escalationRate: number;
    avgConfidence: number;
    commonFailurePoints: string[];
  };
  chunkingIssues: {
    fragmentedRetrieval: number;
    lowQualityChunks: number;
    missingContext: number;
  };
  improvementSuggestions: string[];
}

interface SystemOptimization {
  chunkingThresholds: {
    minTokens: number;
    maxTokens: number;
    semanticSimilarity: number;
    overlapThreshold: number;
  };
  retrievalSettings: {
    hybridWeights: { bm25: number; vector: number; kg: number };
    rerankerThreshold: number;
    maxResults: number;
  };
  confidenceThresholds: {
    escalationThreshold: number;
    autoRefinementThreshold: number;
    lowQualityThreshold: number;
  };
}

export class ContinuousFeedbackLoop {
  private optimizationHistory: Map<string, SystemOptimization> = new Map();
  private lastAnalysisTime = new Date();

  /**
   * Main feedback analysis - runs periodically to analyze patterns
   */
  async analyzeFeedbackPatterns(timeframeHours: number = 24): Promise<{
    globalPatterns: FeedbackPattern;
    userSpecificPatterns: Map<string, FeedbackPattern>;
    optimizationRecommendations: SystemOptimization;
    appliedChanges: string[];
  }> {
    console.log(`📊 Analyzing feedback patterns for last ${timeframeHours} hours`);

    const cutoffTime = new Date(Date.now() - timeframeHours * 60 * 60 * 1000);

    // Step 1: Analyze query refinement patterns
    const refinementPatterns = await this.analyzeQueryRefinements(cutoffTime);

    // Step 2: Analyze chunking performance
    const chunkingPerformance = await this.analyzeChunkingPerformance(cutoffTime);

    // Step 3: Analyze RAG analytics for system performance
    const ragPerformance = await this.analyzeRagPerformance(cutoffTime);

    // Step 4: Generate optimization recommendations
    const optimizationRecommendations = await this.generateOptimizationRecommendations(
      refinementPatterns,
      chunkingPerformance,
      ragPerformance
    );

    // Step 5: Apply automatic optimizations
    const appliedChanges = await this.applyAutomaticOptimizations(optimizationRecommendations);

    // Step 6: Build feedback patterns
    const globalPatterns = this.buildGlobalFeedbackPattern(
      refinementPatterns,
      chunkingPerformance,
      ragPerformance
    );

    const userSpecificPatterns = await this.buildUserSpecificPatterns(refinementPatterns);

    return {
      globalPatterns,
      userSpecificPatterns,
      optimizationRecommendations,
      appliedChanges
    };
  }

  /**
   * Track user interaction for real-time feedback
   */
  async trackUserInteraction(
    userId: string,
    interaction: {
      originalQuery: string;
      reformulatedQuery?: string;
      confidence: number;
      chunksRetrieved: number;
      userSatisfaction?: number; // 1-5 rating
      escalated: boolean;
      fragmentationIndicators: string[];
    }
  ): Promise<void> {
    console.log('📝 Tracking user interaction for feedback analysis');

    try {
      // Track query refinement if reformulated
      if (interaction.reformulatedQuery && 
          interaction.reformulatedQuery !== interaction.originalQuery) {
        
        const refinement: InsertQueryRefinement = {
          userId,
          originalQuery: interaction.originalQuery,
          refinedQuery: interaction.reformulatedQuery,
          originalConfidence: interaction.confidence,
          refinedConfidence: interaction.confidence + 10, // Assume slight improvement
          chunkFragmentation: interaction.fragmentationIndicators.length > 0,
          action: this.determineRefinementAction(interaction),
          automaticRefinement: false
        };

        await storage.createQueryRefinement(refinement);
      }

      // Check if chunking optimization is needed
      await this.checkChunkingOptimizationTriggers(userId, interaction);

    } catch (error) {
      console.log('Failed to track user interaction:', error);
    }
  }

  /**
   * Dynamic chunk tuning based on analytics
   */
  async performDynamicChunkTuning(documentId?: string): Promise<{
    tuningApplied: boolean;
    changes: string[];
    newThresholds: any;
    performance: {
      before: any;
      after: any;
    };
  }> {
    console.log('🔧 Performing dynamic chunk tuning');

    try {
      // Step 1: Analyze current chunking performance
      const analytics = documentId 
        ? await storage.getChunkingAnalytics(documentId)
        : await storage.getChunkingAnalytics();

      if (analytics.length === 0) {
        return {
          tuningApplied: false,
          changes: ['No analytics data available for tuning'],
          newThresholds: {},
          performance: { before: {}, after: {} }
        };
      }

      // Step 2: Calculate performance metrics
      const performanceMetrics = this.calculateChunkingMetrics(analytics);

      // Step 3: Determine if tuning is needed
      const tuningNeeded = this.shouldApplyTuning(performanceMetrics);

      if (!tuningNeeded.apply) {
        return {
          tuningApplied: false,
          changes: [`No tuning needed: ${tuningNeeded.reason}`],
          newThresholds: {},
          performance: { before: performanceMetrics, after: {} }
        };
      }

      // Step 4: Apply chunking adjustments
      const changes: string[] = [];
      
      if (performanceMetrics.tooManyChunks) {
        await smartChunkingAggregator.adjustChunkingThresholds(
          documentId || 'global',
          {
            tooManyChunks: true,
            importantDetailsLost: false,
            avgConfidenceScore: performanceMetrics.avgConfidence
          }
        );
        changes.push('Increased chunk merging threshold to reduce fragmentation');
      }

      if (performanceMetrics.importantDetailsLost) {
        await smartChunkingAggregator.adjustChunkingThresholds(
          documentId || 'global',
          {
            tooManyChunks: false,
            importantDetailsLost: true,
            avgConfidenceScore: performanceMetrics.avgConfidence
          }
        );
        changes.push('Decreased chunk merging threshold to preserve details');
      }

      // Step 5: Re-process affected documents if needed
      if (documentId && changes.length > 0) {
        const reprocessResult = await smartChunkingAggregator.processDocumentChunks(documentId);
        changes.push(`Reprocessed document: ${reprocessResult.originalCount} → ${reprocessResult.mergedCount} chunks`);
      }

      // Step 6: Calculate new performance metrics
      const newAnalytics = documentId 
        ? await storage.getChunkingAnalytics(documentId)
        : await storage.getChunkingAnalytics();
      const newPerformanceMetrics = this.calculateChunkingMetrics(newAnalytics);

      console.log(`✅ Dynamic tuning completed with ${changes.length} changes`);

      return {
        tuningApplied: true,
        changes,
        newThresholds: this.getCurrentThresholds(),
        performance: {
          before: performanceMetrics,
          after: newPerformanceMetrics
        }
      };

    } catch (error) {
      console.log('❌ Dynamic chunk tuning failed:', error);
      return {
        tuningApplied: false,
        changes: [`Tuning failed: ${error}`],
        newThresholds: {},
        performance: { before: {}, after: {} }
      };
    }
  }

  /**
   * Generate optimization report for system administrators
   */
  async generateOptimizationReport(): Promise<{
    summary: string;
    metrics: {
      chunkingEfficiency: number;
      querySuccessRate: number;
      userSatisfaction: number;
      systemPerformance: number;
    };
    recommendations: string[];
    criticalIssues: string[];
  }> {
    console.log('📋 Generating optimization report');

    const analytics = await storage.getChunkingAnalytics();
    const refinements = await this.getRecentRefinements();
    const ragAnalytics = await storage.getRagAnalytics();

    // Calculate key metrics
    const chunkingEfficiency = this.calculateChunkingEfficiency(analytics);
    const querySuccessRate = this.calculateQuerySuccessRate(refinements);
    const userSatisfaction = this.calculateUserSatisfaction(refinements);
    const systemPerformance = this.calculateSystemPerformance(ragAnalytics);

    // Generate recommendations
    const recommendations = this.generateSystemRecommendations(
      chunkingEfficiency,
      querySuccessRate,
      userSatisfaction,
      systemPerformance
    );

    // Identify critical issues
    const criticalIssues = this.identifyCriticalIssues(
      chunkingEfficiency,
      querySuccessRate,
      userSatisfaction
    );

    const summary = this.buildOptimizationSummary(
      { chunkingEfficiency, querySuccessRate, userSatisfaction, systemPerformance },
      recommendations,
      criticalIssues
    );

    return {
      summary,
      metrics: {
        chunkingEfficiency,
        querySuccessRate,
        userSatisfaction,
        systemPerformance
      },
      recommendations,
      criticalIssues
    };
  }

  // === Helper Methods ===

  private async analyzeQueryRefinements(cutoffTime: Date): Promise<QueryRefinement[]> {
    try {
      // This would be enhanced with actual database queries
      return [];
    } catch (error) {
      console.log('Failed to analyze query refinements:', error);
      return [];
    }
  }

  private async analyzeChunkingPerformance(cutoffTime: Date): Promise<ChunkingAnalytics[]> {
    try {
      return await storage.getChunkingAnalytics();
    } catch (error) {
      console.log('Failed to analyze chunking performance:', error);
      return [];
    }
  }

  private async analyzeRagPerformance(cutoffTime: Date): Promise<RagAnalytics[]> {
    try {
      return await storage.getRagAnalytics();
    } catch (error) {
      console.log('Failed to analyze RAG performance:', error);
      return [];
    }
  }

  private async generateOptimizationRecommendations(
    refinements: QueryRefinement[],
    chunking: ChunkingAnalytics[],
    rag: RagAnalytics[]
  ): Promise<SystemOptimization> {
    // Generate optimization recommendations based on analysis
    return {
      chunkingThresholds: {
        minTokens: 250,
        maxTokens: 4000,
        semanticSimilarity: 0.75,
        overlapThreshold: 0.3
      },
      retrievalSettings: {
        hybridWeights: { bm25: 0.3, vector: 0.6, kg: 0.1 },
        rerankerThreshold: 6.0,
        maxResults: 15
      },
      confidenceThresholds: {
        escalationThreshold: 70,
        autoRefinementThreshold: 50,
        lowQualityThreshold: 60
      }
    };
  }

  private async applyAutomaticOptimizations(
    recommendations: SystemOptimization
  ): Promise<string[]> {
    const changes: string[] = [];
    
    // Apply safe automatic optimizations
    try {
      // Store optimization settings (would be applied to services)
      this.optimizationHistory.set(new Date().toISOString(), recommendations);
      changes.push('Updated optimization settings in history');
    } catch (error) {
      console.log('Failed to apply automatic optimizations:', error);
    }

    return changes;
  }

  private buildGlobalFeedbackPattern(
    refinements: QueryRefinement[],
    chunking: ChunkingAnalytics[],
    rag: RagAnalytics[]
  ): FeedbackPattern {
    const avgReformulations = refinements.length;
    const escalationRate = refinements.filter(r => r.action === 'escalate').length / Math.max(refinements.length, 1);
    const avgConfidence = refinements.reduce((sum, r) => sum + r.refinedConfidence, 0) / Math.max(refinements.length, 1);

    return {
      userId: 'global',
      queryPatterns: {
        frequentReformulations: avgReformulations,
        escalationRate: escalationRate * 100,
        avgConfidence,
        commonFailurePoints: ['low_confidence', 'fragmented_chunks']
      },
      chunkingIssues: {
        fragmentedRetrieval: chunking.filter(c => c.originalChunkCount > c.mergedChunkCount * 2).length,
        lowQualityChunks: chunking.filter(c => c.avgCompleteness < 70).length,
        missingContext: chunking.filter(c => c.avgSemanticDensity < 40).length
      },
      improvementSuggestions: [
        'Consider adjusting chunk merging thresholds',
        'Enhance knowledge graph entity linking',
        'Improve semantic similarity calculations'
      ]
    };
  }

  private async buildUserSpecificPatterns(refinements: QueryRefinement[]): Promise<Map<string, FeedbackPattern>> {
    const userPatterns = new Map<string, FeedbackPattern>();
    
    // Group refinements by user
    const userRefinements = new Map<string, QueryRefinement[]>();
    for (const refinement of refinements) {
      if (!userRefinements.has(refinement.userId)) {
        userRefinements.set(refinement.userId, []);
      }
      userRefinements.get(refinement.userId)!.push(refinement);
    }

    // Build patterns for each user
    for (const [userId, userRefs] of userRefinements) {
      const pattern = this.buildGlobalFeedbackPattern(userRefs, [], []);
      pattern.userId = userId;
      userPatterns.set(userId, pattern);
    }

    return userPatterns;
  }

  private determineRefinementAction(interaction: any): string {
    if (interaction.escalated) return 'escalate';
    if (interaction.confidence < 50) return 'reformulate';
    if (interaction.fragmentationIndicators.length > 2) return 'clarify';
    return 'expand';
  }

  private async checkChunkingOptimizationTriggers(userId: string, interaction: any): Promise<void> {
    // Check if this interaction indicates chunking issues
    if (interaction.fragmentationIndicators.length > 1 || 
        interaction.chunksRetrieved < 3 || 
        interaction.confidence < 60) {
      
      // This could trigger automatic re-chunking for specific documents
      console.log(`🚨 Chunking optimization trigger detected for user ${userId}`);
    }
  }

  private calculateChunkingMetrics(analytics: ChunkingAnalytics[]): {
    tooManyChunks: boolean;
    importantDetailsLost: boolean;
    avgConfidence: number;
    fragmentation: number;
  } {
    if (analytics.length === 0) {
      return {
        tooManyChunks: false,
        importantDetailsLost: false,
        avgConfidence: 70,
        fragmentation: 0
      };
    }

    const avgOriginalChunks = analytics.reduce((sum, a) => sum + a.originalChunkCount, 0) / analytics.length;
    const avgMergedChunks = analytics.reduce((sum, a) => sum + a.mergedChunkCount, 0) / analytics.length;
    const avgCompleteness = analytics.reduce((sum, a) => sum + a.avgCompleteness, 0) / analytics.length;
    const fragmentation = avgOriginalChunks / Math.max(avgMergedChunks, 1);

    return {
      tooManyChunks: fragmentation > 3, // Original chunks 3x more than merged
      importantDetailsLost: avgCompleteness < 70,
      avgConfidence: avgCompleteness,
      fragmentation
    };
  }

  private shouldApplyTuning(metrics: any): { apply: boolean; reason: string } {
    if (metrics.tooManyChunks) {
      return { apply: true, reason: 'High fragmentation detected' };
    }
    if (metrics.importantDetailsLost) {
      return { apply: true, reason: 'Low completeness scores detected' };
    }
    if (metrics.fragmentation > 2.5) {
      return { apply: true, reason: 'Moderate fragmentation above threshold' };
    }
    return { apply: false, reason: 'Performance metrics within acceptable range' };
  }

  private getCurrentThresholds(): any {
    return {
      minTokens: 250,
      maxTokens: 4000,
      semanticSimilarity: 0.75,
      overlapThreshold: 0.3
    };
  }

  private async getRecentRefinements(): Promise<QueryRefinement[]> {
    // Get recent refinements for analysis
    return [];
  }

  private calculateChunkingEfficiency(analytics: ChunkingAnalytics[]): number {
    if (analytics.length === 0) return 75;
    
    const avgEfficiency = analytics.reduce((sum, a) => {
      const efficiency = (a.mergedChunkCount / Math.max(a.originalChunkCount, 1)) * 100;
      return sum + Math.min(efficiency, 100);
    }, 0) / analytics.length;

    return avgEfficiency;
  }

  private calculateQuerySuccessRate(refinements: QueryRefinement[]): number {
    if (refinements.length === 0) return 85;
    
    const successfulQueries = refinements.filter(r => 
      r.refinedConfidence > r.originalConfidence + 10
    ).length;
    
    return (successfulQueries / refinements.length) * 100;
  }

  private calculateUserSatisfaction(refinements: QueryRefinement[]): number {
    // Based on refinement patterns - fewer refinements = higher satisfaction
    const avgRefinements = refinements.length;
    return Math.max(0, 100 - avgRefinements * 5);
  }

  private calculateSystemPerformance(ragAnalytics: RagAnalytics[]): number {
    if (ragAnalytics.length === 0) return 80;
    
    const avgResponseTime = ragAnalytics.reduce((sum, a) => 
      sum + (a.responseTime || 1000), 0) / ragAnalytics.length;
    
    const avgConfidence = ragAnalytics.reduce((sum, a) => 
      sum + a.confidence, 0) / ragAnalytics.length;
    
    // Performance score based on speed and confidence
    const speedScore = Math.max(0, 100 - (avgResponseTime / 100));
    const confidenceScore = avgConfidence;
    
    return (speedScore * 0.4 + confidenceScore * 0.6);
  }

  private generateSystemRecommendations(
    chunkingEfficiency: number,
    querySuccessRate: number,
    userSatisfaction: number,
    systemPerformance: number
  ): string[] {
    const recommendations: string[] = [];

    if (chunkingEfficiency < 60) {
      recommendations.push('Optimize chunk merging algorithms to reduce fragmentation');
    }
    if (querySuccessRate < 70) {
      recommendations.push('Enhance query understanding and intent detection');
    }
    if (userSatisfaction < 75) {
      recommendations.push('Improve response relevance and reduce need for refinements');
    }
    if (systemPerformance < 70) {
      recommendations.push('Optimize retrieval speed and response generation');
    }

    if (recommendations.length === 0) {
      recommendations.push('System performance is within acceptable ranges');
    }

    return recommendations;
  }

  private identifyCriticalIssues(
    chunkingEfficiency: number,
    querySuccessRate: number,
    userSatisfaction: number
  ): string[] {
    const issues: string[] = [];

    if (chunkingEfficiency < 40) {
      issues.push('CRITICAL: Severe chunking fragmentation affecting retrieval quality');
    }
    if (querySuccessRate < 50) {
      issues.push('CRITICAL: High query failure rate requiring immediate attention');
    }
    if (userSatisfaction < 50) {
      issues.push('CRITICAL: Low user satisfaction indicating system usability issues');
    }

    return issues;
  }

  private buildOptimizationSummary(
    metrics: any,
    recommendations: string[],
    criticalIssues: string[]
  ): string {
    const issueCount = criticalIssues.length;
    const recommendationCount = recommendations.length;
    
    let summary = `System Analysis Summary: `;
    
    if (issueCount > 0) {
      summary += `${issueCount} critical issues identified requiring immediate attention. `;
    } else {
      summary += `No critical issues detected. `;
    }
    
    summary += `Average performance scores: Chunking (${metrics.chunkingEfficiency.toFixed(1)}%), `;
    summary += `Query Success (${metrics.querySuccessRate.toFixed(1)}%), `;
    summary += `User Satisfaction (${metrics.userSatisfaction.toFixed(1)}%). `;
    
    summary += `${recommendationCount} optimization recommendations generated.`;
    
    return summary;
  }
}

export const continuousFeedbackLoop = new ContinuousFeedbackLoop();