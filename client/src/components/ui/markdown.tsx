import React from 'react';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, className = "" }) => {
  // Simple markdown parser for basic formatting
  const parseMarkdown = (text: string) => {
    // Split by lines to handle list items and preserve line breaks
    const lines = text.split('\n');
    const elements: React.ReactNode[] = [];
    let inReferenceSection = false;
    
    lines.forEach((line, lineIndex) => {
      if (line.trim() === '') {
        elements.push(<br key={`br-${lineIndex}`} />);
        return;
      }
      
      // Handle References/Sources section header
      if (line.match(/^##?\s*(References|Sources|Citations)\s*$/i)) {
        inReferenceSection = true;
        elements.push(
          <div key={`ref-header-${lineIndex}`} className="mt-6 pt-4 border-t border-medical-blue-light">
            <h3 className="text-lg font-semibold text-medical-blue mb-3 flex items-center">
              <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
              </svg>
              References
            </h3>
          </div>
        );
        return;
      }
      
      // Handle citation entries (numbered format [1], [2], etc.)
      const citationMatch = line.match(/^\[(\d+)\]\s*(.+)$/);
      if (citationMatch && inReferenceSection) {
        const [, number, citationText] = citationMatch;
        const urlMatch = citationText.match(/^(.+?)\s*Available at:\s*(.+)$/);
        
        if (urlMatch) {
          const [, title, url] = urlMatch;
          elements.push(
            <div key={`citation-${lineIndex}`} className="mb-2 p-3 bg-blue-50 rounded-lg border-l-4 border-medical-blue">
              <div className="flex items-start space-x-3">
                <span className="inline-flex items-center justify-center w-6 h-6 text-xs font-bold text-white bg-medical-blue rounded-full">
                  {number}
                </span>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-800">{title.trim()}</p>
                  <a 
                    href={url.trim()} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="text-xs text-medical-blue hover:text-medical-blue-dark underline mt-1 inline-block"
                  >
                    View Source →
                  </a>
                </div>
              </div>
            </div>
          );
        } else {
          elements.push(
            <div key={`citation-${lineIndex}`} className="mb-2 p-3 bg-blue-50 rounded-lg border-l-4 border-medical-blue">
              <div className="flex items-start space-x-3">
                <span className="inline-flex items-center justify-center w-6 h-6 text-xs font-bold text-white bg-medical-blue rounded-full">
                  {number}
                </span>
                <p className="text-sm text-gray-800 flex-1">{citationText.trim()}</p>
              </div>
            </div>
          );
        }
        return;
      }
      
      // Handle numbered lists (1. 2. etc.)
      const numberedListMatch = line.match(/^(\s*)(\d+)\.\s+(.+)$/);
      if (numberedListMatch) {
        const [, indent, number, content] = numberedListMatch;
        elements.push(
          <div key={`numbered-${lineIndex}`} className={`ml-${indent.length * 2}`}>
            <span className="font-semibold">{number}. </span>
            {parseInlineMarkdown(content)}
          </div>
        );
        return;
      }
      
      // Handle bullet points with dashes
      const bulletMatch = line.match(/^(\s*)-\s+(.+)$/);
      if (bulletMatch) {
        const [, indent, content] = bulletMatch;
        elements.push(
          <div key={`bullet-${lineIndex}`} className={`ml-${indent.length + 4}`}>
            <span className="mr-2">•</span>
            {parseInlineMarkdown(content)}
          </div>
        );
        return;
      }
      
      // Regular line
      elements.push(
        <div key={`line-${lineIndex}`}>
          {parseInlineMarkdown(line)}
        </div>
      );
    });
    
    return elements;
  };
  
  const parseInlineMarkdown = (text: string): React.ReactNode[] => {
    const parts: React.ReactNode[] = [];
    let currentIndex = 0;
    
    // Regular expressions for different markdown patterns
    const boldRegex = /\*\*(.*?)\*\*/g;
    const emergencyRegex = /🚨\s*\*\*(.*?)\*\*/g;
    let match;
    
    // Handle emergency alerts first
    while ((match = emergencyRegex.exec(text)) !== null) {
      // Add text before the match
      if (match.index > currentIndex) {
        parts.push(text.slice(currentIndex, match.index));
      }
      
      // Add the emergency alert
      parts.push(
        <span key={`emergency-${match.index}`} className="inline-flex items-center px-2 py-1 bg-red-100 text-red-800 rounded-md text-sm font-semibold">
          🚨 {match[1]}
        </span>
      );
      
      currentIndex = match.index + match[0].length;
    }
    
    // Reset regex and handle bold text in remaining content
    const remainingText = text.slice(currentIndex);
    const boldMatches = remainingText.matchAll(/\*\*(.*?)\*\*/g);
    let lastIndex = 0;
    
    for (const boldMatch of boldMatches) {
      if (boldMatch.index !== undefined) {
        // Add text before bold
        if (boldMatch.index > lastIndex) {
          parts.push(remainingText.slice(lastIndex, boldMatch.index));
        }
        
        // Add bold text (check if it's a medical/clinical term)
        const boldContent = boldMatch[1];
        const isClinical = /\b(NICE|NHS|CQC|CALL 999|EMERGENCY|CRITICAL)\b/i.test(boldContent);
        
        parts.push(
          <strong 
            key={`bold-${currentIndex + boldMatch.index}`} 
            className={isClinical ? 'text-red-700 bg-red-50 px-1 rounded' : ''}
          >
            {boldContent}
          </strong>
        );
        
        lastIndex = boldMatch.index + boldMatch[0].length;
      }
    }
    
    // Add any remaining text
    if (lastIndex < remainingText.length) {
      parts.push(remainingText.slice(lastIndex));
    }
    
    // Add remaining text
    if (currentIndex < text.length) {
      parts.push(text.slice(currentIndex));
    }
    
    return parts.length > 0 ? parts : [text];
  };
  
  return (
    <div className={`whitespace-pre-wrap ${className}`}>
      {parseMarkdown(content)}
    </div>
  );
};