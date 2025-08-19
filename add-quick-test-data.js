import { quickTestVectorStore } from './server/services/quickTestVectorStore.js';

async function addTestData() {
  console.log('🚀 Starting quick test data addition...');
  await quickTestVectorStore.addQuickTestData();
  console.log('✅ Test data added! You can now test the RAG system.');
  process.exit(0);
}

addTestData();