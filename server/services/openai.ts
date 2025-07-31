import OpenAI from "openai";
import { documentProcessor } from "./documentProcessor";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_ENV_VAR || "default_key"
});

interface AITutorResponse {
  response: string;
}

export async function getAITutorResponse(question: string, context?: string): Promise<AITutorResponse> {
  try {
    // Search for relevant documents using RAG
    let documentContext = "";
    try {
      const relevantDocs = await documentProcessor.searchDocuments(question, 4);
      
      if (relevantDocs.length > 0) {
        documentContext = relevantDocs
          .map((doc, index) => {
            const source = doc.metadata.category || 'Guidelines';
            return `[${source} - ${index + 1}]: ${doc.pageContent}`;
          })
          .join('\n\n');
      }
    } catch (error) {
      console.log("Could not retrieve document context:", error);
    }

    const systemPrompt = `You are an AI tutor specializing in diabetes care for healthcare workers in care homes and nursing facilities. Your responses should be based on:

- NICE (National Institute for Health and Care Excellence) guidelines
- NHS best practices  
- CQC (Care Quality Commission) requirements
- Evidence-based healthcare practices

Use the provided document context from official guidelines to support your answers. When referencing specific guidelines, mention the source (NICE, NHS, or CQC).

Provide accurate, practical, and actionable information for care workers, nurses, and managers. Always emphasize safety protocols and proper documentation. Keep responses concise but comprehensive.

When appropriate, include specific blood glucose ranges, medication guidelines, or emergency procedures. Always remind users to follow individual care plans and consult healthcare professionals for specific cases.

Respond in JSON format with a "response" field containing your answer.`;

    let userPrompt = question;
    
    if (documentContext) {
      userPrompt = `Based on the following official guidelines:\n\n${documentContext}\n\nQuestion: ${question}`;
    }
    
    if (context) {
      userPrompt += `\n\nAdditional context: ${context}`;
    }

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
      response: result.response || "I apologize, but I couldn't generate a proper response. Please try rephrasing your question."
    };
  } catch (error) {
    console.error('OpenAI API error:', error);
    return {
      response: "I'm experiencing technical difficulties. Please try again later or consult your local healthcare guidelines for immediate assistance."
    };
  }
}
