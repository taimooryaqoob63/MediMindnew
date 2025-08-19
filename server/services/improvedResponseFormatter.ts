/**
 * Improved Response Formatter for Diabetes Care Training
 * Designed to make responses clear, practical, and well-cited
 */
export class ImprovedResponseFormatter {
  /**
   * Format AI responses for optimal readability in care home settings
   */
  static formatDiabetesResponse(content: string, sources: any[]): string {
    // Clean the raw content first
    let cleaned = this.cleanRawContent(content);
    
    // Check if it's already well-formatted
    if (this.isWellFormatted(cleaned)) {
      return this.addSourcesSection(cleaned, sources);
    }
    
    // Extract main components
    const components = this.extractComponents(cleaned);
    
    // Build structured response
    let formatted = '';
    
    // Brief Explanation (Always first)
    if (components.explanation) {
      formatted += `## Quick Explanation\n\n${components.explanation}\n\n`;
    }
    
    // Practical Example (Care home focused)
    if (components.example) {
      formatted += `## Practical Example\n\n${components.example}\n\n`;
    }
    
    // Clear Steps (Easy to follow)
    if (components.steps && components.steps.length > 0) {
      formatted += `## What To Do: A Step-by-Step Guide\n\n`;
      components.steps.forEach((step, index) => {
        formatted += `${index + 1}. ${step}\n`;
      });
      formatted += `\n`;
    }
    
    // Next Action (One clear thing to do)
    if (components.action) {
      formatted += `## Your Next Step\n\n**${components.action}**\n\n`;
    }
    
    // Emergency Info (If relevant)
    if (components.emergency) {
      formatted += `## Important Considerations\n\n${components.emergency}\n\n`;
    }
    
    // Add sources at the end
    return this.addSourcesSection(formatted, sources);
  }
  
  /**
   * Clean raw content from AI responses
   */
  private static cleanRawContent(content: string): string {
    if (!content) return '';
    
    // Remove document references like (document-123-456)
    let cleaned = content.replace(/\(document-[0-9]+-[0-9]+[^)]*\)/g, '');
    
    // Remove [BAD] and [PLACEHOLDER] markers
    cleaned = cleaned.replace(/\[BAD\]/gi, '');
    cleaned = cleaned.replace(/\[PLACEHOLDER\]/gi, '');
    
    // Clean up extra whitespace
    cleaned = cleaned.replace(/\s{2,}/g, ' ');
    cleaned = cleaned.replace(/\s+([.!?])/g, '$1');
    
    // Remove duplicate sentences (basic check)
    const sentences = cleaned.split(/[.!?]+/).filter(s => s.trim().length > 10);
    const uniqueSentences: string[] = [];
    
    for (const sentence of sentences) {
      const trimmed = sentence.trim();
      if (trimmed && !uniqueSentences.some(existing => 
        this.areSimilarSentences(existing, trimmed)
      )) {
        uniqueSentences.push(trimmed);
      }
    }
    
