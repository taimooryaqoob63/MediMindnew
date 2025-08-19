/**
 * Response Formatter for MediMind AI Chat
 * Transforms raw AI responses into beautifully formatted markdown
 */

export interface FormattedResponse {
  content: string;
  hasStructure: boolean;
}

/**
 * Detects if a response contains JSON-like structure that needs formatting
 */
function isStructuredResponse(content: string): boolean {
  if (!content) return false;
  
  // Check for common JSON-like patterns
  const jsonPatterns = [
    /{\s*"[^"]+"\s*:/,  // JSON object start
    /"BriefExplanation"\s*:/,  // Specific fields
    /"PracticalExample"\s*:/,
    /"KeySteps"\s*:/,
    /"OneClearAction"\s*:/,
    /"NextStep"\s*:/,
  ];
  
  return jsonPatterns.some(pattern => pattern.test(content));
}

/**
 * Attempts to parse JSON content safely
 */
function tryParseJSON(content: string): any {
  try {
    // Try direct parsing first
    return JSON.parse(content);
  } catch {
    try {
      // Try to extract JSON from markdown code blocks
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[1]);
      }
      
      // Try to find JSON-like content between braces
      const braceMatch = content.match(/{[\s\S]*}/);
      if (braceMatch) {
        return JSON.parse(braceMatch[0]);
      }
    } catch {
      // If all parsing fails, return null
      return null;
    }
  }
  return null;
}

/**
 * Formats a structured response into beautiful markdown
 */
function formatStructuredResponse(data: any): string {
  let formatted = "";
  
  // Brief Explanation Section
  if (data.BriefExplanation || data.briefExplanation) {
    const explanation = data.BriefExplanation || data.briefExplanation;
    formatted += `## Brief Explanation\n\n${explanation}\n\n---\n\n`;
  }
  
  // Practical Example Section
  if (data.PracticalExample || data.practicalExample) {
    const example = data.PracticalExample || data.practicalExample;
    formatted += `## Practical Example (Care Home Setting)\n\n${example}\n\n---\n\n`;
  }
  
  // Key Steps Section
  if (data.KeySteps || data.keySteps) {
    const steps = data.KeySteps || data.keySteps;
    formatted += `## Key Steps\n\n`;
    
    if (Array.isArray(steps)) {
      steps.forEach((step, index) => {
        formatted += `${index + 1}. ${step}\n`;
      });
    } else if (typeof steps === 'string') {
      // Handle string format with bullet points or numbers
      const stepLines = steps.split('\n').filter(line => line.trim());
      stepLines.forEach((step, index) => {
        const cleanStep = step.replace(/^[-*•]\s*/, '').replace(/^\d+\.\s*/, '');
        formatted += `${index + 1}. ${cleanStep}\n`;
      });
    }
    formatted += `\n`;
  }
  
  // One Clear Action Section
  if (data.OneClearAction || data.oneClearAction) {
    const action = data.OneClearAction || data.oneClearAction;
    formatted += `## One Clear Action\n\n`;
    
    if (typeof action === 'object' && action.NextStep) {
      formatted += `**Next Step:** ${action.NextStep}\n\n`;
    } else if (typeof action === 'string') {
      formatted += `**Next Step:** ${action}\n\n`;
    }
  }
  
  // Additional sections that might be present
  if (data.KeyPoints || data.keyPoints) {
    const points = data.KeyPoints || data.keyPoints;
    formatted += `## Key Points\n\n`;
    
    if (Array.isArray(points)) {
      points.forEach(point => {
        formatted += `- ${point}\n`;
      });
    } else if (typeof points === 'string') {
      formatted += `${points}\n`;
    }
    formatted += `\n`;
  }
  
  // Safety Information
  if (data.SafetyInformation || data.safetyInformation) {
    const safety = data.SafetyInformation || data.safetyInformation;
    formatted += `## Safety Information\n\n**Warning:** ${safety}\n\n`;
  }
  
  // Guidelines/Compliance
  if (data.Guidelines || data.guidelines) {
    const guidelines = data.Guidelines || data.guidelines;
    formatted += `## Guidelines & Compliance\n\n${guidelines}\n\n`;
  }
  
  // Follow-up Questions
  if (data.FollowUpQuestions || data.followUpQuestions) {
    const questions = data.FollowUpQuestions || data.followUpQuestions;
    formatted += `## Follow-up Questions\n\n`;
    
    if (Array.isArray(questions)) {
      questions.forEach(question => {
        formatted += `- ${question}\n`;
      });
    }
    formatted += `\n`;
  }
  
  return formatted.trim();
}

/**
 * Enhances regular text responses with better formatting
 */
function enhanceRegularResponse(content: string): string {
  let enhanced = content;
  
  // Add section breaks for common patterns - clean, no bold formatting
  enhanced = enhanced.replace(/\n\n(Important|Note|Warning|Caution|Remember):/gi, '\n\n$1:');
  enhanced = enhanced.replace(/\n\n(Example|For example):/gi, '\n\nExample:');
  enhanced = enhanced.replace(/\n\n(Steps|To do this|Procedure):/gi, '\n\nSteps:');
  enhanced = enhanced.replace(/\n\n(Next|Action|Next step):/gi, '\n\nNext Step:');
  enhanced = enhanced.replace(/\n\n(Key points|Summary):/gi, '\n\nKey Points:');
  
  // Keep medication mentions clean and simple - no special formatting
  
  // Add visual breaks for long paragraphs
  const paragraphs = enhanced.split('\n\n');
  if (paragraphs.length > 3) {
    enhanced = paragraphs.map((para, index) => {
      if (index > 0 && index % 3 === 0 && para.length > 100) {
        return `---\n\n${para}`;
      }
      return para;
    }).join('\n\n');
  }
  
  return enhanced;
}

