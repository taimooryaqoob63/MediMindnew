/**
 * Enhanced Multi-Agent System with Debate Rounds
 * Implements role-bounded agents with structured debate and guardrails
 */

import OpenAI from 'openai';

interface AgentContext {
  structuredFacts: KGFact[];
  evidencePassages: EvidencePassage[];
  query: string;
  queryType: 'clinical' | 'educational' | 'faq' | 'emergency';
}

interface KGFact {
  id: string;
  triple: string;
  confidence: number;
  provenance: string;
}

interface EvidencePassage {
  id: string;
  content: string;
  source: string;
  score: number;
  metadata: Record<string, any>;
}

interface AgentResponse {
  agent: string;
  content: string;
  citations: string[];
  confidence: number;
  flags: string[];
  suggestions: string[];
}

interface DebateRound {
  round: 'A' | 'B' | 'C';
  description: string;
  responses: AgentResponse[];
  consensus: boolean;
  conflictingClaims: string[];
}

interface EnhancedAgentResult {
  finalContent: string;
  debateRounds: DebateRound[];
  consensusReached: boolean;
  confidence: number;
  citations: string[];
  flags: string[];
  processingTime: number;
}

export class EnhancedMultiAgentSystem {
  private openai?: OpenAI;
  private readonly DEBATE_TIMEOUT_MS = 45000; // 45 seconds per round
  
