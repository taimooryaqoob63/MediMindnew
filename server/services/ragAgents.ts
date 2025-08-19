import OpenAI from 'openai';
import { vectorStore } from './vectorStore';
import { storage } from '../storage';
import { getGenerationSettings } from '../config/ragConfiguration.js';
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
  followUpQuestions?: string[];
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
    if (!this.openai) {
      throw new Error('OpenAI not configured');
    }

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
    if (!this.openai) {
      throw new Error('OpenAI not configured');
    }

    const systemPrompt = `You are MediMind AI, a specialized healthcare assistant for diabetes care in care homes and nursing facilities.

User Role: ${user.role}
Query Complexity: ${analysis.complexity}
Requires Specialist Knowledge: ${analysis.requiresSpecialistKnowledge}

CRITICAL MARKDOWN FORMATTING REQUIREMENTS:

You MUST format ALL responses using proper Markdown syntax for maximum readability and visual appeal:

## MARKDOWN FORMATTING RULES:

### 1. Structure Your Content:
- **Headings**: Use ## for main sections, ### for subsections  
- **Short Paragraphs**: Keep each paragraph to 2-3 sentences maximum
- **Lists**: Use bullet points (-) or numbered lists (1. 2. 3.) for easy scanning
- **Bold Text**: Use **bold** for critical information, warnings, dosages, or key terms
- **Italic Text**: Use *italics* for emphasis or technical terms

### 2. Visual Elements - Clean Professional Format:
- Use **bold text** for warnings or important safety information
- Use clear headings and subheadings to organize content
- Use numbered lists for procedures and step-by-step instructions
- Use bullet points for key information and takeaways

### 3. Tables for Structured Data:
Use tables when presenting medication schedules, blood glucose ranges, or comparing guidelines:
| Parameter | Normal Range | Action Required |
|-----------|-------------|----------------|
| Blood glucose | 4-7 mmol/L | Monitor regularly |

### 4. Simple Language Requirements:
- Use everyday English that anyone can understand
- Avoid heavy medical jargon unless necessary  
- When you must use medical terms, explain them simply
- Write as if explaining to a caring family member

RESPONSE CONTENT REQUIREMENTS:
- Keep responses comprehensive but scannable
- ALWAYS include a practical example from real care scenarios
- Use the visual elements above to break up text
- Provide clear actionable steps
- Maximum 600 tokens for clinical responses, 700 for educational
- NEVER repeat the same sentence, phrase, or information twice
- Each sentence must be unique and add new value

STRUCTURE YOUR RESPONSE USING MARKDOWN:
## Main Topic (use appropriate heading)

Brief explanation with **key terms bolded** and proper formatting.

### Practical Example
**For example**: [specific scenario from care home setting]

### Key Steps:
1. **First step** - with specific details
2. **Second step** - with timing or measurements  
3. **Third step** - with follow-up actions

**Important Safety Note**: [relevant warning]

**Next Action**: [one clear step they can take immediately]

Guidelines:
- Base responses on NICE guidelines, NHS practices, and CQC requirements
- Provide practical, actionable advice appropriate for the user's role
- Always emphasize safety protocols and professional consultation
- Include specific blood glucose ranges, medication guidelines when relevant
- Use icons and formatting to make information scannable

Context from Guidelines:
${context}

Respond in JSON format with:
{
  "content": "Your fully formatted Markdown response following the structure above",
  "confidence": 0-100,
  "agentName": "response_generator",
  "followUpQuestions": ["Question 1", "Question 2", "Question 3"]
}`;

    try {
      // Get the appropriate generation settings based on query type
      const queryType = analysis.requiresSpecialistKnowledge ? 'clinical' : 'educational';
      const genSettings = getGenerationSettings(queryType);

      const response = await this.openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: query }
        ],
        response_format: { type: "json_object" },
        temperature: genSettings.temperature,
        max_tokens: genSettings.maxTokens,
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');

      // Apply deduplication to prevent repetitive sentences
      let content = result.content || "I couldn't generate a proper response.";
      content = this.deduplicateContent(content);

      return {
        content,
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

  private deduplicateContent(content: string): string {
    if (!content) return content;

    // Step 1: Remove exact consecutive duplicates
    content = content.replace(/(.{20,}?[.!?])\s*\1+/gi, '$1');

    // Step 2: More aggressive duplicate detection
    const sentenceParts = content.split(/([.!?]+)/);
    const rebuiltContent: string[] = [];
    const seenNormalized = new Set<string>();

    for (let i = 0; i < sentenceParts.length; i += 2) {
      const sentence = sentenceParts[i]?.trim();
      const punctuation = sentenceParts[i + 1] || '';

      if (!sentence || sentence.length < 15) {
        if (sentence) rebuiltContent.push(sentence + punctuation);
        continue;
      }

      // Create a normalized version for comparison
      const normalized = sentence.toLowerCase()
        .replace(/[^\w\s]/g, '')
        .replace(/\s+/g, ' ')
        .replace(/\b(the|a|an|and|or|but|in|on|at|to|for|of|with|by)\b/g, '')
        .trim();

      // Skip duplicates
      if (!seenNormalized.has(normalized)) {
        seenNormalized.add(normalized);
        rebuiltContent.push(sentence + punctuation);
      }
    }

    return rebuiltContent.join('');
  }

  private async qualityAssurance(
    response: AgentResponse,
    analysis: QueryAnalysis
  ): Promise<AgentResponse> {
    if (!this.openai) {
      throw new Error('OpenAI not configured');
    }

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

// Initialize RAG orchestrator with proper error handling
let ragOrchestrator: RagAgentOrchestrator;

try {
  ragOrchestrator = new RagAgentOrchestrator();
} catch (error) {
  console.error('Failed to initialize RAG orchestrator:', error);
  // Create a fallback orchestrator that will handle errors gracefully
  ragOrchestrator = new RagAgentOrchestrator();
}

export { ragOrchestrator };