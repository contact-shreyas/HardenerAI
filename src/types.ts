/**
 * Core type definitions for the hardening system
 */

export interface SecurityFinding {
  id: string;
  tool: string;
  resource: string; // filename, path, or resource identifier
  file?: string;
  lineRange?: {
    start: number;
    end: number;
  };
  title: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  evidence: string;
  recommendation: string;
  confidence: number; // 0-1
  category: string;
}

export interface RiskScore {
  overall: number; // 0-100
  exploitLikelihood: number; // 0-5 (extended to 0-10 for critical)
  businessImpact: number; // 0-5 (extended to 0-10 for critical)
  confidence: number; // 0-5
  reasoning: string;
  factors: {
    internetExposed?: boolean;
    weakAuth?: boolean;
    defaultCreds?: boolean;
    privilegedContainer?: boolean;
    hostNetwork?: boolean;
    networkExposure?: string; // e.g., "0.0.0.0"
    missingTls?: boolean;
    dataExposure?: boolean;
    downtime?: boolean;
    complianceRisk?: boolean;
    lateralMovement?: boolean;
    blastRadius?: string; // pod, namespace, cluster
    attackComplexity?: string; // CVSS-like: LOW, MEDIUM, HIGH
    privilegesRequired?: string; // CVSS-like: NONE, LOW, HIGH
    userInteraction?: string; // CVSS-like: NONE, REQUIRED
    temporalScore?: string; // Temporal score as string
  };
}

export interface SecurityPatch {
  id: string;
  findingId: string;
  resource: string;
  type: 'nginx' | 'docker' | 'kubernetes' | 'custom';
  before: string;
  after: string;
  diff: string;
  assumptions: string[];
  rollbackSteps: string[];
  validationSteps: string[];
  safetyNotes: string;
  applied: boolean;
  appliedAt?: Date;
}

export interface FindingGroup {
  id: string;
  title: string;
  category: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  count: number;
  findings: SecurityFinding[];
  representativeFinding: SecurityFinding;
}

export interface HardeningReport {
  runId: string;
  timestamp: Date;
  target: string;
  findings: SecurityFinding[];
  groupedFindings: FindingGroup[];
  prioritizedPlan: PrioritizedFinding[];
  patches: SecurityPatch[];
  validationResults: ValidationResult[];
  rollbackResults: RollbackResult[];
  statistics: ReportStatistics;
}

export interface PrioritizedFinding extends SecurityFinding {
  riskScore: RiskScore;
  patchId?: string;
  status: 'pending' | 'patched' | 'ignored' | 'requires-manual-review' | 'grouped';
  groupId?: string;
}

export interface ValidationResult {
  patchId: string;
  passed: boolean;
  message: string;
  timestamp: Date;
  toolOutput?: string;
}

export interface RollbackResult {
  patchId: string;
  success: boolean;
  message: string;
  timestamp: Date;
}

export interface ReportStatistics {
  totalFindings: number;
  uniqueFindings: number;
  duplicateFindings: number;
  byCategory: Record<string, number>;
  bySeverity: Record<string, number>;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  patchedCount: number;
  validationPassRate: number;
  rollbackSuccessRate: number;
  noiseReductionPercent: number;
  groupCount: number;
}

export interface HardenerConfig {
  target: string;
  scanners: {
    enabled: string[];
    trivy?: {
      enabled: boolean;
      scanType: 'config' | 'all';
    };
    kubeBench?: {
      enabled: boolean;
    };
    custom?: {
      enabled: boolean;
      rulesPath?: string;
    };
  };
  autoFix: {
    enabled: boolean;
    categories: string[];
    excludePatterns?: string[];
  };
  validation: {
    enabled: boolean;
    strict: boolean;
  };
  rollback: {
    enabled: boolean;
    autoRollbackOnFailure: boolean;
  };
  reporting: {
    outputDir: string;
    markdown: boolean;
    json: boolean;
  };
  thresholds: {
    ignoreBelow: number; // 0-100
    warnAbove: number; // 0-100
    criticalAbove: number; // 0-100
  };
}

export interface ScannerOutput {
  tool: string;
  findings: SecurityFinding[];
  rawOutput?: Record<string, unknown>;
}
