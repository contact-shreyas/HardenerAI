/**
 * Main orchestrator: coordinates all hardening components
 */

import { promises as fs } from 'fs';
import crypto from 'crypto';
import {
  HardeningReport,
  HardenerConfig,
  SecurityFinding,
  PrioritizedFinding,
  ReportStatistics,
} from './types.js';
import { createConfigReader } from './ingestion/configReader.js';
import { createRiskScorer } from './scoring/riskScorer.js';
import { createPatchEngine } from './patching/patchEngine.js';
import { createValidator } from './validation/validator.js';
import { createRollbackManager } from './safety/rollbackManager.js';
import { createReportGenerator } from './reporting/reportGenerator.js';
import { createHistoryManager } from './reporting/historyManager.js';
import { FindingGrouper, FindingGroup } from './deduplication/grouper.js';

export interface OrchestratorOptions {
  target: string;
  config?: HardenerConfig;
  dryRun?: boolean;
  apply?: boolean;
  enableRollback?: boolean;
  configPath?: string;
}

export class Orchestrator {
  async harden(options: OrchestratorOptions): Promise<HardeningReport> {
    const runId = crypto.randomBytes(8).toString('hex');
    const startTime = new Date();

    console.info(`\n🔍 Starting hardening run: ${runId}`);
    console.info(`   Target: ${options.target}`);

    try {
      // Step 1: Scan for findings
      console.info(`\n📋 Step 1: Scanning for security findings...`);
      const findings = await this.scanConfigs(options.target);
      console.info(`   ✓ Found ${findings.length} raw issues`);

      // Step 1.5: Deduplicate and group findings
      console.info(`\n🔀 Step 1.5: Deduplicating and grouping findings...`);
      const grouper = new FindingGrouper();
      const groupingResult = grouper.groupFindings(findings);
      console.info(`   ✓ Unique findings: ${groupingResult.uniqueFindings.length}`);
      console.info(`   ✓ Duplicates: ${groupingResult.duplicateCount}`);
      console.info(`   ✓ Noise reduction: ${groupingResult.noiseReductionPercent}%`);

      // Step 2: Score findings
      console.info(`\n🎯 Step 2: Scoring and prioritizing findings...`);
      const prioritizedPlan = this.scoreFindings(groupingResult.uniqueFindings);
      console.info(
        `   ✓ Top risk: ${prioritizedPlan[0]?.riskScore.overall || 0}/100`
      );

      // Step 3: Generate patches
      console.info(`\n🔧 Step 3: Generating minimal-change patches...`);
      const patches = await this.generatePatches(
        groupingResult.uniqueFindings,
        options.target
      );
      console.info(`   ✓ Generated ${patches.length} patches`);

      // Step 4: Validate patches (dry-run)
      console.info(`\n✅ Step 4: Validating patches...`);
      const validationResults = await this.validatePatches(patches);
      const validationPassRate =
        validationResults.filter((r) => r.passed).length /
        validationResults.length;
      console.info(`   ✓ Validation pass rate: ${(validationPassRate * 100).toFixed(1)}%`);

      // Step 5: Apply patches if requested
      let rollbackResults: Array<any> = [];

      if (options.apply && !options.dryRun) {
        console.info(`\n💾 Step 5: Applying patches...`);

        let snapshotId = '';
        if (options.enableRollback) {
          console.info(`   📦 Creating snapshot for rollback...`);
          const rollbackManager = createRollbackManager();
          snapshotId = await rollbackManager.createSnapshot(patches);
          console.info(`   ✓ Snapshot ID: ${snapshotId}`);
        }

        await this.applyPatches(patches);
        console.info(`   ✓ Applied ${patches.length} patches`);

        // Step 6: Rollback on failure (if enabled and validation failed)
        if (
          options.enableRollback &&
          validationPassRate < 1.0 &&
          snapshotId
        ) {
          console.warn(`\n⚠️  Step 6: Rollback triggered due to validation failure...`);
          const rollbackManager = createRollbackManager();
          rollbackResults = await rollbackManager.rollback(snapshotId);
          console.info(`   ✓ Rolled back ${rollbackResults.length} changes`);
        }
      } else {
        console.info(`\n💾 Step 5: Dry-run mode (no changes applied)`);
      }

      // Step 7: Generate reports
      console.info(`\n📄 Step 7: Generating reports...`);
      const report: HardeningReport = {
        runId,
        timestamp: startTime,
        target: options.target,
        findings,
          groupedFindings: groupingResult.groups,
        prioritizedPlan,
        patches,
        validationResults,
        rollbackResults,
        statistics: this.computeStatistics(
                    groupingResult,
          findings,
          patches,
          validationResults,
          rollbackResults
        ),
      };

      const reportGenerator = createReportGenerator();
      const { jsonPath, markdownPath } =
        await reportGenerator.generateReport(
          report,
          options.config?.reporting.outputDir || '.hardener/reports'
        );

      const historyManager = createHistoryManager();
      await historyManager.recordRun({
        runId,
        timestamp: startTime.toISOString(),
        target: options.target,
        jsonReportPath: jsonPath,
        markdownReportPath: markdownPath,
        statistics: report.statistics,
      });

      console.info(`   ✓ JSON report: ${jsonPath}`);
      console.info(`   ✓ Markdown report: ${markdownPath}`);

      console.info(`\n✨ Hardening complete!`);
      console.info(`   Duration: ${Date.now() - startTime.getTime()}ms`);
      console.info(`   Run ID: ${runId}`);

      return report;
    } catch (error) {
      console.error('❌ Hardening failed:', error);
      throw error;
    }
  }

