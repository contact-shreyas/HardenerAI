import { describe, it, expect } from 'vitest';
import { FindingGrouper } from '../../src/deduplication/grouper';
import { SecurityFinding } from '../../src/types';

describe('FindingGrouper', () => {
  const grouper = new FindingGrouper();

  it('groups duplicate findings by tool/category/title/severity', () => {
    const findings: SecurityFinding[] = [
      {
        id: '1',
        tool: 'config-reader',
        resource: 'a.conf',
        title: 'Server tokens exposed',
        description: 'server_tokens on',
        severity: 'high',
        evidence: 'server_tokens on;',
        recommendation: 'Disable server tokens',
        confidence: 0.9,
        category: 'nginx-config',
      },
      {
        id: '2',
        tool: 'config-reader',
        resource: 'b.conf',
        title: 'Server tokens exposed',
        description: 'server_tokens on',
        severity: 'high',
        evidence: 'server_tokens on;',
        recommendation: 'Disable server tokens',
        confidence: 0.9,
        category: 'nginx-config',
      },
    ];

    const result = grouper.groupFindings(findings);
    expect(result.uniqueFindings.length).toBe(1);
    expect(result.duplicateCount).toBe(1);
    expect(result.noiseReductionPercent).toBe(50);
    expect(result.groups[0].count).toBe(2);
  });
});
