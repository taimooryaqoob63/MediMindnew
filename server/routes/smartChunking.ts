/**
 * Smart Chunking API Routes
 * Provides endpoints for testing and managing the enhanced chunking system
 */

import { Router, Request, Response } from 'express';
import { smartChunkingAggregator } from '../services/smartChunkingAggregator';
import { enhancedRetrievalWithReranking } from '../services/enhancedRetrievalWithReranking';
import { continuousFeedbackLoop } from '../services/continuousFeedbackLoop';
import { storage } from '../storage';

const router = Router();

/**
 * Process document chunks with smart aggregation
 */
router.post('/process-document/:documentId', async (req: Request, res: Response) => {
  try {
    const { documentId } = req.params;
    
    console.log(`📚 Processing document ${documentId} with smart chunking aggregation`);
    
    const result = await smartChunkingAggregator.processDocumentChunks(documentId);
    
    res.json({
      success: result.success,
      message: result.success 
        ? `Smart chunking completed: ${result.originalCount} → ${result.mergedCount} chunks`
        : 'Smart chunking failed',
      data: {
        originalCount: result.originalCount,
        mergedCount: result.mergedCount,
        qualityImprovement: `${result.qualityImprovement.toFixed(1)}%`,
        analytics: result.analytics
      }
    });
  } catch (error) {
    console.error('Smart chunking processing failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process document chunks',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Enhanced retrieval with reranking
 */
router.post('/enhanced-retrieval', async (req: Request, res: Response) => {
  try {
    const { query, userId, options = {} } = req.body;
    
    if (!query) {
      return res.status(400).json({
        success: false,
        message: 'Query is required'
      });
    }
    
    console.log(`🔍 Enhanced retrieval for query: "${query}"`);
    
    const result = await enhancedRetrievalWithReranking.performEnhancedRetrieval(
      query,
      userId || 'anonymous',
      {
        limit: options.limit || 10,
        useKGExpansion: options.useKGExpansion !== false,
        useLLMReranker: options.useLLMReranker !== false,
        queryType: options.queryType || 'educational',
        minConfidence: options.minConfidence || 70
      }
    );
    
    res.json({
      success: true,
      message: `Retrieved ${result.chunks.length} enhanced chunks`,
      data: {
        chunks: result.chunks.map(chunk => ({
          id: chunk.id,
          content: chunk.content.substring(0, 300) + '...',
          sectionPath: chunk.sectionPath,
          tokenCount: chunk.tokenCount,
          confidenceScore: chunk.confidenceScore
        })),
        rerankerResults: result.rerankerResults.map(r => ({
          chunkId: r.chunkId,
          overallScore: r.overallScore,
          relevanceScore: r.relevanceScore,
          accuracyScore: r.accuracyScore,
          completenessScore: r.completenessScore,
          reasoning: r.reasoning
        })),
        kgExpansion: result.kgExpansion,
        synthesizedAnswer: result.synthesizedAnswer ? {
          content: result.synthesizedAnswer.content,
          confidence: result.synthesizedAnswer.confidence,
          escalationNeeded: result.synthesizedAnswer.escalationNeeded,
          sourceCount: result.synthesizedAnswer.sources.length
        } : null,
        refinementSuggestions: result.refinementSuggestions
      }
    });
  } catch (error) {
    console.error('Enhanced retrieval failed:', error);
    res.status(500).json({
      success: false,
      message: 'Enhanced retrieval failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Analyze feedback patterns
 */
router.get('/feedback-analysis', async (req: Request, res: Response) => {
  try {
    const timeframeHours = parseInt(req.query.timeframe as string) || 24;
    
    console.log(`📊 Analyzing feedback patterns for last ${timeframeHours} hours`);
    
    const analysis = await continuousFeedbackLoop.analyzeFeedbackPatterns(timeframeHours);
    
    res.json({
      success: true,
      message: 'Feedback analysis completed',
      data: {
        globalPatterns: analysis.globalPatterns,
        userPatternCount: analysis.userSpecificPatterns.size,
        optimizationRecommendations: analysis.optimizationRecommendations,
        appliedChanges: analysis.appliedChanges
      }
    });
  } catch (error) {
    console.error('Feedback analysis failed:', error);
    res.status(500).json({
      success: false,
      message: 'Feedback analysis failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Perform dynamic chunk tuning
 */
router.post('/dynamic-tuning', async (req: Request, res: Response) => {
  try {
    const { documentId } = req.body;
    
    console.log('🔧 Performing dynamic chunk tuning');
    
    const result = await continuousFeedbackLoop.performDynamicChunkTuning(documentId);
    
    res.json({
      success: result.tuningApplied,
      message: result.tuningApplied 
        ? `Dynamic tuning applied with ${result.changes.length} changes`
        : 'No tuning needed',
      data: {
        tuningApplied: result.tuningApplied,
        changes: result.changes,
        newThresholds: result.newThresholds,
        performance: result.performance
      }
    });
  } catch (error) {
    console.error('Dynamic tuning failed:', error);
    res.status(500).json({
      success: false,
      message: 'Dynamic tuning failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Generate optimization report
 */
router.get('/optimization-report', async (req: Request, res: Response) => {
  try {
    console.log('📋 Generating optimization report');
    
    const report = await continuousFeedbackLoop.generateOptimizationReport();
    
    res.json({
      success: true,
      message: 'Optimization report generated',
      data: report
    });
  } catch (error) {
    console.error('Report generation failed:', error);
    res.status(500).json({
      success: false,
      message: 'Report generation failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get chunking analytics
 */
router.get('/analytics/:documentId?', async (req: Request, res: Response) => {
  try {
    const { documentId } = req.params;
    
    const analytics = await storage.getChunkingAnalytics(documentId);
    
    res.json({
      success: true,
      message: `Retrieved ${analytics.length} analytics records`,
      data: {
        analytics: analytics.map(a => ({
          documentId: a.documentId,
          originalChunkCount: a.originalChunkCount,
          mergedChunkCount: a.mergedChunkCount,
          avgTokenCount: a.avgTokenCount,
          avgSemanticDensity: a.avgSemanticDensity,
          avgCompleteness: a.avgCompleteness,
          duplicatesRemoved: a.duplicatesRemoved,
          createdAt: a.createdAt
        }))
      }
    });
  } catch (error) {
    console.error('Analytics retrieval failed:', error);
    res.status(500).json({
      success: false,
      message: 'Analytics retrieval failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Track user interaction for feedback loop
 */
router.post('/track-interaction', async (req: Request, res: Response) => {
  try {
    const { userId, interaction } = req.body;
    
    if (!userId || !interaction) {
      return res.status(400).json({
        success: false,
        message: 'UserId and interaction data are required'
      });
    }
    
    await continuousFeedbackLoop.trackUserInteraction(userId, interaction);
    
    res.json({
      success: true,
      message: 'User interaction tracked successfully'
    });
  } catch (error) {
    console.error('Interaction tracking failed:', error);
    res.status(500).json({
      success: false,
      message: 'Interaction tracking failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export { router as smartChunkingRoutes };