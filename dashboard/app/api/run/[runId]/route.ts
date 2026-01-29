import { NextResponse } from 'next/server';
import path from 'path';
import { getWorkspaceRoot, readJsonSafe, safeResolve } from '../../_utils';

export async function GET(
  _request: Request,
  { params }: { params: { runId: string } }
) {
  try {
    const workspaceRoot = getWorkspaceRoot();
    const runId = params.runId;

    // Attempt to read from history to get exact report path
    const historyPath = path.join(workspaceRoot, '.hardener', 'history.json');
    const history = (await readJsonSafe<{ runs?: Array<any> }>(historyPath)) || {};
    const match = history.runs?.find((r) => r.runId === runId);

    let reportPath: string;
    if (match?.jsonReportPath) {
      reportPath = safeResolve(workspaceRoot, match.jsonReportPath);
    } else {
      reportPath = path.join(workspaceRoot, '.hardener', 'reports', `report-${runId}.json`);
    }

    const report = await readJsonSafe<Record<string, unknown>>(reportPath);
    if (!report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    return NextResponse.json({ report });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
