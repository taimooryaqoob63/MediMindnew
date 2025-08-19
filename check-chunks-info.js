
const { storage } = require('./server/storage.js');

async function analyzeChunks() {
  try {
    console.log('🔍 Analyzing document chunks...');
    
    // Get all documents first
    const documents = await storage.getAllDocuments();
    console.log(`📄 Found ${documents.length} documents`);
    
    let totalChunks = 0;
    let chunkDetails = [];
    
    for (const doc of documents) {
      const chunks = await storage.getDocumentChunks(doc.id);
      totalChunks += chunks.length;
      
      console.log(`\n📚 Document: ${doc.title}`);
      console.log(`   - Document ID: ${doc.id}`);
      console.log(`   - Category: ${doc.category}`);
      console.log(`   - Type: ${doc.documentType}`);
      console.log(`   - Chunks: ${chunks.length}`);
      
      chunks.forEach((chunk, index) => {
        const charCount = chunk.content.length;
        const wordCount = chunk.content.split(/\s+/).length;
        
        console.log(`   Chunk ${index + 1}:`);
        console.log(`     - ID: ${chunk.id}`);
        console.log(`     - Characters: ${charCount}`);
        console.log(`     - Words: ${wordCount}`);
        console.log(`     - Index: ${chunk.chunkIndex}`);
        console.log(`     - Has Vector ID: ${!!chunk.vectorId}`);
        console.log(`     - Content preview: "${chunk.content.substring(0, 100)}..."`);
        
        chunkDetails.push({
          documentTitle: doc.title,
          chunkId: chunk.id,
          chunkIndex: chunk.chunkIndex,
          characterCount: charCount,
          wordCount: wordCount,
          hasVectorId: !!chunk.vectorId
        });
      });
    }
    
    console.log(`\n📊 SUMMARY:`);
    console.log(`   Total Documents: ${documents.length}`);
    console.log(`   Total Chunks: ${totalChunks}`);
    
    if (chunkDetails.length > 0) {
      const avgChars = chunkDetails.reduce((sum, chunk) => sum + chunk.characterCount, 0) / chunkDetails.length;
      const avgWords = chunkDetails.reduce((sum, chunk) => sum + chunk.wordCount, 0) / chunkDetails.length;
      const chunksWithVectors = chunkDetails.filter(c => c.hasVectorId).length;
      
      console.log(`   Average characters per chunk: ${Math.round(avgChars)}`);
      console.log(`   Average words per chunk: ${Math.round(avgWords)}`);
      console.log(`   Chunks with vector IDs: ${chunksWithVectors}/${totalChunks}`);
      console.log(`   Min characters: ${Math.min(...chunkDetails.map(c => c.characterCount))}`);
      console.log(`   Max characters: ${Math.max(...chunkDetails.map(c => c.characterCount))}`);
    }
    
    // Check vector store status
    console.log(`\n🔍 Checking vector store...`);
    const { vectorStore } = await import('./server/services/vectorStore.js');
    await vectorStore.initialize();
    const stats = await vectorStore.getIndexStats();
    console.log(`   Vectors in Pinecone: ${stats?.totalRecordCount || 0}`);
    
  } catch (error) {
    console.error('❌ Error analyzing chunks:', error);
  }
}

analyzeChunks();
