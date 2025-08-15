import type { Express } from "express";
import { isAuthenticated } from "../replitAuth";
import { storage } from "../storage";
import { documentProcessor } from "../services/documentProcessor";
import { vectorStore } from "../services/vectorStore";
import { ragOrchestrator } from "../services/ragAgents";
import { enhancedRagOrchestrator } from "../services/enhancedRagOrchestrator";
import { insertDocumentSchema, insertRagChatMessageSchema } from "@shared/schema";
import multer from "multer";
import path from "path";
import fs from "fs/promises";

// Enhanced deduplication function to eliminate repetitive sentences
function finalDeduplication(content: string): string {
  if (!content) return content;
  
  // STEP -1: Remove unwanted disclaimers first
  content = removeUnwantedDisclaimers(content);
  
  // STEP 0: Fix heading formatting
  content = formatHeadings(content);
  
  console.log('Final deduplication - Original length:', content.length);
  console.log('Content preview for debugging:', content.substring(0, 200) + '...');
  
  // STEP -1: Most direct duplication check - look for exact half duplication
  const halfLength = Math.floor(content.length / 2);
  if (halfLength > 100) {
    const firstHalf = content.substring(0, halfLength).trim();
    const secondHalf = content.substring(halfLength).trim();
    
    console.log('Checking direct half-split:', firstHalf.length, 'vs', secondHalf.length);
    
    // Debug: show the actual content
    console.log('First half start:', firstHalf.substring(0, 100) + '...');
    console.log('Second half start:', secondHalf.substring(0, 100) + '...');
    
    if (firstHalf === secondHalf) {
      console.log('DIRECT HALF DUPLICATION DETECTED - exact match');
      return formatHeadings(firstHalf);
    }
    
    // Check normalized versions to catch minor variations
    const norm1 = firstHalf.replace(/\s+/g, ' ').trim().toLowerCase();
    const norm2 = secondHalf.replace(/\s+/g, ' ').trim().toLowerCase();
    
    if (norm1 === norm2 && norm1.length > 100) {
      console.log('NORMALIZED HALF DUPLICATION DETECTED');
      return formatHeadings(firstHalf);
    }
    
    // Check if second half starts with first half (common pattern)
    if (secondHalf.startsWith(firstHalf.substring(0, Math.min(200, firstHalf.length)))) {
      console.log('DIRECT HALF DUPLICATION DETECTED - second starts with first');
      return formatHeadings(firstHalf);
    }
    
    // Check normalized starting pattern
    if (norm2.startsWith(norm1.substring(0, Math.min(200, norm1.length)))) {
      console.log('NORMALIZED STARTING DUPLICATION DETECTED');
      return formatHeadings(firstHalf);
    }
  }
  
  // STEP -0.75: Try different split points around the middle
  for (let offset = -100; offset <= 100; offset += 10) {
    const splitPoint = halfLength + offset;
    if (splitPoint < 50 || splitPoint > content.length - 50) continue;
    
    const part1 = content.substring(0, splitPoint).trim();
    const part2 = content.substring(splitPoint).trim();
    
    if (part1.length > 100 && part1 === part2) {
      console.log('OFFSET DUPLICATION DETECTED at offset:', offset);
      return formatHeadings(part1);
    }
  }
  
  // STEP -0.6: Brute force search for any repeated pattern
  const contentWords = content.split(/\s+/);
  const contentText = contentWords.join(' ');
  
  // Look for any substring that appears twice consecutively
  for (let wordCount = 20; wordCount <= Math.floor(contentWords.length / 2); wordCount += 5) {
    const testChunk = contentWords.slice(0, wordCount).join(' ');
    const remainingText = contentWords.slice(wordCount).join(' ');
    
    if (testChunk.length > 100 && remainingText.startsWith(testChunk.substring(0, Math.min(300, testChunk.length)))) {
      console.log('BRUTE FORCE PATTERN FOUND - word count:', wordCount);
      return formatHeadings(testChunk.trim());
    }
  }
  
  // STEP -0.5: Simple substring repetition check
  // Look for cases where the content literally repeats itself
  const contentLength = content.length;
  for (let chunkSize = Math.floor(contentLength * 0.3); chunkSize <= Math.floor(contentLength * 0.7); chunkSize += 50) {
    const chunk = content.substring(0, chunkSize);
    if (chunkSize > 200 && content.includes(chunk + chunk.substring(0, 100))) {
      console.log('SIMPLE REPETITION DETECTED - chunk size:', chunkSize, '- Using first occurrence');
      return formatHeadings(chunk.trim());
    }
    
    // Check if content starts repeating at any point
    const possibleRepeat = content.substring(chunkSize);
    if (chunkSize > 200 && possibleRepeat.startsWith(chunk.substring(0, Math.min(300, chunk.length)))) {
      console.log('CONTENT REPETITION DETECTED - chunk size:', chunkSize, '- Using first part');
      return formatHeadings(chunk.trim());
    }
  }
  
  // STEP -0.25: Sliding window repetition detection
  // Use a sliding window to find repeating content
  const contentSentences = content.split(/[.!?]+/).filter(s => s.trim().length > 10);
  if (contentSentences.length > 4) {
    for (let windowSize = 2; windowSize <= Math.floor(contentSentences.length / 2); windowSize++) {
      for (let i = 0; i <= contentSentences.length - windowSize * 2; i++) {
        const window1 = contentSentences.slice(i, i + windowSize).join('.').trim();
        const window2 = contentSentences.slice(i + windowSize, i + windowSize * 2).join('.').trim();
        
        if (window1.length > 100 && window1 === window2) {
          console.log('SLIDING WINDOW REPETITION DETECTED - window size:', windowSize, 'at position:', i);
          return formatHeadings(contentSentences.slice(0, i + windowSize).join('.').trim() + '.');
        }
      }
    }
  }
  
  // STEP 0: Ultra-aggressive exact duplication detection
  const words = content.split(/\s+/);
  
  // Check if content is repeated exactly (most common case)
  if (words.length > 30) {
    // First, try to find exact duplication by looking for repeating patterns
    const contentStr = words.join(' ');
    
    // Look for the pattern where text repeats from various starting points
    for (let startCheck = 0; startCheck < Math.min(words.length / 4, 50); startCheck++) {
      for (let splitOffset = -50; splitOffset <= 50; splitOffset += 1) {
        const splitPoint = Math.floor(words.length / 2) + splitOffset;
        if (splitPoint < 10 || splitPoint > words.length - 10) continue;
        
        const firstPart = words.slice(startCheck, splitPoint).join(' ');
        const secondPart = words.slice(splitPoint + startCheck, splitPoint + startCheck + (splitPoint - startCheck)).join(' ');
        
        // Direct string comparison for exact duplication
        if (firstPart === secondPart && firstPart.length > 80) {
          console.log('FINAL DEDUP: EXACT WORD-FOR-WORD DUPLICATION DETECTED at split:', splitPoint, 'start:', startCheck, '- Using first part');
          return formatHeadings(words.slice(startCheck, splitPoint).join(' ').trim());
        }
      }
    }
    
    // Fallback: original logic with broader range
    for (let offset = -100; offset <= 100; offset += 1) {
      const splitPoint = Math.floor(words.length / 2) + offset;
      if (splitPoint < 15 || splitPoint > words.length - 15) continue;
      
      const firstPart = words.slice(0, splitPoint).join(' ');
      const secondPart = words.slice(splitPoint).join(' ');
      
      // Direct string comparison for exact duplication
      if (firstPart === secondPart && firstPart.length > 100) {
        console.log('FINAL DEDUP: EXACT WORD-FOR-WORD DUPLICATION DETECTED at offset', offset, '- Using first part');
        return formatHeadings(firstPart.trim());
      }
      
      // Check if second part starts with substantial portion of first part
      if (firstPart.length > 200 && secondPart.startsWith(firstPart.substring(0, 300))) {
        console.log('FINAL DEDUP: SUBSTRING DUPLICATION DETECTED at offset', offset, '- Using first part');
        return formatHeadings(firstPart.trim());
      }
      
      // Character-level similarity check
      const similarity = calculateTextSimilarity(firstPart, secondPart);
      if (similarity > 0.95 && firstPart.length > 150) {
        console.log('FINAL DEDUP: HIGH SIMILARITY DETECTED at offset', offset, 'similarity:', similarity, '- Using first part');
        return formatHeadings(firstPart.trim());
      }
      
      // Check for near-exact duplication
      if (firstPart.length > 50 && secondPart.length > 50) {
        const similarity = calculateTextSimilarity(firstPart, secondPart);
        if (similarity > 0.85) {
          console.log('NEAR-EXACT DUPLICATION DETECTED at offset', offset, '(similarity:', similarity, ') - Using first part');
          const originalWords = content.split(' ');
          const resultWords = originalWords.slice(0, splitPoint);
          return formatHeadings(resultWords.join(' ').trim());
        }
      }
      
      // Check if second part starts with first part (common pattern)
      if (firstPart.length > 50 && secondPart.startsWith(firstPart.substring(0, 100))) {
        console.log('SUBSTRING DUPLICATION DETECTED at offset', offset, '- Using first part');
        const originalWords = content.split(' ');
        const resultWords = originalWords.slice(0, splitPoint);
        return formatHeadings(resultWords.join(' ').trim());
      }
      
      // Check for overlapping content (more aggressive)
      if (firstPart.length > 50 && secondPart.length > 50) {
        const overlap = findLongestCommonSubstring(firstPart, secondPart);
        if (overlap.length > Math.min(firstPart.length, secondPart.length) * 0.6) {
          console.log('MAJOR OVERLAP DETECTED at offset', offset, '- Using first part');
          const originalWords = content.split(' ');
          const resultWords = originalWords.slice(0, splitPoint);
          return formatHeadings(resultWords.join(' ').trim());
        }
      }
    }
  }
  
  // STEP 1: Handle content without proper sentence breaks by inserting breaks
  let processedContent = content
    .replace(/\.([A-Z])/g, '. $1')  // Add space after period if missing
    .replace(/\?([A-Z])/g, '? $1')  // Add space after question mark if missing
    .replace(/!([A-Z])/g, '! $1');  // Add space after exclamation if missing
  
  // STEP 2: Aggressive sentence-based duplication detection
  console.log('Checking for sentence-based duplication patterns...');
  
  // Split into sentences and check for repetitive patterns
  const sentences = processedContent
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 10);
  
  console.log('Total sentences found:', sentences.length);
  
  // Look for patterns where sentences repeat in blocks
  const normalizedSentences = sentences.map(s => 
    s.toLowerCase()
     .replace(/[^\w\s]/g, ' ')
     .replace(/\s+/g, ' ')
     .trim()
  );
  
  // Check if second half of sentences match first half
  const halfPoint = Math.floor(sentences.length / 2);
  if (halfPoint > 2) {
    const firstHalfNorm = normalizedSentences.slice(0, halfPoint);
    const secondHalfNorm = normalizedSentences.slice(halfPoint);
    
    let matchCount = 0;
    const compareLength = Math.min(firstHalfNorm.length, secondHalfNorm.length);
    
    for (let i = 0; i < compareLength; i++) {
      if (firstHalfNorm[i] === secondHalfNorm[i]) {
        matchCount++;
      }
    }
    
    const matchRatio = matchCount / compareLength;
    console.log(`Sentence match ratio: ${matchRatio} (${matchCount}/${compareLength})`);
    
    if (matchRatio > 0.3) { // Even lower threshold 
      console.log('MAJOR SENTENCE DUPLICATION DETECTED - Using first half only');
      const firstHalfSentences = sentences.slice(0, halfPoint);
      return formatHeadings(firstHalfSentences.join(' ').trim());
    }
    
    // Also check for exact first sentence matches (most common pattern)
    if (normalizedSentences.length > 2 && 
        normalizedSentences[0] === normalizedSentences[halfPoint]) {
      console.log('FIRST SENTENCE DUPLICATION DETECTED - Using first half only');
      const firstHalfSentences = sentences.slice(0, halfPoint);
      return formatHeadings(firstHalfSentences.join(' ').trim());
    }
    
    // Check for any exact sentence matches between halves
    for (let i = 0; i < Math.min(firstHalfNorm.length, 3); i++) {
      for (let j = 0; j < Math.min(secondHalfNorm.length, 3); j++) {
        if (firstHalfNorm[i].length > 30 && firstHalfNorm[i] === secondHalfNorm[j]) {
          console.log('MATCHING SENTENCE FOUND between halves - Using first half only');
          const firstHalfSentences = sentences.slice(0, halfPoint);
          return formatHeadings(firstHalfSentences.join(' ').trim());
        }
      }
    }
  }
  
  // STEP 3: Character-based duplication check as fallback
  let bestReduction = processedContent;
  let maxReductionFound = false;
  
  // Try multiple split points around the halfway mark
  for (let offset = -100; offset <= 100; offset += 25) {
    const splitPoint = Math.floor(processedContent.length / 2) + offset;
    if (splitPoint < 200 || splitPoint > processedContent.length - 200) continue;
    
    const firstPart = processedContent.substring(0, splitPoint).trim();
    const secondPart = processedContent.substring(splitPoint).trim();
    
    const normalize = (text: string) => text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    const norm1 = normalize(firstPart);
    const norm2 = normalize(secondPart);
    
    // Check for exact duplication with different thresholds
    if (norm1.length > 100 && norm2.length > 100) {
      // Check beginning overlap
      const firstChunk = norm1.substring(0, Math.min(300, norm1.length));
      const secondChunk = norm2.substring(0, Math.min(300, norm2.length));
      
      const similarity = calculateTextSimilarity(firstChunk, secondChunk);
      
      if (similarity > 0.8) {
        console.log('HIGH SIMILARITY DUPLICATION DETECTED at offset', offset, 'similarity:', similarity);
        bestReduction = firstPart;
        maxReductionFound = true;
        break;
      }
    }
  }
  
  // STEP 4: Advanced sentence-level deduplication if no major duplication found
  console.log('Performing sentence-level deduplication...');
  
  // More sophisticated sentence splitting
  const finalSentences = bestReduction
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 5);
  
  const uniqueSentences: string[] = [];
  const seenNormalized = new Set<string>();
  const seenConcepts = new Set<string>();
  
  for (const sentence of finalSentences) {
    if (sentence.length < 10) {
      uniqueSentences.push(sentence);
      continue;
    }
    
    // Ultra-aggressive normalization for duplicate detection
    const normalized = sentence.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/\b(the|a|an|and|or|but|in|on|at|to|for|of|with|by|is|are|was|were|that|this|it|as|can|will|should|must|may|might|could|would|has|have|had|be|been|being|do|does|did|than|then|when|where|why|how|what|who|which|these|those|they|them|their|there|here|such|some|many|much|more|most|all|any|each|every|both|either|neither|one|two|three|first|second|last|also|just|only|very|really|quite|rather|even|still|yet|already|again|once|never|always|often|sometimes|usually|generally|particularly|especially|specifically|including|regarding|concerning|about|above|below|before|after|during|while|since|until|unless|because|although|however|therefore|thus|hence|moreover|furthermore|additionally|meanwhile|instead|otherwise|nevertheless|nonetheless)\b/g, '')
      .trim();
    
    // Extract key concepts (remove very common words)
    const words = normalized.split(' ')
      .filter(w => w.length > 3)
      .filter(w => !['that', 'this', 'they', 'them', 'their', 'there', 'here', 'from', 'into', 'onto', 'upon', 'over', 'under', 'through', 'between', 'among', 'within', 'without', 'across', 'along', 'around', 'behind', 'beside', 'beneath', 'beyond'].includes(w));
    
    const conceptString = words.slice(0, 5).join(' '); // First 5 meaningful words
    
    // Check for exact sentence duplication
    if (normalized.length > 5 && seenNormalized.has(normalized)) {
      console.log('Exact duplicate sentence removed:', sentence.substring(0, 60) + '...');
      continue;
    }
    
    // Check for conceptual duplication
    if (conceptString.length > 8 && seenConcepts.has(conceptString)) {
      console.log('Conceptual duplicate removed:', sentence.substring(0, 60) + '...');
      continue;
    }
    
    // Enhanced diabetes-specific concept detection
    const diabetesConcept = detectDiabetesConcept(sentence);
    if (diabetesConcept && seenConcepts.has(diabetesConcept)) {
      console.log('Diabetes concept duplicate removed (' + diabetesConcept + '):', sentence.substring(0, 60) + '...');
      continue;
    }
    
    // Check for substring matches in existing sentences
    let isSubstringDuplicate = false;
    for (const existingNormalized of Array.from(seenNormalized)) {
      if (existingNormalized.length > 20 && normalized.length > 20) {
        const longer = existingNormalized.length > normalized.length ? existingNormalized : normalized;
        const shorter = existingNormalized.length > normalized.length ? normalized : existingNormalized;
        if (longer.includes(shorter) && shorter.length > longer.length * 0.6) {
          console.log('Substring duplicate removed:', sentence.substring(0, 60) + '...');
          isSubstringDuplicate = true;
          break;
        }
      }
    }
    
    if (!isSubstringDuplicate) {
      seenNormalized.add(normalized);
      if (conceptString.length > 8) seenConcepts.add(conceptString);
      // Track diabetes concepts
      if (diabetesConcept) seenConcepts.add(diabetesConcept);
      uniqueSentences.push(sentence);
    }
  }
  
  bestReduction = uniqueSentences.join(' ');
  
  // STEP 4: Remove repeated phrases within the content
  bestReduction = removeRepeatedPhrases(bestReduction);
  
  // STEP 5: Final cleanup - remove any obvious repetitions that might remain
  bestReduction = removeConsecutiveRepeats(bestReduction);
  
  // Ensure proper ending
  if (bestReduction && !bestReduction.match(/[.!?]$/)) {
    bestReduction += '.';
  }
  
  const reductionPercent = Math.round((1 - bestReduction.length / content.length) * 100);
  console.log('Final length:', bestReduction.length, '| Reduction:', reductionPercent + '%');
  
  // FINAL STEP: Brute force removal of common duplication patterns
  bestReduction = bruteForceDeduplication(bestReduction);
  
  // Final ultra-aggressive check
  bestReduction = ultimateDeduplicationCheck(bestReduction);
  
  return bestReduction;
}

