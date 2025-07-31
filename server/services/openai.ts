
import OpenAI from "openai";
import { documentProcessor } from "./documentProcessor";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_ENV_VAR || "default_key"
});

interface AITutorResponse {
  response: string;
  references?: DocumentReference[];
}

interface DocumentReference {
  source: string;
  category: string;
  filename: string;
  snippet: string;
}

export async function getAITutorResponse(question: string, context?: string): Promise<AITutorResponse> {
  try {
    // Search for relevant documents using RAG
    let documentContext = "";
    let references: DocumentReference[] = [];
    
    try {
      const relevantDocs = await documentProcessor.searchDocuments(question, 4);
      
      if (relevantDocs.length > 0) {
        documentContext = relevantDocs
          .map((doc, index) => {
            const source = doc.metadata.category || 'Guidelines';
            const filename = doc.metadata.filename || 'Unknown document';
            
            // Create reference for citation
            references.push({
              source,
              category: doc.metadata.category || 'General',
              filename,
              snippet: doc.pageContent.substring(0, 150) + '...'
            });

            return `[Reference ${index + 1} - ${source}]: ${doc.pageContent}`;
          })
          .join('\n\n');
        
        console.log(`RAG Context: Found ${relevantDocs.length} relevant document chunks`);
      }
    } catch (error) {
      console.log("Could not retrieve document context:", error);
    }

    const systemPrompt = `You are an AI tutor specializing in diabetes care for healthcare workers in care homes and nursing facilities. Your responses should be based on:

- NICE (National Institute for Health and Care Excellence) guidelines
- NHS best practices  
- CQC (Care Quality Commission) requirements
- Evidence-based healthcare practices

IMPORTANT: When you use information from the provided documents, always include specific references in your response. Use the format [Reference X] to cite the sources.

Use the provided document context from official guidelines to support your answers. When referencing specific guidelines, mention the source (NICE, NHS, or CQC) and indicate which reference number supports your statement.

Provide accurate, practical, and actionable information for care workers, nurses, and managers. Always emphasize safety protocols and proper documentation. Keep responses concise but comprehensive.

When appropriate, include specific blood glucose ranges, medication guidelines, or emergency procedures. Always remind users to follow individual care plans and consult healthcare professionals for specific cases.

Structure your response to include:
1. Direct answer to the question
2. Specific guidance from the documents (with references)
3. Practical implementation advice
4. Safety considerations if relevant

Respond in JSON format with a "response" field containing your answer with embedded citations.`;

    let userPrompt = question;
    
    if (documentContext) {
      userPrompt = `Based on the following official guidelines:\n\n${documentContext}\n\nQuestion: ${question}

Please provide a comprehensive answer with specific references to the documents provided. Use [Reference X] format to cite relevant information.`;
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
      max_tokens: 1200
    });

    const result = JSON.parse(completion.choices[0].message.content || '{}');
    
    return {
      response: result.response || "I apologize, but I couldn't generate a proper response. Please try rephrasing your question.",
      references: references.length > 0 ? references : undefined
    };
  } catch (error) {
    console.error('OpenAI API error:', error);
    return {
      response: "I'm experiencing technical difficulties. Please try again later or consult your local healthcare guidelines for immediate assistance."
    };
  }
}
