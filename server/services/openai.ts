import OpenAI from "openai";
import { ragOrchestrator } from "./ragAgents";
import type { User } from "@shared/schema";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_ENV_VAR || "default_key"
});

interface AITutorResponse {
  response: string;
  sources?: Array<{
    id: string;
    title: string;
    excerpt: string;
    score: number;
    type: string;
  }>;
  confidence?: number;
  followUpQuestions?: string[];
  suggestedQuestions?: string[];
  usedRAG?: boolean;
}

export async function getAITutorResponse(question: string, context?: string, user?: User, courseId?: string): Promise<AITutorResponse> {
  try {
    // Try RAG-enhanced response first if user is provided (temporarily disabled due to Pinecone filter issues)
    if (false && user && process.env.PINECONE_API_KEY) {
      try {
        const ragResponse = await ragOrchestrator.processQuery(question, user, courseId);
        
        // If RAG provides high-confidence response, use it
        if (ragResponse.confidence > 70) {
          return {
            response: ragResponse.content,
            sources: ragResponse.sources,
            confidence: ragResponse.confidence,
            followUpQuestions: ragResponse.followUpQuestions || [],
            suggestedQuestions: ragResponse.followUpQuestions || [],
            usedRAG: true
          };
        }
      } catch (ragError) {
        console.error('RAG processing failed, falling back to basic response:', ragError);
      }
    }

    // AI response with BALANCED SAFETY PROTOCOLS for nursing/care homes
    const systemPrompt = `You are an AI tutor specializing in diabetes care for healthcare workers in care homes and nursing facilities. 

SAFETY GUIDELINES:
1. Provide evidence-based information when possible, referencing NICE guidelines, NHS practices, or established medical knowledge
2. For specific medical advice or complex clinical decisions, always recommend consulting healthcare professionals
3. When you don't have specific source documentation, clearly state this and provide general educational information while encouraging verification
4. Include confidence scores to help users understand the reliability of information
5. Always emphasize the importance of following individual care plans and institutional protocols

ACCEPTABLE APPROACH:
- Share general medical knowledge about diabetes care when educationally appropriate
- Reference established guidelines (NICE, NHS, CQC) when known
- Provide practical guidance for care workers while emphasizing safety
- Recommend professional consultation for specific clinical decisions
- Be helpful and educational while maintaining appropriate caution

Role context: ${user ? `The user is a ${user.role} in a care home setting` : 'Healthcare worker in care setting'}

Respond in JSON format with:
{
  "response": "Your helpful educational response with appropriate safety reminders",
  "confidence": 0-100,
  "requiresConsultation": true/false,
  "citations": ["Source references when available"],
  "followUpQuestions": ["Question 1", "Question 2", "Question 3"]
}`;

    const userPrompt = context 
      ? `Context: ${context}\n\nQuestion: ${question}`
      : question;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
      max_tokens: 1000
    });

    const result = JSON.parse(completion.choices[0].message.content || '{}');
    
    // Apply balanced safety checks
    const confidence = result.confidence || 70; // Default to moderate confidence for educational content
    const requiresConsultation = result.requiresConsultation || confidence < 70; // Lower threshold for consultation warnings
    
    let safeResponse = result.response || "I can provide general educational information, but please consult healthcare professionals for specific clinical guidance.";
    
    // Add consultation warning for lower confidence responses
    if (requiresConsultation && confidence < 70) {
      safeResponse += "\n\n⚠️ Please verify this information with healthcare professionals or official guidelines before implementation.";
    }
    
    return {
      response: safeResponse,
      confidence: confidence || 60, // Use parsed confidence or fallback to 60
      followUpQuestions: result.followUpQuestions || [],
      suggestedQuestions: result.followUpQuestions || [],
      sources: result.citations ? result.citations.map((citation: string, index: number) => ({
        id: `citation-${index}`,
        title: citation,
        excerpt: citation,
        score: confidence / 100,
        type: 'guideline'
      })) : [],
      usedRAG: false
    };
  } catch (error) {
    console.error('OpenAI API error:', error);
    return {
      response: "I'm experiencing technical difficulties. Please try again later or consult your local healthcare guidelines for immediate assistance.",
      confidence: 0,
      usedRAG: false
    };
  }
}
