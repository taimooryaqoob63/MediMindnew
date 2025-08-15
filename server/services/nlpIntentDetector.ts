/**
 * NLP-based Intent Detection for Enhanced Emergency Handling
 * Goes beyond keyword matching to understand context and intent
 */

import OpenAI from 'openai';
import { RAG_CONFIG } from '../config/ragConfiguration';

interface IntentAnalysis {
  isEmergency: boolean;
  confidence: number;
  intent: 'emergency' | 'clinical' | 'educational' | 'administrative';
  urgencyLevel: 'low' | 'medium' | 'high' | 'critical';
  entities: string[];
  context: string;
  suggestedActions: string[];
}

interface EmergencyContext {
  symptoms: string[];
  timeframe: string;
  severity: string;
  location: string;
}

export class NLPIntentDetector {
  private openai?: OpenAI;
  private emergencyPatterns: RegExp[];
  private clinicalTerms: Set<string>;
  private urgencyIndicators: Set<string>;

  constructor() {
    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
    }

    // Enhanced pattern recognition
    this.emergencyPatterns = [
      /\b(unconscious|unresponsive|not responding|collapsed)\b/gi,
      /\b(severe|critical|extreme|acute|sudden)\s+(pain|symptoms|reaction|drop|rise)\b/gi,
      /\b(blood sugar|glucose)\s+(very|extremely|dangerously)?\s*(low|high|dropping|rising)\b/gi,
      /\b(can't breathe|difficulty breathing|shortness of breath|gasping)\b/gi,
      /\b(chest pain|heart attack|stroke|seizure|convulsion)\b/gi,
      /\b(diabetic coma|ketoacidosis|insulin shock|hypoglycemic)\b/gi,
      /\b(emergency|urgent|immediate|right now|asap|quickly)\b/gi,
      /\b(call (999|ambulance|doctor)|need help|get help)\b/gi,
    ];

    this.clinicalTerms = new Set([
      'hypoglycemia', 'hyperglycemia', 'ketoacidosis', 'insulin', 'glucagon',
      'blood glucose', 'hba1c', 'medication', 'dose', 'injection', 'monitoring',
      'symptoms', 'complications', 'neuropathy', 'retinopathy', 'nephropathy'
    ]);

    this.urgencyIndicators = new Set([
      'now', 'immediately', 'urgent', 'emergency', 'critical', 'severe',
      'acute', 'sudden', 'rapid', 'extreme', 'dangerous', 'life-threatening'
    ]);
  }

  async analyzeIntent(query: string, context?: string): Promise<IntentAnalysis> {
    try {
      // Quick pattern-based pre-screening
      const patternAnalysis = this.patternBasedAnalysis(query);
      
      // If high confidence emergency from patterns, skip LLM for speed
      if (patternAnalysis.isEmergency && patternAnalysis.confidence > 0.9) {
        return patternAnalysis;
      }

      // Use LLM for nuanced intent analysis
      const llmAnalysis = await this.llmBasedAnalysis(query, context);
      
      // Combine pattern and LLM results for final decision
      return this.combineAnalysis(patternAnalysis, llmAnalysis);
      
    } catch (error) {
      console.error('Intent analysis error:', error);
      // Fallback to pattern-based analysis
      return this.patternBasedAnalysis(query);
    }
  }

  private patternBasedAnalysis(query: string): IntentAnalysis {
    const queryLower = query.toLowerCase();
    let emergencyScore = 0;
    let matchedPatterns: string[] = [];
    let entities: string[] = [];

    // Check emergency patterns
    this.emergencyPatterns.forEach(pattern => {
      const matches = query.match(pattern);
      if (matches) {
        emergencyScore += 0.2;
        matchedPatterns.push(...matches);
      }
    });

    // Check for clinical terms
    for (const term of this.clinicalTerms) {
      if (queryLower.includes(term)) {
        entities.push(term);
        emergencyScore += 0.05;
      }
    }

    // Check urgency indicators
    for (const indicator of this.urgencyIndicators) {
      if (queryLower.includes(indicator)) {
        emergencyScore += 0.15;
      }
    }

    // Determine urgency level
    let urgencyLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
    if (emergencyScore > 0.8) urgencyLevel = 'critical';
    else if (emergencyScore > 0.5) urgencyLevel = 'high';
    else if (emergencyScore > 0.3) urgencyLevel = 'medium';

    return {
      isEmergency: emergencyScore > 0.4,
      confidence: Math.min(emergencyScore, 1.0),
      intent: emergencyScore > 0.4 ? 'emergency' : entities.length > 0 ? 'clinical' : 'educational',
      urgencyLevel,
      entities,
      context: matchedPatterns.join(', '),
      suggestedActions: this.getSuggestedActions(urgencyLevel, entities),
    };
  }

