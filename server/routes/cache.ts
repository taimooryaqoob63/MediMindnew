import { Router } from 'express';
import { storage } from '../storage';
import { isAuthenticated } from '../replitAuth';

const router = Router();

/**
 * Clear all chat history and cache for the current user
 */
router.delete('/clear', isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.id;
    
    console.log(`🧹 Clearing cache and chat history for user: ${userId}`);
    
    // Clear chat messages
    const deletedMessages = await storage.clearUserChatHistory(userId);
    
    // Clear query cache (optional - affects all users, so we'll clear expired only)
    const deletedCache = await storage.clearExpiredQueryCache();
    
    // Clear chat summaries
    const deletedSummaries = await storage.clearUserChatSummaries(userId);
    
    console.log(`✅ Cache cleared successfully:`, {
      chatMessages: deletedMessages,
      expiredCache: deletedCache,
      chatSummaries: deletedSummaries
    });
    
    res.json({
      success: true,
      message: 'Cache and chat history cleared successfully',
      cleared: {
        chatMessages: deletedMessages,
        expiredCache: deletedCache,
        chatSummaries: deletedSummaries
      }
    });
    
  } catch (error) {
    console.error('❌ Error clearing cache:', error);
    res.status(500).json({
      error: 'Failed to clear cache and chat history'
    });
  }
});

/**
 * Clear only chat history for the current user
 */
router.delete('/chat-history', isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.id;
    
    console.log(`🧹 Clearing chat history for user: ${userId}`);
    
    const deletedMessages = await storage.clearUserChatHistory(userId);
    const deletedSummaries = await storage.clearUserChatSummaries(userId);
    
    console.log(`✅ Chat history cleared: ${deletedMessages} messages, ${deletedSummaries} summaries`);
    
    res.json({
      success: true,
      message: 'Chat history cleared successfully',
      cleared: {
        chatMessages: deletedMessages,
        chatSummaries: deletedSummaries
      }
    });
    
  } catch (error) {
    console.error('❌ Error clearing chat history:', error);
    res.status(500).json({
      error: 'Failed to clear chat history'
    });
  }
});

/**
 * Clear only query cache (admin operation)
 */
router.delete('/query-cache', isAuthenticated, async (req: any, res) => {
  try {
    console.log(`🧹 Clearing expired query cache`);
    
    const deletedCache = await storage.clearExpiredQueryCache();
    
    console.log(`✅ Query cache cleared: ${deletedCache} entries`);
    
    res.json({
      success: true,
      message: 'Query cache cleared successfully',
      cleared: {
        cacheEntries: deletedCache
      }
    });
    
  } catch (error) {
    console.error('❌ Error clearing query cache:', error);
    res.status(500).json({
      error: 'Failed to clear query cache'
    });
  }
});

/**
 * Get cache statistics
 */
router.get('/stats', isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.id;
    
    const stats = await storage.getCacheStats(userId);
    
    res.json({
      success: true,
      stats
    });
    
  } catch (error) {
    console.error('❌ Error getting cache stats:', error);
    res.status(500).json({
      error: 'Failed to get cache statistics'
    });
  }
});

export default router;