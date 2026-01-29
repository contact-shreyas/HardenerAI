/**
 * Risk scoring engine with explainable breakdown
 * ML-inspired weighted scoring with CVSS-like metrics
 */

import {
  SecurityFinding,
  RiskScore,
} from '../types.js';

// Attack complexity indicators
const ATTACK_COMPLEXITY = {
  LOW: { weight: 1.0, label: 'Trivial to exploit' },
  MEDIUM: { weight: 0.7, label: 'Moderate skill required' },
  HIGH: { weight: 0.4, label: 'Expert skill required' },
};

// Privileges required for exploitation
const PRIVILEGES_REQUIRED = {
  NONE: { weight: 1.0, label: 'No privileges needed' },
  LOW: { weight: 0.6, label: 'Basic user access required' },
  HIGH: { weight: 0.3, label: 'Admin privileges required' },
};

// User interaction required
const USER_INTERACTION = {
  NONE: { weight: 1.0, label: 'Fully automated' },
  REQUIRED: { weight: 0.6, label: 'User action needed' },
};

// Scope of impact
const SCOPE = {
  CHANGED: { weight: 1.2, label: 'Can affect other components' },
  UNCHANGED: { weight: 1.0, label: 'Isolated to vulnerable component' },
};

export class RiskScorer {
  /**
   * Score a finding based on exploit likelihood, business impact, and confidence
   * Enhanced with CVSS-inspired metrics and ML-weighted factors
   */
  scoreFind(finding: SecurityFinding, context?: Record<string, unknown>): RiskScore {
    const exploitLikelihood = this.calculateExploitLikelihood(finding, context);
    const businessImpact = this.calculateBusinessImpact(finding, context);
    const confidence = finding.confidence * 5; // scale 0-1 to 0-5
    
    // CVSS-inspired adjustments
    const cvssModifiers = this.calculateCVSSModifiers(finding);
    const temporalScore = this.calculateTemporalScore(finding);
    
    // Apply attack complexity and privilege modifiers
    const adjustedExploit = exploitLikelihood * cvssModifiers.attackComplexity * cvssModifiers.privilegesRequired;
    const adjustedImpact = businessImpact * cvssModifiers.scope;
    
    // Composite score with enhanced weighting and temporal adjustment
    // Exploit: 45%, Impact: 40%, Confidence: 10%, Temporal: 5%
    const compositeScore =
      (adjustedExploit * 0.45 + adjustedImpact * 0.40 + confidence * 0.10 + temporalScore * 0.05) / 10;
    const overall = Math.round(compositeScore * 100);

    const factors = this.extractFactors(finding);
    const reasoning = this.generateReasoning(
      adjustedExploit,
      adjustedImpact,
      confidence,
      factors,
      cvssModifiers
    );

    return {
      overall: Math.min(100, Math.max(0, overall)),
      exploitLikelihood: Math.round(adjustedExploit * 10) / 10,
      businessImpact: Math.round(adjustedImpact * 10) / 10,
      confidence: Math.round(confidence * 10) / 10,
      reasoning,
      factors: {
        ...factors,
        attackComplexity: cvssModifiers.attackComplexityLabel,
        privilegesRequired: cvssModifiers.privilegesLabel,
        userInteraction: cvssModifiers.userInteractionLabel,
        temporalScore: temporalScore.toFixed(1),
      },
    };
  }

