
import { storage } from './server/storage.js';

async function analyzeChunkQuality() {
  try {
    console.log('\n🔍 CHUNK QUALITY ANALYSIS\n');
    console.log('='.repeat(60));

    const documents = await storage.getAllDocuments();
    const allChunks = await storage.getAllDocumentChunks();
    
    if (allChunks.length === 0) {
      console.log('❌ No chunks found for analysis');
      return;
    }

    console.log(`📚 Total Documents: ${documents.length}`);
    console.log(`📄 Total Chunks: ${allChunks.length}`);
    console.log(`📊 Average chunks per document: ${(allChunks.length / documents.length).toFixed(1)}`);

    // Analyze chunk sizes and quality metrics
    let totalTokens = 0;
    let totalCharacters = 0;
    let chunksWithVectors = 0;
    let chunksWithMetadata = 0;
    let qualityScores = [];
    let tokenCounts = [];
    let characterCounts = [];
    
    console.log('\n📋 DETAILED CHUNK ANALYSIS:');
    console.log('-'.repeat(50));

    for (const doc of documents) {
      const docChunks = allChunks.filter(chunk => chunk.documentId === doc.id);
      console.log(`\n📖 Document: ${doc.title}`);
      console.log(`   Chunks: ${docChunks.length}`);
      
      let docTokens = 0;
      let docChars = 0;
      let docQualitySum = 0;
      
      for (const chunk of docChunks) {
        const charCount = chunk.content.length;
        const tokenCount = chunk.tokenCount || estimateTokens(chunk.content);
        
        totalTokens += tokenCount;
        totalCharacters += charCount;
        docTokens += tokenCount;
        docChars += charCount;
        
        tokenCounts.push(tokenCount);
        characterCounts.push(charCount);
        
        if (chunk.vectorId) chunksWithVectors++;
        if (chunk.metadata) chunksWithMetadata++;
        
        // Calculate quality score based on multiple factors
        const qualityScore = calculateChunkQuality(chunk, tokenCount, charCount);
        qualityScores.push(qualityScore);
        docQualitySum += qualityScore;
        
        console.log(`   📄 Chunk ${chunk.chunkIndex + 1}:`);
        console.log(`      • Size: ${charCount} chars, ~${tokenCount} tokens`);
        console.log(`      • Quality Score: ${qualityScore.toFixed(1)}%`);
        console.log(`      • Vector: ${chunk.vectorId ? '✅' : '❌'}`);
        console.log(`      • Enhanced: ${chunk.metadata?.enhanced ? '✅' : '❌'}`);
        
        if (chunk.metadata) {
          console.log(`      • Section: ${chunk.metadata.sectionPath?.join(' > ') || 'N/A'}`);
          console.log(`      • Type: ${chunk.metadata.nodeType || 'N/A'}`);
          if (chunk.metadata.semanticDensity) {
            console.log(`      • Semantic Density: ${chunk.metadata.semanticDensity}`);
          }
          if (chunk.metadata.completeness) {
            console.log(`      • Completeness: ${chunk.metadata.completeness}%`);
          }
        }
      }
      
      console.log(`   📊 Document Summary:`);
      console.log(`      • Total tokens: ${docTokens}`);
      console.log(`      • Avg tokens/chunk: ${(docTokens / docChunks.length).toFixed(0)}`);
      console.log(`      • Avg quality: ${(docQualitySum / docChunks.length).toFixed(1)}%`);
    }

    // Overall statistics
    console.log('\n📊 OVERALL QUALITY METRICS:');
    console.log('-'.repeat(50));
    
    const avgTokens = totalTokens / allChunks.length;
    const avgChars = totalCharacters / allChunks.length;
    const avgQuality = qualityScores.reduce((a, b) => a + b, 0) / qualityScores.length;
    
    console.log(`📈 Token Statistics:`);
    console.log(`   • Average: ${avgTokens.toFixed(0)} tokens/chunk`);
    console.log(`   • Min: ${Math.min(...tokenCounts)} tokens`);
    console.log(`   • Max: ${Math.max(...tokenCounts)} tokens`);
    console.log(`   • Std Dev: ${calculateStdDev(tokenCounts).toFixed(0)}`);
    
    console.log(`\n📏 Character Statistics:`);
    console.log(`   • Average: ${avgChars.toFixed(0)} chars/chunk`);
    console.log(`   • Min: ${Math.min(...characterCounts)} chars`);
    console.log(`   • Max: ${Math.max(...characterCounts)} chars`);
    
    console.log(`\n⭐ Quality Metrics:`);
    console.log(`   • Overall Quality Score: ${avgQuality.toFixed(1)}%`);
    console.log(`   • Chunks with vectors: ${chunksWithVectors}/${allChunks.length} (${(chunksWithVectors/allChunks.length*100).toFixed(1)}%)`);
    console.log(`   • Enhanced chunks: ${chunksWithMetadata}/${allChunks.length} (${(chunksWithMetadata/allChunks.length*100).toFixed(1)}%)`);
    
    // Quality distribution
    const excellentChunks = qualityScores.filter(q => q >= 80).length;
    const goodChunks = qualityScores.filter(q => q >= 60 && q < 80).length;
    const poorChunks = qualityScores.filter(q => q < 60).length;
    
    console.log(`\n📊 Quality Distribution:`);
    console.log(`   • Excellent (80-100%): ${excellentChunks} chunks (${(excellentChunks/allChunks.length*100).toFixed(1)}%)`);
    console.log(`   • Good (60-79%): ${goodChunks} chunks (${(goodChunks/allChunks.length*100).toFixed(1)}%)`);
    console.log(`   • Needs Improvement (<60%): ${poorChunks} chunks (${(poorChunks/allChunks.length*100).toFixed(1)}%)`);
    
    // Recommendations
    console.log('\n💡 RECOMMENDATIONS:');
    console.log('-'.repeat(50));
    
    if (avgTokens < 200) {
      console.log('⚠️  Chunks are quite small - consider merging related chunks');
    } else if (avgTokens > 1500) {
      console.log('⚠️  Chunks are large - consider splitting for better retrieval');
    } else {
      console.log('✅ Chunk sizes are well-balanced');
    }
    
    if (chunksWithVectors < allChunks.length) {
      console.log(`⚠️  ${allChunks.length - chunksWithVectors} chunks missing vector embeddings`);
    } else {
      console.log('✅ All chunks have vector embeddings');
    }
    
    if (avgQuality < 70) {
      console.log('⚠️  Overall chunk quality could be improved');
      console.log('   Consider: better content extraction, semantic chunking, metadata enhancement');
    } else {
      console.log('✅ Good overall chunk quality');
    }
    
    const tokenVariance = calculateStdDev(tokenCounts);
    if (tokenVariance > avgTokens * 0.5) {
      console.log('⚠️  High variance in chunk sizes - consider more consistent chunking');
    } else {
      console.log('✅ Consistent chunk sizing');
    }
    
  } catch (error) {
    console.error('❌ Error analyzing chunk quality:', error);
  }
}

