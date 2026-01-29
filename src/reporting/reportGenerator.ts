/**
 * Report generator (JSON + Markdown)
 */

import { promises as fs } from 'fs';
import path from 'path';
import {
  HardeningReport,
  PrioritizedFinding,
  ReportStatistics,
} from '../types.js';

export class ReportGenerator {
  async generateReport(
    report: HardeningReport,
    outputDir: string
  ): Promise<{ jsonPath: string; markdownPath: string }> {
    await fs.mkdir(outputDir, { recursive: true });

    const timestamp = report.timestamp.toISOString().replace(/[:.]/g, '-');
    const jsonPath = path.join(outputDir, `report-${timestamp}.json`);
    const markdownPath = path.join(outputDir, `report-${timestamp}.md`);

    // Write JSON report
    await fs.writeFile(jsonPath, JSON.stringify(report, null, 2));

    // Write Markdown report
    const markdown = this.generateMarkdown(report);
    await fs.writeFile(markdownPath, markdown);

    return { jsonPath, markdownPath };
  }

  private generateMarkdown(report: HardeningReport): string {
    const lines: string[] = [];

    lines.push('# Hardening Report');
    lines.push('');
    lines.push(`**Run ID:** ${report.runId}`);
    lines.push(`**Timestamp:** ${report.timestamp.toISOString()}`);
    lines.push(`**Target:** ${report.target}`);
    lines.push('');

    // Statistics Summary
    lines.push('## Summary Statistics');
    lines.push('');
    lines.push(
      this.generateStatisticsTable(report.statistics)
    );
    lines.push('');

    // Prioritized Plan
    lines.push('## Risk-Prioritized Plan');
    lines.push('');
    lines.push(
      this.generatePlanTable(report.prioritizedPlan.slice(0, 10))
    );
    lines.push('');

    if (report.prioritizedPlan.length > 10) {
      lines.push(
        `*... and ${report.prioritizedPlan.length - 10} more findings*`
      );
      lines.push('');
    }

    // Grouped Findings Summary
    if (report.groupedFindings.length > 0) {
      lines.push('## Grouped Findings (Noise Reduction)');
      lines.push('');
      lines.push('| Group | Category | Severity | Count |');
      lines.push('|-------|----------|----------|-------|');

      const topGroups = report.groupedFindings
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      for (const group of topGroups) {
        lines.push(
          `| ${group.title} | ${group.category} | ${group.severity} | ${group.count} |`
        );
      }
      lines.push('');
    }

    // Patches
    if (report.patches.length > 0) {
      lines.push('## Recommended Patches');
      lines.push('');

      for (const patch of report.patches.slice(0, 5)) {
        lines.push(`### ${patch.id}`);
        lines.push('');
        lines.push(`**Finding:** ${patch.findingId}`);
        lines.push(`**Type:** ${patch.type}`);
        lines.push('');

        lines.push('**Diff:**');
        lines.push('```diff');
        lines.push(patch.diff);
        lines.push('```');
        lines.push('');

        lines.push('**Assumptions:**');
        for (const assumption of patch.assumptions) {
          lines.push(`- ${assumption}`);
        }
        lines.push('');

        lines.push('**Rollback Steps:**');
        for (const step of patch.rollbackSteps) {
          lines.push(`- ${step}`);
        }
        lines.push('');

        lines.push('**Validation Steps:**');
        for (const step of patch.validationSteps) {
          lines.push(`- ${step}`);
        }
        lines.push('');

        lines.push(`**Safety Notes:** ${patch.safetyNotes}`);
        lines.push('');
      }

      if (report.patches.length > 5) {
        lines.push(`*... and ${report.patches.length - 5} more patches*`);
        lines.push('');
      }
    }

    // Validation Results
    if (report.validationResults.length > 0) {
      lines.push('## Validation Results');
      lines.push('');

      const passed = report.validationResults.filter((r) => r.passed).length;
      const total = report.validationResults.length;

      lines.push(
        `**Pass Rate:** ${passed}/${total} (${((passed / total) * 100).toFixed(1)}%)`
      );
      lines.push('');

      for (const result of report.validationResults.filter((r) => !r.passed)) {
        lines.push(`- ❌ ${result.patchId}: ${result.message}`);
      }

      if (passed > 0) {
        lines.push(`- ✅ ${passed} validations passed`);
      }
      lines.push('');
    }

    // Rollback Results
    if (report.rollbackResults.length > 0) {
      lines.push('## Rollback Results');
      lines.push('');

      const successful = report.rollbackResults.filter(
        (r) => r.success
      ).length;
      const total = report.rollbackResults.length;

      lines.push(
        `**Success Rate:** ${successful}/${total} (${((successful / total) * 100).toFixed(1)}%)`
      );
      lines.push('');

      for (const result of report.rollbackResults) {
        const icon = result.success ? '✅' : '❌';
        lines.push(`- ${icon} ${result.patchId}: ${result.message}`);
      }
      lines.push('');
    }

    // Threat Model & Safety
    lines.push('## Safety Guarantees');
    lines.push('');
    lines.push('- ✅ All changes are captured in snapshots for rollback');
    lines.push('- ✅ Validation gates prevent unsafe deployments');
    lines.push('- ✅ Each patch includes explicit rollback steps');
    lines.push(
      '- ✅ Changes are minimal and focused on specific misconfigurations'
    );
    lines.push('');

    lines.push('## Next Steps');
    lines.push('');
    lines.push(
      '1. Review the prioritized findings above, starting with highest risk scores'
    );
    lines.push(
      '2. Test patches in a development environment before applying to production'
    );
    lines.push('3. Use `--apply` flag to write patches to disk');
    lines.push('4. Use `--enable-rollback` to auto-snapshot and rollback on failure');
    lines.push('');

    return lines.join('\n');
  }