// Remove unwanted disclaimer text
function removeUnwantedDisclaimers(content: string): string {
  // Remove the specific NICE/NHS/CQC disclaimer that's being auto-generated
  const disclaimerPatterns = [
    /While specific authoritative sources from NICE, NHS, or CQC are not available in the current context,?\s*/gi,
    /While specific authoritative sources from NICE[^.]*?\.\s*/gi,
    /As there is no specific context provided[^.]*?\.\s*/gi,
    /It appears that there is no specific[^.]*?\.\s*/gi
  ];
  
  let result = content;
  for (const pattern of disclaimerPatterns) {
    const beforeLength = result.length;
    result = result.replace(pattern, '');
    if (result.length < beforeLength) {
      console.log('Removed unwanted disclaimer, reduced by', beforeLength - result.length, 'characters');
    }
  }
  
  return result.trim();
}

// Detect diabetes-specific concepts to prevent semantic repetition
function detectDiabetesConcept(sentence: string): string | null {
  const lowerSentence = sentence.toLowerCase();
  
  // Define concept patterns for common diabetes topics
  const concepts = [
    {
      key: 'diabetes_definition',
      patterns: [
        /diabetes.*chronic.*condition/,
        /chronic.*health.*condition.*diabetes/,
        /diabetes.*affects.*body.*food.*energy/,
        /condition.*affects.*glucose/,
        /diabetes.*blood.*sugar/,
        /chronic.*disease.*blood.*glucose/
      ]
    },
    {
      key: 'insulin_function',
      patterns: [
        /insulin.*hormone.*pancreas/,
        /hormone.*insulin.*produced/,
        /insulin.*helps.*glucose.*cells/,
        /pancreas.*produces.*insulin/,
        /insulin.*glucose.*energy/,
        /hormone.*helps.*glucose/
      ]
    },
    {
      key: 'diabetes_types',
      patterns: [
        /type.*diabetes.*autoimmune/,
        /type.*diabetes.*common.*form/,
        /main.*types.*diabetes/,
        /two.*types.*diabetes/,
        /type.*insulin.*dependent/,
        /type.*lifestyle.*factors/
      ]
    },
    {
      key: 'diabetes_symptoms',
      patterns: [
        /symptoms.*increased.*thirst/,
        /frequent.*urination.*fatigue/,
        /blurred.*vision.*symptoms/,
        /extreme.*fatigue.*diabetes/,
        /symptoms.*include.*thirst/,
        /increased.*thirst.*frequent/
      ]
    },
    {
      key: 'diabetes_management',
      patterns: [
        /managing.*diabetes.*monitoring/,
        /blood.*glucose.*monitoring/,
        /healthy.*diet.*exercise/,
        /lifestyle.*changes.*medication/,
        /diabetes.*care.*involves/,
        /treatment.*blood.*glucose/
      ]
    },
    {
      key: 'hyperglycemia',
      patterns: [
        /elevated.*glucose.*blood/,
        /hyperglycemia.*high.*blood/,
        /blood.*glucose.*levels.*high/,
        /glucose.*blood.*elevated/,
        /high.*blood.*sugar.*levels/
      ]
    }
  ];
  
  // Check each concept
  for (const concept of concepts) {
    for (const pattern of concept.patterns) {
      if (pattern.test(lowerSentence)) {
        return concept.key;
      }
    }
  }
  
  return null;
}

