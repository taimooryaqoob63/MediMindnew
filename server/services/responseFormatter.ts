
export class ResponseFormatter {
  /**
   * Transform structured JSON responses into beautiful markdown format
   */
  static formatResponse(content: string, metadata?: {
    queryType?: string;
    confidence?: number;
    sources?: any[];
    followUpQuestions?: string[];
    suggestedActions?: any[];
  }): string {
    // If content is already well-formatted, return as-is
    if (this.isAlreadyFormatted(content)) {
      return content;
    }

    // Try to parse if content looks like JSON
    let structuredData: any = null;
    try {
      if (content.trim().startsWith('{') && content.trim().endsWith('}')) {
        structuredData = JSON.parse(content);
      }
    } catch (e) {
      // Not JSON, treat as regular markdown
    }

    if (structuredData) {
      return this.formatStructuredResponse(structuredData);
    }

    // Format regular content with beautiful presentation
    return this.enhanceRegularContent(content, metadata);
  }

  private static isAlreadyFormatted(content: string): boolean {
    // Check if content already has our formatting
    const indicators = ['## ', '### '];
    return indicators.some(indicator => content.includes(indicator));
  }

  private static formatStructuredResponse(data: any): string {
    let formatted = '';

    // Brief Explanation
    if (data['Brief explanation'] || data.briefExplanation || data.explanation) {
      const explanation = data['Brief explanation'] || data.briefExplanation || data.explanation;
      formatted += `## Brief Explanation\n\n${explanation}\n\n`;
    }

    // Practical Example
    if (data['Practical example'] || data.practicalExample || data.example) {
      const example = data['Practical example'] || data.practicalExample || data.example;
      formatted += `## Practical Example\n\n${example}\n\n`;
    }

    // Key Steps
    if (data['Key steps in bullet points'] || data.keySteps || data.steps) {
      const steps = data['Key steps in bullet points'] || data.keySteps || data.steps;
      formatted += `## What To Do: A Step-by-Step Guide\n\n`;
      
      if (Array.isArray(steps)) {
        steps.forEach((step, index) => {
          const cleanStep = step.replace(/^[-•]\s*/, '');
          formatted += `${index + 1}. ${cleanStep}\n`;
        });
      } else if (typeof steps === 'string') {
        const stepLines = steps.split('\n').filter(line => line.trim());
        stepLines.forEach((step, index) => {
          const cleanStep = step.replace(/^[-•]\s*/, '');
          formatted += `${index + 1}. ${cleanStep}\n`;
        });
      }
      formatted += '\n';
    }

    // One Clear Action
    if (data['One clear action'] || data.nextStep || data.action) {
      const action = data['One clear action'] || data.nextStep || data.action;
      let actionText = '';
      
      if (typeof action === 'object' && action['Next step']) {
        actionText = action['Next step'];
      } else if (typeof action === 'string') {
        actionText = action;
      }
      
      if (actionText) {
        formatted += `## Important Considerations\n\n**${actionText}**\n\n`;
      }
    }

    return formatted.trim();
  }

  private static enhanceRegularContent(content: string, metadata?: any): string {
    let enhanced = content;

    // Add confidence banner if needed
    if (metadata?.confidence && metadata.confidence < 70) {
      enhanced = `**Please Note**: This response has moderate confidence. Consider consulting with a healthcare professional for complex cases.\n\n${enhanced}`;
    }

    // Enhance headings - NO EMOJIS
    enhanced = enhanced.replace(/^## (Understanding|Explanation|Brief)/gmi, '## $1');
    enhanced = enhanced.replace(/^## (Example|Practical|For example)/gmi, '## $1');
    enhanced = enhanced.replace(/^## (Steps|Key|Actions|Procedure)/gmi, '## $1');
    enhanced = enhanced.replace(/^## (Next|Action|Immediate)/gmi, '## $1');
    enhanced = enhanced.replace(/^## (Emergency|Warning|Critical)/gmi, '## $1');

    // Enhance bullet points
    enhanced = enhanced.replace(/^- /gm, '• ');
    enhanced = enhanced.replace(/^\* /gm, '• ');

    // Add visual separators
    enhanced = enhanced.replace(/^---$/gm, '________________________________________');

    return enhanced;
  }

  /**
   * Quick formatter for simple responses
   */
  static quickFormat(explanation: string, example?: string, steps?: string[], action?: string): string {
    let formatted = `## 🩺 Brief Explanation\n\n${explanation}\n\n`;

    if (example) {
      formatted += `## 📍 Practical Example (Care Home Setting)\n\n${example}\n\n`;
    }

    if (steps && steps.length > 0) {
      formatted += `## ✅ Key Steps\n\n`;
      steps.forEach(step => {
        formatted += `• ${step}\n`;
      });
      formatted += '\n';
    }

    if (action) {
      formatted += `## ➡️ One Clear Action\n\n🔎 **Next Step**: ${action}\n\n`;
    }

    return formatted.trim();
  }

  /**
   * Format emergency responses with special styling
   */
  static formatEmergencyResponse(content: string): string {
    return `## 🚨 EMERGENCY RESPONSE\n\n${content}\n\n⚠️ **CRITICAL**: This is an emergency situation. Follow your facility's protocols immediately.`;
  }

  /**
   * Add visual dividers between sections
   */
  static addSectionDividers(content: string): string {
    return content.replace(/^## /gm, '________________________________________\n\n## ');
  }
}
