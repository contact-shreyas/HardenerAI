/**
 * Snapshot and rollback manager
 */

import { promises as fs } from 'fs';
import path from 'path';
import { SecurityPatch, RollbackResult } from '../types.js';
import crypto from 'crypto';

export interface Snapshot {
  id: string;
  timestamp: Date;
  patches: Array<{
    patchId: string;
    resource: string;
    originalContent: string;
  }>;
}

export class RollbackManager {
  private snapshotDir: string;
  private historyFile: string;

  constructor(baseDir: string = '.hardener') {
    this.snapshotDir = path.join(baseDir, 'snapshots');
    this.historyFile = path.join(baseDir, 'history.json');
  }

  /**
   * Create a snapshot before applying patches
   */
  async createSnapshot(patches: SecurityPatch[]): Promise<string> {
    const snapshotId = crypto.randomBytes(8).toString('hex');
    const snapshotPath = path.join(this.snapshotDir, snapshotId);

    await fs.mkdir(snapshotPath, { recursive: true });

    const snapshot: Snapshot = {
      id: snapshotId,
      timestamp: new Date(),
      patches: [],
    };

    for (const patch of patches) {
      try {
        const originalContent = await fs.readFile(patch.resource, 'utf-8');
        snapshot.patches.push({
          patchId: patch.id,
          resource: patch.resource,
          originalContent,
        });
      } catch (error) {
        console.warn(`Could not snapshot ${patch.resource}:`, error);
      }
    }

    const snapshotFile = path.join(snapshotPath, 'snapshot.json');
    await fs.writeFile(snapshotFile, JSON.stringify(snapshot, null, 2));

    return snapshotId;
  }

  /**
   * Rollback to a specific snapshot
   */
  async rollback(snapshotId: string): Promise<RollbackResult[]> {
    const results: RollbackResult[] = [];
    const snapshotFile = path.join(
      this.snapshotDir,
      snapshotId,
      'snapshot.json'
    );

    try {
      const snapshotData = await fs.readFile(snapshotFile, 'utf-8');
      const snapshot: Snapshot = JSON.parse(snapshotData);

      for (const item of snapshot.patches) {
        try {
          await fs.writeFile(item.resource, item.originalContent);

          results.push({
            patchId: item.patchId,
            success: true,
            message: `Rolled back ${item.resource}`,
            timestamp: new Date(),
          });
        } catch (error) {
          results.push({
            patchId: item.patchId,
            success: false,
            message: `Failed to rollback ${item.resource}: ${String(error)}`,
            timestamp: new Date(),
          });
        }
      }

      // Update history
      await this.recordRollback(snapshotId, results);
    } catch (error) {
      console.error(`Failed to load snapshot ${snapshotId}:`, error);
      results.push({
        patchId: 'unknown',
        success: false,
        message: `Failed to load snapshot: ${String(error)}`,
        timestamp: new Date(),
      });
    }

    return results;
  }

  /**
   * Record rollback result in history
   */
  async recordRollback(
    snapshotId: string,
    results: RollbackResult[]
  ): Promise<void> {
    try {
      let history: Record<string, unknown> = {};

      try {
        const historyData = await fs.readFile(this.historyFile, 'utf-8');
        history = JSON.parse(historyData);
      } catch {
        // File doesn't exist yet
      }

      const successRate =
        results.filter((r) => r.success).length / results.length;

      if (!history.rollbacks) {
        history.rollbacks = [];
      }

      if (typeof history.rollbacks === 'object' && !Array.isArray(history.rollbacks)) {
        history.rollbacks = [];
      }

      (history.rollbacks as Array<Record<string, unknown>>).push({
        snapshotId,
        timestamp: new Date(),
        successRate,
        details: results,
      });

      await fs.mkdir(path.dirname(this.historyFile), { recursive: true });
      await fs.writeFile(
        this.historyFile,
        JSON.stringify(history, null, 2)
      );
    } catch (error) {
      console.warn('Could not record rollback in history:', error);
    }
  }

  /**
   * Get rollback success statistics
   */
  async getRollbackStats(): Promise<{ successRate: number; totalRollbacks: number }> {
    try {
      const historyData = await fs.readFile(this.historyFile, 'utf-8');
      const history = JSON.parse(historyData) as {
        rollbacks?: Array<{ successRate: number }>;
      };

      const rollbacks = history.rollbacks || [];
      if (rollbacks.length === 0) {
        return { successRate: 1.0, totalRollbacks: 0 };
      }

      const avgSuccessRate =
        rollbacks.reduce((sum, r) => sum + r.successRate, 0) /
        rollbacks.length;

      return { successRate: avgSuccessRate, totalRollbacks: rollbacks.length };
    } catch {
      return { successRate: 1.0, totalRollbacks: 0 };
    }
  }
}

export function createRollbackManager(
  baseDir?: string
): RollbackManager {
  return new RollbackManager(baseDir);
}
