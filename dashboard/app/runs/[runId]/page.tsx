import Link from 'next/link';
import path from 'path';
import { promises as fs } from 'fs';
import FindingsTable from '../../components/FindingsTable';
import PatchList from '../../components/PatchList';

interface ReportData {
  runId: string;
  timestamp: string;
  target: string;
  statistics: Record<string, any>;
  prioritizedPlan: Array<any>;
  findings: Array<any>;
  groupedFindings: Array<any>;
  patches: Array<any>;
}

async function getReport(runId: string): Promise<ReportData | null> {
  try {
    // Server-side: directly read files instead of HTTP fetch
    const workspaceRoot = path.resolve(process.cwd(), '..');
    const reportsDir = path.join(workspaceRoot, '.hardener', 'reports');
    
    // Try to find the report file
    const files = await fs.readdir(reportsDir);
    const reportFile = files.find(f => f.includes(runId) && f.endsWith('.json'));
    
    if (!reportFile) return null;
    
    const reportPath = path.join(reportsDir, reportFile);
    const reportContent = await fs.readFile(reportPath, 'utf-8');
    return JSON.parse(reportContent) as ReportData;
  } catch (error) {
    console.error('Failed to load report:', error);
    return null;
  }
}

const formatTimestamp = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
};

const formatTarget = (target: string) => {
  if (!target) return '-';
  const normalized = target.replace(/\\/g, '/');
  if (normalized.startsWith('./') || normalized.startsWith('.\\')) return normalized;
  const parts = normalized.split('/').filter(Boolean);
  if (parts.length <= 3) return normalized;
  return `…/${parts.slice(-3).join('/')}`;
};

export default async function RunDetailPage({
  params,
}: {
  params: { runId: string };
}) {
  const report = await getReport(params.runId);

  if (!report) {
    return (
      <div className="card">
        <p>Report not found.</p>
        <Link href="/">Back to runs</Link>
      </div>
    );
  }

  const findings = report.prioritizedPlan.map((f) => ({
    id: f.id,
    title: f.title,
    severity: f.severity,
    category: f.category,
    tool: f.tool,
    file: f.file,
    recommendation: f.recommendation,
    riskScore: f.riskScore?.overall,
    groupId: f.groupId,
  }));

  return (
    <>
      <header>
        <div>
          <h1>Run {report.runId}</h1>
          <p className="muted">
            {formatTimestamp(report.timestamp)} |{' '}
            <span title={report.target}>{formatTarget(report.target)}</span>
          </p>
        </div>
        <Link className="button" href="/">
          Back to runs
        </Link>
      </header>

      <div className="grid">
        <div className="card">
          <h3>Total Findings</h3>
          <p>{report.statistics?.totalFindings ?? '-'}</p>
        </div>
        <div className="card">
          <h3>Unique Findings</h3>
          <p>{report.statistics?.uniqueFindings ?? '-'}</p>
        </div>
        <div className="card">
          <h3>Noise Reduction</h3>
          <p>{report.statistics?.noiseReductionPercent?.toFixed?.(1) ?? '-'}%</p>
        </div>
        <div className="card">
          <h3>Critical</h3>
          <p>{report.statistics?.criticalCount ?? '-'}</p>
        </div>
      </div>

      <h2>Findings</h2>
      <FindingsTable findings={findings} />

      <h2>Grouped Duplicates</h2>
      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Group</th>
              <th>Category</th>
              <th>Severity</th>
              <th>Count</th>
            </tr>
          </thead>
          <tbody>
            {report.groupedFindings
              .slice()
              .sort((a, b) => b.count - a.count)
              .slice(0, 20)
              .map((g) => (
                <tr key={g.id}>
                  <td>{g.title}</td>
                  <td>{g.category}</td>
                  <td>
                    <span className={`badge ${g.severity}`}>{g.severity}</span>
                  </td>
                  <td>{g.count}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <h2>Patches</h2>
      <PatchList patches={report.patches} target={report.target} />
    </>
  );
}
