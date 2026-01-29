/**
 * History manager for tracking runs and rollbacks
 */

import { promises as fs } from 'fs';
import path from 'path';
import { ReportStatistics } from '../types.js';

export interface RunHistoryEntry {
  runId: string;
  timestamp: string;
  target: string;
  jsonReportPath: string;
  markdownReportPath: string;
  statistics: ReportStatistics;
}

export interface HistoryFile {
  runs?: RunHistoryEntry[];
  rollbacks?: Array<Record<string, unknown>>;
}

export class HistoryManager {
  private historyFile: string;

  constructor(baseDir: string = '.hardener') {
    this.historyFile = path.join(baseDir, 'history.json');
  }

  async recordRun(entry: RunHistoryEntry): Promise<void> {
    const history = await this.loadHistory();
    if (!history.runs) history.runs = [];
    history.runs.push(entry);
    await this.saveHistory(history);
  }

  async loadHistory(): Promise<HistoryFile> {
    try {
      const data = await fs.readFile(this.historyFile, 'utf-8');
      return JSON.parse(data) as HistoryFile;
    } catch {
      return {};
    }
  }

  private async saveHistory(history: HistoryFile): Promise<void> {
    await fs.mkdir(path.dirname(this.historyFile), { recursive: true });
    await fs.writeFile(this.historyFile, JSON.stringify(history, null, 2));
  }
}

export function createHistoryManager(baseDir?: string): HistoryManager {
  return new HistoryManager(baseDir);
}
