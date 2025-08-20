/**
 * Improved Response Formatter for Diabetes Care Training
 * Designed to make responses clear, practical, and well-cited
 */
export class ImprovedResponseFormatter {
  /**
   * Format AI responses for optimal readability - SIMPLE and SHORT
   */
  static formatDiabetesResponse(content: string, sources: any[]): string {
    // Clean and shorten the content drastically
    let cleaned = this.cleanAndShortenContent(content);
    
    // Keep it super simple - maximum 200 words total
    const words = cleaned.split(/\s+/);
    if (words.length > 200) {
      cleaned = words.slice(0, 200).join(' ') + '.';
    }
    
    // No fancy formatting - just clean text with minimal structure
    let formatted = cleaned;
    
    // Only add sources if there are any and they're relevant
    if (sources && sources.length > 0) {
      formatted += '\n\n' + this.addSimpleSources(sources);
    }
    
    return formatted.trim();
  }
  
  /**
   * Clean and drastically shorten content
   */
  private static cleanAndShortenContent(content: string): string {
    if (!content) return '';
    
    // Remove all markdown headers and formatting
    let cleaned = content.replace(/#{1,6}\s+/g, '');
    
    // Remove document references
    cleaned = cleaned.replace(/\(document-[0-9]+-[0-9]+[^)]*\)/g, '');
    
    // Remove markers and artifacts
    cleaned = cleaned.replace(/\[BAD\]/gi, '');
    cleaned = cleaned.replace(/\[PLACEHOLDER\]/gi, '');
    cleaned = cleaned.replace(/\*{1,2}([^*]+)\*{1,2}/g, '$1');
    
    // Remove excessive line breaks and clean whitespace
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
    cleaned = cleaned.replace(/\s{2,}/g, ' ');
    
    // Split into sentences and remove duplicates aggressively
    const sentences = cleaned.split(/[.!?]+/).filter(s => s.trim().length > 15);
    const uniqueSentences: string[] = [];
    
    for (const sentence of sentences) {
      const trimmed = sentence.trim();
      if (trimmed && uniqueSentences.length < 6) { // Max 6 sentences
        const isDuplicate = uniqueSentences.some(existing => 
          this.areSimilarSentences(existing, trimmed)
        );
        if (!isDuplicate) {
          uniqueSentences.push(trimmed);
        }
      }
    }
    
    return uniqueSentences.join('. ').trim() + '.';
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
   * Add detailed sources with proper references
   */
  private static addSimpleSources(sources: any[]): string {
    if (!sources || sources.length === 0) {
      return '';
    }
    
    let referencesSection = '\n\n## References\n\n';
    
    // Extract unique sources with proper details
    const uniqueSources = this.getUniqueSources(sources);
    
    uniqueSources.forEach((source, index) => {
      const refNumber = index + 1;
      const title = source.title || 'Medical Guidelines';
      const sourceType = source.metadata?.source || source.source || 'Clinical Reference';
      const section = source.metadata?.section || source.section || '';
      const page = source.metadata?.page || source.pageNumber;
      
      referencesSection += `${refNumber}. **${title}**`;
      
      if (sourceType && sourceType !== 'other') {
        referencesSection += ` - ${sourceType}`;
      }
      
      if (section) {
        referencesSection += `, Section: ${section}`;
      }
      
      if (page) {
        referencesSection += `, Page: ${page}`;
      }
      
      referencesSection += '\n';
    });
    
    return referencesSection;
  }
  
  /**
   * Get unique sources from the provided sources array
   */
  private static getUniqueSources(sources: any[]): any[] {
    const seen = new Set();
    const uniqueSources: any[] = [];
    
    for (const source of sources) {
      const identifier = source.title + (source.metadata?.source || source.source || '');
      if (!seen.has(identifier)) {
        seen.add(identifier);
        uniqueSources.push(source);
        
        // Limit to 5 references for readability
        if (uniqueSources.length >= 5) break;
      }
    }
    
    return uniqueSources;
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