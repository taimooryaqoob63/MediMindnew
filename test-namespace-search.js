
import { vectorStore } from './server/services/vectorStore.js';

async function testNamespaceSearch() {
  try {
    console.log('🧪 Testing namespace-aware search...');
    
    await vectorStore.initialize();
    
    // Test the exact query that failed before
    const testQuery = 'what is Easy Read Report of cqc';
    console.log(`\n🔍 Searching for: "${testQuery}"`);
    
    // Test new namespace-aware search
    const results = await vectorStore.searchSimilar(testQuery, 5);
    
    console.log('\n📊 Search Results:', {
      totalFound: results.length,
      results: results.map(r => ({
        id: r.id,
        score: r.score.toFixed(3),
        title: r.title,
        excerpt: r.excerpt.substring(0, 100) + '...'
      }))
    });
    
    if (results.length > 0) {
      console.log('\n✅ SUCCESS! RAG can now find your custom chunk');
    } else {
      console.log('\n❌ Still not finding results - checking namespaces directly...');
      
      // Direct namespace test
      const embedding = await vectorStore.createEmbedding(testQuery);
      const directResults = await vectorStore.queryVectors(embedding, 5, {}, 'page_1_sentences_1-3');
      console.log('Direct namespace results:', directResults.length);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testNamespaceSearch();
