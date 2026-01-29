# AI-Driven Cybersecurity Config Hardening for SMEs

**Problem:** SMEs often ship misconfigured infrastructure configs (Nginx TLS/headers, Docker privileges, K8s RBAC/PodSecurity). Existing scanners (Trivy, kube-bench) produce noisy findings without actionable remediation guidance.

**Solution:** AI-driven hardening system that:
1. **Scans** Nginx, Docker, Kubernetes configs
2. **Scores** findings by risk (exploit likelihood × business impact × confidence)
3. **Generates** minimal-change, PR-ready patches
4. **Validates** patches safely
5. **Enables rollback** with snapshots
6. **Reports** findings and metrics

---

## Quick Start

### Installation & Setup

```bash
# Install dependencies
pnpm install

# Generate default config
pnpm harden --init-config

# Build project
pnpm build
```

### Basic Usage

```bash
# Scan and report (dry-run, no changes)
pnpm harden --target ./

# View detailed report
cat .hardener/reports/report-*.md

# Apply patches with rollback enabled
pnpm harden --target ./ --apply --enable-rollback
```

### Dashboard (Localhost UI)

```bash
# Run the dashboard at http://localhost:3000
pnpm dashboard
```

Optional (enable UI apply):
```
HARDENER_UI_APPLY=1
HARDENER_WORKSPACE=.
```

---

## Architecture

```
hardener/
├── src/
│   ├── types.ts                 # Core type definitions
│   ├── cli.ts                   # CLI entry point
│   ├── orchestrator.ts          # Main orchestration logic
│   │
│   ├── ingestion/
│   │   └── configReader.ts      # Nginx/Docker/K8s config parsing
│   │
│   ├── scoring/
│   │   └── riskScorer.ts        # Risk scoring engine (0-100)
│   │
│   ├── patching/
│   │   └── patchEngine.ts       # Minimal-change patch generation
│   │
│   ├── deduplication/
│   │   └── grouper.ts           # Noise reduction and grouping
│   │
│   ├── validation/
│   │   └── validator.ts         # Syntax & schema validation
│   │
│   ├── safety/
│   │   └── rollbackManager.ts   # Snapshot & rollback system
│   │
│   ├── reporting/
│   │   ├── reportGenerator.ts   # JSON + Markdown reports
│   │   └── historyManager.ts    # Run history for dashboard
│   │
│   └── config/
│       └── configLoader.ts      # YAML config management
│
├── tests/
│   ├── scoring/
│   ├── ingestion/
│   ├── patching/
│   ├── validation/
│   └── safety/
│
├── fixtures/                    # Intentionally vulnerable configs
│   ├── nginx.conf
│   ├── Dockerfile
│   └── vulnerable-k8s.yaml
│
├── .hardener/
│   ├── config.yaml              # Hardening policy (user-configurable)
│   ├── reports/                 # Generated reports (JSON + Markdown)
│   ├── snapshots/               # Pre-change snapshots for rollback
│   └── history.json             # Rollback success rate tracking
│
├── dashboard/                    # Next.js 14 interactive UI
│   ├── app/
│   └── package.json
│
└── package.json
```

---

## Risk Scoring Rubric

**Final Score = f(exploit_likelihood, business_impact, confidence)**

Normalized to **0-100** with weighted formula (extended scale for critical):
```
score = (exploit_likelihood × 0.4 + business_impact × 0.4 + confidence × 0.2) / 10 × 100
```

### Exploit Likelihood (0-5)
Factors:
- **Internet-exposed** (e.g., `0.0.0.0`, public IP) → +3
- **Weak authentication** (default creds, no auth) → +2.5 to +3.5
- **Privileged execution** (Docker `USER root`, K8s `privileged: true`) → +2.5
- **Host network access** (K8s `hostNetwork: true`) → +2.5
- **Missing encryption** (no TLS, HTTP only) → +2

**Severity multiplier:**
- Critical: 1.5×
- High: 1.2×
- Medium: 1.0×
- Low: 0.7×
- Info: 0.5×

### Business Impact (0-5)
Factors:
- **Data exposure** (secrets, credentials, PII) → +5
- **Downtime risk** (availability, DOS) → +4
- **Compliance violation** (PCI, HIPAA) → +4
- **Lateral movement** (privilege escalation paths) → +3.5
- **Blast radius** → cluster-wide: +4, namespace: +3, pod: +2

### Confidence (0-5)
Based on:
- Direct evidence presence
- Tool certainty
- Parsing confidence

---

## Supported Checks

