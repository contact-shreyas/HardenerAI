import { NextResponse } from 'next/server';
import path from 'path';
import { promises as fs } from 'fs';
import { getWorkspaceRoot, readJsonSafe, isUiApplyEnabled } from '../_utils';

interface HistoryRun {
  runId: string;
  timestamp: string;
  target: string;
  jsonReportPath: string;
  markdownReportPath: string;
  statistics: Record<string, unknown>;
}

interface HistoryFile {
  runs?: HistoryRun[];
}

export async function GET() {
  try {
    const workspaceRoot = getWorkspaceRoot();
    const historyPath = path.join(workspaceRoot, '.hardener', 'history.json');
    const history = (await readJsonSafe<HistoryFile>(historyPath)) || {};

    const runs = (history.runs || []).slice().sort((a, b) => {
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });

    // If no history, fall back to reading report filenames
    if (runs.length === 0) {
      const reportsDir = path.join(workspaceRoot, '.hardener', 'reports');
      const files = await fs.readdir(reportsDir).catch(() => [] as string[]);
      const jsonFiles = files.filter((f) => f.endsWith('.json'));
      const fallbackRuns = jsonFiles.map((f) => ({
        runId: f.replace('report-', '').replace('.json', ''),
        timestamp: f.replace('report-', '').replace('.json', '').replace(/-/g, ':'),
        target: workspaceRoot,
        jsonReportPath: path.join('.hardener', 'reports', f),
        markdownReportPath: path.join('.hardener', 'reports', f.replace('.json', '.md')),
        statistics: {},
      }));
      return NextResponse.json({ runs: fallbackRuns, uiApplyEnabled: isUiApplyEnabled() });
    }

    return NextResponse.json({ runs, uiApplyEnabled: isUiApplyEnabled() });
  } catch (error) {
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}