// Format headings to be on new lines and bold
function formatHeadings(content: string): string {
  // Pattern to match numbered headings like "1.Initial Treatment:" or "2.Recheck Blood Sugar:"
  const headingPattern = /(\d+)\.([A-Z][^:]+):/g;
  
  // Replace with proper formatting: new line + bold heading
  const result = content.replace(headingPattern, '\n\n**$1. $2:**\n');
  
  // Clean up any double new lines at the start
  return result.replace(/^\n+/, '').trim();
}

// Brute force deduplication as final failsafe
function bruteForceDeduplication(content: string): string {
  if (!content || content.length < 200) return content;
  
  console.log('Running brute force deduplication as final check...');
  
  // Split content into paragraphs and sentences
  const paragraphs = content.split(/\n\s*\n/);
  const processedParagraphs: string[] = [];
  
  for (const paragraph of paragraphs) {
    if (paragraph.trim().length < 50) {
      processedParagraphs.push(paragraph);
      continue;
    }
    
    // Check for repeated sentences within paragraph
    const sentences = paragraph.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 10);
    const uniqueSentences: string[] = [];
    const seenSentences = new Set<string>();
    
    for (const sentence of sentences) {
      const normalized = sentence.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
      
      if (normalized.length > 20 && !seenSentences.has(normalized)) {
        seenSentences.add(normalized);
        uniqueSentences.push(sentence.trim());
      } else if (normalized.length <= 20) {
        uniqueSentences.push(sentence.trim());
      } else {
        console.log('Brute force removed duplicate sentence:', sentence.substring(0, 60) + '...');
      }
    }
    
    processedParagraphs.push(uniqueSentences.join(' '));
  }
  
  let result = processedParagraphs.join('\n\n').trim();
  
  // Enhanced pattern matching for all types of duplications
  const commonDuplicatePatterns = [
    // Exact duplications of various sizes
    /(.{200,})\s*\1+/gi, // Large chunk duplicates
    /(.{100,})\s*\1+/gi, // Medium chunk duplicates  
    /(.{50,})\s*\1+/gi,  // Small chunk duplicates
    
    // Sentence-level duplicates
    /(.{30,}?[.!?])\s*\1+/gi,
    
    // Specific repetitive disclaimer patterns
    /(I'm sorry, but there is no specific[^.]+\.)\s*\1+/gi,
    /(While specific authoritative sources[^.]+\.)\s*\1+/gi,
    /(However, I can offer[^.]+\.)\s*\1+/gi,
    /(As a care worker[^.]+\.)\s*\1+/gi,
    
    // Word sequence duplicates (10+ words)
    /(\w+(?:\s+\w+){9,})\s*\1+/gi,
    
    // Paragraph-level duplicates
    /([^\n]{100,}\n?)\s*\1+/gi
  ];
  
  for (const pattern of commonDuplicatePatterns) {
    const beforeLength = result.length;
    result = result.replace(pattern, '$1');
    if (result.length < beforeLength) {
      console.log('Brute force pattern removal applied, reduced by', beforeLength - result.length, 'characters');
    }
  }
  
  return result;
}

