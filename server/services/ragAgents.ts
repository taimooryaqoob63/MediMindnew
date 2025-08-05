import OpenAI from 'openai';
import { vectorStore } from './vectorStore';
import { storage } from '../storage';
import type { User } from '@shared/schema';

interface AgentResponse {
  content: string;
  confidence: number;
  sources: Array<{
    id: string;
    title: string;
    excerpt: string;
    score: number;
    type: string;
  }>;
  agentName: string;
}

interface QueryAnalysis {
  intent: string;
  entities: string[];
  complexity: 'simple' | 'moderate' | 'complex';
  requiresSpecialistKnowledge: boolean;
  suggestedFilters: Record<string, any>;
}

export class RagAgentOrchestrator {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY!,
    });
  }

  async processQuery(
    query: string,
    user: User,
    courseId?: string
  ): Promise<AgentResponse> {
    try {
      // Step 1: Analyze the query
      const analysis = await this.analyzeQuery(query, user);
      
      // Step 2: Retrieve relevant documents
      const retrievalResult = await this.retrieveDocuments(query, analysis);
      
      // Step 3: Synthesize context
      const context = await this.synthesizeContext(retrievalResult.sources);
      
      // Step 4: Generate response
      const response = await this.generateResponse(query, context, user, analysis);
      
      // Step 5: Quality assurance
      const finalResponse = await this.qualityAssurance(response, analysis);
      
      return {
        ...finalResponse,
        sources: retrievalResult.sources,
      };
    } catch (error) {
      console.error('RAG processing error:', error);
      return {
        content: "I'm experiencing technical difficulties. Please consult your local healthcare guidelines for immediate assistance.",
        confidence: 0,
        sources: [],
        agentName: 'error_handler'
      };
    }
  }

  private async analyzeQuery(query: string, user: User): Promise<QueryAnalysis> {
    const prompt = `Analyze this healthcare query from a ${user.role} in a care home setting:

Query: "${query}"

Provide a JSON response with:
1. intent: What is the user trying to accomplish?
2. entities: List medical terms, procedures, conditions mentioned
3. complexity: simple/moderate/complex based on medical expertise required
4. requiresSpecialistKnowledge: true if needs specialist medical knowledge
5. suggestedFilters: Suggested document filters (documentType, category)

Focus on diabetes care, NICE guidelines, NHS practices, and CQC requirements.`;

    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.1,
      });

      return JSON.parse(response.choices[0].message.content || '{}');
    } catch (error) {
      console.error('Query analysis error:', error);
      return {
        intent: 'general_inquiry',
        entities: [],
        complexity: 'simple',
        requiresSpecialistKnowledge: false,
        suggestedFilters: {}
      };
    }
  }

  private async retrieveDocuments(
    query: string,
    analysis: QueryAnalysis
  ): Promise<{
    sources: Array<{
      id: string;
      title: string;
      excerpt: string;
      score: number;
      type: string;
    }>;
  }> {
    try {
      // Create query embedding
      const queryEmbedding = await vectorStore.createEmbedding(query);
      
      // Search with filters based on analysis
      const searchResults = await vectorStore.queryVectors(
        queryEmbedding,
        10, // Get top 10 results
        analysis.suggestedFilters
      );

      // Get document details for each result
      const sources = [];
      for (const result of searchResults) {
        try {
          const chunk = await storage.getDocumentChunk(result.id);
          if (chunk) {
            const document = await storage.getDocument(chunk.documentId);
            if (document) {
              sources.push({
                id: chunk.id,
                title: document.title,
                excerpt: chunk.content.substring(0, 200) + '...',
                score: result.score,
                type: document.documentType
              });
            }
          }
        } catch (error) {
          console.error('Error fetching document details:', error);
        }
      }

      return { sources };
    } catch (error) {
      console.error('Document retrieval error:', error);
      return { sources: [] };
    }
  }

  private async synthesizeContext(sources: any[]): Promise<string> {
    if (sources.length === 0) {
      return "No specific guideline documents found for this query.";
    }

    // Combine relevant excerpts into coherent context
    const contextParts = sources.slice(0, 5).map((source, index) => 
      `[Source ${index + 1}: ${source.title}]\n${source.excerpt}`
    );

    return contextParts.join('\n\n');
  }

  private async generateResponse(
    query: string,
    context: string,
    user: User,
    analysis: QueryAnalysis
  ): Promise<AgentResponse> {
    const systemPrompt = `You are MediMind AI, a specialized healthcare assistant for diabetes care in care homes and nursing facilities.

User Role: ${user.role}
Query Complexity: ${analysis.complexity}
Requires Specialist Knowledge: ${analysis.requiresSpecialistKnowledge}

Guidelines:
- Base responses on NICE guidelines, NHS practices, and CQC requirements
- Provide practical, actionable advice appropriate for the user's role
- Always emphasize safety protocols and professional consultation
- Include specific blood glucose ranges, medication guidelines when relevant
- Maintain professional tone while being accessible

Context from Guidelines:
${context}

Respond in JSON format with:
{
  "content": "Your detailed response",
  "confidence": 0-100,
  "agentName": "response_generator",
  "followUpQuestions": ["Question 1", "Question 2", "Question 3"]
}`;

    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: query }
        ],
        response_format: { type: "json_object" },
        temperature: 0.3,
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');
      
      return {
        content: result.content || "I couldn't generate a proper response.",
        confidence: result.confidence || 50,
        sources: [],
        agentName: result.agentName || 'response_generator'
      };
    } catch (error) {
      console.error('Response generation error:', error);
      return {
        content: "I'm having trouble generating a response. Please try rephrasing your question.",
        confidence: 0,
        sources: [],
        agentName: 'response_generator'
      };
    }
  }

  private async qualityAssurance(
    response: AgentResponse,
    analysis: QueryAnalysis
  ): Promise<AgentResponse> {
    // Simple quality checks
    const qaPrompt = `Review this healthcare response for accuracy and safety:

Response: "${response.content}"
Confidence: ${response.confidence}
Query Complexity: ${analysis.complexity}

Provide a JSON response with:
{
  "approved": true/false,
  "confidence_adjustment": -20 to +20,
  "safety_warnings": ["warning1", "warning2"],
  "improvements": "suggested improvements if any"
}`;

    try {
      const qaResponse = await this.openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: qaPrompt }],
        response_format: { type: "json_object" },
        temperature: 0.1,
      });

      const qa = JSON.parse(qaResponse.choices[0].message.content || '{}');
      
      if (!qa.approved) {
        return {
          ...response,
          content: "I need to be more careful with this response. Please consult with a healthcare professional for specific medical advice.",
          confidence: Math.max(0, response.confidence - 30)
        };
      }

      return {
        ...response,
        confidence: Math.min(100, Math.max(0, response.confidence + (qa.confidence_adjustment || 0)))
      };
    } catch (error) {
      console.error('Quality assurance error:', error);
      // Return original response with lower confidence
      return {
        ...response,
        confidence: Math.max(0, response.confidence - 10)
      };
    }
  }
}

export const ragOrchestrator = new RagAgentOrchestrator();