/**
 * Main formatting function that handles all response types
 */
export function formatAIResponse(content: string): FormattedResponse {
  if (!content || typeof content !== 'string') {
    return {
      content: content || '',
      hasStructure: false
    };
  }
  
  let text = content;
  
  // 🔹 Fix common duplication bug like "OnsetOnset:"
  text = text.replace(/(\b[A-Z][a-zA-Z ]+)\1/g, "$1");
  
  // 🔹 Normalize spacing around headings (###)
  text = text.replace(/#+\s*/g, (m) => `${m.trim()} `);
  
  // 🔹 Ensure bullet points start correctly
  text = text.replace(/-\s*/g, "- ");
  
  // 🔹 Fix bold markers (sometimes duplicated or missing space)
  text = text.replace(/\*\*(\s*)/g, "**");
  
  // 🔹 Trim extra spaces & newlines
  text = text.replace(/\n{3,}/g, "\n\n").trim();
  
  // Check if this is a structured response that needs special formatting
  if (isStructuredResponse(text)) {
    const parsedData = tryParseJSON(text);
    
    if (parsedData) {
      const formattedContent = formatStructuredResponse(parsedData);
      return {
        content: formattedContent,
        hasStructure: true
      };
    }
  }
  
  // For regular responses, apply enhancement formatting
  const enhancedContent = enhanceRegularResponse(text);
  
  return {
    content: enhancedContent,
    hasStructure: false
  };
}

/**
 * Utility to clean up any remaining JSON artifacts
 */
export function cleanupResponse(content: string): string {
  if (!content) return content;
  
  let cleaned = content;
  
  // Remove any lingering JSON syntax
  cleaned = cleaned.replace(/^\s*{[\s\S]*}\s*$/, (match) => {
    // If the entire content is just JSON, try to format it
    const parsed = tryParseJSON(match);
    if (parsed) {
      return formatStructuredResponse(parsed);
    }
    return match;
  });
  
  // Remove quotes around structured field names that might have leaked through
  cleaned = cleaned.replace(/"(BriefExplanation|PracticalExample|KeySteps|OneClearAction)":\s*/g, '');
  
  // Clean up any escaped characters
  cleaned = cleaned.replace(/\\"/g, '"');
  cleaned = cleaned.replace(/\\n/g, '\n');
  
  // Fix text duplication like "Type 1 DiabetesType 1 Diabetes"
  cleaned = removeDuplicatedWords(cleaned);
  
  // Fix numbered lists to ensure they start from 1 and are consecutive
  cleaned = fixNumberedLists(cleaned);
  
  return cleaned.trim();
}

/**
 * Remove duplicated words like "Type 1 DiabetesType 1 Diabetes"
 */
function removeDuplicatedWords(content: string): string {
  if (!content) return content;
  
  // Fix cases where words or phrases are duplicated without spaces
  let cleaned = content;
  
  // 🔹 Fix common duplication bug like "OnsetOnset:" - enhanced pattern
  cleaned = cleaned.replace(/(\b[A-Z][a-zA-Z ]+)\1/g, "$1");
  
  // Common medical terms that might get duplicated
  const medicalTerms = [
    'Type 1 Diabetes', 'Type 2 Diabetes', 'Gestational Diabetes',
    'insulin', 'glucose', 'blood sugar', 'medication', 'treatment',
    'symptoms', 'diagnosis', 'monitoring', 'management', 'onset',
    'autoimmune condition', 'key characteristics', 'insulin dependence'
  ];
  
  medicalTerms.forEach(term => {
    // Remove duplications like "Type 1 DiabetesType 1 Diabetes"
    const duplicatedPattern = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})\\1+`, 'gi');
    cleaned = cleaned.replace(duplicatedPattern, '$1');
  });
  
  // General pattern for any word followed immediately by itself
  cleaned = cleaned.replace(/\b(\w+)\1+\b/g, '$1');
  
  return cleaned;
}

/**
 * Fix numbered lists to ensure proper sequential numbering starting from 1
 */
function fixNumberedLists(content: string): string {
  const lines = content.split('\n');
  const fixedLines: string[] = [];
  let inNumberedList = false;
  let listCounter = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();
    
    // Check if this line is a numbered list item
    const numberedMatch = trimmedLine.match(/^(\s*)(\d+)\.\s+(.+)$/);
    
    if (numberedMatch) {
      const [, indent, , content] = numberedMatch;
      
      if (!inNumberedList) {
        // Starting a new numbered list
        inNumberedList = true;
        listCounter = 1;
      } else {
        listCounter++;
      }
      
      // Replace with correct sequential number
      fixedLines.push(`${indent}${listCounter}. ${content}`);
    } else {
      // Not a numbered list item
      if (inNumberedList) {
        // We were in a list but now we're not, so reset
        inNumberedList = false;
        listCounter = 0;
      }
      fixedLines.push(line);
    }
  }
  
  return fixedLines.join('\n');
}