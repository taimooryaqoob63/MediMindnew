import { Pinecone } from '@pinecone-database/pinecone';
import OpenAI from 'openai';

async function debugContentMapping() {
  try {
    console.log('🔍 Debugging content mapping issue...');
    
    const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    
    const index = pinecone.index('medimind-rag');
    
    // Test the exact query from the logs
    const testQuery = "what is Blood glucose monitoring guidelines (NICE)";
    
    // Generate embedding
    const embedding = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: testQuery,
    });
    
    // Search with NICE filter like the system does
    const searchResults = await index.query({
      vector: embedding.data[0].embedding,
      topK: 8,
      filter: { source: { '$eq': 'NICE' } },
      includeMetadata: true,
    });
    
    console.log(`\n🔍 Search results (with NICE filter):`, {
      totalMatches: searchResults.matches?.length || 0,
    });
    
    if (searchResults.matches && searchResults.matches.length > 0) {
      searchResults.matches.forEach((match, idx) => {
        console.log(`\n📄 Match ${idx + 1}:`, {
          id: match.id,
          score: match.score
        });
        console.log('Metadata structure:', {
          hasTitle: !!match.metadata?.title,
          hasContent: !!match.metadata?.content,
          hasText: !!match.metadata?.text,
          hasSource: !!match.metadata?.source,
          metadataKeys: Object.keys(match.metadata || {})
        });
        
        // Test different content extraction methods
        const contentOptions = {
          pageContent: match.pageContent || null,
          content: match.content || null,
          text: match.text || null,
          'metadata.content': match.metadata?.content || null,
          'metadata.text': match.metadata?.text || null
        };
        
        console.log('Content extraction options:', contentOptions);
        
        const bestContent = match.pageContent || match.content || match.text || 
                           match.metadata?.content || match.metadata?.text || '';
        
        console.log('Best content (first 100 chars):', bestContent.substring(0, 100));
        console.log('Content length:', bestContent.length);
      });
    } else {
      console.log('❌ No matches found with NICE filter');
      
      // Try without filter
      const noFilterResults = await index.query({
        vector: embedding.data[0].embedding,
        topK: 3,
        includeMetadata: true,
      });
      
      console.log(`\n🔍 Search results (no filter):`, {
        totalMatches: noFilterResults.matches?.length || 0,
      });
      
      if (noFilterResults.matches && noFilterResults.matches.length > 0) {
        noFilterResults.matches.forEach((match, idx) => {
          console.log(`\n📄 No-filter Match ${idx + 1}:`, {
            id: match.id,
            score: match.score,
            source: match.metadata?.source || 'Unknown'
          });
        });
      }
    }
    
  } catch (error) {
    console.error('❌ Debug failed:', error);
  }
}

debugContentMapping();