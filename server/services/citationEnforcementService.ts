/**
 * Citation Enforcement Service for Medical Accuracy & Compliance
 * Ensures all medical responses include proper authoritative citations with audit trails
 */

import { RAG_CONFIG } from '../config/ragConfiguration';
import { storage } from '../storage';

interface CitationRequirement {
  id: string;
  guidelineType: 'NICE' | 'NHS' | 'CQC' | 'other';
  requiredForQueryTypes: string[];
  minCitations: number;
  requiresOnlineSource: boolean;
  validityCheckRequired: boolean;
}

interface CitationValidation {
  isValid: boolean;
  validCitations: EnhancedCitation[];
  missingRequirements: string[];
  confidence: number;
  auditTrail: CitationAudit[];
  recommendations: string[];
}

interface EnhancedCitation {
  id: string;
  title: string;
  source: string;
  excerpt: string;
  type: 'guideline' | 'research' | 'policy' | 'best_practice';
  authority: 'NICE' | 'NHS' | 'CQC' | 'academic' | 'professional_body' | 'other';
  url?: string;
  lastUpdated: Date;
  relevanceScore: number;
  credibilityScore: number;
  pageNumber?: number;
  section?: string;
  isVerified: boolean;
  verificationDate?: Date;
}

interface CitationAudit {
  timestamp: Date;
  action: 'validated' | 'rejected' | 'flagged' | 'verified';
  reason: string;
  userId?: string;
  metadata: Record<string, any>;
}

export class CitationEnforcementService {
  private citationRequirements: CitationRequirement[];
  private auditLog: Map<string, CitationAudit[]> = new Map();

  constructor() {
    this.initializeCitationRequirements();
  }

  private initializeCitationRequirements(): void {
    this.citationRequirements = [
      {
        id: 'clinical_guidance',
        guidelineType: 'NICE',
        requiredForQueryTypes: ['clinical', 'emergency', 'medication'],
        minCitations: 2,
        requiresOnlineSource: true,
        validityCheckRequired: true,
      },
      {
        id: 'care_standards',
        guidelineType: 'CQC',
        requiredForQueryTypes: ['care_quality', 'documentation', 'compliance'],
        minCitations: 1,
        requiresOnlineSource: true,
        validityCheckRequired: true,
      },
      {
        id: 'nhs_protocols',
        guidelineType: 'NHS',
        requiredForQueryTypes: ['clinical', 'emergency', 'best_practice'],
        minCitations: 1,
        requiresOnlineSource: true,
        validityCheckRequired: true,
      },
    ];
  }

  async validateCitations(
    sources: any[],
    queryType: string,
    responseContent: string,
    userId?: string
  ): Promise<CitationValidation> {
    const startTime = Date.now();
    
    try {
      // Convert sources to enhanced citations
      const enhancedCitations = await this.enhanceSources(sources);
      
      // Get applicable requirements
      const requirements = this.getApplicableRequirements(queryType);
      
      // Validate each requirement
      const validationResults = await Promise.all(
        requirements.map(req => this.validateRequirement(enhancedCitations, req, responseContent))
      );
      
      // Combine results
      const isValid = validationResults.every(result => result.isValid);
      const validCitations = enhancedCitations.filter(citation => citation.isVerified);
      const missingRequirements = validationResults
        .filter(result => !result.isValid)
        .map(result => result.missingRequirement);
      
      // Calculate overall confidence
      const confidence = this.calculateCitationConfidence(validCitations, requirements);
      
      // Generate recommendations
      const recommendations = this.generateRecommendations(validCitations, missingRequirements, queryType);
      
      // Create audit trail
      const auditEntry: CitationAudit = {
        timestamp: new Date(),
        action: isValid ? 'validated' : 'flagged',
        reason: isValid ? 'All requirements met' : `Missing: ${missingRequirements.join(', ')}`,
        userId,
        metadata: {
          queryType,
          citationCount: enhancedCitations.length,
          validCitationCount: validCitations.length,
          processingTime: Date.now() - startTime,
        },
      };

      this.addAuditEntry(sources.map(s => s.id || 'unknown').join('|'), auditEntry);

      return {
        isValid,
        validCitations,
        missingRequirements,
        confidence,
        auditTrail: [auditEntry],
        recommendations,
      };

    } catch (error) {
      console.error('Citation validation error:', error);
      
      // Fallback validation
      return this.performBasicValidation(sources, queryType);
    }
  }

