import path from 'path';
import { promises as fs } from 'fs';
import RunsTable from './components/RunsTable';
import { isUiApplyEnabled } from './api/_utils';

interface RunEntry {
  runId: string;
  timestamp: string;
  target: string;
  statistics?: {
    totalFindings?: number;
    uniqueFindings?: number;
    duplicateFindings?: number;
    noiseReductionPercent?: number;
    criticalCount?: number;
    highCount?: number;
  };
}

async function getRuns(): Promise<RunEntry[]> {
  try {
    // Server-side: directly read files instead of HTTP fetch
    const workspaceRoot = path.resolve(process.cwd(), '..');
    const historyPath = path.join(workspaceRoot, '.hardener', 'history.json');
    
    try {
      const historyContent = await fs.readFile(historyPath, 'utf-8');
      const history = JSON.parse(historyContent);
      const runs = (history.runs || []).slice().sort((a: RunEntry, b: RunEntry) => {
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      });
      
      if (runs.length > 0) return runs;
    } catch {
      // History file doesn't exist, fall back to reading reports
    }
    
    // Fallback: read report files directly
    const reportsDir = path.join(workspaceRoot, '.hardener', 'reports');
    const files = await fs.readdir(reportsDir).catch(() => [] as string[]);
    const jsonFiles = files.filter((f) => f.endsWith('.json')).sort().reverse();
    
    const runs: RunEntry[] = [];
    for (const file of jsonFiles.slice(0, 20)) { // Limit to 20 most recent
      try {
        const reportPath = path.join(reportsDir, file);
        const reportContent = await fs.readFile(reportPath, 'utf-8');
        const report = JSON.parse(reportContent);
        
        runs.push({
          runId: report.runId || file.replace('report-', '').replace('.json', ''),
          timestamp: report.timestamp || file.replace('report-', '').replace('.json', ''),
          target: report.target || workspaceRoot,
          statistics: report.statistics,
        });
      } catch {
        // Skip invalid files
      }
    }
    
    return runs;
  } catch (error) {
    console.error('Failed to load runs:', error);
    return [];
  }
}

export default async function HomePage() {
  const runs = await getRuns();
  const latest = runs[0];
  const stats = latest?.statistics;
  const uiApplyEnabled = isUiApplyEnabled();

  return (
    <>
      <header>
        <div>
          <h1>Hardener Dashboard</h1>
          <p className="muted">Explore runs, findings, patches, and validation results.</p>
        </div>
        <a className="button" href="/api/runs">API: runs</a>
      </header>

      {!uiApplyEnabled ? (
        <div className="banner">
          <div>
            <strong>UI Apply is disabled.</strong>
            <span className="muted"> Enable it by setting <code>HARDENER_UI_APPLY=1</code> in <code>dashboard/.env.local</code> and restarting.</span>
          </div>
          <a className="link" href="/api/runs">View API output</a>
        </div>
      ) : (
        <div className="banner success">
          <div>
            <strong>UI Apply is enabled (server-gated).</strong>
            <span className="muted"> Use carefully. Patches will be applied with rollback enabled.</span>
          </div>
        </div>
      )}

      <div className="grid">
        <div className="card stat">
          <div className="label">Latest run</div>
          <div className="value">{latest?.runId ?? '—'}</div>
          <div className="muted">{latest ? new Date(latest.timestamp).toLocaleString() : 'No runs yet'}</div>
        </div>
        <div className="card stat">
          <div className="label">Unique findings</div>
          <div className="value">{stats?.uniqueFindings ?? '—'}</div>
          <div className="muted">Total: {stats?.totalFindings ?? '—'}</div>
        </div>
        <div className="card stat">
          <div className="label">Noise reduction</div>
          <div className="value">{stats?.noiseReductionPercent?.toFixed?.(1) ?? '—'}%</div>
          <div className="muted">Duplicates: {stats?.duplicateFindings ?? '—'}</div>
        </div>
        <div className="card stat">
          <div className="label">Critical / High</div>
          <div className="value">{stats?.criticalCount ?? '—'} / {stats?.highCount ?? '—'}</div>
          <div className="muted">Prioritize remediation first</div>
        </div>
      </div>

      <RunsTable runs={runs} />
    </>
  );
}