  private calculateCVSSModifiers(finding: SecurityFinding): {
    attackComplexity: number;
    privilegesRequired: number;
    userInteraction: number;
    scope: number;
    attackComplexityLabel: string;
    privilegesLabel: string;
    userInteractionLabel: string;
  } {
    const evidence = finding.evidence.toLowerCase();
    const description = finding.description.toLowerCase();
    
    // Determine attack complexity
    let attackComplexity = ATTACK_COMPLEXITY.LOW;
    if (description.includes('chained') || description.includes('multiple steps')) {
      attackComplexity = ATTACK_COMPLEXITY.HIGH;
    } else if (description.includes('authenticated') || description.includes('requires')) {
      attackComplexity = ATTACK_COMPLEXITY.MEDIUM;
    }
    
    // Determine privileges required
    let privilegesRequired = PRIVILEGES_REQUIRED.NONE;
    if (description.includes('admin') || description.includes('root') || 
        evidence.includes('cluster-admin')) {
      privilegesRequired = PRIVILEGES_REQUIRED.HIGH;
    } else if (description.includes('authenticated') || description.includes('user')) {
      privilegesRequired = PRIVILEGES_REQUIRED.LOW;
    }
    
    // Determine user interaction
    let userInteraction = USER_INTERACTION.NONE;
    if (description.includes('click') || description.includes('user action') ||
        description.includes('manual')) {
      userInteraction = USER_INTERACTION.REQUIRED;
    }
    
    // Determine scope
    let scope = SCOPE.UNCHANGED;
    if (description.includes('cluster') || description.includes('lateral') ||
        description.includes('pivot') || description.includes('escape')) {
      scope = SCOPE.CHANGED;
    }
    
    return {
      attackComplexity: attackComplexity.weight,
      privilegesRequired: privilegesRequired.weight,
      userInteraction: userInteraction.weight,
      scope: scope.weight,
      attackComplexityLabel: attackComplexity.label,
      privilegesLabel: privilegesRequired.label,
      userInteractionLabel: userInteraction.label,
    };
  }

  private calculateTemporalScore(finding: SecurityFinding): number {
    // Temporal factors: exploit code maturity, remediation level, report confidence
    let score = 5.0; // baseline
    
    const description = finding.description.toLowerCase();
    const category = finding.category.toLowerCase();
    
    // Exploit code maturity
    if (description.includes('poc available') || description.includes('exploit')) {
      score += 2.0; // Public exploit increases urgency
    } else if (description.includes('theoretical') || description.includes('no known')) {
      score -= 1.0; // Lower temporal risk if theoretical
    }
    
    // Remediation level
    if (category.includes('docker') && description.includes('latest tag')) {
      score += 1.0; // Easy fix = higher priority
    }
    if (description.includes('no patch') || description.includes('cannot fix')) {
      score += 1.5; // No remediation = higher risk acceptance decision
    }
    
    // Report confidence (already in finding.confidence, but boost temporal)
    if (finding.confidence >= 0.9) {
      score += 0.5; // High confidence findings get temporal boost
    }
    
    return Math.max(0, Math.min(10, score));
  }