// Helper function to find longest common substring
function findLongestCommonSubstring(str1: string, str2: string): string {
  const len1 = str1.length;
  const len2 = str2.length;
  
  if (len1 === 0 || len2 === 0) return '';
  
  let maxLength = 0;
  let result = '';
  
  for (let i = 0; i < len1; i++) {
    for (let j = 0; j < len2; j++) {
      let length = 0;
      let temp = '';
      
      while (
        i + length < len1 &&
        j + length < len2 &&
        str1[i + length].toLowerCase() === str2[j + length].toLowerCase()
      ) {
        temp += str1[i + length];
        length++;
      }
      
      if (length > maxLength) {
        maxLength = length;
        result = temp;
      }
    }
  }
  
  return result;
}

// Helper function to remove repeated phrases within text
function removeRepeatedPhrases(text: string): string {
  // Find and remove repeated phrases (5+ words that appear multiple times)
  const words = text.split(/\s+/);
  const phrases = new Map<string, number>();
  
  // Collect all 5-word phrases
  for (let i = 0; i <= words.length - 5; i++) {
    const phrase = words.slice(i, i + 5).join(' ').toLowerCase();
    phrases.set(phrase, (phrases.get(phrase) || 0) + 1);
  }
  
  // Remove phrases that appear more than once - use forEach to avoid iteration issues
  phrases.forEach((count, phrase) => {
    if (count > 1 && phrase.length > 20) {
      const regex = new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      const matches = text.match(regex);
      if (matches && matches.length > 1) {
        // Keep only the first occurrence
        let found = false;
        text = text.replace(regex, (match) => {
          if (!found) {
            found = true;
            return match;
          }
          return '';
        });
        console.log('Removed repeated phrase:', phrase.substring(0, 40) + '...');
      }
    }
  });
  
  // Clean up extra whitespace
  return text.replace(/\s+/g, ' ').trim();
}

