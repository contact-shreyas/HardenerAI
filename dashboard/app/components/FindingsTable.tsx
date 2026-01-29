"use client";

import { useMemo, useState } from 'react';

export interface FindingRow {
  id: string;
  title: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  category: string;
  tool: string;
  file?: string;
  recommendation: string;
  riskScore?: number;
  groupId?: string;
}

interface FindingsTableProps {
  findings: FindingRow[];
}

export default function FindingsTable({ findings }: FindingsTableProps) {
  const [query, setQuery] = useState('');
  const [severity, setSeverity] = useState('all');
  const [category, setCategory] = useState('all');

  const filtered = useMemo(() => {
    return findings.filter((f) => {
      const matchesQuery =
        f.title.toLowerCase().includes(query.toLowerCase()) ||
        (f.file || '').toLowerCase().includes(query.toLowerCase()) ||
        f.category.toLowerCase().includes(query.toLowerCase());
      const matchesSeverity = severity === 'all' || f.severity === severity;
      const matchesCategory = category === 'all' || f.category === category;
      return matchesQuery && matchesSeverity && matchesCategory;
    });
  }, [findings, query, severity, category]);

  return (
    <div className="card">
      <div className="grid" style={{ marginBottom: 12 }}>
        <input
          className="input"
          placeholder="Search title, file, category..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          className="input"
          value={severity}
          onChange={(e) => setSeverity(e.target.value)}
        >
          <option value="all">All Severities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
          <option value="info">Info</option>
        </select>
        <select
          className="input"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="all">All Categories</option>
          {Array.from(new Set(findings.map((f) => f.category))).map((c) => (
            <option value={c} key={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <table className="table">
        <thead>
          <tr>
            <th>Severity</th>
            <th>Finding</th>
            <th>Category</th>
            <th>Tool</th>
            <th>Risk Score</th>
            <th>File</th>
            <th>Recommendation</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((f) => (
            <tr key={f.id}>
              <td>
                <span className={`badge ${f.severity}`}>{f.severity}</span>
              </td>
              <td>{f.title}</td>
              <td>{f.category}</td>
              <td>{f.tool}</td>
              <td>{f.riskScore ?? '-'}</td>
              <td className="muted">{f.file || '-'}</td>
              <td>{f.recommendation}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
