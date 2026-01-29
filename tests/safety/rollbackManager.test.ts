import { describe, it, expect } from 'vitest';
import { createRollbackManager } from '../../src/safety/rollbackManager';
import { SecurityPatch } from '../../src/types';
import { promises as fs } from 'fs';
import path from 'path';

describe('RollbackManager', () => {
  const manager = createRollbackManager('.hardener-test');

  it('creates and manages snapshots', async () => {
    const patches: SecurityPatch[] = [
      {
        id: 'patch-1',
        findingId: 'find-1',
        resource: 'test-file.txt',
        type: 'nginx',
        before: 'original content',
        after: 'modified content',
        diff: '',
        assumptions: [],
        rollbackSteps: [],
        validationSteps: [],
        safetyNotes: 'test',
        applied: false,
      },
    ];

    // Create a test file
    const testDir = path.join('.hardener-test-tmp');
    await fs.mkdir(testDir, { recursive: true });
    const testFile = path.join(testDir, 'test-file.txt');
    await fs.writeFile(testFile, 'original content');

    // Update patch resource to test file
    patches[0].resource = testFile;

    const snapshotId = await manager.createSnapshot(patches);

    expect(snapshotId).toBeTruthy();
    expect(snapshotId.length).toBe(16); // hex format

    // Cleanup
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('retrieves rollback statistics', async () => {
    const stats = await manager.getRollbackStats();

    expect(stats.successRate).toBeGreaterThanOrEqual(0);
    expect(stats.successRate).toBeLessThanOrEqual(1.0);
    expect(stats.totalRollbacks).toBeGreaterThanOrEqual(0);
  });
});
