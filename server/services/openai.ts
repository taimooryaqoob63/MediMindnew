
import OpenAI from "openai";
import { documentProcessor } from "./documentProcessor";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_ENV_VAR || "default_key"
});

interface AITutorResponse {
  response: string;
  sources?: string[];
}

export async function getAITutorResponse(question: string, context?: string): Promise<AITutorResponse> {
  try {
    // Search for relevant documents using RAG
    const relevantDocs = await documentProcessor.searchSimilarDocuments(question, 4);
    
    // Build context from retrieved documents
    let ragContext = "";
    const sources: string[] = [];
    
    if (relevantDocs.length > 0) {
      ragContext = "\n\nRelevant guidelines and information:\n\n";
      relevantDocs.forEach((doc, index) => {
        ragContext += `${index + 1}. Source: ${doc.metadata.source} (${doc.metadata.category})\n`;
        ragContext += `Content: ${doc.pageContent}\n\n`;
        
        if (doc.metadata.source && !sources.includes(doc.metadata.source)) {
          sources.push(doc.metadata.source);
        }
      });
    }

    const systemPrompt = `You are an AI tutor specializing in diabetes care for healthcare workers in care homes and nursing facilities. Your responses should be based on:

- NICE (National Institute for Health and Care Excellence) guidelines
- NHS best practices
- CQC (Care Quality Commission) requirements
- Evidence-based healthcare practices

You have access to specific guideline documents that will be provided in the context. When answering questions, prioritize information from these official sources and cite them when appropriate.

Provide accurate, practical, and actionable information for care workers, nurses, and managers. Always emphasize safety protocols and proper documentation. Keep responses concise but comprehensive.

When appropriate, include specific blood glucose ranges, medication guidelines, or emergency procedures. Always remind users to follow individual care plans and consult healthcare professionals for specific cases.

If you reference information from the provided guidelines, mention the source (e.g., "According to NICE guidelines..." or "The NHS recommends...").

Respond in JSON format with a "response" field containing your answer.`;

    const userPrompt = context 
      ? `Context: ${context}\n\nQuestion: ${question}${ragContext}`
      : `Question: ${question}${ragContext}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
      max_tokens: 1200
    });

    const result = JSON.parse(completion.choices[0].message.content || '{}');
    
    return {
      response: result.response || "I apologize, but I couldn't generate a proper response. Please try rephrasing your question.",
      sources: sources
    };
  } catch (error) {
    console.error('OpenAI API error:', error);
    return {
      response: "I'm experiencing technical difficulties. Please try again later or consult your local healthcare guidelines for immediate assistance."
    };
  }
}