  constructor() {
    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
    }
  }

  /**
   * Main multi-agent processing with structured debate
   */
  async processWithDebate(context: AgentContext): Promise<EnhancedAgentResult> {
    const startTime = Date.now();
    
    console.log(`🤖 Starting enhanced multi-agent debate for ${context.queryType} query`);
    console.log(`📊 Context: ${context.structuredFacts.length} KG facts, ${context.evidencePassages.length} evidence passages`);

    if (!this.openai) {
      throw new Error('OpenAI not configured for multi-agent system');
    }

    try {
      // Build context blocks
      const contextBlocks = this.buildContextBlocks(context);

      // Execute debate rounds
      const debateRounds: DebateRound[] = [];

      // Round A: Medical Specialist drafts initial answer
      const roundA = await this.executeRoundA(context, contextBlocks);
      debateRounds.push(roundA);

      // Round B: Compliance Officer reviews and flags issues
      const roundB = await this.executeRoundB(context, contextBlocks, roundA);
      debateRounds.push(roundB);

      // Round C: Learning Facilitator simplifies language
      const roundC = await this.executeRoundC(context, contextBlocks, roundA, roundB);
      debateRounds.push(roundC);

      // Synthesize final response
      const finalResult = await this.synthesizeFinalResponse(debateRounds, context);

      const processingTime = Date.now() - startTime;
      
      console.log(`✅ Multi-agent debate completed in ${processingTime}ms`);
      console.log(`🎯 Consensus: ${finalResult.consensusReached}, Confidence: ${finalResult.confidence}%`);

      return {
        ...finalResult,
        debateRounds,
        processingTime
      };

    } catch (error) {
      console.error('Multi-agent processing error:', error);
      throw error;
    }
  }

  /**
   * Build structured context blocks for agents
   */
  private buildContextBlocks(context: AgentContext): {
    kgFacts: string;
    evidencePassages: string;
  } {
    // KG Facts block (top 10-15 triples)
    const kgFactsText = context.structuredFacts
      .slice(0, 15)
      .map((fact, i) => `[KG${i + 1}] ${fact.triple} (confidence: ${fact.confidence}%, source: ${fact.provenance})`)
      .join('\n');

    // Evidence passages block (top 8-12 chunks)
    const evidenceText = context.evidencePassages
      .slice(0, 12)
      .map((passage, i) => `[S${i + 1}] ${passage.source}\n${passage.content}\n`)
      .join('\n');

    return {
      kgFacts: kgFactsText,
      evidencePassages: evidenceText
    };
  }

  /**
   * Round A: Medical Specialist drafts answer with citations
   */
  private async executeRoundA(
    context: AgentContext,
    contextBlocks: { kgFacts: string; evidencePassages: string }
  ): Promise<DebateRound> {
    const medicalSpecialistPrompt = `You are a Medical Specialist with expertise in diabetes care. Draft a comprehensive answer to the healthcare worker's question.

QUERY: "${context.query}"
QUERY TYPE: ${context.queryType}

KNOWLEDGE GRAPH FACTS:
${contextBlocks.kgFacts}

EVIDENCE PASSAGES:
${contextBlocks.evidencePassages}

INSTRUCTIONS:
1. Provide accurate, evidence-based medical guidance
2. Use inline citations [S#] for evidence passages and [KG#] for knowledge graph facts
3. Every clinical claim must have a citation
4. Focus on practical, actionable advice
5. Consider patient safety implications
6. Be specific about dosages, contraindications, and monitoring requirements

Respond in JSON format:
{
  "content": "Your comprehensive answer with inline citations",
  "citations": ["S1", "KG2", "S3", ...],
  "confidence": 85,
  "clinicalFlags": ["flag1", "flag2", ...],
  "reasoning": "Brief explanation of clinical approach"
}`;

    try {
      const completion = await this.openai!.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: medicalSpecialistPrompt }],
        temperature: 0.1,
        max_tokens: 2000
      });

      let rawContent = completion.choices[0]?.message?.content || '{}';
      
      // Clean the response content to extract JSON
      if (rawContent.startsWith('```json')) {
        rawContent = rawContent.replace(/```json\s*/, '').replace(/\s*```$/, '');
      } else if (rawContent.startsWith('```')) {
        rawContent = rawContent.replace(/```\s*/, '').replace(/\s*```$/, '');
      }
      
      const response = JSON.parse(rawContent);
      
      const agentResponse: AgentResponse = {
        agent: 'Medical Specialist',
        content: response.content || '',
        citations: response.citations || [],
        confidence: response.confidence || 75,
        flags: response.clinicalFlags || [],
        suggestions: []
      };

      return {
        round: 'A',
        description: 'Medical Specialist drafts evidence-based answer',
        responses: [agentResponse],
        consensus: true, // Single agent round
        conflictingClaims: []
      };

    } catch (error) {
      console.error('Round A error:', error);
      throw new Error('Medical Specialist round failed');
    }
  }

  /**
   * Round B: Compliance Officer flags issues and suggests replacements
   */
  private async executeRoundB(
    context: AgentContext,
    contextBlocks: { kgFacts: string; evidencePassages: string },
    roundA: DebateRound
  ): Promise<DebateRound> {
    const medicalAnswer = roundA.responses[0]?.content || '';

    const complianceOfficerPrompt = `You are a Compliance Officer ensuring adherence to NICE/NHS/CQC guidelines. Review the Medical Specialist's answer for compliance issues.

ORIGINAL QUERY: "${context.query}"

MEDICAL SPECIALIST'S ANSWER:
${medicalAnswer}

AVAILABLE EVIDENCE:
${contextBlocks.evidencePassages}

KNOWLEDGE GRAPH FACTS:
${contextBlocks.kgFacts}

COMPLIANCE REVIEW TASKS:
1. Identify any claims not supported by NICE/NHS/CQC sources
2. Flag missing citations for clinical statements
3. Check for contraindication warnings
4. Verify dosage recommendations against guidelines
5. Ensure appropriate disclaimers for high-risk advice
6. Suggest authoritative source replacements

Respond in JSON format:
{
  "content": "Your compliance review and recommendations",
  "citations": ["S1", "KG2", ...],
  "confidence": 80,
  "complianceFlags": [
    {
      "issue": "Missing NICE citation for dosage",
      "location": "paragraph 2",
      "severity": "high",
      "suggestion": "Add reference to NICE NG28 section 3.2"
    }
  ],
  "approvedClaims": ["claim1", "claim2", ...],
  "flaggedClaims": ["claim3", "claim4", ...],
  "suggestedReplacements": [
    {
      "original": "text to replace",
      "replacement": "compliant alternative",
      "source": "NICE NG28"
    }
  ]
}`;

    try {
      const completion = await this.openai!.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: complianceOfficerPrompt }],
        temperature: 0.1,
        max_tokens: 2000
      });

      let rawContent = completion.choices[0]?.message?.content || '{}';
      
      // Clean the response content to extract JSON for Round B
      if (rawContent.startsWith('```json')) {
        rawContent = rawContent.replace(/```json\s*/, '').replace(/\s*```$/, '');
      } else if (rawContent.startsWith('```')) {
        rawContent = rawContent.replace(/```\s*/, '').replace(/\s*```$/, '');
      }
      
      const response = JSON.parse(rawContent);
      
      const agentResponse: AgentResponse = {
        agent: 'Compliance Officer',
        content: response.content || '',
        citations: response.citations || [],
        confidence: response.confidence || 75,
        flags: response.complianceFlags?.map((f: any) => f.issue) || [],
        suggestions: response.suggestedReplacements?.map((r: any) => `Replace "${r.original}" with "${r.replacement}" (${r.source})`) || []
      };

      return {
        round: 'B',
        description: 'Compliance Officer reviews for guideline adherence',
        responses: [agentResponse],
        consensus: (response.flaggedClaims?.length || 0) === 0,
        conflictingClaims: response.flaggedClaims || []
      };

    } catch (error) {
      console.error('Round B error:', error);
      return {
        round: 'B',
        description: 'Compliance Officer review failed',
        responses: [],
        consensus: false,
        conflictingClaims: ['Review process failed']
      };
    }
  }

  /**
   * Round C: Learning Facilitator simplifies language while preserving clinical accuracy
   */
  private async executeRoundC(
    context: AgentContext,
    contextBlocks: { kgFacts: string; evidencePassages: string },
    roundA: DebateRound,
    roundB: DebateRound
  ): Promise<DebateRound> {
    const medicalAnswer = roundA.responses[0]?.content || '';
    const complianceReview = roundB.responses[0];

    const learningFacilitatorPrompt = `You are a Learning Facilitator specializing in healthcare education. Simplify the medical answer for healthcare workers while maintaining clinical accuracy.

ORIGINAL QUERY: "${context.query}"

MEDICAL SPECIALIST'S ANSWER:
${medicalAnswer}

COMPLIANCE OFFICER'S FEEDBACK:
${complianceReview?.content || 'No compliance issues identified'}

COMPLIANCE FLAGS TO ADDRESS:
${complianceReview?.flags?.join(', ') || 'None'}

SUGGESTED IMPROVEMENTS:
${complianceReview?.suggestions?.join('\n') || 'None'}

LEARNING FACILITATION TASKS:
1. Simplify complex medical terminology
2. Add practical examples and scenarios
3. Structure information clearly with bullet points
4. Ensure accessibility for care home staff
5. Include step-by-step guidance where appropriate
6. DO NOT alter dosages, contraindications, or clinical facts
7. DO NOT remove or change citations
8. DO NOT add new clinical claims

RESTRICTIONS:
- Cannot modify numerical values, dosages, or clinical parameters
- Cannot remove safety warnings or contraindications
- Cannot change the meaning of medical statements
- Can only rephrase for clarity and accessibility

Respond in JSON format:
{
  "content": "Simplified, accessible version maintaining all clinical accuracy",
  "citations": ["S1", "KG2", ...],
  "confidence": 90,
  "simplificationChanges": ["change1", "change2", ...],
  "preservedClinicalFacts": ["fact1", "fact2", ...],
  "educationalEnhancements": ["enhancement1", "enhancement2", ...]
}`;

    try {
      const completion = await this.openai!.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: learningFacilitatorPrompt }],
        temperature: 0.2,
        max_tokens: 2500
      });

      let rawContent = completion.choices[0]?.message?.content || '{}';
      
      // Clean the response content to extract JSON for Round C
      if (rawContent.startsWith('```json')) {
        rawContent = rawContent.replace(/```json\s*/, '').replace(/\s*```$/, '');
      } else if (rawContent.startsWith('```')) {
        rawContent = rawContent.replace(/```\s*/, '').replace(/\s*```$/, '');
      }
      
      const response = JSON.parse(rawContent);
      
      const agentResponse: AgentResponse = {
        agent: 'Learning Facilitator',
        content: response.content || medicalAnswer, // Fallback to original
        citations: response.citations || [],
        confidence: response.confidence || 80,
        flags: [],
        suggestions: response.educationalEnhancements || []
      };

      return {
        round: 'C',
        description: 'Learning Facilitator simplifies language for accessibility',
        responses: [agentResponse],
        consensus: true, // Final round
        conflictingClaims: []
      };

    } catch (error) {
      console.error('Round C error:', error);
      // Return original medical answer if simplification fails
      return {
        round: 'C',
        description: 'Learning Facilitator simplification failed - using medical answer',
        responses: [{
          agent: 'Learning Facilitator (Fallback)',
          content: medicalAnswer,
          citations: roundA.responses[0]?.citations || [],
          confidence: 70,
          flags: ['Simplification failed'],
          suggestions: []
        }],
        consensus: true,
        conflictingClaims: []
      };
    }
  }

  /**
   * Synthesize final response from debate rounds
   */
  private async synthesizeFinalResponse(
    debateRounds: DebateRound[],
    context: AgentContext
  ): Promise<Omit<EnhancedAgentResult, 'debateRounds' | 'processingTime'>> {
    const finalRound = debateRounds[debateRounds.length - 1];
    const finalResponse = finalRound.responses[0];
    
    if (!finalResponse) {
      throw new Error('No final response generated');
    }

    // Check for consensus across rounds
    const consensusReached = debateRounds.every(round => round.consensus);
    
    // Collect all flags from all rounds
    const allFlags = debateRounds.flatMap(round => 
      round.responses.flatMap(response => response.flags)
    );

    // Collect all citations (deduplicated)
    const allCitations = Array.from(new Set(
      debateRounds.flatMap(round => 
        round.responses.flatMap(response => response.citations)
      )
    ));

    // Calculate overall confidence
    const confidenceScores = debateRounds.flatMap(round => 
      round.responses.map(response => response.confidence)
    );
    const avgConfidence = confidenceScores.reduce((sum, score) => sum + score, 0) / confidenceScores.length;

    // Apply guardrails - remove unsupported statements
    const finalContent = await this.applyGuardrails(finalResponse.content, allCitations);

    return {
      finalContent,
      consensusReached,
      confidence: Math.round(avgConfidence),
      citations: allCitations,
      flags: Array.from(new Set(allFlags)) // Remove duplicates
    };
  }

  /**
   * Apply guardrails to remove unsupported statements
   */
  private async applyGuardrails(content: string, citations: string[]): Promise<string> {
    if (!this.openai) {
      return content;
    }

    try {
      const guardrailPrompt = `Apply guardrails to this medical content. Remove or flag any statements not supported by the provided citations.

CONTENT:
${content}

AVAILABLE CITATIONS: ${citations.join(', ')}

GUARDRAIL RULES:
1. Every factual medical claim must have a citation [S#] or [KG#]
2. Remove statements that lack proper citations
3. Flag uncertain claims with "further clinical review may be needed"
4. Preserve all properly cited information
5. Maintain content readability and flow

Respond with the guarded content only:`;

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: guardrailPrompt }],
        temperature: 0.0,
        max_tokens: 2000
      });

      return completion.choices[0]?.message?.content || content;

    } catch (error) {
      console.error('Guardrails application error:', error);
      return content; // Return original if guardrails fail
    }
  }

  /**
   * Get agent capabilities and constraints
   */
  getAgentCapabilities(): Record<string, { role: string; capabilities: string[]; constraints: string[] }> {
    return {
      'Medical Specialist': {
        role: 'Provides evidence-based clinical guidance',
        capabilities: [
          'Clinical reasoning and diagnosis',
          'Treatment recommendations',
          'Drug interactions and contraindications',
          'Patient safety assessment',
          'Evidence synthesis'
        ],
        constraints: [
          'Must cite all clinical claims',
          'Cannot provide emergency medical advice',
          'Must consider patient safety first',
          'Cannot make definitive diagnoses'
        ]
      },
      'Compliance Officer': {
        role: 'Ensures guideline adherence and regulatory compliance',
        capabilities: [
          'NICE/NHS/CQC guideline validation',
          'Citation requirement enforcement',
          'Regulatory compliance checking',
          'Risk assessment',
          'Quality assurance'
        ],
        constraints: [
          'Cannot modify clinical facts',
          'Must flag non-compliant statements',
          'Cannot approve unsupported claims',
          'Must prioritize authoritative sources'
        ]
      },
      'Learning Facilitator': {
        role: 'Simplifies content for healthcare education',
        capabilities: [
          'Language simplification',
          'Educational structuring',
          'Practical examples',
          'Accessibility improvements',
          'Clear communication'
        ],
        constraints: [
          'Cannot alter clinical facts',
          'Cannot modify dosages or measurements',
          'Cannot remove citations',
          'Cannot add new medical claims',
          'Only rephrases existing content'
        ]
      }
    };
  }
}

export const enhancedMultiAgentSystem = new EnhancedMultiAgentSystem();