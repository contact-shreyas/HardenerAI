"use client";

import { useState } from 'react';

export interface PatchItem {
  id: string;
  findingId: string;
  type: string;
  diff: string;
  assumptions: string[];
  validationSteps: string[];
  rollbackSteps: string[];
  applied: boolean;
}

interface PatchListProps {
  patches: PatchItem[];
  target: string;
}

export default function PatchList({ patches, target }: PatchListProps) {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div className="card">
      {patches.length === 0 && <p className="muted">No patches generated.</p>}
      {patches.map((p) => (
        <div key={p.id} style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div>
              <strong>{p.id}</strong> <span className="muted">({p.type})</span>
            </div>
            <div>
              <button
                className="button"
                onClick={() =>
                  navigator.clipboard.writeText(
                    `pnpm harden --target ${target} --apply --enable-rollback`
                  )
                }
              >
                Copy patch command
              </button>
            </div>
          </div>

          <div className="muted" style={{ marginTop: 6 }}>
            Finding: {p.findingId} | Applied: {p.applied ? 'Yes' : 'No'}
          </div>

          <button
            className="button"
            style={{ marginTop: 8 }}
            onClick={() => setExpanded(expanded === p.id ? null : p.id)}
          >
            {expanded === p.id ? 'Hide details' : 'View details'}
          </button>

          {expanded === p.id && (
            <div style={{ marginTop: 12 }}>
              <pre
                style={{
                  background: '#0f172a',
                  padding: 12,
                  borderRadius: 8,
                  overflowX: 'auto',
                }}
              >
                {p.diff}
              </pre>

              <h4>Assumptions</h4>
              <ul>
                {p.assumptions.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>

              <h4>Validation Steps</h4>
              <ul>
                {p.validationSteps.map((v) => (
                  <li key={v}>{v}</li>
                ))}
              </ul>

              <h4>Rollback Steps</h4>
              <ul>
                {p.rollbackSteps.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