function estimateTokens(text) {
  return Math.ceil(text.split(/\s+/).length * 0.75);
}

function calculateChunkQuality(chunk, tokenCount, charCount) {
  let score = 50; // Base score
  
  // Size quality (0-25 points)
  if (tokenCount >= 200 && tokenCount <= 1000) {
    score += 25; // Ideal size
  } else if (tokenCount >= 100 && tokenCount < 200) {
    score += 15; // Acceptable but small
  } else if (tokenCount > 1000 && tokenCount <= 1500) {
    score += 20; // Large but manageable
  } else {
    score += 5; // Too small or too large
  }
  
  // Vector presence (0-15 points)
  if (chunk.vectorId) {
    score += 15;
  }
  
  // Metadata quality (0-10 points)
  if (chunk.metadata) {
    score += 5;
    if (chunk.metadata.enhanced) score += 3;
    if (chunk.metadata.sectionPath && chunk.metadata.sectionPath.length > 0) score += 2;
  }
  
  // Content quality indicators
  const hasStructure = /\n\n|\. [A-Z]/.test(chunk.content); // Paragraphs or sentences
  const hasHeaders = /^[A-Z][^.!?]*:?\s*$/m.test(chunk.content); // Headers
  const isNotTooRepetitive = !(/(.{20,})\1{2,}/.test(chunk.content)); // Not overly repetitive
  
  if (hasStructure) score += 3;
  if (hasHeaders) score += 2;
  if (isNotTooRepetitive) score += 5;
  
  return Math.min(100, Math.max(0, score));
}

function calculateStdDev(numbers) {
  const mean = numbers.reduce((a, b) => a + b, 0) / numbers.length;
  const squaredDiffs = numbers.map(num => Math.pow(num - mean, 2));
  const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / numbers.length;
  return Math.sqrt(avgSquaredDiff);
}

// Run the analysis
analyzeChunkQuality().then(() => {
  console.log('\n✅ Chunk quality analysis complete');
  process.exit(0);
}).catch(error => {
  console.error('❌ Analysis failed:', error);
  process.exit(1);
});
