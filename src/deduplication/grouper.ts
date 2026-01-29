/**
 * Finding deduplication and grouping for noise reduction
 */

import { SecurityFinding } from '../types.js';

export interface FindingGroup {
  id: string;
  title: string;
  category: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  count: number;
  findings: SecurityFinding[];
  representativeFinding: SecurityFinding; // The primary finding for this group
}

export interface GroupingResult {
  groups: FindingGroup[];
  uniqueFindings: SecurityFinding[];
  duplicateCount: number;
  noiseReductionPercent: number;
}

export class FindingGrouper {
  /**
   * Group similar findings to reduce noise
   */
  groupFindings(findings: SecurityFinding[]): GroupingResult {
    const groups: Map<string, FindingGroup> = new Map();
    const uniqueFindings: SecurityFinding[] = [];

    for (const finding of findings) {
      const groupKey = this.generateGroupKey(finding);
      
      if (groups.has(groupKey)) {
        // Add to existing group
        const group = groups.get(groupKey)!;
        group.findings.push(finding);
        group.count++;
      } else {
        // Create new group
        const groupId = `group-${groupKey}`;
        groups.set(groupKey, {
          id: groupId,
          title: finding.title,
          category: finding.category,
          severity: finding.severity,
          count: 1,
          findings: [finding],
          representativeFinding: finding,
        });
        uniqueFindings.push(finding);
      }
    }

    const groupsArray = Array.from(groups.values());
    const duplicateCount = findings.length - uniqueFindings.length;
    const noiseReductionPercent = findings.length > 0
      ? Math.round((duplicateCount / findings.length) * 100)
      : 0;

    return {
      groups: groupsArray,
      uniqueFindings,
      duplicateCount,
      noiseReductionPercent,
    };
  }

  /**
   * Generate a unique key for grouping similar findings
   */
  private generateGroupKey(finding: SecurityFinding): string {
    // Group by: tool + category + title + severity
    // This groups identical issues across different locations
    const parts = [
      finding.tool,
      finding.category,
      finding.title.toLowerCase().trim(),
      finding.severity,
    ];

    return parts.join('::');
  }

  /**
   * Filter low-confidence findings for noise reduction
   */
  filterLowConfidence(
    findings: SecurityFinding[],
    threshold: number = 0.5
  ): SecurityFinding[] {
    return findings.filter((f) => f.confidence >= threshold);
  }

  /**
   * Suppress findings below a risk score threshold
   */
  suppressBelowThreshold(
    findings: Array<SecurityFinding & { riskScore?: number }>,
    threshold: number
  ): Array<SecurityFinding & { riskScore?: number }> {
    return findings.filter((f) => {
      if (!f.riskScore) return true; // Keep if not scored yet
      return f.riskScore >= threshold;
    });
  }
}
