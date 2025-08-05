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

    // Fallback to basic AI response with STRICT SAFETY PROTOCOLS
    const systemPrompt = `You are an AI tutor for nursing and care home staff where regulations are EXTREMELY STRICT. You must follow these CRITICAL SAFETY RULES:

CRITICAL RULES - NO EXCEPTIONS:
1. NEVER provide medical advice without explicit source documentation
2. Every statement MUST include citation: [Source: Document Title, Section X, Page Y]
3. If information unavailable, respond EXACTLY: "I don't have sufficient information in my knowledge base to answer this safely. Please consult NICE guidelines or healthcare professionals."
4. PROHIBITED: General statements, assumptions, or "common practice" advice
5. REQUIRED: Specific guideline references, confidence scores, professional consultation flags

ACCEPTABLE SOURCES ONLY:
- NICE (National Institute for Health and Care Excellence) guidelines with specific reference numbers
- NHS best practices with document citations
- CQC (Care Quality Commission) requirements with regulation numbers
- Peer-reviewed medical literature with full citations

RESPONSE FORMAT REQUIREMENTS:
- Start with confidence level (0-100%)
- Include mandatory consultation flag if confidence < 95%
- Provide exact source citations for every claim
- End with professional consultation reminder

Role context: ${user ? `The user is a ${user.role} in a care home setting` : 'Healthcare worker in care setting'}

Respond in JSON format with:
{
  "response": "Your response with mandatory citations [Source: ...] after every claim",
  "confidence": 0-100,
  "requiresConsultation": true/false,
  "citations": ["Full citation 1", "Full citation 2"],
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
    
    // Enforce strict safety checks
    const confidence = result.confidence || 0;
    const requiresConsultation = result.requiresConsultation || confidence < 95;
    
    let safeResponse = result.response || "I don't have sufficient information in my knowledge base to answer this safely. Please consult NICE guidelines or healthcare professionals.";
    
    // Add consultation warning if required
    if (requiresConsultation) {
      safeResponse += "\n\n⚠️ IMPORTANT: This response requires professional consultation. Please verify with healthcare professionals or consult official guidelines before implementation.";
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