  private calculateExploitLikelihood(
    finding: SecurityFinding,
    _context?: Record<string, unknown>
  ): number {
    let score = 0;
    const evidence = finding.evidence.toLowerCase();
    const description = finding.description.toLowerCase();
    const title = finding.title.toLowerCase();

    // Network exposure (highest weight)
    if (evidence.includes('0.0.0.0') || evidence.includes('internet-facing')) {
      score += 4.5; // Direct internet exposure
    } else if (evidence.includes('publicly accessible') || evidence.includes('external')) {
      score += 3.8;
    } else if (evidence.includes('127.0.0.1') || evidence.includes('localhost')) {
      score += 0.5; // Local only = low exploit likelihood
    }
    
    // Authentication weaknesses (critical factor)
    if (
      description.includes('no authentication') ||
      description.includes('unauthenticated') ||
      evidence.includes('anonymous') ||
      title.includes('unauthenticated')
    ) {
      score += 4.2;
    }
    if (
      evidence.includes('default password') ||
      description.includes('default credential') ||
      evidence.includes('admin:admin') ||
      evidence.includes('root:root')
    ) {
      score += 4.8; // Default creds = instant exploitation
    }
    
    // Container escape vectors
    if (
      description.includes('privileged') ||
      evidence.includes('privileged: true') ||
      evidence.includes('--privileged')
    ) {
      score += 3.5; // Privileged containers can escape
    }
    if (
      description.includes('hostnetwork') ||
      evidence.includes('hostNetwork: true') ||
      description.includes('hostpath')
    ) {
      score += 3.2; // Host namespace access
    }
    if (
      description.includes('hostipc') || description.includes('hostpid')
    ) {
      score += 3.0;
    }
    
    // Encryption weaknesses
    if (
      (description.includes('tls') || description.includes('ssl')) &&
      (evidence.includes('false') || evidence.includes('disabled') || 
       description.includes('not enabled'))
    ) {
      score += 3.8; // Missing encryption = MitM attacks
    }
    if (description.includes('weak cipher') || description.includes('sslv3')) {
      score += 3.5;
    }
    
    // Privilege elevation
    if (
      description.includes('root') ||
      evidence.includes('user: root') ||
      evidence.includes('uid: 0') ||
      evidence.includes('runAsNonRoot: false')
    ) {
      score += 2.8; // Root access increases exploitation impact
    }
    if (description.includes('sudo') || description.includes('setuid')) {
      score += 3.0;
    }
    
    // High-impact vulnerability types
    if (description.includes('rce') || description.includes('remote code execution')) {
      score += 5.5; // RCE is always critical
    }
    if (description.includes('sql injection') || description.includes('sqli')) {
      score += 5.0;
    }
    if (description.includes('command injection') || description.includes('shell injection')) {
      score += 5.2;
    }
    if (description.includes('path traversal') || description.includes('directory traversal')) {
      score += 4.0;
    }
    if (description.includes('xxe') || description.includes('xml external entity')) {
      score += 4.2;
    }
    if (description.includes('ssrf') || description.includes('server-side request forgery')) {
      score += 4.5;
    }
    
    // Resource access
    if (description.includes('secrets') || evidence.includes('secret')) {
      score += 3.5; // Secret exposure
    }
    if (description.includes('cluster-admin') || evidence.includes('cluster-admin')) {
      score += 4.0; // Full cluster control
    }
    if (description.includes('latest tag') || evidence.includes(':latest')) {
      score += 1.5; // Supply chain risk
    }
    
    // Severity-based calibration (refined multipliers)
    const severityMultiplier =
      {
        critical: 1.9,  // Boost critical findings more
        high: 1.4,
        medium: 0.85,
        low: 0.55,
        info: 0.35,
      }[finding.severity] || 1;

    // Category-specific adjustments
    let categoryMultiplier = 1.0;
    if (finding.category.includes('kubernetes-rbac')) {
      categoryMultiplier = 1.3; // RBAC issues have cluster-wide impact
    } else if (finding.category.includes('docker-security')) {
      categoryMultiplier = 1.2;
    } else if (finding.category.includes('nginx-security')) {
      categoryMultiplier = 1.1;
    }

    // Final score with calibrated bounds
    const finalScore = score * severityMultiplier * categoryMultiplier;
    return Math.min(10, Math.max(0, finalScore));
  }

  private calculateBusinessImpact(
    finding: SecurityFinding,
    _context?: Record<string, unknown>
  ): number {
    let score = 0;
    const description = finding.description.toLowerCase();

    // Check for high-impact indicators
    if (
      description.includes('secret') ||
      description.includes('credential') ||
      description.includes('api key') ||
      description.includes('token')
    )
      score += 5;
    if (
      description.includes('data breach') ||
      description.includes('data exfiltration') ||
      description.includes('data leak')
    )
      score += 5;
    if (description.includes('ransomware') || description.includes('crypto'))
      score += 5;
    if (
      description.includes('availability') ||
      description.includes('downtime') ||
      description.includes('denial of service')
    )
      score += 4;
    if (
      description.includes('compliance') ||
      description.includes('gdpr') ||
      description.includes('hipaa') ||
      description.includes('pci-dss')
    )
      score += 4;
    if (
      description.includes('lateral movement') ||
      description.includes('pivot') ||
      description.includes('cluster-admin')
    )
      score += 4.5;
    if (description.includes('etcd') || description.includes('control plane'))
      score += 5;

    // Severity-based adjustment
    const severityBonus =
      {
        critical: 2,
        high: 1,
        medium: 0,
        low: -1,
        info: -2,
      }[finding.severity] || 0;

    const finalScore = score + severityBonus;
    return Math.max(0, Math.min(10, finalScore));
  }

