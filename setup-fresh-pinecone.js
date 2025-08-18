
#!/usr/bin/env node

const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('🚀 MediMind AI - Fresh Pinecone Setup');
console.log('=====================================\n');

console.log('To set up a fresh Pinecone database:');
console.log('1. Go to https://app.pinecone.io');
console.log('2. Create a new account or log in');
console.log('3. Create a new index with these settings:');
console.log('   - Name: medimind-rag (or any name you prefer)');
console.log('   - Dimensions: 1536');
console.log('   - Metric: cosine');
console.log('   - Cloud: AWS');
console.log('   - Region: us-east-1');
console.log('4. Get your API key from the dashboard\n');

rl.question('Enter your new Pinecone API key: ', (apiKey) => {
  rl.question('Enter your Pinecone index name (default: medimind-rag): ', (indexName) => {
    const finalIndexName = indexName.trim() || 'medimind-rag';
    
    console.log('\n🔧 Add these to your Replit Secrets:');
    console.log(`PINECONE_API_KEY=${apiKey}`);
    console.log(`PINECONE_INDEX_NAME=${finalIndexName}`);
    
    console.log('\n✅ After adding the secrets:');
    console.log('1. Restart your Repl');
    console.log('2. Use the "Clear All Data" button in Document Management');
    console.log('3. Upload your documents again');
    console.log('4. Initialize the vector store');
    
    rl.close();
  });
});