// Remove consecutive repeating patterns
function removeConsecutiveRepeats(text: string): string {
  // Remove patterns where the same phrase appears consecutively
  const words = text.split(/\s+/);
  const cleanedWords: string[] = [];
  
  for (let i = 0; i < words.length; i++) {
    // Look for repeating patterns of 2-10 words
    let foundRepeat = false;
    
    for (let patternLength = 2; patternLength <= Math.min(10, Math.floor((words.length - i) / 2)); patternLength++) {
      if (i + patternLength * 2 <= words.length) {
        const pattern1 = words.slice(i, i + patternLength);
        const pattern2 = words.slice(i + patternLength, i + patternLength * 2);
        
        // Check if patterns match
        if (pattern1.length === pattern2.length && 
            pattern1.every((word, idx) => word.toLowerCase() === pattern2[idx].toLowerCase())) {
          console.log('Consecutive repeat pattern removed:', pattern1.join(' '));
          cleanedWords.push(...pattern1);
          i += patternLength * 2 - 1; // Skip both patterns, -1 because loop will increment
          foundRepeat = true;
          break;
        }
      }
    }
    
    if (!foundRepeat) {
      cleanedWords.push(words[i]);
    }
  }
  
  return cleanedWords.join(' ');
}

// Helper function to calculate text similarity
function calculateTextSimilarity(text1: string, text2: string): number {
  if (!text1 || !text2) return 0;
  
  const words1 = text1.split(' ').filter(w => w.length > 2);
  const words2 = text2.split(' ').filter(w => w.length > 2);
  
  if (words1.length === 0 || words2.length === 0) return 0;
  
  // Method 1: Check if text2 starts with a significant portion of text1
  const shorterLength = Math.min(words1.length, words2.length);
  const checkLength = Math.min(shorterLength, 50); // Check first 50 words
  
  let sequentialMatches = 0;
  for (let i = 0; i < checkLength; i++) {
    if (i < words1.length && i < words2.length && words1[i] === words2[i]) {
      sequentialMatches++;
    } else {
      break; // Stop at first mismatch
    }
  }
  
  const sequentialSimilarity = sequentialMatches / checkLength;
  
  // Method 2: Overall word overlap
  const set1 = new Set(words1);
  const set2 = new Set(words2);
  const set1Array = Array.from(set1);
  const set2Array = Array.from(set2);
  const intersection = set1Array.filter(x => set2.has(x));
  const union = Array.from(new Set([...set1Array, ...set2Array]));
  const overlapSimilarity = intersection.length / union.length;
  
  // Combine both methods - prioritize sequential matching
  return Math.max(sequentialSimilarity, overlapSimilarity * 0.7);
}

