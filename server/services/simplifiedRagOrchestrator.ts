import OpenAI from 'openai';
import { vectorStore } from './vectorStore';
import { storage } from '../storage';
import { ImprovedResponseFormatter } from './improvedResponseFormatter';
import type { User, ChatResponse } from '@shared/schema';

interface SimplifiedQueryAnalysis {
  intent: 'clinical' | 'educational' | 'general';
  entities: string[];
  isDiabetesRelated: boolean;
  urgency: 'low' | 'medium' | 'high';
}

interface RetrievalResult {
  sources: Array<{
    id: string;
    title: string;
    content: string;
    score: number;
    source: 'NICE' | 'Oxford Diabetes' | 'Other';
    pageNumber?: number;
    section?: string;
  }>;
  totalFound: number;
}

export class SimplifiedRagOrchestrator {
  private openai?: OpenAI;

  constructor() {
    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
    }
  }

  async processQuery(
    query: string,
    user: User,
    courseId?: string
  ): Promise<ChatResponse> {
    const startTime = Date.now();
    
    try {
      console.log(`🚀 Simplified RAG processing: "${query}"`);
      
      // Step 1: Quick analysis
      const analysis = await this.analyzeQuery(query);
      console.log(`🔍 Analysis - Intent: ${analysis.intent}, Diabetes-related: ${analysis.isDiabetesRelated}`);

      // Step 2: Focused retrieval from NICE guidelines and Oxford book
      const retrievalResult = await this.performFocusedRetrieval(query, analysis);
      console.log(`📚 Retrieved ${retrievalResult.sources.length} relevant sources`);

      // Step 3: Generate response with clear citations
      const response = await this.generateResponse(query, analysis, retrievalResult);
      console.log(`✅ Response generated with ${response.sources?.length || 0} citations`);

      const processingTime = Date.now() - startTime;
      console.log(`✅ Simplified RAG complete in ${processingTime}ms`);
      
      return {
        ...response,
        processingTimeMs: processingTime
      };

    } catch (error) {
      console.error('Simplified RAG error:', error);
      
      return {
        content: "I apologize, but I'm having difficulty accessing the medical guidelines at the moment. Please try asking your question again, or contact support if the issue continues.",
        sources: [],
        confidence: 0,
        followUpQuestions: [],
        suggestedActions: [],
        processingTimeMs: Date.now() - startTime,
        debugInfo: {
          error: error instanceof Error ? error.message : 'Unknown error',
          stage: 'simplified_rag',
          fallback: true
        }
      };
    }
  }

  private async analyzeQuery(query: string): Promise<SimplifiedQueryAnalysis> {
    // Simple keyword-based analysis focused on diabetes care
    const lowerQuery = query.toLowerCase();
    
    // Diabetes-related keywords
    const diabetesKeywords = [
      'diabetes', 'diabetic', 'blood sugar', 'glucose', 'insulin', 'hba1c',
      'hypoglycemia', 'hyperglycemia', 'ketones', 'metformin', 'glucagon'
    ];
    
    // Clinical keywords
    const clinicalKeywords = [
      'emergency', 'urgent', 'severe', 'crisis', 'unconscious', 'coma',
      'treatment', 'medication', 'dosage', 'side effects'
    ];
    
    // Educational keywords
    const educationalKeywords = [
      'how to', 'what is', 'explain', 'understand', 'learn', 'training'
    ];

    const isDiabetesRelated = diabetesKeywords.some(keyword => lowerQuery.includes(keyword));
    const hasClinicalTerms = clinicalKeywords.some(keyword => lowerQuery.includes(keyword));
    const hasEducationalTerms = educationalKeywords.some(keyword => lowerQuery.includes(keyword));

    // Simple entity extraction
    const entities: string[] = [];
    diabetesKeywords.forEach(keyword => {
      if (lowerQuery.includes(keyword)) {
        entities.push(keyword);
      }
    });

    return {
      intent: hasClinicalTerms ? 'clinical' : hasEducationalTerms ? 'educational' : 'general',
      entities,
      isDiabetesRelated,
      urgency: hasClinicalTerms ? 'high' : isDiabetesRelated ? 'medium' : 'low'
    };
  }

  private async performFocusedRetrieval(
    query: string, 
    analysis: SimplifiedQueryAnalysis
  ): Promise<RetrievalResult> {
    try {
      // Use vector search to find relevant content - bypassing reindexing issues
      console.log(`🔍 Searching for: "${query.substring(0, 50)}..."`);
      
      let searchResults: any[] = [];
      try {
        searchResults = await vectorStore.searchSimilar(
          query,
          8, // Fewer results for better quality
          analysis.isDiabetesRelated ? { 
            source: 'NICE'  // Focus on NICE guidelines primarily
          } : undefined
        );
        console.log(`✅ Vector search returned ${searchResults.length} results`);
      } catch (error) {
        console.warn('⚠️ Vector search failed, using fallback:', error.message);
        searchResults = [];
      }

      // Map results to our format
      const sources = searchResults.map((result: any) => ({
        id: result.id || result.metadata?.id || '',
        title: result.metadata?.title || result.title || 'Medical Guidelines',
        content: result.pageContent || result.content || result.text || '',
        score: result.score || 0.8,
        source: this.determineSource(result.metadata?.title || result.title || result.metadata?.source || ''),
        pageNumber: result.metadata?.pageNumber,
        section: result.metadata?.section
      }));

      // Filter and sort by relevance and authority
      const filteredSources = sources
        .filter((source: any) => source.content.length > 50) // Remove very short snippets
        .sort((a: any, b: any) => {
          // Prioritize NICE guidelines and Oxford book
          if (a.source === 'NICE' && b.source !== 'NICE') return -1;
          if (b.source === 'NICE' && a.source !== 'NICE') return 1;
          if (a.source === 'Oxford Diabetes' && b.source === 'Oxford Diabetes') return 0;
          return b.score - a.score;
        })
        .slice(0, 5); // Keep only top 5 results

      return {
        sources: filteredSources,
        totalFound: searchResults.length
      };

    } catch (error) {
      console.error('Retrieval error:', error);
      return {
        sources: [],
        totalFound: 0
      };
    }
  }

  private determineSource(title: string): 'NICE' | 'Oxford Diabetes' | 'Other' {
    const lowerTitle = title.toLowerCase();
    if (lowerTitle.includes('nice') || lowerTitle.includes('national institute')) {
      return 'NICE';
    }
    if (lowerTitle.includes('oxford') || lowerTitle.includes('diabetes')) {
      return 'Oxford Diabetes';
    }
    return 'Other';
  }

  private async generateResponse(
    query: string,
    analysis: SimplifiedQueryAnalysis,
    retrievalResult: RetrievalResult
  ): Promise<ChatResponse> {
    if (!this.openai) {
      throw new Error('OpenAI API not configured');
    }

    if (retrievalResult.sources.length === 0) {
      return {
        content: "I don't have specific information about that topic in the current medical guidelines. Could you please rephrase your question or ask about diabetes management, which I'm specifically trained to help with?",
        sources: [],
        confidence: 20,
        followUpQuestions: [
          "How can I help someone with low blood sugar?",
          "What are the signs of high blood sugar?",
          "How do I check blood glucose levels?"
        ],
        suggestedActions: []
      };
    }

    // Build context from sources
    const context = retrievalResult.sources.map((source, index) => 
      `Source ${index + 1} (${source.source}): ${source.content}`
    ).join('\n\n');

    // Create a focused prompt for better responses
    const systemPrompt = `You are a medical education AI assistant specializing in diabetes care for healthcare workers in care homes. Your responses must be:

1. Based ONLY on the provided sources (NICE guidelines and Oxford Diabetes book)
2. Written in simple, clear English that care home staff can understand
3. Include practical examples from care home settings
4. Follow this structure:
   - Brief explanation (2-3 sentences)
   - Practical example from care home setting
   - Key steps in bullet points
   - One clear action

CRITICAL: Always cite your sources using [NICE] or [Oxford Diabetes] tags after statements.
If emergency-related, include safety warnings.`;

    const userPrompt = `Question: ${query}

Available sources:
${context}

Please provide a helpful response following the required structure and citing your sources appropriately.`;

    try {
      const completion = await this.openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.3, // Lower temperature for more consistent responses
        max_tokens: 800,
        presence_penalty: 0.1
      });

      const responseContent = completion.choices[0]?.message?.content || '';
      
      // Format the response nicely using the improved formatter
      const formattedResponse = ImprovedResponseFormatter.formatDiabetesResponse(
        responseContent, 
        retrievalResult.sources
      );

      // Calculate confidence based on source quality and relevance
      const confidence = this.calculateConfidence(retrievalResult.sources, responseContent);

      return {
        content: formattedResponse,
        sources: retrievalResult.sources.map(source => ({
          id: source.id,
          title: source.title,
          excerpt: source.content.substring(0, 200) + '...',
          score: source.score,
          type: 'medical_guideline',
          source: source.source,
          pageNumber: source.pageNumber,
          section: source.section
        })),
        confidence,
        followUpQuestions: this.generateFollowUpQuestions(analysis, query),
        suggestedActions: this.generateSuggestedActions(analysis)
      };

    } catch (error) {
      console.error('OpenAI API error:', error);
      throw new Error('Failed to generate response');
    }
  }

  private formatResponse(
    content: string, 
    analysis: SimplifiedQueryAnalysis, 
    retrievalResult: RetrievalResult
  ): string {
    // Add visual structure to the response
    let formatted = content;

    // Add section headers if not present
    if (!formatted.includes('##')) {
      const lines = formatted.split('\n').filter(line => line.trim());
      if (lines.length > 1) {
        formatted = `## 🩺 Brief Explanation\n\n${lines[0]}\n\n`;
        if (lines.length > 1) {
          formatted += `## 📍 Practical Example\n\n${lines[1]}\n\n`;
        }
        if (lines.length > 2) {
          formatted += `## ✅ Key Steps\n\n${lines.slice(2).join('\n')}\n\n`;
        }
      }
    }

    // Add source attribution at the end
    if (retrievalResult.sources.length > 0) {
      const sourceList = retrievalResult.sources
        .map(source => `- ${source.source}: ${source.title}`)
        .join('\n');
      
      formatted += `\n\n## 📚 Sources\n\n${sourceList}`;
    }

    return formatted;
  }

  private calculateConfidence(sources: any[], responseContent: string): number {
    let confidence = 50; // Base confidence

    // Boost confidence based on source quality
    const niceSourceCount = sources.filter(s => s.source === 'NICE').length;
    const oxfordSourceCount = sources.filter(s => s.source === 'Oxford Diabetes').length;
    
    confidence += (niceSourceCount * 15); // NICE guidelines are authoritative
    confidence += (oxfordSourceCount * 10); // Oxford book is also reliable
    confidence += Math.min(sources.length * 5, 20); // More sources = higher confidence

    // Boost if response includes citations
    if (responseContent.includes('[NICE]') || responseContent.includes('[Oxford')) {
      confidence += 10;
    }

    return Math.min(confidence, 95); // Cap at 95%
  }

  private generateFollowUpQuestions(analysis: SimplifiedQueryAnalysis, originalQuery: string): string[] {
    const baseQuestions = [
      "What should I do if someone shows signs of low blood sugar?",
      "How often should blood glucose be checked?",
      "When should I call for medical help?"
    ];

    if (analysis.intent === 'clinical') {
      return [
        "What are the emergency protocols for this situation?",
        "How do I document this incident?",
        "When should I contact the GP or diabetes nurse?"
      ];
    }

    if (analysis.intent === 'educational') {
      return [
        "Can you explain more about the underlying causes?",
        "What training should staff receive on this topic?",
        "Are there any recent updates to the guidelines?"
      ];
    }

    return baseQuestions;
  }

  private generateSuggestedActions(analysis: SimplifiedQueryAnalysis): any[] {
    const baseActions = [
      {
        type: 'learn_more',
        title: 'Review NICE Guidelines',
        description: 'Read the complete NICE guidelines on diabetes management'
      },
      {
        type: 'training',
        title: 'Staff Training',
        description: 'Ensure all staff are trained on diabetes care protocols'
      }
    ];

    if (analysis.urgency === 'high') {
      return [
        {
          type: 'emergency',
          title: 'Emergency Protocol',
          description: 'Review emergency procedures for diabetes-related incidents'
        },
        ...baseActions
      ];
    }

    return baseActions;
  }
}

export const simplifiedRagOrchestrator = new SimplifiedRagOrchestrator();