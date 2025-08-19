import { Pinecone } from '@pinecone-database/pinecone';

async function testPineconeConnection() {
  try {
    console.log('🧪 Testing Pinecone connection...');
    
    if (!process.env.PINECONE_API_KEY) {
      console.error('❌ PINECONE_API_KEY not found');
      return;
    }
    
    const pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY
    });
    
    // List all indexes
    const indexList = await pinecone.listIndexes();
    console.log('📝 Available indexes:', indexList.indexes?.map(i => i.name) || []);
    
    // Check our specific index
    const indexName = 'medimind-rag';
    const index = pinecone.index(indexName);
    
    // Get index stats
    const stats = await index.describeIndexStats();
    console.log(`📊 Index "${indexName}" stats:`, {
      totalVectorCount: stats.totalVectorCount,
      dimension: stats.dimension,
      indexFullness: stats.indexFullness
    });
    
    if (stats.totalVectorCount > 0) {
      console.log('✅ Index has vectors - connection working!');
      
      // Test a simple query
      const queryResults = await index.query({
        vector: new Array(1536).fill(0.1), // Dummy vector
        topK: 1,
        includeValues: false,
        includeMetadata: true
      });
      
      console.log('🔍 Test query results:', queryResults.matches?.length || 0, 'matches found');
    } else {
      console.log('⚠️ Index is empty - this explains the reindexing');
    }
    
  } catch (error) {
    console.error('❌ Pinecone test failed:', error.message);
  }
}

testPineconeConnection();