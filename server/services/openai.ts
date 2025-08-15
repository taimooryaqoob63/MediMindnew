import OpenAI from "openai";
import { ragOrchestrator } from "./ragAgents";
import { RAG_CONFIG } from "../config/ragConfiguration";
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
    // Try RAG-enhanced response first if user is provided
    if (user && process.env.PINECONE_API_KEY) {
      try {
        const ragResponse = await ragOrchestrator.processQuery(question, user, courseId);
        
        // Use RAG response if it meets minimum confidence threshold
        if (ragResponse.confidence && ragResponse.confidence >= RAG_CONFIG.safety.minResponseConfidence) {
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

    // Fallback to basic AI response
    const systemPrompt = `You are an AI tutor specializing in diabetes care for healthcare workers in care homes and nursing facilities. Your responses should be based on:

- NICE (National Institute for Health and Care Excellence) guidelines
- NHS best practices
- CQC (Care Quality Commission) requirements
- Evidence-based healthcare practices

RESPONSE FORMAT REQUIREMENTS:
- Keep responses concise (4-5 sentences maximum for explanation)
- ALWAYS include a practical example from real care scenarios
- Use bullet points for key steps or takeaways
- Provide one clear action the user can take
- Maximum 500 tokens for clinical responses, 600 for educational

STRUCTURE YOUR RESPONSE AS:
1. Brief explanation (4-5 sentences)
2. Practical example: "For example: [specific scenario]"
3. Key steps in bullet points
4. One clear action: "Next step: [specific action]"

Role context: ${user ? `The user is a ${user.role} in a care home setting` : 'Healthcare worker in care setting'}

Respond in JSON format with:
{
  "response": "Your structured answer following the format above",
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
      temperature: 0.2, // Lower temperature for more controlled output
      max_tokens: 600,
      presence_penalty: 0.6, // Penalize repetition
      frequency_penalty: 0.7, // Penalize repeated tokens
    });

    const result = JSON.parse(completion.choices[0].message.content || '{}');
    
    return {
      response: result.response || "I apologize, but I couldn't generate a proper response. Please try rephrasing your question.",
      followUpQuestions: result.followUpQuestions || [],
      suggestedQuestions: result.followUpQuestions || [],
      confidence: 60, // Basic AI confidence
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
