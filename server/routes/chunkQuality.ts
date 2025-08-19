
import { Router } from 'express';
import { storage } from '../storage';

const router = Router();

interface ChunkQualityMetrics {
  documentId: string;
  documentTitle: string;
  totalChunks: number;
  avgTokens: number;
  avgQuality: number;
  chunksWithVectors: number;
  enhancedChunks: number;
  qualityDistribution: {
    excellent: number;
    good: number;
    poor: number;
  };
}

function estimateTokens(text: string): number {
  return Math.ceil(text.split(/\s+/).length * 0.75);
}

function calculateChunkQuality(chunk: any, tokenCount: number): number {
  let score = 50; // Base score
  
  // Size quality (0-25 points)
  if (tokenCount >= 200 && tokenCount <= 1000) {
    score += 25;
  } else if (tokenCount >= 100 && tokenCount < 200) {
    score += 15;
  } else if (tokenCount > 1000 && tokenCount <= 1500) {
    score += 20;
  } else {
    score += 5;
  }
  
  // Vector presence (0-15 points)
  if (chunk.vectorId) score += 15;
  
  // Metadata quality (0-10 points)
  if (chunk.metadata) {
    score += 5;
    if (chunk.metadata.enhanced) score += 3;
    if (chunk.metadata.sectionPath?.length > 0) score += 2;
  }
  
  // Content quality indicators
  const hasStructure = /\n\n|\. [A-Z]/.test(chunk.content);
  const hasHeaders = /^[A-Z][^.!?]*:?\s*$/m.test(chunk.content);
  const isNotTooRepetitive = !(/(.{20,})\1{2,}/.test(chunk.content));
  
  if (hasStructure) score += 3;
  if (hasHeaders) score += 2;
  if (isNotTooRepetitive) score += 5;
  
  return Math.min(100, Math.max(0, score));
}

router.get('/analysis', async (req, res) => {
  try {
    const documents = await storage.getAllDocuments();
    const allChunks = await storage.getAllDocumentChunks();
    
    const analysis: ChunkQualityMetrics[] = [];
    let totalQualityScores: number[] = [];
    let totalTokenCounts: number[] = [];
    
    for (const doc of documents) {
      const docChunks = allChunks.filter(chunk => chunk.documentId === doc.id);
      
      if (docChunks.length === 0) continue;
      
      let docQualityScores: number[] = [];
      let docTokenCounts: number[] = [];
      let chunksWithVectors = 0;
      let enhancedChunks = 0;
      
      for (const chunk of docChunks) {
        const tokenCount = chunk.tokenCount || estimateTokens(chunk.content);
        const qualityScore = calculateChunkQuality(chunk, tokenCount);
        
        docQualityScores.push(qualityScore);
        docTokenCounts.push(tokenCount);
        totalQualityScores.push(qualityScore);
        totalTokenCounts.push(tokenCount);
        
        if (chunk.vectorId) chunksWithVectors++;
        if (chunk.metadata?.enhanced) enhancedChunks++;
      }
      
      const avgQuality = docQualityScores.reduce((a, b) => a + b, 0) / docQualityScores.length;
      const avgTokens = docTokenCounts.reduce((a, b) => a + b, 0) / docTokenCounts.length;
      
      const excellent = docQualityScores.filter(q => q >= 80).length;
      const good = docQualityScores.filter(q => q >= 60 && q < 80).length;
      const poor = docQualityScores.filter(q => q < 60).length;
      
      analysis.push({
        documentId: doc.id,
        documentTitle: doc.title,
        totalChunks: docChunks.length,
        avgTokens: Math.round(avgTokens),
        avgQuality: Math.round(avgQuality * 10) / 10,
        chunksWithVectors,
        enhancedChunks,
        qualityDistribution: { excellent, good, poor }
      });
    }
    
    // Overall statistics
    const overallStats = {
      totalDocuments: documents.length,
      totalChunks: allChunks.length,
      avgQualityOverall: totalQualityScores.length > 0 
        ? Math.round((totalQualityScores.reduce((a, b) => a + b, 0) / totalQualityScores.length) * 10) / 10 
        : 0,
      avgTokensOverall: totalTokenCounts.length > 0 
        ? Math.round(totalTokenCounts.reduce((a, b) => a + b, 0) / totalTokenCounts.length) 
        : 0,
      chunksWithVectors: allChunks.filter(c => c.vectorId).length,
      enhancedChunks: allChunks.filter(c => c.metadata?.enhanced).length
    };
    
    res.json({
      analysis,
      overallStats,
      recommendations: generateRecommendations(overallStats, totalTokenCounts, totalQualityScores)
    });
    
  } catch (error) {
    console.error('Error analyzing chunk quality:', error);
    res.status(500).json({ error: 'Failed to analyze chunk quality' });
  }
});

function generateRecommendations(stats: any, tokenCounts: number[], qualityScores: number[]): string[] {
  const recommendations: string[] = [];
  
  if (stats.avgTokensOverall < 200) {
    recommendations.push('Chunks are quite small - consider merging related chunks for better context');
  } else if (stats.avgTokensOverall > 1500) {
    recommendations.push('Chunks are large - consider splitting for better retrieval precision');
  }
  
  if (stats.chunksWithVectors < stats.totalChunks) {
    recommendations.push(`${stats.totalChunks - stats.chunksWithVectors} chunks missing vector embeddings`);
  }
  
  if (stats.avgQualityOverall < 70) {
    recommendations.push('Overall chunk quality could be improved - consider better content extraction');
  }
  
  const tokenVariance = calculateStdDev(tokenCounts);
  if (tokenVariance > stats.avgTokensOverall * 0.5) {
    recommendations.push('High variance in chunk sizes - consider more consistent chunking strategy');
  }
  
  const poorQualityCount = qualityScores.filter(q => q < 60).length;
  if (poorQualityCount > qualityScores.length * 0.2) {
    recommendations.push('More than 20% of chunks have poor quality - review chunking strategy');
  }
  
  return recommendations;
}

function calculateStdDev(numbers: number[]): number {
  const mean = numbers.reduce((a, b) => a + b, 0) / numbers.length;
  const squaredDiffs = numbers.map(num => Math.pow(num - mean, 2));
  const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / numbers.length;
  return Math.sqrt(avgSquaredDiff);
}

export default router;