  private async scanConfigs(target: string): Promise<SecurityFinding[]> {
    const configReader = createConfigReader();
    return configReader.scanDirectory(target);
  }

  private scoreFindings(findings: SecurityFinding[]): PrioritizedFinding[] {
    const scorer = createRiskScorer();

    const prioritized = findings.map((finding) => ({
      ...finding,
      riskScore: scorer.scoreFind(finding),
      status: 'pending' as const,
    }));

    // Sort by risk score descending
    prioritized.sort((a, b) => b.riskScore.overall - a.riskScore.overall);

    return prioritized;
  }

  private async generatePatches(
    findings: SecurityFinding[],
    target: string
  ): Promise<Array<any>> {
    const engine = createPatchEngine();
    return engine.generatePatches(findings, target);
  }

  private async validatePatches(patches: Array<any>): Promise<Array<any>> {
    const validator = createValidator();

    const results = await Promise.all(
      patches.map((patch) => validator.validatePatch(patch))
    );

    return results;
  }

  private async applyPatches(patches: Array<any>): Promise<boolean> {
    for (const patch of patches) {
      try {
        await fs.writeFile(patch.resource, patch.after);
        patch.applied = true;
        patch.appliedAt = new Date();
      } catch (error) {
        console.warn(`Failed to apply patch ${patch.id}:`, error);
        return false;
      }
    }
    return true;
  }

  private computeStatistics(
      groupingResult: { uniqueFindings: SecurityFinding[]; duplicateCount: number; noiseReductionPercent: number; groups: FindingGroup[] },
    findings: SecurityFinding[],
    patches: Array<any>,
    validationResults: Array<any>,
    rollbackResults: Array<any>
  ): ReportStatistics {
    const byCategory: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};

    for (const finding of groupingResult.uniqueFindings) {
      byCategory[finding.category] = (byCategory[finding.category] || 0) + 1;
      bySeverity[finding.severity] =
        (bySeverity[finding.severity] || 0) + 1;
    }

    const criticalCount = bySeverity.critical || 0;
    const highCount = bySeverity.high || 0;
    const mediumCount = bySeverity.medium || 0;
    const lowCount = bySeverity.low || 0;

    const validationPassRate =
      validationResults.length > 0
        ? validationResults.filter((r) => r.passed).length /
          validationResults.length
        : 1.0;

    const rollbackSuccessRate =
      rollbackResults.length > 0
        ? rollbackResults.filter((r) => r.success).length /
          rollbackResults.length
        : 1.0;

    return {
      totalFindings: findings.length,
        uniqueFindings: groupingResult.uniqueFindings.length,
        duplicateFindings: groupingResult.duplicateCount,
      byCategory,
      bySeverity,
      criticalCount,
      highCount,
      mediumCount,
      lowCount,
      patchedCount: patches.filter((p) => p.applied).length,
      validationPassRate,
      rollbackSuccessRate,
      noiseReductionPercent: groupingResult.noiseReductionPercent,
      groupCount: groupingResult.groups.length,
    };
  }
}

export function createOrchestrator(): Orchestrator {
  return new Orchestrator();
}