### Nginx
- ✅ Server tokens exposed
- ✅ HSTS header missing
- ✅ Weak SSL/TLS protocols (TLSv1.0, TLSv1.1)
- ✅ HTTP not redirected to HTTPS
- ⏳ Missing security headers (CSP, X-Frame-Options)

### Docker
- ✅ Running as root (no USER directive)
- ✅ Using `:latest` tag (unpinned)
- ✅ Privileged operations in RUN
- ⏳ Missing resource limits
- ⏳ No seccomp/AppArmor profiles

### Kubernetes
- ✅ Privileged containers (`privileged: true`)
- ✅ Root user (`runAsUser: 0`, no `runAsNonRoot`)
- ✅ Missing resource limits/requests
- ⏳ Missing RBAC policies
- ⏳ No network policies
- ⏳ Pod security violations

---

## Configuration (`.hardener/config.yaml`)

```yaml
# Target directory to scan
target: ./

scanners:
  enabled:
    - config-reader
    # - trivy (when available)
    # - kube-bench (when available)
  
  custom:
    enabled: true
    rulesPath: .hardener/custom-rules.json

# Auto-fix settings
autoFix:
  enabled: false  # Set to true for auto-patching
  categories:
    - nginx-config
    - dockerfile
    - kubernetes-pod-security
  excludePatterns:
    - "**/production/**"
    - "sensitive-*.yaml"

# Safety & validation
validation:
  enabled: true
  strict: false  # Set to true for zero-tolerance

rollback:
  enabled: false
  autoRollbackOnFailure: false

# Reporting
reporting:
  outputDir: .hardener/reports
  markdown: true
  json: true

# Risk thresholds
thresholds:
  ignoreBelow: 20      # Suppress low-risk findings
  warnAbove: 60        # Yellow alert zone
  criticalAbove: 80    # Red alert zone
```

---

## Usage Scenarios

### Scenario 1: Audit & Report Only (Dry-Run)
```bash
pnpm harden --target ./ --config .hardener/config.yaml
```
**Output:** `.hardener/reports/report-*.{json,md}` with prioritized findings.

### Scenario 2: Apply Patches with Rollback
```bash
pnpm harden --target ./ --apply --enable-rollback
```
**Actions:**
1. Create snapshot at `.hardener/snapshots/<run-id>/`
2. Apply patches to config files
3. Validate patches (syntax, schema)
4. On failure → auto-rollback to snapshot
5. Report success/failure + stats

### Scenario 3: Dry-Run then Manual Review
```bash
# Step 1: Analyze
pnpm harden --target ./ --dry-run

# Step 2: Review markdown report
cat .hardener/reports/report-*.md

# Step 3: Apply selectively
pnpm harden --target ./ --apply --enable-rollback
```

---

## Running Tests

```bash
# Unit tests
pnpm test

# Watch mode
pnpm test:watch

# Coverage
pnpm test:coverage

# Integration tests (uses fixtures)
pnpm integration-test

# Linting & formatting
pnpm lint
pnpm format
```

---

## Example Report Output

### JSON (`.hardener/reports/report-*.json`)
```json
{
  "runId": "a1b2c3d4",
  "timestamp": "2024-01-29T10:30:00Z",
  "target": "./",
  "findings": [
    {
      "id": "nginx-server-tokens-exposed",
      "severity": "high",
      "title": "Server tokens exposed",
      "riskScore": {
        "overall": 82,
        "exploitLikelihood": 3.2,
        "businessImpact": 2.8,
        "confidence": 4.5
      }
    }
  ],
  "statistics": {
    "totalFindings": 12,
    "criticalCount": 2,
    "highCount": 5,
    "mediumCount": 4,
    "lowCount": 1,
    "validationPassRate": 0.95,
    "rollbackSuccessRate": 1.0
  }
}
```

### Markdown (`.hardener/reports/report-*.md`)
```markdown
# Hardening Report

**Run ID:** a1b2c3d4
**Timestamp:** 2024-01-29T10:30:00Z
**Target:** ./

## Summary Statistics

| Metric | Count |
|--------|-------|
| Total Findings | 12 |
| Critical | 2 |
| High | 5 |
| Patched | 7 |
| Validation Pass Rate | 95.0% |

## Risk-Prioritized Plan

| Priority | Finding | Severity | Risk Score | Recommendation |
|----------|---------|----------|-----------|-----------------|
| #1 | Privileged container | critical | 95/100 | Remove privileged: true |
| #2 | Root user in K8s pod | high | 85/100 | Set runAsNonRoot: true |
...
```

---

## Safety Guarantees

