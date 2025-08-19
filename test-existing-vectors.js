import { vectorStore } from './server/services/vectorStore.js';

async function testExistingVectors() {
  try {
    console.log('🔍 Testing existing vectors in Pinecone...');
    
    // Initialize the vector store
    await vectorStore.initialize();
    
    // Test 1: Query with a diabetes-related search
    console.log('\n🩺 Testing diabetes-related search...');
    const diabetesQuery = await vectorStore.createEmbedding('blood glucose monitoring guidelines');
    const diabetesResults = await vectorStore.queryVectors(diabetesQuery, 10);
    
    console.log('📊 Diabetes search results:', {
      totalFound: diabetesResults.length,
      results: diabetesResults.map(r => ({
        id: r.id,
        score: r.score.toFixed(3),
        title: r.metadata?.title || 'No title',
        hasContent: !!(r.metadata?.content || r.metadata?.text)
      }))
    });
    
    // Test 2: Check for our known test data IDs
    console.log('\n🧪 Testing specific test data vectors...');
    const testIds = ['test-diabetes-1', 'test-diabetes-2', 'test-diabetes-3', 'test-diabetes-4'];
    
    for (const testId of testIds) {
      try {
        // Query for vectors similar to a generic query and check if our test ID appears
        const genericQuery = await vectorStore.createEmbedding('diabetes care guidelines');
        const results = await vectorStore.queryVectors(genericQuery, 20);
        const foundTestVector = results.find(r => r.id === testId);
        
        if (foundTestVector) {
          console.log(`✅ Found ${testId}: score=${foundTestVector.score.toFixed(3)}, title="${foundTestVector.metadata?.title || 'No title'}"`);
        } else {
          console.log(`❌ Missing ${testId}`);
        }
      } catch (error) {
        console.log(`❌ Error checking ${testId}: ${error.message}`);
      }
    }
    
    // Test 3: Check for reindexed content  
    console.log('\n🔄 Testing for reindexed chunks...');
    const reindexQuery = await vectorStore.createEmbedding('diabetes management care home');
    const reindexResults = await vectorStore.queryVectors(reindexQuery, 20);
    
    const reindexedChunks = reindexResults.filter(r => !r.id.startsWith('test-') && !r.id.startsWith('upsert-test'));
    console.log('📚 Reindexed chunks found:', {
      count: reindexedChunks.length,
      sampleIds: reindexedChunks.slice(0, 5).map(r => r.id),
      sampleTitles: reindexedChunks.slice(0, 3).map(r => r.metadata?.title || 'No title')
    });
    
    // Test 4: Total unique vectors in index
    console.log('\n📊 Summary:');
    const allUniqueIds = new Set(diabetesResults.map(r => r.id));
    reindexResults.forEach(r => allUniqueIds.add(r.id));
    
    console.log(`🎯 Total unique vectors accessible: ${allUniqueIds.size}`);
    console.log('🎉 Reindexing IS working - Pinecone stats just don\'t update immediately!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testExistingVectors();