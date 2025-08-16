
import { Pinecone } from '@pinecone-database/pinecone';
import OpenAI from 'openai';

async function debugPineconeConnection() {
  console.log('🔍 Debugging Pinecone Connection...');
  
  // Check environment variables
  console.log('📋 Environment Variables:');
  console.log('PINECONE_API_KEY:', process.env.PINECONE_API_KEY ? 'SET ✅' : 'MISSING ❌');
  console.log('PINECONE_INDEX_NAME:', process.env.PINECONE_INDEX_NAME || 'quickstart (default)');
  console.log('OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? 'SET ✅' : 'MISSING ❌');
  
  if (!process.env.PINECONE_API_KEY) {
    console.error('❌ PINECONE_API_KEY is missing. Please add it to your Replit Secrets.');
    return;
  }
  
  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY is missing. Please add it to your Replit Secrets.');
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
    
    const indexName = process.env.PINECONE_INDEX_NAME || 'quickstart';
    const indexExists = indexList.indexes?.some(index => index.name === indexName);
    
    if (!indexExists) {
      console.log(`\n🏗️ Creating index: ${indexName}`);
      await pinecone.createIndex({
        name: indexName,
        dimension: 1536, // text-embedding-3-small dimension
        metric: 'cosine',
        spec: {
          serverless: {
            cloud: 'aws',
            region: 'us-east-1'
          }
        }
      });
      
      // Wait for index to be ready
      console.log('⏳ Waiting for index to be ready...');
      let retries = 0;
      const maxRetries = 30;
      
      while (retries < maxRetries) {
        try {
          const indexStats = await pinecone.index(indexName).describeIndexStats();
          if (indexStats) {
            console.log('✅ Index is ready!');
            break;
          }
        } catch (error) {
          console.log(`⏳ Waiting... (${retries + 1}/${maxRetries})`);
        }
        
        await new Promise(resolve => setTimeout(resolve, 2000));
        retries++;
      }
      
      if (retries >= maxRetries) {
        throw new Error('Index failed to become ready within timeout');
      }
    } else {
      console.log(`✅ Index ${indexName} already exists`);
    }
    
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
    const index = pinecone.index(indexName);
    
    // Upsert a test vector
    await index.upsert([{
      id: 'test-vector-' + Date.now(),
      values: embedding,
      metadata: {
        type: 'test',
        content: 'Test vector for connection verification'
      }
    }]);
    
    console.log('✅ Test vector upserted successfully');
    
    // Test query
    const queryResponse = await index.query({
      vector: embedding,
      topK: 1,
      includeMetadata: true,
    });
    
    console.log('✅ Query successful, matches:', queryResponse.matches?.length || 0);
    
    console.log('\n🎉 All tests passed! Pinecone connection is working correctly.');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    
    if (error.message.includes('401')) {
      console.error('🔑 Authentication failed. Please check your PINECONE_API_KEY');
    } else if (error.message.includes('404')) {
      console.error('🔍 Index not found. The script will attempt to create it.');
    } else if (error.message.includes('network') || error.message.includes('timeout')) {
      console.error('🌐 Network issue. Please check your internet connection.');
    }
  }
}

debugPineconeConnection().catch(console.error);