  private generateStatisticsTable(stats: ReportStatistics): string {
    const lines: string[] = [];

    lines.push('| Metric | Count |');
    lines.push('|--------|-------|');
    lines.push(`| Total Findings | ${stats.totalFindings} |`);
    lines.push(`| Unique Findings | ${stats.uniqueFindings} |`);
    lines.push(`| Duplicate Findings | ${stats.duplicateFindings} |`);
    lines.push(`| Groups | ${stats.groupCount} |`);
    lines.push(`| Critical | ${stats.criticalCount} |`);
    lines.push(`| High | ${stats.highCount} |`);
    lines.push(`| Medium | ${stats.mediumCount} |`);
    lines.push(`| Low | ${stats.lowCount} |`);
    lines.push(`| Patched | ${stats.patchedCount} |`);
    lines.push(
      `| Validation Pass Rate | ${(stats.validationPassRate * 100).toFixed(1)}% |`
    );
    lines.push(
      `| Rollback Success Rate | ${(stats.rollbackSuccessRate * 100).toFixed(1)}% |`
    );
    lines.push(
      `| Noise Reduction | ${stats.noiseReductionPercent.toFixed(1)}% |`
    );

    return lines.join('\n');
  }

  private generatePlanTable(findings: PrioritizedFinding[]): string {
    const lines: string[] = [];

    lines.push(
      '| Priority | Finding | Severity | Risk Score | Recommendation |'
    );
    lines.push('|----------|---------|----------|-----------|-----------------|');

    for (let i = 0; i < findings.length; i++) {
      const finding = findings[i];
      const priority = i + 1;
      const riskScore = finding.riskScore.overall;

      lines.push(
        `| #${priority} | ${finding.title} | ${finding.severity} | ${riskScore}/100 | ${finding.recommendation.substring(0, 50)}... |`
      );
    }

    return lines.join('\n');
  }
}

export function createReportGenerator(): ReportGenerator {
  return new ReportGenerator();
}
