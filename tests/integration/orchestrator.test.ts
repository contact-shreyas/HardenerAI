import { describe, it, expect } from 'vitest';
import { createOrchestrator } from '../../src/orchestrator';
import path from 'path';

describe('Integration Tests - Full Hardening Flow', () => {
  it('performs complete hardening run on fixtures', async () => {
    const orchestrator = createOrchestrator();
    const fixtureDir = path.join(process.cwd(), 'fixtures');

    const report = await orchestrator.harden({
      target: fixtureDir,
      dryRun: true,
      apply: false,
      enableRollback: false,
    });

    // Verify report structure
    expect(report).toBeDefined();
    expect(report.runId).toBeTruthy();
    expect(report.findings.length).toBeGreaterThan(0);
    expect(report.prioritizedPlan.length).toBeGreaterThan(0);
    expect(report.statistics).toBeDefined();

    // Verify findings have risk scores
    for (const finding of report.prioritizedPlan) {
      expect(finding.riskScore).toBeDefined();
      expect(finding.riskScore.overall).toBeGreaterThanOrEqual(0);
      expect(finding.riskScore.overall).toBeLessThanOrEqual(100);
    }

    // Verify prioritization (highest risk first)
    for (let i = 0; i < report.prioritizedPlan.length - 1; i++) {
      expect(
        report.prioritizedPlan[i].riskScore.overall
      ).toBeGreaterThanOrEqual(
        report.prioritizedPlan[i + 1].riskScore.overall
      );
    }

    // Verify statistics
    expect(report.statistics.totalFindings).toBe(report.findings.length);
    expect(report.statistics.validationPassRate).toBeGreaterThanOrEqual(0);
    expect(report.statistics.validationPassRate).toBeLessThanOrEqual(1.0);
  });

  it('handles multiple config types', async () => {
    const orchestrator = createOrchestrator();
    const fixtureDir = path.join(process.cwd(), 'fixtures');

    const report = await orchestrator.harden({
      target: fixtureDir,
      dryRun: true,
      apply: false,
    });

    // Check for findings across different config types
    const categories = new Set(report.findings.map((f) => f.category));

    // Should have findings from multiple sources
    expect(categories.size).toBeGreaterThan(1);
    expect(Array.from(categories).some((c) => c.includes('nginx'))).toBe(true);
    expect(Array.from(categories).some((c) => c.includes('docker'))).toBe(true);
  });

  it('scores findings properly with realistic data', async () => {
    const orchestrator = createOrchestrator();
    const fixtureDir = path.join(process.cwd(), 'fixtures');

    const report = await orchestrator.harden({
      target: fixtureDir,
      dryRun: true,
    });

    // Find high-risk findings
    // Check for high-severity findings (realistic threshold)
    const highSeverityFindings = report.prioritizedPlan.filter(
      (f) => f.riskScore.overall > 10
    );

    // Should find significant misconfigurations
    expect(highSeverityFindings.length).toBeGreaterThan(0);

    // Verify findings have clear explanations
    for (const finding of highSeverityFindings) {
      expect(finding.riskScore.reasoning).toBeTruthy();
      expect(finding.riskScore.reasoning.length).toBeGreaterThan(0);
    }
  });
});
