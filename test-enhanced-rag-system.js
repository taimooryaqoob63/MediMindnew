import { vectorStore } from './server/services/vectorStore.ts';
import { superEnhancedRagOrchestrator } from './server/services/superEnhancedRagOrchestrator.ts';

async function testEnhancedRagSystem() {
  try {
    console.log('🧪 Testing Enhanced RAG System Connection...');
    
    // Test 1: Initialize vector store
    console.log('\n📋 Test 1: Vector Store Initialization');
    await vectorStore.initialize();
    console.log('✅ Vector store initialized successfully');
    
    // Test 2: Test vector store operations
    console.log('\n📋 Test 2: Vector Store Operations');
    const testEmbedding = await vectorStore.createEmbedding('test diabetes management query');
    console.log('✅ Test embedding created:', testEmbedding.length, 'dimensions');
    
    // Test 3: Test hybrid search components
    console.log('\n📋 Test 3: Enhanced RAG System Components');
    
    const testUser = {
      id: 'test-user-123',
      email: 'test@medimind.ai',
      firstName: 'Test',
      lastName: 'User',
      profileImageUrl: null,
      role: 'care_worker',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const testQuery = "What are the signs of hypoglycemia in diabetes patients?";
    
    console.log(`🤖 Testing super enhanced RAG with query: "${testQuery}"`);
    
    const startTime = Date.now();
    const response = await superEnhancedRagOrchestrator.processQuery(
      testQuery,
      testUser,
      'test-course-id',
      []
    );
    const endTime = Date.now();
    
    console.log('✅ Super Enhanced RAG Response:', {
      hasContent: !!response.content,
      contentLength: response.content?.length || 0,
      confidence: response.confidence,
      sourcesCount: response.sources?.length || 0,
      agentsUsed: response.agentsUsed?.length || 0,
      usedRAG: response.usedRAG,
      responseTime: response.responseTime,
      totalTime: endTime - startTime
    });
    
    if (response.content) {
      console.log('\n📄 Response Preview:', response.content.substring(0, 200) + '...');
    }
    
    if (response.sources && response.sources.length > 0) {
      console.log('\n📚 Sources Found:', response.sources.map(s => ({
        title: s.title,
        score: s.score,
        type: s.type
      })));
    }
    
    if (response.agentsUsed && response.agentsUsed.length > 0) {
      console.log('\n🤖 Agents Used:', response.agentsUsed);
    }
    
    console.log('\n🎉 All tests completed successfully!');
    console.log('✅ Enhanced RAG system is fully operational with Pinecone');
    
    return {
      success: true,
      response,
      performance: {
        totalTime: endTime - startTime,
        responseTime: response.responseTime
      }
    };
    
  } catch (error) {
    console.error('❌ Enhanced RAG system test failed:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack
    });
    return {
      success: false,
      error: error.message
    };
  }
}

// Run test
testEnhancedRagSystem().then(result => {
  if (result.success) {
    console.log('\n✅ Enhanced RAG system test completed successfully');
    process.exit(0);
  } else {
    console.error('\n❌ Enhanced RAG system test failed:', result.error);
    process.exit(1);
  }
});