  private async enhanceSources(sources: any[]): Promise<EnhancedCitation[]> {
    return Promise.all(sources.map(async (source) => {
      const authority = this.identifyAuthority(source.title, source.excerpt);
      const type = this.classifySourceType(source.type, source.title);
      
      return {
        id: source.id || `citation_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
        title: source.title,
        source: source.title,
        excerpt: source.excerpt || '',
        type,
        authority,
        url: source.url,
        lastUpdated: source.lastUpdated ? new Date(source.lastUpdated) : new Date(),
        relevanceScore: source.score || 0,
        credibilityScore: this.calculateCredibilityScore(authority, type),
        pageNumber: source.pageNumber,
        section: source.section,
        isVerified: await this.verifySource(source),
        verificationDate: new Date(),
      };
    }));
  }

  private identifyAuthority(title: string, excerpt: string): EnhancedCitation['authority'] {
    const text = (title + ' ' + excerpt).toLowerCase();
    
    if (text.includes('nice') || text.includes('national institute for health')) return 'NICE';
    if (text.includes('nhs') || text.includes('national health service')) return 'NHS';
    if (text.includes('cqc') || text.includes('care quality commission')) return 'CQC';
    if (text.includes('bmj') || text.includes('lancet') || text.includes('nejm')) return 'academic';
    if (text.includes('royal college') || text.includes('diabetes uk')) return 'professional_body';
    
    return 'other';
  }

  private classifySourceType(sourceType: string, title: string): EnhancedCitation['type'] {
    const text = (sourceType + ' ' + title).toLowerCase();
    
    if (text.includes('guideline') || text.includes('guidance')) return 'guideline';
    if (text.includes('research') || text.includes('study') || text.includes('trial')) return 'research';
    if (text.includes('policy') || text.includes('standard') || text.includes('regulation')) return 'policy';
    
    return 'best_practice';
  }

  private calculateCredibilityScore(authority: EnhancedCitation['authority'], type: EnhancedCitation['type']): number {
    let score = 50;
    
    // Authority scoring
    switch (authority) {
      case 'NICE': score += 40; break;
      case 'NHS': score += 35; break;
      case 'CQC': score += 30; break;
      case 'academic': score += 25; break;
      case 'professional_body': score += 20; break;
      default: score += 10;
    }
    
    // Type scoring
    switch (type) {
      case 'guideline': score += 10; break;
      case 'research': score += 8; break;
      case 'policy': score += 6; break;
      case 'best_practice': score += 4; break;
    }
    
    return Math.min(100, score);
  }

  private async verifySource(source: any): Promise<boolean> {
    // Basic verification - in production, this would check URL accessibility, content freshness, etc.
    return !!(source.title && source.excerpt && source.score && source.score > 0.5);
  }

  private getApplicableRequirements(queryType: string): CitationRequirement[] {
    return this.citationRequirements.filter(req => 
      req.requiredForQueryTypes.includes(queryType) || 
      req.requiredForQueryTypes.includes('all')
    );
  }

  private async validateRequirement(
    citations: EnhancedCitation[],
    requirement: CitationRequirement,
    responseContent: string
  ): Promise<{ isValid: boolean; missingRequirement: string }> {
    // Check minimum citation count
    const relevantCitations = citations.filter(citation => 
      citation.authority === requirement.guidelineType || requirement.guidelineType === 'other'
    );

    if (relevantCitations.length < requirement.minCitations) {
      return {
        isValid: false,
        missingRequirement: `Need ${requirement.minCitations} ${requirement.guidelineType} citations, found ${relevantCitations.length}`,
      };
    }

    // Check online source requirement
    if (requirement.requiresOnlineSource) {
      const onlineSources = relevantCitations.filter(citation => citation.url);
      if (onlineSources.length === 0) {
        return {
          isValid: false,
          missingRequirement: `${requirement.guidelineType} citations must include online sources`,
        };
      }
    }

    // Check validity requirement
    if (requirement.validityCheckRequired) {
      const validSources = relevantCitations.filter(citation => citation.isVerified);
      if (validSources.length === 0) {
        return {
          isValid: false,
          missingRequirement: `${requirement.guidelineType} citations must be verified and current`,
        };
      }
    }

    // Check if citations are actually referenced in response
    const citationsMentioned = relevantCitations.filter(citation =>
      responseContent.toLowerCase().includes(citation.authority.toLowerCase()) ||
      responseContent.toLowerCase().includes(citation.title.toLowerCase().split(' ').slice(0, 3).join(' '))
    );

    if (citationsMentioned.length === 0) {
      return {
        isValid: false,
        missingRequirement: `${requirement.guidelineType} citations must be explicitly referenced in response`,
      };
    }

    return { isValid: true, missingRequirement: '' };
  }

  private calculateCitationConfidence(citations: EnhancedCitation[], requirements: CitationRequirement[]): number {
    if (citations.length === 0) return 0;

    let totalScore = 0;
    let maxScore = 0;

    citations.forEach(citation => {
      let citationScore = citation.credibilityScore * (citation.relevanceScore || 0.5);
      
      // Boost for recent sources
      const daysSinceUpdate = (Date.now() - citation.lastUpdated.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceUpdate < 30) citationScore *= 1.2;
      else if (daysSinceUpdate < 365) citationScore *= 1.1;
      else if (daysSinceUpdate > 1095) citationScore *= 0.8; // 3+ years old
      
      totalScore += citationScore;
      maxScore += 100;
    });

    // Penalty for not meeting requirements
    const requirementsPenalty = requirements.length * 10; // 10 points per unmet requirement
    const metRequirements = requirements.length; // Simplified - would need actual validation
    const penalty = (requirements.length - metRequirements) * requirementsPenalty;

    const confidence = Math.max(0, Math.min(100, (totalScore / maxScore) * 100 - penalty));
    return Math.round(confidence);
  }

  private generateRecommendations(
    validCitations: EnhancedCitation[],
    missingRequirements: string[],
    queryType: string
  ): string[] {
    const recommendations: string[] = [];

    if (missingRequirements.length > 0) {
      recommendations.push(`Address missing requirements: ${missingRequirements.join(', ')}`);
    }

    if (validCitations.length < 2) {
      recommendations.push('Consider adding more authoritative sources to strengthen response');
    }

    const oldCitations = validCitations.filter(citation => {
      const daysSinceUpdate = (Date.now() - citation.lastUpdated.getTime()) / (1000 * 60 * 60 * 24);
      return daysSinceUpdate > 365;
    });

    if (oldCitations.length > 0) {
      recommendations.push('Update older citations with more recent guidance if available');
    }

    const lowCredibility = validCitations.filter(citation => citation.credibilityScore < 70);
    if (lowCredibility.length > 0) {
      recommendations.push('Include more authoritative sources (NICE, NHS, CQC guidelines)');
    }

    if (queryType === 'clinical' || queryType === 'emergency') {
      const hasNICE = validCitations.some(citation => citation.authority === 'NICE');
      if (!hasNICE) {
        recommendations.push('Include NICE guidelines for clinical queries');
      }
    }

    return recommendations;
  }

  private performBasicValidation(sources: any[], queryType: string): CitationValidation {
    const hasAuthoritativeSource = sources.some(source => 
      source.title?.toLowerCase().includes('nice') ||
      source.title?.toLowerCase().includes('nhs') ||
      source.title?.toLowerCase().includes('cqc')
    );

    return {
      isValid: hasAuthoritativeSource && sources.length >= 1,
      validCitations: [],
      missingRequirements: hasAuthoritativeSource ? [] : ['Authoritative guidelines required'],
      confidence: hasAuthoritativeSource ? 60 : 30,
      auditTrail: [],
      recommendations: hasAuthoritativeSource ? [] : ['Add NICE, NHS, or CQC guidelines'],
    };
  }

  private addAuditEntry(sourceId: string, entry: CitationAudit): void {
    if (!this.auditLog.has(sourceId)) {
      this.auditLog.set(sourceId, []);
    }
    this.auditLog.get(sourceId)!.push(entry);
    
    // Keep only last 100 entries per source
    const entries = this.auditLog.get(sourceId)!;
    if (entries.length > 100) {
      entries.splice(0, entries.length - 100);
    }
  }

  // Get audit trail for specific sources
  getAuditTrail(sourceIds: string[]): CitationAudit[] {
    const allEntries: CitationAudit[] = [];
    
    sourceIds.forEach(id => {
      const entries = this.auditLog.get(id) || [];
      allEntries.push(...entries);
    });
    
    return allEntries.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  // Generate compliance report
  generateComplianceReport(timeRange: { start: Date; end: Date }): {
    totalValidations: number;
    successRate: number;
    commonIssues: string[];
    authorityBreakdown: Record<string, number>;
    recommendations: string[];
  } {
    const allEntries: CitationAudit[] = [];
    this.auditLog.forEach(entries => allEntries.push(...entries));
    
    const filteredEntries = allEntries.filter(entry => 
      entry.timestamp >= timeRange.start && entry.timestamp <= timeRange.end
    );
    
    const totalValidations = filteredEntries.length;
    const successful = filteredEntries.filter(entry => entry.action === 'validated').length;
    const successRate = totalValidations > 0 ? (successful / totalValidations) * 100 : 0;
    
    // Analyze common issues
    const flaggedEntries = filteredEntries.filter(entry => entry.action === 'flagged');
    const issueCount = new Map<string, number>();
    
    flaggedEntries.forEach(entry => {
      const reason = entry.reason;
      issueCount.set(reason, (issueCount.get(reason) || 0) + 1);
    });
    
    const commonIssues = Array.from(issueCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([issue]) => issue);

    return {
      totalValidations,
      successRate: Math.round(successRate),
      commonIssues,
      authorityBreakdown: {}, // Would implement based on actual audit data
      recommendations: this.generateSystemRecommendations(commonIssues, successRate),
    };
  }

  private generateSystemRecommendations(commonIssues: string[], successRate: number): string[] {
    const recommendations: string[] = [];
    
    if (successRate < 80) {
      recommendations.push('Improve source validation processes');
    }
    
    if (commonIssues.some(issue => issue.includes('NICE'))) {
      recommendations.push('Enhance NICE guideline integration');
    }
    
    if (commonIssues.some(issue => issue.includes('online'))) {
      recommendations.push('Ensure all citations include accessible URLs');
    }
    
    return recommendations;
  }
}

export const citationEnforcementService = new CitationEnforcementService();