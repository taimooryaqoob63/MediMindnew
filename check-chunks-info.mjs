

import { storage } from './server/storage.js';

async function analyzeChunks() {
  try {
    console.log('\n🔍 DOCUMENT CHUNKS ANALYSIS\n');
    console.log('='.repeat(50));

    // Get all documents
    const documents = await storage.getAllDocuments();
    console.log(`📚 Total Documents: ${documents.length}`);
    
    if (documents.length === 0) {
      console.log('❌ No documents found in database');
      return;
    }

    // Get all chunks
    const allChunks = await storage.getAllDocumentChunks();
    console.log(`📄 Total Chunks: ${allChunks.length}`);
    
    if (allChunks.length === 0) {
      console.log('❌ No chunks found in database');
      return;
    }

    console.log('\n📋 DOCUMENT OVERVIEW:');
    console.log('-'.repeat(30));
    
    for (const doc of documents) {
      const docChunks = allChunks.filter(chunk => chunk.documentId === doc.id);
      console.log(`\n📖 Document: ${doc.title || doc.filename}`);
      console.log(`   • ID: ${doc.id}`);
      console.log(`   • Chunks: ${docChunks.length}`);
      console.log(`   • Created: ${doc.createdAt}`);
      console.log(`   • Has Vector ID: ${doc.vectorId ? '✅' : '❌'}`);
    }

    console.log('\n📊 CHUNK ANALYSIS:');
    console.log('-'.repeat(30));
    
    let totalCharacters = 0;
    let totalWords = 0;
    let chunksWithVectors = 0;
    let characterCounts = [];

    for (let i = 0; i < allChunks.length; i++) {
      const chunk = allChunks[i];
      const charCount = chunk.content.length;
      const wordCount = chunk.content.split(/\s+/).length;
      
      totalCharacters += charCount;
      totalWords += wordCount;
      characterCounts.push(charCount);
      
      if (chunk.vectorId) {
        chunksWithVectors++;
      }

      console.log(`\n📄 Chunk ${i + 1}:`);
      console.log(`   • ID: ${chunk.id}`);
      console.log(`   • Document ID: ${chunk.documentId}`);
      console.log(`   • Characters: ${charCount}`);
      console.log(`   • Words: ${wordCount}`);
      console.log(`   • Vector ID: ${chunk.vectorId ? '✅ ' + chunk.vectorId : '❌ Not indexed'}`);
      console.log(`   • Created: ${chunk.createdAt}`);
      console.log(`   • Preview: "${chunk.content.substring(0, 100)}..."`);
    }

    console.log('\n📈 STATISTICS:');
    console.log('-'.repeat(30));
    console.log(`📊 Total Chunks: ${allChunks.length}`);
    console.log(`📊 Chunks with Vectors: ${chunksWithVectors}/${allChunks.length} (${Math.round(chunksWithVectors/allChunks.length*100)}%)`);
    console.log(`📊 Average Characters per Chunk: ${Math.round(totalCharacters / allChunks.length)}`);
    console.log(`📊 Average Words per Chunk: ${Math.round(totalWords / allChunks.length)}`);
    console.log(`📊 Min Characters: ${Math.min(...characterCounts)}`);
    console.log(`📊 Max Characters: ${Math.max(...characterCounts)}`);
    console.log(`📊 Total Characters: ${totalCharacters.toLocaleString()}`);
    console.log(`📊 Total Words: ${totalWords.toLocaleString()}`);

    // Check vector store status
    console.log('\n🔌 VECTOR STORE STATUS:');
    console.log('-'.repeat(30));
    
    try {
      // We can't directly access vectorStore here, but we can infer from chunk vector IDs
      const indexedChunks = allChunks.filter(chunk => chunk.vectorId);
      console.log(`✅ Chunks properly indexed in Pinecone: ${indexedChunks.length}`);
      console.log(`❌ Chunks missing vectors: ${allChunks.length - indexedChunks.length}`);
      
      if (indexedChunks.length > 0) {
        console.log('✅ Vector store appears to be working correctly');
      } else {
        console.log('⚠️  No chunks have vector IDs - vector indexing may have failed');
      }
    } catch (error) {
      console.log('❌ Could not check vector store status:', error.message);
    }

    console.log('\n🎯 RECOMMENDATIONS:');
    console.log('-'.repeat(30));
    
    const avgChars = totalCharacters / allChunks.length;
    if (avgChars < 300) {
      console.log('⚠️  Chunks are quite small (avg < 300 chars) - consider larger chunks for better context');
    } else if (avgChars > 1500) {
      console.log('⚠️  Chunks are quite large (avg > 1500 chars) - consider smaller chunks for better precision');
    } else {
      console.log('✅ Chunk sizes look reasonable for RAG retrieval');
    }

    if (chunksWithVectors < allChunks.length) {
      console.log('⚠️  Some chunks are missing vector embeddings - run re-indexing');
    } else {
      console.log('✅ All chunks have vector embeddings');
    }

    console.log('\n' + '='.repeat(50));
    console.log('✅ Analysis complete!');

  } catch (error) {
    console.error('❌ Error analyzing chunks:', error);
  }
}

// Run the analysis
analyzeChunks();

