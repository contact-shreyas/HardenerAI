#!/usr/bin/env node
/**
 * Utility to inspect and display fixture configurations
 */

import path from 'path';
import { createConfigReader } from '../ingestion/configReader.js';
import { createRiskScorer } from '../scoring/riskScorer.js';

async function inspectFixtures(): Promise<void> {
  console.log('\n=== Fixture Analysis ===\n');

  const reader = createConfigReader();
  const scorer = createRiskScorer();
  const fixtureDir = path.join(process.cwd(), 'fixtures');

  try {
    // Scan all fixtures
    const findings = await reader.scanDirectory(fixtureDir);

    console.log(`Found ${findings.length} security findings in fixtures:\n`);

    // Group by file
    const byFile: Record<string, typeof findings> = {};
    for (const finding of findings) {
      if (!byFile[finding.resource]) {
        byFile[finding.resource] = [];
      }
      byFile[finding.resource].push(finding);
    }

    // Display findings
    for (const [file, fileFinding] of Object.entries(byFile)) {
      console.log(`📄 ${path.basename(file)}`);
      console.log(`   Path: ${file}`);
      console.log(`   Issues: ${fileFinding.length}\n`);

      for (const f of fileFinding) {
        const score = scorer.scoreFind(f);
        const riskLevel =
          score.overall > 80
            ? '🔴 CRITICAL'
            : score.overall > 60
              ? '🟠 HIGH'
              : score.overall > 40
                ? '🟡 MEDIUM'
                : '🟢 LOW';

        console.log(`   ${riskLevel} (${score.overall}/100) ${f.title}`);
        console.log(`      Severity: ${f.severity}`);
        console.log(`      Evidence: ${f.evidence.substring(0, 60)}`);
        console.log(`      Recommendation: ${f.recommendation.substring(0, 60)}`);
        console.log(`      Reasoning: ${score.reasoning}\n`);
      }
    }

    // Summary stats
    const bySeverity: Record<string, number> = {};
    const riskScores = findings.map((f) => scorer.scoreFind(f).overall);

    for (const finding of findings) {
      bySeverity[finding.severity] = (bySeverity[finding.severity] || 0) + 1;
    }

    console.log('\n=== Summary Statistics ===\n');
    console.log(`Total Findings: ${findings.length}`);
    console.log(`Average Risk Score: ${(riskScores.reduce((a, b) => a + b, 0) / riskScores.length).toFixed(1)}/100`);
    console.log(`Max Risk Score: ${Math.max(...riskScores)}/100`);
    console.log(`Min Risk Score: ${Math.min(...riskScores)}/100`);

    console.log('\nBy Severity:');
    for (const [severity, count] of Object.entries(bySeverity)) {
      console.log(`  ${severity}: ${count}`);
    }

    console.log(
      '\n💡 Tip: Run `pnpm harden --target ./fixtures` to see full report\n'
    );
  } catch (error) {
    console.error('Error analyzing fixtures:', error);
    process.exit(1);
  }
}

inspectFixtures().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