// Configure multer for document uploads
const documentStorage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = './uploads/documents';
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error as Error, uploadDir);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: documentStorage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow PDFs, DOCX, HTML, TXT, and JSON files
    const allowedTypes = ['.pdf', '.docx', '.html', '.htm', '.txt', '.json'];
    const ext = path.extname(file.originalname).toLowerCase();
    
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF, DOCX, HTML, TXT, and JSON files are allowed!'));
    }
  }
});

export function registerRAGRoutes(app: Express) {
  // Initialize vector store
  app.post("/api/rag/initialize", isAuthenticated, async (req, res) => {
    try {
      if (!process.env.PINECONE_API_KEY) {
        return res.status(400).json({ 
          message: "Pinecone API key required for RAG functionality" 
        });
      }
      
      await vectorStore.initialize();
      res.json({ message: "Vector store initialized successfully" });
    } catch (error) {
      console.error("Vector store initialization error:", error);
      res.status(500).json({ message: "Failed to initialize vector store" });
    }
  });

  // Get verification data
  app.get("/api/rag/verification", isAuthenticated, async (req, res) => {
    try {
      // Get document counts
      const documents = await storage.getAllDocuments();
      const jobs = await storage.getProcessingJobs();
      
      // Count documents with chunks
      let documentsWithChunks = 0;
      let totalChunks = 0;
      
      for (const doc of documents) {
        const chunks = await storage.getDocumentChunks(doc.id);
        if (chunks.length > 0) {
          documentsWithChunks++;
          totalChunks += chunks.length;
        }
      }

      // Categorize jobs
      const completedJobs = jobs.filter(job => job.status === 'completed');
      const processingJobs = jobs.filter(job => job.status === 'processing');
      const failedJobs = jobs.filter(job => job.status === 'failed');

      // Count documents by category
      const documentsByCategory: Record<string, number> = {};
      documents.forEach(doc => {
        documentsByCategory[doc.category] = (documentsByCategory[doc.category] || 0) + 1;
      });

      res.json({
        totalDocuments: documents.length,
        documentsWithChunks,
        completedJobs,
        processingJobs,
        failedJobs,
        totalChunks,
        documentsByCategory
      });
    } catch (error) {
      console.error('Verification endpoint error:', error);
      res.status(500).json({ message: 'Failed to load verification data' });
    }
  });

  // Upload and process document
  app.post("/api/rag/documents/upload", isAuthenticated, upload.single('document'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'No document file uploaded' });
      }

      const { documentType = 'guideline', category = 'diabetes' } = req.body;
      const filePath = req.file.path;

      // Start document processing
      const documentId = await documentProcessor.processDocument(
        filePath,
        documentType,
        category
      );

      res.json({
        message: 'Document uploaded and processing started',
        documentId,
        filename: req.file.filename,
        originalName: req.file.originalname,
        size: req.file.size
      });
    } catch (error) {
      console.error('Document upload error:', error);
      res.status(500).json({ message: 'Failed to upload document' });
    }
  });

  // Get all documents
  app.get("/api/rag/documents", isAuthenticated, async (req, res) => {
    try {
      const documents = await storage.getDocuments();
      res.json(documents);
    } catch (error) {
      console.error("Error fetching documents:", error);
      res.status(500).json({ message: "Failed to fetch documents" });
    }
  });

  // Get document by ID
  app.get("/api/rag/documents/:id", isAuthenticated, async (req, res) => {
    try {
      const document = await storage.getDocument(req.params.id);
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }
      res.json(document);
    } catch (error) {
      console.error("Error fetching document:", error);
      res.status(500).json({ message: "Failed to fetch document" });
    }
  });

  // Delete document
  app.delete("/api/rag/documents/:id", isAuthenticated, async (req, res) => {
    try {
      const document = await storage.getDocument(req.params.id);
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }

      // Delete document chunks from vector store
      const chunks = await storage.getDocumentChunks(req.params.id);
      for (const chunk of chunks) {
        if (chunk.vectorId) {
          await vectorStore.deleteVector(chunk.vectorId);
        }
        await storage.deleteDocumentChunk(chunk.id);
      }

      // Delete document
      await storage.deleteDocument(req.params.id);

      res.json({ message: "Document deleted successfully" });
    } catch (error) {
      console.error("Error deleting document:", error);
      res.status(500).json({ message: "Failed to delete document" });
    }
  });

  // Enhanced RAG chat endpoint with multi-agent processing
  app.post("/api/rag/chat", isAuthenticated, async (req, res) => {
    try {
      const { message, courseId, conversationHistory } = req.body;
      const user = req.user as any;

      if (!message) {
        return res.status(400).json({ message: "Message is required" });
      }

      // Create user object for the enhanced orchestrator
      const userObj = {
        id: user.claims.sub,
        email: user.claims.email || user.claims.global_name || null,
        firstName: user.claims.given_name || null,
        lastName: user.claims.family_name || null,
        profileImageUrl: user.claims.picture || null,
        role: 'care_worker' as const,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Process query with Enhanced RAG Orchestrator
      const response = await enhancedRagOrchestrator.processQuery(
        message, 
        userObj, 
        courseId, 
        conversationHistory
      );

      // Final deduplication before sending to user (safety net)
      if (response.content) {
        response.content = finalDeduplication(response.content);
      }

      // Store the enhanced chat message
      const chatMessage = await storage.createRagChatMessage({
        userId: user.claims.sub,
        courseId: courseId || null,
        message,
        response: response.content || '',
        sources: response.sources || [],
        confidence: response.confidence || 0,
        agentTrace: { 
          agents: response.agentsUsed || [],
          responseTime: response.responseTime || 0,
          cacheHit: response.cacheHit || false,
          usedRAG: response.usedRAG || false
        }
      });

      res.json({
        ...response,
        id: chatMessage.id,
        timestamp: chatMessage.timestamp
      });
    } catch (error) {
      console.error("Enhanced RAG chat error:", error);
      res.status(500).json({ 
        message: "I'm experiencing technical difficulties. Please consult your local healthcare guidelines for immediate assistance.",
        confidence: 0,
        sources: [],
        usedRAG: false,
        agentsUsed: ['error_handler']
      });
    }
  });

  // Get RAG chat history
  app.get("/api/rag/chat/:courseId?", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const { courseId } = req.params;
      
      const messages = await storage.getRagChatMessages(user.claims.sub, courseId);
      res.json(messages);
    } catch (error) {
      console.error("Error fetching chat history:", error);
      res.status(500).json({ message: "Failed to fetch chat history" });
    }
  });

  // Get processing jobs
  app.get("/api/rag/jobs", isAuthenticated, async (req, res) => {
    try {
      const jobs = await storage.getProcessingJobs();
      res.json(jobs);
    } catch (error) {
      console.error("Error fetching processing jobs:", error);
      res.status(500).json({ message: "Failed to fetch processing jobs" });
    }
  });

  // Get entities
  app.get("/api/rag/entities", isAuthenticated, async (req, res) => {
    try {
      const entities = await storage.getEntities();
      res.json(entities);
    } catch (error) {
      console.error("Error fetching entities:", error);
      res.status(500).json({ message: "Failed to fetch entities" });
    }
  });

  // Get entity relationships
  app.get("/api/rag/relationships/:entityId?", isAuthenticated, async (req, res) => {
    try {
      const { entityId } = req.params;
      const relationships = await storage.getEntityRelationships(entityId);
      res.json(relationships);
    } catch (error) {
      console.error("Error fetching relationships:", error);
      res.status(500).json({ message: "Failed to fetch relationships" });
    }
  });

  // Feedback collection endpoint
  app.post("/api/rag/feedback", isAuthenticated, async (req, res) => {
    try {
      const { messageId, rating, feedbackType, comments, responseTime } = req.body;
      const user = req.user as any;

      if (!messageId || rating === undefined) {
        return res.status(400).json({ message: "Message ID and rating are required" });
      }

      await enhancedRagOrchestrator.collectFeedback(
        user.claims.sub,
        messageId,
        rating,
        feedbackType,
        comments,
        responseTime
      );

      res.json({ message: "Feedback collected successfully" });
    } catch (error) {
      console.error("Error collecting feedback:", error);
      res.status(500).json({ message: "Failed to collect feedback" });
    }
  });

  // Document verification endpoint
  app.get("/api/rag/documents/verify", isAuthenticated, async (req, res) => {
    try {
      const documents = await storage.getDocuments();
      const jobs = await storage.getProcessingJobs();
      
      const documentStats = {
        totalDocuments: documents.length,
        documentsWithChunks: 0,
        totalChunks: 0,
        recentDocuments: documents.slice(-10), // Last 10 documents
        processingJobs: jobs.filter(job => job.status === 'processing'),
        completedJobs: jobs.filter(job => job.status === 'completed'),
        failedJobs: jobs.filter(job => job.status === 'failed'),
        documentsByCategory: {} as Record<string, number>,
        documentsByType: {} as Record<string, number>,
        vectorStoreStatus: 'unknown' as string,
        chunkDistribution: [] as Array<{documentId: string, title: string, chunkCount: number, hasVectors: boolean}>
      };



  // Recent uploads status endpoint
  app.get("/api/rag/status/recent", isAuthenticated, async (req, res) => {
    try {
      const documents = await storage.getDocuments();
      const jobs = await storage.getProcessingJobs();
      
      // Get documents from the last hour
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const recentDocs = documents.filter(doc => doc.createdAt && new Date(doc.createdAt) > oneHourAgo);
      
      // Get recent jobs
      const recentJobs = jobs.filter(job => job.createdAt && new Date(job.createdAt) > oneHourAgo);
      
      const status = {
        recentDocuments: recentDocs.length,
        recentJobs: recentJobs.length,
        completedRecently: recentJobs.filter(job => job.status === 'completed').length,
        failedRecently: recentJobs.filter(job => job.status === 'failed').length,
        processingNow: recentJobs.filter(job => job.status === 'processing').length,
        details: await Promise.all(recentDocs.map(async (doc) => {
          const chunks = await storage.getDocumentChunks(doc.id);
          const relatedJob = recentJobs.find(job => {
            const metadata = job.metadata as any;
            return metadata?.filePath?.includes(doc.title.split('.')[0]);
          });
          return {
            id: doc.id,
            title: doc.title,
            category: doc.category,
            documentType: doc.documentType,
            chunkCount: chunks.length,
            hasVectors: chunks.some(chunk => chunk.vectorId),
            jobStatus: relatedJob?.status || 'unknown',
            createdAt: doc.createdAt
          };
        }))
      };
      
      res.json(status);
    } catch (error) {
      console.error("Error getting recent status:", error);
      res.status(500).json({ message: "Failed to get recent status" });
    }
  });

      // Get chunk counts and categorize documents
      for (const doc of documents) {
        const chunks = await storage.getDocumentChunks(doc.id);
        if (chunks.length > 0) {
          documentStats.documentsWithChunks++;
        }
        documentStats.totalChunks += chunks.length;
        
        // Check if chunks have vector IDs
        const hasVectors = chunks.some(chunk => chunk.vectorId);
        
        documentStats.chunkDistribution.push({
          documentId: doc.id,
          title: doc.title,
          chunkCount: chunks.length,
          hasVectors
        });
        
        // Categorize by document category and type
        documentStats.documentsByCategory[doc.category] = (documentStats.documentsByCategory[doc.category] || 0) + 1;
        documentStats.documentsByType[doc.documentType] = (documentStats.documentsByType[doc.documentType] || 0) + 1;
      }

      // Test vector store connection
      try {
        if (process.env.PINECONE_API_KEY && process.env.OPENAI_API_KEY) {
          // Try a simple query to test the vector store
          const testEmbedding = await vectorStore.createEmbedding("test query");
          const testResults = await vectorStore.queryVectors(testEmbedding, 1);
          documentStats.vectorStoreStatus = 'connected';
        } else {
          documentStats.vectorStoreStatus = 'missing_api_keys';
        }
      } catch (error) {
        documentStats.vectorStoreStatus = 'connection_error';
      }

      res.json(documentStats);
    } catch (error) {
      console.error("Error verifying documents:", error);
      res.status(500).json({ message: "Failed to verify documents" });
    }
  });

  // Analytics endpoint for monitoring (admin only)
  app.get("/api/rag/analytics", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      
      // Simple role check - in production would need proper admin role verification
      if (user.claims.email && user.claims.email.includes('admin')) {
        const analytics = await storage.getRagAnalytics();
        res.json(analytics);
      } else {
        res.status(403).json({ message: "Access denied" });
      }
    } catch (error) {
      console.error("Error fetching analytics:", error);
      res.status(500).json({ message: "Failed to fetch analytics" });
    }
  });
}

