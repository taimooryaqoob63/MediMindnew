import { Pinecone } from '@pinecone-database/pinecone';

async function checkIndexingProgress() {
  try {
    console.log('🔍 Checking current indexing progress...');
    
    const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
    const index = pinecone.index('medimind-rag');
    
    // Get detailed index stats
    const stats = await index.describeIndexStats();
    console.log('\n📊 Current Index Statistics:', {
      totalVectorCount: stats.totalVectorCount,
      dimension: stats.dimension,
      indexFullness: stats.indexFullness,
      namespaces: Object.keys(stats.namespaces || {}).length
    });
    
    // Check if we have vectors from both our test data and the ongoing reindexing
    if (stats.totalVectorCount > 0) {
      console.log('\n✅ Index has vectors! Testing search functionality...');
      
      // Test search with a simple diabetes query
      const testResults = await index.query({
        vector: new Array(1536).fill(0.1),
        topK: 5,
        includeMetadata: true
      });
      
      console.log('\n🔍 Sample vectors in index:', {
        totalFound: testResults.matches?.length || 0,
        sampleIds: testResults.matches?.slice(0, 3).map(m => m.id) || []
      });
      
      // Check for our test data specifically
      const testDataIds = ['test-diabetes-1', 'test-diabetes-2', 'test-diabetes-3', 'test-diabetes-4'];
      const foundTestData = testResults.matches?.filter(m => testDataIds.includes(m.id)) || [];
      
      console.log('\n🧪 Test data status:', {
        testDataFound: foundTestData.length,
        testIds: foundTestData.map(m => m.id)
      });
      
      // Sample some metadata to verify content is stored
      if (testResults.matches && testResults.matches.length > 0) {
        const firstMatch = testResults.matches[0];
        console.log('\n📄 Sample metadata structure:', {
          id: firstMatch.id,
          hasContent: !!(firstMatch.metadata?.content || firstMatch.metadata?.text),
          hasTitle: !!firstMatch.metadata?.title,
          hasSource: !!firstMatch.metadata?.source,
          metadataKeys: Object.keys(firstMatch.metadata || {})
        });
        
        const contentLength = (firstMatch.metadata?.content || firstMatch.metadata?.text || '').length;
        console.log(`📝 Content preview (${contentLength} chars):`, 
          (firstMatch.metadata?.content || firstMatch.metadata?.text || 'No content').substring(0, 100) + '...');
      }
      
    } else {
      console.log('\n⚠️ Index appears empty - reindexing may not be working properly');
      
      // Check if there are any errors in the indexing process
      console.log('🔄 Checking if reindexing process is active...');
      console.log('📊 From logs: Current batch processing appears to be at batch 23/824');
      console.log('📊 This suggests about 2.8% completion of the reindexing process');
    }
    
  } catch (error) {
    console.error('❌ Error checking indexing progress:', error);
  }
}

checkIndexingProgress();