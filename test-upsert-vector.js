import { vectorStore } from './server/services/vectorStore.js';

async function testVectorUpsert() {
  try {
    console.log('🔍 Testing vector upsert functionality...');
    
    // Initialize the vector store
    await vectorStore.initialize();
    
    // Test 1: Check current index stats
    const statsBefore = await vectorStore.getIndexStats();
    console.log('\n📊 Index stats BEFORE test:', {
      totalVectorCount: statsBefore?.totalVectorCount,
      dimension: statsBefore?.dimension,
      indexFullness: statsBefore?.indexFullness
    });
    
    // Test 2: Create a simple test vector
    console.log('\n🧪 Creating test vector...');
    const testContent = 'This is a test diabetes content for vector storage verification.';
    const embedding = await vectorStore.createEmbedding(testContent);
    
    console.log(`✅ Embedding created with dimension: ${embedding.length}`);
    
    // Test 3: Upsert the vector with error handling
    console.log('\n📤 Upserting test vector...');
    try {
      await vectorStore.upsertVector(
        'upsert-test-vector-' + Date.now(),
        embedding,
        {
          content: testContent,
          title: 'Test Vector Upsert',
          source: 'upsert-test',
          contentType: 'text',
          timestamp: new Date().toISOString()
        }
      );
      console.log('✅ Vector upserted successfully!');
    } catch (upsertError) {
      console.error('❌ Upsert failed:', {
        error: upsertError.message,
        stack: upsertError.stack?.split('\n').slice(0, 3).join('\n')
      });
      return;
    }
    
    // Test 4: Wait a moment then check stats again
    console.log('\n⏳ Waiting 3 seconds for Pinecone to update...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const statsAfter = await vectorStore.getIndexStats();
    console.log('\n📊 Index stats AFTER test:', {
      totalVectorCount: statsAfter?.totalVectorCount,
      dimension: statsAfter?.dimension,
      indexFullness: statsAfter?.indexFullness
    });
    
    // Test 5: Check if the count increased
    const beforeCount = statsBefore?.totalVectorCount || 0;
    const afterCount = statsAfter?.totalVectorCount || 0;
    
    if (afterCount > beforeCount) {
      console.log(`\n✅ SUCCESS: Vector count increased from ${beforeCount} to ${afterCount}!`);
      console.log('🎉 Upsert functionality is working correctly');
    } else {
      console.log(`\n⚠️ ISSUE: Vector count unchanged (${beforeCount} -> ${afterCount})`);
      console.log('❌ This suggests vectors are not being stored properly in Pinecone');
      
      // Additional diagnostic: try to query the test vector
      console.log('\n🔍 Attempting to query for the test vector...');
      try {
        const queryResults = await vectorStore.queryVectors(embedding, 1);
        console.log('📄 Query results:', {
          resultsFound: queryResults.length,
          firstResultId: queryResults[0]?.id,
          firstResultScore: queryResults[0]?.score
        });
      } catch (queryError) {
        console.error('❌ Query also failed:', queryError.message);
      }
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testVectorUpsert();