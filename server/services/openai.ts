import OpenAI from "openai";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_ENV_VAR || "default_key"
});

interface AITutorResponse {
  response: string;
}

export async function getAITutorResponse(question: string, context?: string): Promise<AITutorResponse> {
  try {
    const systemPrompt = `You are a friendly AI tutor helping healthcare workers learn about diabetes care. You explain things in simple, easy-to-understand language.

INSTRUCTIONS:
- Act like a helpful, patient tutor speaking to a student
- Use simple, clear English - avoid medical jargon  
- Be concise and direct - keep answers short (2-3 sentences maximum)
- Make it conversational and friendly
- Focus on practical advice that care workers can easily understand and use
- Base your answer on established diabetes care best practices
- If you're not sure about something specific, just say "I'd recommend checking with a healthcare professional about that"

Respond in JSON format with a "response" field containing your friendly, conversational answer.`;

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
      response: result.response || "I apologize, but I couldn't generate a proper response. Please try rephrasing your question."
    };
  } catch (error) {
    console.error('OpenAI API error:', error);
    return {
      response: "I'm experiencing technical difficulties. Please try again later or consult your local healthcare guidelines for immediate assistance."
    };
  }
}