  private async llmBasedAnalysis(query: string, context?: string): Promise<IntentAnalysis> {
    if (!this.openai) {
      throw new Error('OpenAI not configured for intent analysis');
    }

    const systemPrompt = `You are an expert medical triage AI specializing in diabetes care emergencies. Analyze queries for emergency intent, clinical complexity, and urgency level.

Response should be JSON with:
{
  "isEmergency": boolean,
  "confidence": 0.0-1.0,
  "intent": "emergency|clinical|educational|administrative",
  "urgencyLevel": "low|medium|high|critical",
  "entities": ["symptom1", "condition2"],
  "context": "brief explanation",
  "suggestedActions": ["action1", "action2"]
}

Emergency indicators:
- Unconsciousness, unresponsiveness
- Severe hypoglycemia (blood sugar < 4mmol/L with symptoms)
- Suspected DKA (ketoacidosis)
- Severe hyperglycemia with dehydration
- Chest pain, difficulty breathing
- Signs of stroke or heart attack
- Seizures or convulsions

Consider context, tone, and medical terminology sophistication.`;

    const userPrompt = context 
      ? `Context: ${context}\n\nQuery to analyze: "${query}"`
      : `Query to analyze: "${query}"`;

    const response = await this.openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      response_format: { type: "json_object" },
      temperature: 0.1, // Low temperature for consistent analysis
      max_tokens: 400
    });

    const result = JSON.parse(response.choices[0].message.content || '{}');
    
    return {
      isEmergency: result.isEmergency || false,
      confidence: Math.min(Math.max(result.confidence || 0, 0), 1),
      intent: result.intent || 'educational',
      urgencyLevel: result.urgencyLevel || 'low',
      entities: result.entities || [],
      context: result.context || '',
      suggestedActions: result.suggestedActions || [],
    };
  }

  private combineAnalysis(patternAnalysis: IntentAnalysis, llmAnalysis: IntentAnalysis): IntentAnalysis {
    // Weight pattern analysis higher for clear emergency keywords
    // Weight LLM analysis higher for nuanced context
    const patternWeight = patternAnalysis.confidence > 0.7 ? 0.7 : 0.3;
    const llmWeight = 1 - patternWeight;

    const combinedConfidence = (patternAnalysis.confidence * patternWeight) + 
                              (llmAnalysis.confidence * llmWeight);

    const isEmergency = combinedConfidence > RAG_CONFIG.safety.emergencyDetection.confidenceThreshold ||
                       (patternAnalysis.isEmergency && patternAnalysis.confidence > 0.8);

    return {
      isEmergency,
      confidence: combinedConfidence,
      intent: isEmergency ? 'emergency' : llmAnalysis.intent,
      urgencyLevel: this.getHigherUrgencyLevel(patternAnalysis.urgencyLevel, llmAnalysis.urgencyLevel),
      entities: [...new Set([...patternAnalysis.entities, ...llmAnalysis.entities])],
      context: llmAnalysis.context || patternAnalysis.context,
      suggestedActions: [...new Set([...patternAnalysis.suggestedActions, ...llmAnalysis.suggestedActions])],
    };
  }

  private getSuggestedActions(urgencyLevel: string, entities: string[]): string[] {
    const actions: string[] = [];

    switch (urgencyLevel) {
      case 'critical':
        actions.push('Call 999 immediately', 'Follow emergency protocols', 'Contact on-call clinician');
        break;
      case 'high':
        actions.push('Monitor closely', 'Consider medical review', 'Document observations');
        break;
      case 'medium':
        actions.push('Check care plan', 'Monitor blood glucose', 'Consider medication review');
        break;
      case 'low':
        actions.push('Continue routine care', 'Educational resources', 'Regular monitoring');
        break;
    }

    // Add entity-specific actions
    if (entities.includes('hypoglycemia')) {
      actions.push('Administer glucose if conscious');
    }
    if (entities.includes('hyperglycemia')) {
      actions.push('Check ketones', 'Ensure hydration');
    }

    return actions.slice(0, 4); // Limit to 4 actions
  }

  private getHigherUrgencyLevel(level1: 'low' | 'medium' | 'high' | 'critical', level2: 'low' | 'medium' | 'high' | 'critical'): 'low' | 'medium' | 'high' | 'critical' {
    const urgencyOrder = { 'low': 0, 'medium': 1, 'high': 2, 'critical': 3 };
    const maxLevel = urgencyOrder[level1] > urgencyOrder[level2] ? level1 : level2;
    return maxLevel;
  }

  // Method to extract emergency context details
  extractEmergencyContext(query: string): EmergencyContext {
    const symptoms: string[] = [];
    const queryLower = query.toLowerCase();

    // Extract symptoms
    const symptomPatterns = [
      /\b(unconscious|dizzy|confused|sweating|shaking|nauseous|vomiting)\b/g,
      /\b(chest pain|shortness of breath|rapid breathing|palpitations)\b/g,
      /\b(blurred vision|weakness|fatigue|dehydrated)\b/g,
    ];

    for (const pattern of symptomPatterns) {
      const matches = query.match(pattern);
      if (matches) symptoms.push(...matches);
    }

    // Extract timeframe
    let timeframe = 'unknown';
    if (queryLower.includes('sudden') || queryLower.includes('just now')) timeframe = 'immediate';
    else if (queryLower.includes('few minutes') || queryLower.includes('recently')) timeframe = 'minutes';
    else if (queryLower.includes('hour') || queryLower.includes('today')) timeframe = 'hours';

    // Extract severity indicators
    let severity = 'mild';
    if (queryLower.includes('severe') || queryLower.includes('extreme')) severity = 'severe';
    else if (queryLower.includes('moderate') || queryLower.includes('bad')) severity = 'moderate';

    return {
      symptoms: [...new Set(symptoms)],
      timeframe,
      severity,
      location: 'care facility', // Default for this system
    };
  }
}

export const nlpIntentDetector = new NLPIntentDetector();