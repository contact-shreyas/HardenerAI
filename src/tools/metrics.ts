/**
 * Metrics script for evaluating hardening effectiveness
 */

import { promises as fs } from 'fs';
import path from 'path';

interface ReportStats {
  totalFindings: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  noiseReductionPercent?: number;
  validationPassRate?: number;
  rollbackSuccessRate?: number;
}

interface HardeningReport {
  runId: string;
  timestamp: string;
  statistics: ReportStats;
}

async function getLatestReports(dir: string): Promise<string[]> {
  const files = await fs.readdir(dir);
  const reports = files
    .filter((f) => f.endsWith('.json'))
    .map((f) => path.join(dir, f))
    .sort();
  return reports.slice(-2);
}

function calcReduction(before: number, after: number): string {
  if (before === 0) return '0.0%';
  const reduction = ((before - after) / before) * 100;
  return `${reduction.toFixed(1)}%`;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const reportsDir = path.join('.hardener', 'reports');

  let beforePath = args[0];
  let afterPath = args[1];

  if (!beforePath || !afterPath) {
    const latest = await getLatestReports(reportsDir);
    if (latest.length < 2) {
      console.error('Not enough reports to compare. Run hardener twice.');
      process.exit(1);
    }
    [beforePath, afterPath] = latest;
  }

  const before = JSON.parse(await fs.readFile(beforePath, 'utf-8')) as HardeningReport;
  const after = JSON.parse(await fs.readFile(afterPath, 'utf-8')) as HardeningReport;

  console.log('=== Hardening Metrics ===');
  console.log(`Before: ${before.runId}`);
  console.log(`After:  ${after.runId}`);
  console.log('');
  console.log(`Critical reduction: ${calcReduction(before.statistics.criticalCount, after.statistics.criticalCount)}`);
  console.log(`High reduction:     ${calcReduction(before.statistics.highCount, after.statistics.highCount)}`);
  console.log(`Total reduction:    ${calcReduction(before.statistics.totalFindings, after.statistics.totalFindings)}`);
  console.log(`Noise reduction:    ${after.statistics.noiseReductionPercent ?? 0}%`);
  console.log(`Validation pass:    ${((after.statistics.validationPassRate || 0) * 100).toFixed(1)}%`);
  console.log(`Rollback success:   ${((after.statistics.rollbackSuccessRate || 0) * 100).toFixed(1)}%`);
}

main().catch((error) => {
  console.error('Metrics error:', error);
  process.exit(1);
});
