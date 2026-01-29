import { describe, it, expect } from 'vitest';
import { createRiskScorer } from '../../src/scoring/riskScorer';
import { SecurityFinding } from '../../src/types';

describe('RiskScorer', () => {
  const scorer = createRiskScorer();

  it('scores critical findings with high exploit likelihood', () => {
    const finding: SecurityFinding = {
      id: 'test-1',
      tool: 'test',
      resource: 'test.conf',
      title: 'Exposed credentials',
      description:
        'Default credentials detected on internet-facing endpoint with weak authentication and potential RCE/data breach impact',
      severity: 'critical',
      evidence: 'internet-facing 0.0.0.0:8080 with default password admin and unauthenticated access',
      recommendation: 'Change credentials',
      confidence: 0.95,
      category: 'authentication',
    };

    const score = scorer.scoreFind(finding);

    expect(score.overall).toBeGreaterThanOrEqual(80);
    expect(score.exploitLikelihood).toBeGreaterThan(3);
    expect(score.businessImpact).toBeGreaterThan(3);
    expect(score.reasoning).toContain('Exploit:'); // Updated to match new format
  });

  it('scores low-severity findings appropriately', () => {
    const finding: SecurityFinding = {
      id: 'test-2',
      tool: 'test',
      resource: 'test.conf',
      title: 'Missing comment',
      description: 'Config section lacks documentation',
      severity: 'info',
      evidence: 'No comment found',
      recommendation: 'Add comment',
      confidence: 0.5,
      category: 'documentation',
    };

    const score = scorer.scoreFind(finding);

    expect(score.overall).toBeLessThan(40);
    expect(score.confidence).toBeLessThan(3);
  });

  it('extracts risk factors correctly', () => {
    const finding: SecurityFinding = {
      id: 'test-3',
      tool: 'test',
      resource: 'k8s.yaml',
      title: 'Privileged container with cluster-wide RBAC',
      description:
        'Container runs with privileged: true with cluster-admin role',
      severity: 'critical',
      evidence: 'privileged: true, clusterrolebinding: cluster-admin',
      recommendation: 'Remove privileged flag',
      confidence: 1.0,
      category: 'privilege-escalation',
    };

    const score = scorer.scoreFind(finding);

    expect(score.factors.privilegedContainer).toBe(true);
    expect(score.factors.blastRadius).toBe('cluster');
    expect(score.overall).toBeGreaterThan(30);
  });

  it('normalizes scores to 0-100 range', () => {
    const findings: SecurityFinding[] = [
      {
        id: 'test-4',
        tool: 'test',
        resource: 'test.conf',
        title: 'Test',
        description: 'Test finding with max impact',
        severity: 'critical',
        evidence: 'critical issue everywhere',
        recommendation: 'Fix it',
        confidence: 1.0,
        category: 'critical',
      },
    ];

    for (const finding of findings) {
      const score = scorer.scoreFind(finding);
      expect(score.overall).toBeGreaterThanOrEqual(0);
      expect(score.overall).toBeLessThanOrEqual(100);
    }
  });
});