### Non-Negotiable Rules
1. **Snapshots First** — Before any patch, create `.hardener/snapshots/<run-id>/` with original file contents
2. **Validation Gates** — Each patch passes syntax/schema check before application
3. **Explicit Rollback** — Each patch includes numbered rollback steps
4. **Minimal Changes** — Diffs are targeted to a single issue, no unrelated refactoring
5. **Dry-Run Default** — CLI defaults to `--dry-run` unless `--apply` flag set
6. **Tracking** — Rollback success rates stored in `.hardener/history.json`

### Limitations & When to Use Caution

| Scenario | Risk Level | Mitigation |
|----------|-----------|-----------|
| Patch `:latest` Docker tag | HIGH | Manual: requires selecting specific version |
| Change K8s resource requests | HIGH | Test in dev/staging first; use `--dry-run` |
| HTTP → HTTPS redirect | MEDIUM | Verify HTTPS configured; test client compatibility |
| HSTS header (1-year cache) | MEDIUM | Consider staging with short max-age first |
| Drop capabilities in K8s | MEDIUM | Verify app doesn't require elevated capabilities |

---

## Running on Fixtures

```bash
# Scan vulnerable configs
pnpm harden --target ./fixtures

# Sample output:
# 🔍 Starting hardening run: a1b2c3d4
#    ✓ Found 12 issues
# 🎯 Step 2: Scoring and prioritizing...
#    ✓ Top risk: 95/100
# 🔧 Step 3: Generating patches...
#    ✓ Generated 7 patches
# ✅ Step 4: Validating patches...
#    ✓ Validation pass rate: 85.7%
```

---

## Next Hardening Steps (Future Work)

### Phase 2
- [ ] Integrate **Trivy** for container image scanning
- [ ] Integrate **kube-bench** for K8s compliance
- [ ] Add **static ruleset** for custom policies
- [ ] Implement **noise reduction** (deduplication, confidence thresholding)

### Phase 3
- [ ] **Next.js dashboard** for visualizing reports across runs
- [ ] **Git integration** (auto-commit patches on --apply)
- [ ] **CICD integration** (GitHub Actions, GitLab CI)
- [ ] **Slack/email notifications** for critical findings

### Phase 4
- [ ] **Compliance mapping** (PCI-DSS, HIPAA, CIS benchmarks)
- [ ] **ML-based scoring** (learn from historical fixes)
- [ ] **Helm chart hardening** (template scanning)
- [ ] **Terraform/Bicep** support

---

## Security & Threat Model

### What This Tool Protects Against
- Misconfigured TLS (weak protocols, missing headers)
- Privileged container execution
- Root user execution in containers
- Exposed credentials/secrets in configs
- Missing RBAC and network policies
- Weak authentication mechanisms

### What This Tool Does NOT Protect Against
- Container image vulnerabilities (use Trivy for that)
- Code vulnerabilities in applications
- Runtime exploitation (focus on config, not runtime defense)
- Supply chain attacks (dependency vulnerabilities)
- Social engineering / insider threats

### Assumptions
- Configs are static files (no dynamic generation assumed)
- Validation tools (nginx -t, kubectl) may not be available; syntax checks used as fallback
- Patches are applied sequentially; race conditions not handled
- No multi-tenant isolation (all users can read/write `.hardener/`)

---

## Contributing

### Code Style
```bash
# Lint & auto-fix
pnpm lint

# Format code
pnpm format

# Run tests before commit
pnpm test
```

### Adding a New Patch Template

1. Create a new template in `src/patching/patchEngine.ts`:
```typescript
const CUSTOM_PATCH_TEMPLATE: PatchTemplate = {
  id: 'custom-fix-issue',
  findingPattern: (f) => f.id === 'custom-issue-id',
  type: 'custom',
  generatePatch: (finding, content) => {
    // Return SecurityPatch or null
  },
};
```

2. Add to `templates` array:
```typescript
this.templates.push(CUSTOM_PATCH_TEMPLATE);
```

3. Add tests in `tests/patching/`

---

## License

MIT

---

## Support & Issues

- **Security Issues:** Please report privately to [security email]
- **Feature Requests:** GitHub Issues
- **Documentation:** See [SECURITY.md](./SECURITY.md) for threat model details

---

## Summary

This tool helps SMEs **reduce config security risk fast** by:
- 🎯 Prioritizing by actual risk (not noise)
- 🔧 Generating PR-ready patches (minimal, safe, testable)
- 🔄 Enabling rollback with snapshots (non-destructive)
- 📊 Reporting metrics + next steps (actionable insights)

**Start hardening today:**
```bash
pnpm install && pnpm build && pnpm harden --init-config
```
