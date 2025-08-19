import { Pinecone } from '@pinecone-database/pinecone';
import OpenAI from 'openai';

async function testDirectSearch() {
  try {
    console.log('🧪 Testing direct search on Pinecone...');
    
    const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    
    const index = pinecone.index('medimind-rag');
    
    // Test query about diabetes
    const testQuery = "How do I check blood sugar in care home?";
    
    // Generate embedding
    const embedding = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: testQuery,
    });
    
    // Search
    const searchResults = await index.query({
      vector: embedding.data[0].embedding,
      topK: 3,
      includeMetadata: true,
    });
    
    console.log(`🔍 Search results for "${testQuery}":`, {
      totalMatches: searchResults.matches?.length || 0,
    });
    
    if (searchResults.matches && searchResults.matches.length > 0) {
      searchResults.matches.forEach((match, idx) => {
        console.log(`\n📄 Match ${idx + 1}:`, {
          id: match.id,
          score: match.score,
          title: match.metadata?.title || 'No title',
          source: match.metadata?.source || 'Unknown',
          contentPreview: (match.metadata?.content || '').substring(0, 100) + '...'
        });
      });
      console.log('\n✅ Search working! The data is there.');
    } else {
      console.log('❌ No matches found - there may be an indexing issue.');
    }
    
  } catch (error) {
    console.error('❌ Direct search test failed:', error);
  }
}

testDirectSearch();