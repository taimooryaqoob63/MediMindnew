
import { Pinecone } from '@pinecone-database/pinecone';
import OpenAI from 'openai';

async function debugPineconeConnection() {
  console.log('🔍 Debugging Pinecone Connection...');
  
  // Check environment variables
  console.log('📋 Environment Variables:');
  console.log('PINECONE_API_KEY:', process.env.PINECONE_API_KEY ? 'SET ✅' : 'MISSING ❌');
  console.log('PINECONE_INDEX_NAME:', process.env.PINECONE_INDEX_NAME || 'Not set - will use quickstart');
  console.log('OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? 'SET ✅' : 'MISSING ❌');
  
  if (!process.env.PINECONE_API_KEY) {
    console.error('❌ PINECONE_API_KEY is missing. Please add it to your Replit Secrets.');
    console.log('🔧 To fix: Go to Secrets tab and add PINECONE_API_KEY');
    return;
  }
  
  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY is missing. Please add it to your Replit Secrets.');
    console.log('🔧 To fix: Go to Secrets tab and add OPENAI_API_KEY');
    return;
  }
  
  try {
    // Initialize Pinecone
    console.log('\n🌲 Initializing Pinecone...');
    const pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY,
    });
    
    // List existing indexes
    console.log('📝 Listing existing indexes...');
    const indexList = await pinecone.listIndexes();
    console.log('Available indexes:', indexList.indexes?.map(i => i.name) || []);
    
    // Check both possible index names
    const possibleIndexes = ['medimind-rag', 'quickstart'];
    let workingIndex = null;
    
    for (const indexName of possibleIndexes) {
      const indexExists = indexList.indexes?.some(index => index.name === indexName);
      console.log(`Index "${indexName}": ${indexExists ? 'EXISTS ✅' : 'NOT FOUND ❌'}`);
      
      if (indexExists && !workingIndex) {
        workingIndex = indexName;
      }
    }
    
    if (!workingIndex) {
      console.error('❌ No suitable index found. Available indexes:', indexList.indexes?.map(i => i.name));
      return;
    }
    
    console.log(`\n🎯 Using index: ${workingIndex}`);
    
    // Test connection to the working index
    console.log('🔗 Testing index connection...');
    const index = pinecone.index(workingIndex);
    const stats = await index.describeIndexStats();
    console.log('✅ Index connection successful!');
    console.log('📊 Index stats:', {
      totalVectorCount: stats.totalVectorCount || 0,
      dimension: stats.dimension || 'Unknown'
    });
    
    // Test OpenAI embeddings
    console.log('\n🤖 Testing OpenAI embeddings...');
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: 'Test embedding for diabetes care',
    });
    
    const embedding = response.data[0].embedding;
    console.log('✅ OpenAI embedding created successfully, dimension:', embedding.length);
    
    // Test vector operations
    console.log('\n🧪 Testing vector operations...');
    
    // Upsert a test vector
    const testId = 'test-vector-' + Date.now();
    await index.upsert([{
      id: testId,
      values: embedding,
      metadata: {
        type: 'test',
        content: 'Test vector for connection verification',
        timestamp: new Date().toISOString()
      }
    }]);
    
    console.log('✅ Test vector upserted successfully');
    
    // Test query
    const queryResponse = await index.query({
      vector: embedding,
      topK: 3,
      includeMetadata: true,
    });
    
    console.log('✅ Query successful, matches:', queryResponse.matches?.length || 0);
    
    // Clean up test vector
    await index.deleteOne(testId);
    console.log('🧹 Test vector cleaned up');
    
    console.log('\n🎉 All tests passed! Pinecone connection is working correctly.');
    console.log(`💡 Set PINECONE_INDEX_NAME="${workingIndex}" in your Replit Secrets for optimal performance.`);
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    
    if (error.message.includes('401') || error.message.includes('Unauthorized')) {
      console.error('🔑 Authentication failed. Please check your PINECONE_API_KEY');
      console.log('🔧 Solution: Verify your API key in Pinecone dashboard > API Keys');
    } else if (error.message.includes('404') || error.message.includes('not found')) {
      console.error('🔍 Index not found or inaccessible.');
      console.log('🔧 Solution: Check if the index name is correct and accessible');
    } else if (error.message.includes('network') || error.message.includes('timeout')) {
      console.error('🌐 Network issue. Please check your internet connection.');
    } else if (error.message.includes('quota') || error.message.includes('limit')) {
      console.error('💰 Quota or rate limit exceeded.');
      console.log('🔧 Solution: Check your Pinecone usage dashboard');
    }
    
    console.log('\n📝 Full error details:', error);
  }
}

// Run the debug function
debugPineconeConnection().catch(console.error);
