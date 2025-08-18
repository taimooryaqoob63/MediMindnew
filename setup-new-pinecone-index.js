import { Pinecone } from '@pinecone-database/pinecone';

async function setupNewPineconeIndex() {
  try {
    console.log('🌲 Setting up new Pinecone index...');
    
    if (!process.env.PINECONE_API_KEY) {
      throw new Error('PINECONE_API_KEY environment variable is required');
    }

    const pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY,
    });

    const indexName = process.env.PINECONE_INDEX_NAME || 'medimind-rag';
    console.log(`📝 Creating index: ${indexName}`);

    // Check if index already exists
    const existingIndexes = await pinecone.listIndexes();
    console.log('📋 Existing indexes:', existingIndexes.indexes?.map(idx => idx.name));

    const indexExists = existingIndexes.indexes?.some(idx => idx.name === indexName);

    if (!indexExists) {
      console.log(`🔨 Creating new index: ${indexName}`);
      
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

      console.log(`✅ Index ${indexName} created successfully`);
      
      // Wait for index to be ready
      console.log('⏳ Waiting for index to be ready...');
      let isReady = false;
      let attempts = 0;
      const maxAttempts = 30;

      while (!isReady && attempts < maxAttempts) {
        try {
          const indexStats = await pinecone.index(indexName).describeIndexStats();
          console.log(`📊 Index stats attempt ${attempts + 1}:`, indexStats);
          isReady = true;
        } catch (error) {
          console.log(`⏳ Index not ready yet, attempt ${attempts + 1}/${maxAttempts}`);
          await new Promise(resolve => setTimeout(resolve, 2000));
          attempts++;
        }
      }

      if (isReady) {
        console.log('✅ Index is ready for use');
      } else {
        console.log('⚠️ Index may still be initializing, but proceeding...');
      }
    } else {
      console.log(`✅ Index ${indexName} already exists`);
    }

    // Test the connection
    console.log('🔍 Testing index connection...');
    const index = pinecone.index(indexName);
    const stats = await index.describeIndexStats();
    console.log('📊 Index statistics:', {
      dimension: stats.dimension,
      indexFullness: stats.indexFullness,
      totalVectorCount: stats.totalVectorCount,
      namespaces: stats.namespaces
    });

    // Test a simple upsert operation
    console.log('🧪 Testing upsert operation...');
    const testVector = {
      id: 'test-vector-' + Date.now(),
      values: new Array(1536).fill(0).map(() => Math.random() - 0.5),
      metadata: {
        test: true,
        content: 'This is a test vector for connection verification',
        timestamp: new Date().toISOString()
      }
    };

    await index.upsert([testVector]);
    console.log('✅ Test upsert successful');

    // Query the test vector
    console.log('🔍 Testing query operation...');
    const queryResponse = await index.query({
      vector: testVector.values,
      topK: 1,
      includeMetadata: true
    });
    
    console.log('✅ Test query successful:', {
      matches: queryResponse.matches?.length || 0,
      firstMatch: queryResponse.matches?.[0]?.id
    });

    // Clean up test vector
    await index.deleteOne(testVector.id);
    console.log('🗑️ Test vector cleaned up');

    console.log('🎉 Pinecone setup completed successfully!');
    console.log(`📋 Configuration summary:`);
    console.log(`  - Index Name: ${indexName}`);
    console.log(`  - Dimension: 1536`);
    console.log(`  - Metric: cosine`);
    console.log(`  - Cloud: AWS us-east-1`);
    console.log(`  - Connection: ✅ Verified`);
    
    return {
      success: true,
      indexName,
      stats
    };

  } catch (error) {
    console.error('❌ Pinecone setup failed:', error);
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

// Run setup
setupNewPineconeIndex().then(result => {
  if (result.success) {
    console.log('✅ Setup completed successfully');
    process.exit(0);
  } else {
    console.error('❌ Setup failed:', result.error);
    process.exit(1);
  }
});

export { setupNewPineconeIndex };