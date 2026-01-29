"use client";

import Link from 'next/link';
import { useMemo, useState } from 'react';

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

interface RunsTableProps {
  runs: RunEntry[];
}

const formatTimestamp = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  // Deterministic ISO format - no hydration mismatch
  return date.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, ' UTC');
};

const formatTarget = (target: string) => {
  if (!target) return '-';
  const normalized = target.replace(/\\/g, '/');
  if (normalized.startsWith('./') || normalized.startsWith('.\\')) return normalized;

  const parts = normalized.split('/').filter(Boolean);
  if (parts.length <= 3) return normalized;
  return `…/${parts.slice(-3).join('/')}`;
};

export default function RunsTable({ runs }: RunsTableProps) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('newest');

  const filtered = useMemo(() => {
    const filteredRuns = runs.filter((run) => {
      const haystack = `${run.runId} ${run.target}`.toLowerCase();
      return haystack.includes(query.toLowerCase());
    });

    const sorted = filteredRuns.slice().sort((a, b) => {
      if (sort === 'oldest') {
        return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
      }
      if (sort === 'critical') {
        return (b.statistics?.criticalCount || 0) - (a.statistics?.criticalCount || 0);
      }
      if (sort === 'high') {
        return (b.statistics?.highCount || 0) - (a.statistics?.highCount || 0);
      }
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });

    return sorted;
  }, [runs, query, sort]);

  if (runs.length === 0) {
    return (
      <div className="card">
        <h2>Runs</h2>
        <p className="muted">No runs found. Execute a hardening run to populate the dashboard.</p>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-header">
        <h2>Runs</h2>
        <div className="toolbar">
          <input
            className="input"
            placeholder="Search by run ID or target..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <select className="input" value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="critical">Most critical</option>
            <option value="high">Most high</option>
          </select>
        </div>
      </div>

      <table className="table">
        <thead>
          <tr>
            <th>Run</th>
            <th>When</th>
            <th>Target</th>
            <th>Total</th>
            <th>Unique</th>
            <th>Duplicates</th>
            <th>Noise Reduction</th>
            <th>Critical</th>
            <th>High</th>
            <th>Links</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((run) => (
            <tr key={run.runId}>
              <td>
                <div className="stack">
                  <span className="mono">{run.runId}</span>
                  <Link className="button secondary" href={`/runs/${run.runId}`}>
                    View run
                  </Link>
                </div>
              </td>
              <td>{formatTimestamp(run.timestamp)}</td>
              <td title={run.target} className="muted">
                {formatTarget(run.target)}
              </td>
              <td>{run.statistics?.totalFindings ?? '—'}</td>
              <td>{run.statistics?.uniqueFindings ?? '—'}</td>
              <td>{run.statistics?.duplicateFindings ?? '—'}</td>
              <td>{run.statistics?.noiseReductionPercent?.toFixed?.(1) ?? '—'}%</td>
              <td>
                <span className="pill critical">{run.statistics?.criticalCount ?? '—'}</span>
              </td>
              <td>
                <span className="pill high">{run.statistics?.highCount ?? '—'}</span>
              </td>
              <td>
                <div className="stack">
                  <Link className="link" href={`/api/run/${run.runId}`}>
                    API JSON
                  </Link>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
