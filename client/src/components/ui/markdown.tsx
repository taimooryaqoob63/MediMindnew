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
    
    lines.forEach((line, lineIndex) => {
      if (line.trim() === '') {
        elements.push(<br key={`br-${lineIndex}`} />);
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
    
    // Regular expression to match **bold** text
    const boldRegex = /\*\*(.*?)\*\*/g;
    let match;
    
    while ((match = boldRegex.exec(text)) !== null) {
      // Add text before the match
      if (match.index > currentIndex) {
        parts.push(text.slice(currentIndex, match.index));
      }
      
      // Add the bold text
      parts.push(<strong key={`bold-${match.index}`}>{match[1]}</strong>);
      
      currentIndex = match.index + match[0].length;
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