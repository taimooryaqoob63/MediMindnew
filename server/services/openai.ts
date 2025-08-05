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
  usedRAG?: boolean;
}

export async function getAITutorResponse(question: string, context?: string, user?: User, courseId?: string): Promise<AITutorResponse> {
  try {
    // Try RAG-enhanced response first if user is provided
    if (user && process.env.PINECONE_API_KEY) {
      try {
        const ragResponse = await ragOrchestrator.processQuery(question, user, courseId);
        
        // If RAG provides high-confidence response, use it
        if (ragResponse.confidence > 70) {
          return {
            response: ragResponse.content,
            sources: ragResponse.sources,
            confidence: ragResponse.confidence,
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

Provide accurate, practical, and actionable information for care workers, nurses, and managers. Always emphasize safety protocols and proper documentation. Keep responses concise but comprehensive.

When appropriate, include specific blood glucose ranges, medication guidelines, or emergency procedures. Always remind users to follow individual care plans and consult healthcare professionals for specific cases.

Role context: ${user ? `The user is a ${user.role} in a care home setting` : 'Healthcare worker in care setting'}

Respond in JSON format with:
{
  "response": "Your detailed answer",
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
    
    return {
      response: result.response || "I apologize, but I couldn't generate a proper response. Please try rephrasing your question.",
      followUpQuestions: result.followUpQuestions || [],
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
