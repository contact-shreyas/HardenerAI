# Architecture

## Overview
The system provides a safe-by-default pipeline to scan config files, score and prioritize findings, generate minimal-change patches, validate them, and produce rollback-ready reports. It also includes a Next.js 14 dashboard for exploring runs and patches.

## Pipeline
1. **Ingestion**
   - Direct parsing: Nginx, Dockerfile, Docker Compose, Kubernetes YAML, Helm values
   - External scans: Trivy config JSON, kube-bench JSON/text
2. **Normalization**
   - All findings are normalized into a shared schema
3. **Noise Reduction**
   - Group duplicates by tool + category + title + severity
4. **Risk Scoring**
   - Compute $0–100$ risk scores with explainable factors
5. **Patch Generation**
   - Minimal-change, PR-ready patches with diff + assumptions + validation + rollback
6. **Validation & Rollback**
   - Static validation, optional tool validation, snapshot-based rollback
7. **Reporting**
   - JSON + Markdown reports and run history tracking

## Key Modules
- Ingestion: src/ingestion/configReader.ts
- Scoring: src/scoring/riskScorer.ts
- Deduplication: src/deduplication/grouper.ts
- Patching: src/patching/patchEngine.ts
- Validation: src/validation/validator.ts
- Rollback: src/safety/rollbackManager.ts
- Reporting: src/reporting/reportGenerator.ts, src/reporting/historyManager.ts

## Dashboard
- Next.js 14 app in dashboard/
- API routes read .hardener/history.json and report files
- UI apply is **off by default**; requires HARDENER_UI_APPLY=1

## Data Flow Diagram
```
Configs + Scan Outputs
        ↓
  Ingestion & Normalization
        ↓
  Deduplication & Noise Reduction
        ↓
   Risk Scoring (0–100)
        ↓
   Patch Engine (diff + safety)
        ↓
 Validation (static + optional tools)
        ↓
  Snapshot + Apply + Rollback
        ↓
   JSON/MD Reports + History
        ↓
     Next.js Dashboard
```
