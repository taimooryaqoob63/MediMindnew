import { Pinecone } from '@pinecone-database/pinecone';

async function testPineconeConnection() {
  console.log('🔍 Testing Pinecone connection...');
  
  const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
  const index = pinecone.index('medimind-rag');
  
  const stats = await index.describeIndexStats();
  console.log('✅ Connection successful:', {
    dimension: stats.dimension,
    totalVectors: stats.totalVectorCount || 0
  });
}

testPineconeConnection().catch(console.error);