// Ultimate final check to catch any remaining duplications
function ultimateDeduplicationCheck(content: string): string {
  if (!content || content.length < 100) return content;
  
  console.log('ULTIMATE DEDUPLICATION CHECK - Input length:', content.length);
  
  // Step 1: Check for exact half-duplication one more time
  const sentences = content.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 10);
  
  if (sentences.length > 6) {
    const halfPoint = Math.floor(sentences.length / 2);
    
    for (let offset = -3; offset <= 3; offset++) {
      const splitPoint = halfPoint + offset;
      if (splitPoint < 2 || splitPoint > sentences.length - 2) continue;
      
      const firstHalf = sentences.slice(0, splitPoint).join(' ').trim();
      const secondHalf = sentences.slice(splitPoint).join(' ').trim();
      
      // Normalize for comparison
      const norm1 = firstHalf.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ');
      const norm2 = secondHalf.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ');
      
      if (norm1 === norm2 && norm1.length > 100) {
        console.log('ULTIMATE CHECK: Exact sentence-level duplication found at offset', offset);
        return firstHalf;
      }
      
      // Check for high similarity
      if (norm1.length > 100 && norm2.length > 100) {
        const similarity = calculateTextSimilarity(norm1, norm2);
        if (similarity > 0.9) {
          console.log('ULTIMATE CHECK: High similarity duplication found at offset', offset, 'similarity:', similarity);
          return firstHalf;
        }
      }
    }
  }
  
  // Step 2: Final regex cleanup for any missed patterns
  let result = content;
  const finalPatterns = [
    /(.{100,}?[.!?])\s*\1+/gi,    // Any sentence duplicated
    /(.{200,})\s*\1+/gi,          // Large chunk duplicated
    /(.*?)(\1){2,}/gi             // Any pattern repeated 3+ times
  ];
  
  for (const pattern of finalPatterns) {
    const beforeLength = result.length;
    result = result.replace(pattern, '$1');
    if (result.length < beforeLength) {
      console.log('ULTIMATE CHECK: Final pattern cleanup applied, reduced by:', beforeLength - result.length, 'characters');
    }
  }
  
  console.log('ULTIMATE DEDUPLICATION CHECK - Output length:', result.length, 'final reduction:', Math.round((1 - result.length / content.length) * 100) + '%');
  
  return result;
}