  private extractFactors(
    finding: SecurityFinding
  ): Record<string, boolean | string> {
    const factors: Record<string, boolean | string> = {};
    const evidence = finding.evidence.toLowerCase();
    const description = finding.description.toLowerCase();

    factors.internetExposed =
      evidence.includes('0.0.0.0') || evidence.includes('internet-facing');
    factors.weakAuth =
      description.includes('authentication') || description.includes('no auth');
    factors.defaultCreds =
      evidence.includes('default') || description.includes('default credential');
    factors.privilegedContainer =
      description.includes('privileged') || evidence.includes('privileged: true');
    factors.hostNetwork =
      description.includes('hostnetwork') || evidence.includes('hostNetwork');
    factors.missingTls =
      description.includes('tls') && evidence.includes('false');

    if (evidence.includes('0.0.0.0')) factors.networkExposure = '0.0.0.0';
    else if (evidence.includes('127.0.0.1'))
      factors.networkExposure = 'localhost-only';
    else if (evidence.includes('private')) factors.networkExposure = 'private-only';

    if (description.includes('secret') || description.includes('credential')) {
      factors.dataExposure = true;
    }
    if (
      description.includes('availability') ||
      description.includes('downtime')
    ) {
      factors.downtime = true;
    }
    if (
      description.includes('compliance') ||
      description.includes('pci') ||
      description.includes('hipaa')
    ) {
      factors.complianceRisk = true;
    }
    if (description.includes('lateral movement')) {
      factors.lateralMovement = true;
    }

    if (description.includes('cluster')) {
      factors.blastRadius = 'cluster';
    } else if (description.includes('namespace')) {
      factors.blastRadius = 'namespace';
    } else if (description.includes('pod')) {
      factors.blastRadius = 'pod';
    }

    return factors;
  }

  private generateReasoning(
    exploitLikelihood: number,
    businessImpact: number,
    confidence: number,
    factors: Record<string, boolean | string>,
    cvssModifiers?: any
  ): string {
    const parts: string[] = [];

    parts.push(`Exploit: ${exploitLikelihood.toFixed(1)}/10`);

    if (exploitLikelihood >= 7) {
      parts.push('(CRITICAL - trivial exploitation)');
    } else if (exploitLikelihood >= 5) {
      parts.push('(VERY HIGH - direct attack vector)');
    } else if (exploitLikelihood >= 3) {
      parts.push('(HIGH - multiple paths)');
    } else if (exploitLikelihood >= 1.5) {
      parts.push('(MEDIUM - requires access)');
    } else {
      parts.push('(LOW - limited vector)');
    }

    parts.push(`Impact: ${businessImpact.toFixed(1)}/10`);

    if (factors.dataExposure) {
      parts.push('• Data breach risk');
    }
    if (factors.downtime) {
      parts.push('• Service disruption');
    }
    if (factors.lateralMovement) {
      parts.push('• Lateral movement');
    }
    if (factors.complianceRisk) {
      parts.push('• Compliance violation');
    }

    if (factors.blastRadius === 'cluster') {
      parts.push('• Blast radius: CLUSTER-WIDE');
    } else if (factors.blastRadius === 'namespace') {
      parts.push('• Blast radius: namespace');
    } else if (factors.blastRadius === 'pod') {
      parts.push('• Blast radius: pod-only');
    }
    
    if (cvssModifiers) {
      if (cvssModifiers.attackComplexityLabel && cvssModifiers.attackComplexity < 0.8) {
        parts.push(`• ${cvssModifiers.attackComplexityLabel}`);
      }
      if (cvssModifiers.privilegesLabel && cvssModifiers.privilegesRequired < 0.8) {
        parts.push(`• ${cvssModifiers.privilegesLabel}`);
      }
    }

    parts.push(`Confidence: ${confidence.toFixed(1)}/5`);

    return parts.join(' ');
  }
}

export function createRiskScorer(): RiskScorer {
  return new RiskScorer();
}
