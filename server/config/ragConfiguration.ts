/**
 * Enhanced RAG Configuration with Layered Parameters
 * Organized by operational layers for better maintainability and medical accuracy
 */

export interface RagRetrievalSettings {
  // Vector search parameters
  topK: number;
  minScore: number;
  hybridSearchEnabled: boolean;
  bm25Weight: number;
  embeddingWeight: number;
  
  // Embedding model settings
  embeddingModel: 'text-embedding-3-small' | 'text-embedding-3-large';
  chunkOverlap: number;
  maxChunkSize: number;
}

export interface GenerationSettings {
  // Model parameters by context type
  clinical: {
    temperature: number;
    topP: number;
    maxTokens: number;
    model: string;
  };
  educational: {
    temperature: number;
    topP: number;
    maxTokens: number;
    model: string;
  };
  emergency: {
    temperature: number;
    topP: number;
    maxTokens: number;
    model: string;
  };
}

export interface AgentSelectionRules {
  // Confidence thresholds for agent selection
  medicalSpecialistThreshold: number;
  complianceOfficerThreshold: number;
  learningFacilitatorThreshold: number;
  
  // Query complexity routing
  complexityThresholds: {
    simple: number;
    moderate: number;
    complex: number;
  };
  
  // Agent pruning rules
  maxParallelAgents: number;
  emergencyAgentOverride: boolean;
}

export interface SafetyComplianceRules {
  // Confidence and quality gates
  minResponseConfidence: number;
  humanEscalationThreshold: {
    lower: number;  // Below this: automatic fallback
    upper: number;  // Above this: proceed normally
    // Between: human-in-loop escalation
  };
  
  // Emergency detection
  emergencyDetection: {
    keywordBased: boolean;
    nlpIntentBased: boolean;
    confidenceThreshold: number;
  };
  
  // Citation requirements
  citationRequirements: {
    minCitationsRequired: number;
    requireOnlineSources: boolean;
    mandatoryGuidelines: string[]; // NICE, NHS, CQC
  };
}

export interface PerformanceMonitoring {
  // Response time limits
  maxResponseTimeMs: number;
  ragTimeoutMs: number;
  agentTimeoutMs: number;
  
  // Token usage limits
  maxTokensPerQuery: number;
  tokenBudgetPerAgent: number;
  
  // Cache settings
  cacheEnabled: boolean;
  cacheThreshold: number; // confidence level to cache
  cacheTTLHours: number;
}

export interface AuditPrivacySettings {
  // Logging requirements
  logAllInteractions: boolean;
  logConfidenceScores: boolean;
  logSourceCitations: boolean;
  logEmergencyTriggers: boolean;
  
  // Data retention
  analyticsRetentionDays: number;
  conversationRetentionDays: number;
  
  // Privacy controls
  anonymizeUserData: boolean;
  excludeSensitiveContent: boolean;
}

export const RAG_CONFIG: {
  retrieval: RagRetrievalSettings;
  generation: GenerationSettings;
  agentSelection: AgentSelectionRules;
  safety: SafetyComplianceRules;
  performance: PerformanceMonitoring;
  audit: AuditPrivacySettings;
} = {
  retrieval: {
    topK: 8,
    minScore: 0.2, // Lowered from 0.5 to be more permissive for better document retrieval
    hybridSearchEnabled: true,
    bm25Weight: 0.3,
    embeddingWeight: 0.7,
    embeddingModel: 'text-embedding-3-small',
    chunkOverlap: 200,
    maxChunkSize: 1000,
  },
  
  generation: {
    clinical: {
      temperature: 0.3,
      topP: 0.9,
      maxTokens: 500,
      model: 'gpt-4o',
    },
    educational: {
      temperature: 0.3,
      topP: 0.9,
      maxTokens: 600,
      model: 'gpt-4o',
    },
    emergency: {
      temperature: 0.05, // Maximum determinism for emergencies
      topP: 0.8,
      maxTokens: 800,
      model: 'gpt-4o',
    },
  },
  
  agentSelection: {
    medicalSpecialistThreshold: 0.8,
    complianceOfficerThreshold: 0.7,
    learningFacilitatorThreshold: 0.6,
    
    complexityThresholds: {
      simple: 0.3,
      moderate: 0.6,
      complex: 0.8,
    },
    
    maxParallelAgents: 2,
    emergencyAgentOverride: true,
  },
  
  safety: {
    minResponseConfidence: 70,
    humanEscalationThreshold: {
      lower: 50,  // Below 50%: fallback
      upper: 70,  // Above 70%: proceed
      // 50-70%: human escalation
    },
    
    emergencyDetection: {
      keywordBased: true,
      nlpIntentBased: true,
      confidenceThreshold: 0.8,
    },
    
    citationRequirements: {
      minCitationsRequired: 1,
      requireOnlineSources: true,
      mandatoryGuidelines: ['NICE', 'NHS', 'CQC'],
    },
  },
  
  performance: {
    maxResponseTimeMs: 30000,
    ragTimeoutMs: 15000,
    agentTimeoutMs: 10000,
    maxTokensPerQuery: 8000,
    tokenBudgetPerAgent: 3000,
    cacheEnabled: true,
    cacheThreshold: 85,
    cacheTTLHours: 24,
  },
  
  audit: {
    logAllInteractions: true,
    logConfidenceScores: true,
    logSourceCitations: true,
    logEmergencyTriggers: true,
    analyticsRetentionDays: 90,
    conversationRetentionDays: 30,
    anonymizeUserData: true,
    excludeSensitiveContent: false,
  },
};

// Helper function to get generation settings based on query type
export function getGenerationSettings(queryType: 'clinical' | 'educational' | 'emergency' | 'faq'): GenerationSettings['clinical'] {
  switch (queryType) {
    case 'clinical':
    case 'emergency':
      return RAG_CONFIG.generation.clinical;
    case 'educational':
    case 'faq':
      return RAG_CONFIG.generation.educational;
    default:
      return RAG_CONFIG.generation.educational;
  }
}

// Helper to determine if human escalation is needed
export function shouldEscalateToHuman(confidence: number): boolean {
  const { lower, upper } = RAG_CONFIG.safety.humanEscalationThreshold;
  return confidence >= lower && confidence < upper;
}

// Helper to validate citation requirements
export function validateCitations(sources: any[]): boolean {
  const { minCitationsRequired, mandatoryGuidelines } = RAG_CONFIG.safety.citationRequirements;
  
  if (sources.length < minCitationsRequired) return false;
  
  // Check if at least one source references mandatory guidelines
  const hasRequiredGuideline = sources.some(source => 
    mandatoryGuidelines.some(guideline => 
      source.title?.toLowerCase().includes(guideline.toLowerCase()) ||
      source.excerpt?.toLowerCase().includes(guideline.toLowerCase())
    )
  );
  
  return hasRequiredGuideline;
}