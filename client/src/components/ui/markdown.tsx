import React from 'react';
import { AlertTriangle, Info, Pill, Zap, CheckCircle, XCircle, Heart, Brain, Activity } from 'lucide-react';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, className = "" }) => {
  // Enhanced markdown parser with improved formatting and visual elements
  const parseMarkdown = (text: string) => {
    const lines = text.split('\n');
    const elements: React.ReactNode[] = [];
    let inReferenceSection = false;
    let inTable = false;
    let tableHeaders: string[] = [];
    let tableRows: string[][] = [];
    
    const processTable = () => {
      if (tableHeaders.length > 0 && tableRows.length > 0) {
        elements.push(
          <div key={`table-${elements.length}`} className="my-4 overflow-x-auto">
            <table className="min-w-full border border-gray-200 rounded-lg overflow-hidden">
              <thead className="bg-medical-blue text-white">
                <tr>
                  {tableHeaders.map((header, idx) => (
                    <th key={idx} className="px-4 py-2 text-left text-sm font-semibold">
                      {header.trim()}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tableRows.map((row, rowIdx) => (
                  <tr key={rowIdx} className={rowIdx % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                    {row.map((cell, cellIdx) => (
                      <td key={cellIdx} className="px-4 py-2 text-sm border-b border-gray-200">
                        {parseInlineMarkdown(cell.trim())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }
      inTable = false;
      tableHeaders = [];
      tableRows = [];
    };
    
    lines.forEach((line, lineIndex) => {
      const trimmedLine = line.trim();
      
      // Handle empty lines
      if (trimmedLine === '') {
        if (inTable) {
          processTable();
        }
        elements.push(<div key={`spacer-${lineIndex}`} className="h-2" />);
        return;
      }
      
      // Handle tables
      if (trimmedLine.includes('|') && !inReferenceSection) {
        const cells = trimmedLine.split('|').map(cell => cell.trim()).filter(cell => cell !== '');
        if (cells.length > 1) {
          if (!inTable) {
            inTable = true;
            tableHeaders = cells;
          } else if (cells.every(cell => cell.match(/^[-:]+$/))) {
            // This is a separator row, skip it
            return;
          } else {
            tableRows.push(cells);
          }
          return;
        }
      } else if (inTable) {
        processTable();
      }
      
      // Handle headings
      const headingMatch = trimmedLine.match(/^(#{1,6})\s+(.+)$/);
      if (headingMatch) {
        const [, hashes, title] = headingMatch;
        const level = hashes.length;
        const HeadingTag = `h${Math.min(level, 6)}` as keyof JSX.IntrinsicElements;
        
        const getHeadingIcon = (title: string) => {
          if (title.toLowerCase().includes('warning') || title.toLowerCase().includes('caution')) {
            return <AlertTriangle className="w-5 h-5 text-amber-500" />;
          }
          if (title.toLowerCase().includes('medication') || title.toLowerCase().includes('drug')) {
            return <Pill className="w-5 h-5 text-blue-500" />;
          }
          if (title.toLowerCase().includes('emergency') || title.toLowerCase().includes('urgent')) {
            return <Zap className="w-5 h-5 text-red-500" />;
          }
          if (title.toLowerCase().includes('treatment') || title.toLowerCase().includes('care')) {
            return <Heart className="w-5 h-5 text-green-500" />;
          }
          return <Info className="w-5 h-5 text-blue-500" />;
        };
        
        const headingClasses = {
          1: 'text-2xl font-bold text-gray-900 mt-6 mb-4 pb-2 border-b-2 border-medical-blue',
          2: 'text-xl font-semibold text-gray-800 mt-5 mb-3 flex items-center gap-2',
          3: 'text-lg font-semibold text-gray-700 mt-4 mb-2 flex items-center gap-2',
          4: 'text-base font-semibold text-gray-600 mt-3 mb-2',
          5: 'text-sm font-semibold text-gray-600 mt-2 mb-1',
          6: 'text-sm font-medium text-gray-500 mt-2 mb-1'
        };
        
        elements.push(
          <HeadingTag key={`heading-${lineIndex}`} className={headingClasses[level as keyof typeof headingClasses] || headingClasses[6]}>
            {level <= 3 && getHeadingIcon(title)}
            {title}
          </HeadingTag>
        );
        return;
      }
      
      // Handle References/Sources section header
      if (trimmedLine.match(/^##?\s*(References|Sources|Citations)\s*$/i)) {
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
      const citationMatch = trimmedLine.match(/^\[(\d+)\]\s*(.+)$/);
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
      
      // Handle alert boxes (lines starting with emoji warnings)
      if (trimmedLine.match(/^(⚠️|🚨|ℹ️|💊|✅|❌|💡|🎯)/)) {
        const alertType = trimmedLine.charAt(0);
        const content = trimmedLine.slice(1).trim();
        
        const alertStyles = {
          '⚠️': 'bg-amber-50 border-amber-200 text-amber-800',
          '🚨': 'bg-red-50 border-red-200 text-red-800',
          'ℹ️': 'bg-blue-50 border-blue-200 text-blue-800',
          '💊': 'bg-purple-50 border-purple-200 text-purple-800',
          '✅': 'bg-green-50 border-green-200 text-green-800',
          '❌': 'bg-red-50 border-red-200 text-red-800',
          '💡': 'bg-yellow-50 border-yellow-200 text-yellow-800',
          '🎯': 'bg-indigo-50 border-indigo-200 text-indigo-800'
        };
        
        elements.push(
          <div key={`alert-${lineIndex}`} className={`p-4 rounded-lg border-l-4 my-3 ${alertStyles[alertType as keyof typeof alertStyles] || alertStyles['ℹ️']}`}>
            <div className="flex items-start space-x-2">
              <span className="text-lg flex-shrink-0">{alertType}</span>
              <div className="flex-1">
                {parseInlineMarkdown(content)}
              </div>
            </div>
          </div>
        );
        return;
      }
      
      // Handle numbered lists (1. 2. etc.)
      const numberedListMatch = trimmedLine.match(/^(\s*)(\d+)\.\s+(.+)$/);
      if (numberedListMatch) {
        const [, indent, number, content] = numberedListMatch;
        const indentLevel = Math.floor(indent.length / 2);
        elements.push(
          <div key={`numbered-${lineIndex}`} className={`my-1 ml-${indentLevel * 4} flex items-start space-x-2`}>
            <span className="inline-flex items-center justify-center w-6 h-6 text-xs font-bold text-white bg-medical-blue rounded-full flex-shrink-0 mt-0.5">
              {number}
            </span>
            <div className="flex-1">
              {parseInlineMarkdown(content)}
            </div>
          </div>
        );
        return;
      }
      
      // Handle bullet points (- or *)
      const bulletMatch = trimmedLine.match(/^(\s*)[-*]\s+(.+)$/);
      if (bulletMatch) {
        const [, indent, content] = bulletMatch;
        const indentLevel = Math.floor(indent.length / 2);
        elements.push(
          <div key={`bullet-${lineIndex}`} className={`my-1 ml-${indentLevel * 4} flex items-start space-x-2`}>
            <span className="w-2 h-2 bg-medical-blue rounded-full flex-shrink-0 mt-2"></span>
            <div className="flex-1">
              {parseInlineMarkdown(content)}
            </div>
          </div>
        );
        return;
      }
      
      // Regular paragraph - handle as short paragraphs
      const sentences = trimmedLine.split(/(?<=[.!?])\s+/).filter(s => s.trim());
      if (sentences.length > 3) {
        // Split long paragraphs
        const chunks = [];
        for (let i = 0; i < sentences.length; i += 2) {
          chunks.push(sentences.slice(i, i + 2).join(' '));
        }
        chunks.forEach((chunk, idx) => {
          elements.push(
            <p key={`para-${lineIndex}-${idx}`} className="mb-2 leading-relaxed">
              {parseInlineMarkdown(chunk)}
            </p>
          );
        });
      } else {
        elements.push(
          <p key={`para-${lineIndex}`} className="mb-2 leading-relaxed">
            {parseInlineMarkdown(trimmedLine)}
          </p>
        );
      }
    });
    
    // Process any remaining table
    if (inTable) {
      processTable();
    }
    
    return elements;
  };
  
  const parseInlineMarkdown = (text: string): React.ReactNode[] => {
    if (typeof text !== 'string') return [text];
    
    const parts: React.ReactNode[] = [];
    let processedText = text;
    
    // Process all markdown patterns in sequence
    const patterns = [
      // Bold with icons for medical terms
      {
        regex: /\*\*([^*]+)\*\*/g,
        render: (match: RegExpExecArray, key: string) => {
          const content = match[1];
          const isClinical = /\b(NICE|NHS|CQC|CALL 999|EMERGENCY|CRITICAL|URGENT)\b/i.test(content);
          const isMedication = /\b(mg|ml|tablet|dose|medication|drug|prescription)\b/i.test(content);
          
          return (
            <strong 
              key={key} 
              className={`${
                isClinical ? 'text-red-700 bg-red-50 px-2 py-0.5 rounded font-bold' :
                isMedication ? 'text-purple-700 bg-purple-50 px-2 py-0.5 rounded font-semibold' :
                'font-semibold text-gray-900'
              }`}
            >
              {isClinical && <AlertTriangle className="w-3 h-3 inline mr-1" />}
              {isMedication && <Pill className="w-3 h-3 inline mr-1" />}
              {content}
            </strong>
          );
        }
      },
      // Italic text
      {
        regex: /\*([^*]+)\*/g,
        render: (match: RegExpExecArray, key: string) => (
          <em key={key} className="italic text-gray-700">{match[1]}</em>
        )
      },
      // Inline code
      {
        regex: /`([^`]+)`/g,
        render: (match: RegExpExecArray, key: string) => (
          <code key={key} className="bg-gray-100 text-gray-800 px-1.5 py-0.5 rounded text-sm font-mono">
            {match[1]}
          </code>
        )
      },
      // Links
      {
        regex: /\[([^\]]+)\]\(([^)]+)\)/g,
        render: (match: RegExpExecArray, key: string) => (
          <a 
            key={key} 
            href={match[2]} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="text-medical-blue hover:text-medical-blue-dark underline font-medium"
          >
            {match[1]} ↗
          </a>
        )
      },
      // Highlight important terms
      {
        regex: /==(.*?)==/g,
        render: (match: RegExpExecArray, key: string) => (
          <mark key={key} className="bg-yellow-200 px-1 rounded">{match[1]}</mark>
        )
      }
    ];
    
    // Apply all patterns
    let result = text;
    let allMatches: Array<{match: RegExpExecArray, pattern: any, index: number}> = [];
    
    patterns.forEach(pattern => {
      const matches = Array.from(result.matchAll(pattern.regex));
      matches.forEach(match => {
        if (match.index !== undefined) {
          allMatches.push({ match, pattern, index: match.index });
        }
      });
    });
    
    // Sort matches by position
    allMatches.sort((a, b) => a.index - b.index);
    
    let lastIndex = 0;
    allMatches.forEach((item, idx) => {
      const { match, pattern } = item;
      if (match.index !== undefined) {
        // Add text before match
        if (match.index > lastIndex) {
          const textBefore = result.slice(lastIndex, match.index);
          if (textBefore) {
            parts.push(textBefore);
          }
        }
        
        // Add the formatted element
        parts.push(pattern.render(match, `pattern-${idx}`));
        lastIndex = match.index + match[0].length;
      }
    });
    
    // Add remaining text
    if (lastIndex < result.length) {
      const remaining = result.slice(lastIndex);
      if (remaining) {
        parts.push(remaining);
      }
    }
    
    return parts.length > 0 ? parts : [text];
  };
  
  return (
    <div className={`whitespace-pre-wrap ${className}`}>
      {parseMarkdown(content)}
    </div>
  );
};