    return uniqueSentences.join('. ').trim();
  }
  
  /**
   * Check if content is already well-formatted
   */
  private static isWellFormatted(content: string): boolean {
    const indicators = ['## Quick Explanation', '## Practical Example', '## What To Do', '## Important Considerations'];
    return indicators.some(indicator => content.includes(indicator));
  }
  
  /**
   * Extract key components from unstructured content
   */
  private static extractComponents(content: string): {
    explanation?: string;
    example?: string;
    steps?: string[];
    action?: string;
    emergency?: string;
  } {
    const components: {
      explanation?: string;
      example?: string;
      steps?: string[];
      action?: string;
      emergency?: string;
    } = {};
    
    // Split into paragraphs
    const paragraphs = content.split('\n').filter(p => p.trim().length > 20);
    
    if (paragraphs.length === 0) return {};
    
    // First paragraph is usually explanation
    components.explanation = paragraphs[0]?.trim();
    
    // Look for example keywords
    for (const para of paragraphs) {
      const lowerPara = para.toLowerCase();
      if (lowerPara.includes('example') || lowerPara.includes('care home') || 
          lowerPara.includes('resident') || lowerPara.includes('for instance')) {
        components.example = para.trim();
        break;
      }
    }
    
    // Look for steps or bullet points
    const steps: string[] = [];
    for (const para of paragraphs) {
      if (para.includes('1.') || para.includes('•') || para.includes('-')) {
        const stepLines = para.split(/[1-9]\.|•|-/).filter(s => s.trim().length > 5);
        steps.push(...stepLines.map(s => s.trim()));
      }
    }
    
    if (steps.length > 0) {
      components.steps = steps.slice(0, 5); // Limit to 5 steps max
    }
    
    // Look for action keywords
    for (const para of paragraphs) {
      const lowerPara = para.toLowerCase();
      if (lowerPara.includes('next step') || lowerPara.includes('should do') || 
          lowerPara.includes('action') || lowerPara.includes('immediately')) {
        components.action = para.trim();
        break;
      }
    }
    
    // Look for emergency keywords
    for (const para of paragraphs) {
      const lowerPara = para.toLowerCase();
      if (lowerPara.includes('emergency') || lowerPara.includes('urgent') || 
          lowerPara.includes('call') || lowerPara.includes('999')) {
        components.emergency = para.trim();
        break;
      }
    }
    
    return components;
  }
  
  /**
   * Add sources section with proper citations
   */
  private static addSourcesSection(content: string, sources: any[]): string {
    if (!sources || sources.length === 0) {
      return content;
    }
    
    // Group sources by type
    const niceGuides = sources.filter(s => s.source?.includes('NICE') || s.title?.toLowerCase().includes('nice'));
    const oxfordSources = sources.filter(s => s.source?.includes('Oxford') || s.title?.toLowerCase().includes('oxford'));
    const otherSources = sources.filter(s => !niceGuides.includes(s) && !oxfordSources.includes(s));
    
    let sourcesSection = '\n## 📚 Medical Guidelines Used\n\n';
    
    if (niceGuides.length > 0) {
      sourcesSection += '**NICE Guidelines:**\n';
      niceGuides.forEach(source => {
        sourcesSection += `- ${source.title || 'NICE Guidance'}\n`;
      });
      sourcesSection += '\n';
    }
    
    if (oxfordSources.length > 0) {
      sourcesSection += '**Oxford Medical Resources:**\n';
      oxfordSources.forEach(source => {
        sourcesSection += `- ${source.title || 'Oxford Diabetes Guidelines'}\n`;
      });
      sourcesSection += '\n';
    }
    
    if (otherSources.length > 0) {
      sourcesSection += '**Additional References:**\n';
      otherSources.forEach(source => {
        sourcesSection += `- ${source.title || 'Medical Resource'}\n`;
      });
    }
    
    return content + sourcesSection;
  }
  
  /**
   * Check if two sentences are similar (basic similarity check)
   */
  private static areSimilarSentences(sentence1: string, sentence2: string): boolean {
    const clean1 = sentence1.toLowerCase().replace(/[^a-z\s]/g, '').trim();
    const clean2 = sentence2.toLowerCase().replace(/[^a-z\s]/g, '').trim();
    
    if (clean1 === clean2) return true;
    
    // Check if one is contained in the other (80% overlap)
    const words1 = clean1.split(/\s+/);
    const words2 = clean2.split(/\s+/);
    
    const minLength = Math.min(words1.length, words2.length);
    if (minLength < 3) return false;
    
    const commonWords = words1.filter(word => words2.includes(word)).length;
    const similarity = commonWords / minLength;
    
    return similarity > 0.8;
  }
  
  /**
   * Quick format method for simple responses
   */
  static quickFormat(explanation: string, example?: string, steps?: string[], action?: string): string {
    let formatted = `## Quick Explanation\n\n${explanation}\n\n`;
    
    if (example) {
      formatted += `## In Your Care Home\n\n${example}\n\n`;
    }
    
    if (steps && steps.length > 0) {
      formatted += `## What To Do\n\n`;
      steps.forEach((step, index) => {
        formatted += `${index + 1}. ${step}\n`;
      });
      formatted += '\n';
    }
    
    if (action) {
      formatted += `## Your Next Step\n\n**${action}**\n\n`;
    }
    
    return formatted.trim();
  }
}