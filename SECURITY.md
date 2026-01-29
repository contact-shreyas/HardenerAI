# Security Model & Threat Analysis

## Threat Model

### What We Protect Against

#### 1. Configuration Misconfigurations (Primary Focus)
- **Nginx:** Exposed server tokens, weak TLS, missing HSTS, HTTP not redirected
- **Docker:** Root user, unpinned images, privileged operations
- **Kubernetes:** Privileged containers, root execution, missing resource limits

#### 2. Risk Scoring Accuracy
- Misclassified findings (high-severity items missed)
- False positives (incorrectly flagged non-issues)
- Mitigation: Multi-factor scoring (exploit likelihood + business impact + confidence)

#### 3. Unsafe Patch Application
- Breaking config syntax
- Unintended side effects
- Non-idempotent changes
- Mitigation: Syntax validation + rollback snapshots + explicit assumptions

#### 4. Loss of Original Config (Data Loss)
- Patches overwrite files without recovery
- Mitigation: Snapshots stored in `.hardener/snapshots/<run-id>/` before any changes

#### 5. Privilege Escalation via Patches
- Malicious patches elevating privileges
- Mitigation: All patches generated from trusted rules; no user code execution

---

## Safety Guarantees

### Guarantee 1: Snapshot-First
**Rule:** No file is modified without a snapshot.

```
Before applying patches:
1. createSnapshot(patches) → .hardener/snapshots/{run-id}/snapshot.json
2. Snapshot contains: { patchId, resource, originalContent }
3. Only after snapshot succeeds, apply patches
4. On failure, rollback uses snapshot.json
```

**Failure Mode:** Snapshot creation fails
- **Detection:** Orchestrator catches error, returns without applying patches
- **Recovery:** No files modified, exit code 1

### Guarantee 2: Validation Gates
**Rule:** Every patch must pass validation before/after application.

```typescript
validatePatch(patch) → {
  - Syntax check (nginx: balanced braces, docker: FROM directive, k8s: YAML indent)
  - Schema check (K8s: required fields like kind, apiVersion)
  - Optional: tool-specific validation (nginx -t, docker build, kubectl dry-run)
}
```

**Failure Mode:** Patch validation fails
- **Detection:** Validator.validatePatch() returns passed=false
- **Recovery:** If autoRollbackOnFailure=true, rollback() called; exit code 1

### Guarantee 3: Rollback Tested
**Rule:** Rollback success tracked and verified.

```typescript
await rollbackManager.rollback(snapshotId)
→ RollbackResult[] { success, message, timestamp }

recordRollback() → .hardener/history.json {
  rollbacks: [{ snapshotId, successRate, details }]
}
```

**Failure Mode:** Rollback fails
- **Detection:** result.success=false
- **Recovery:** Report failure in output; manual rollback steps provided in patch

### Guarantee 4: Minimal Changes Only
**Rule:** Each patch targets a single issue; no refactoring.

**Examples of GOOD patches:**
```diff
# Disable server tokens (single change)
- server_tokens on;
+ server_tokens off;
```

```diff
# Add USER directive (single addition)
+ USER appuser
```

**Examples of BAD patches (not generated):**
```diff
# DON'T: Refactor unrelated code
- if (condition) { doSomething(); }
+ if (condition) {
+   logFirstly();
+   doSomething();
+ }
```

**Validation:** Patch diff is reviewed in tests; if unrelated changes detected, patch is rejected.

### Guarantee 5: UI Apply Disabled by Default
**Rule:** Dashboard cannot apply patches unless explicitly enabled.

```
HARDENER_UI_APPLY=1
```

When enabled, the UI uses strict input validation and only runs within the workspace root.

---

## Assumptions & Limitations

### Assumption 1: Configs Are Static Files
- No dynamic config generation (e.g., templating, variable interpolation)
- No config hot-reload required
- **Implication:** Works for committed YAML/conf; may not work for generated configs

### Assumption 2: Validation Tools May Not Be Available
- `nginx -t` might not be installed
- `kubectl` might not exist
- `docker build` might fail due to missing dependencies
- **Mitigation:** Fall back to static syntax checks; validator doesn't fail on tool absence

### Assumption 3: Sequential Patch Application
- Patches applied in order, no parallelization
- No interdependencies between patches (e.g., order-sensitive changes)
- **Implication:** Safe but slightly slower; explicit ordering possible in future

### Assumption 4: Single-Tenant Environment
- No multi-user isolation
- All users can read/write `.hardener/` directory
- **Implication:** Not suitable for shared/multi-tenant setups (add RBAC in future)

### Assumption 5: No Runtime Context
- Scoring is static (file-based analysis only)
- No knowledge of actual deployed environment
- No runtime metrics (uptime, error rates)
- **Mitigation:** Recommendations include validation steps that require runtime checks

---

## Risk Thresholds (Configurable)

```yaml
thresholds:
  ignoreBelow: 20      # Suppress info/low findings
  warnAbove: 60        # Yellow alert (manual review recommended)
  criticalAbove: 80    # Red alert (immediate action)
```

**Justification:**
- **Ignore < 20:** Very low likelihood + low impact (e.g., missing docs)
- **Warn 20-60:** Medium risk; requires manual assessment
- **Critical > 80:** High exploit likelihood + high impact (e.g., privilege escalation)

---

## Noise Reduction & Deduplication

Duplicate findings are grouped by:
- tool + category + title + severity

Noise reduction percentage is reported as:

$$
	ext{Noise Reduction} = \frac{\text{duplicates}}{\text{total findings}} \times 100
$$

---

## Confidence Decay

**Confidence scalar (0-1) reduces score if:**
1. Pattern match is weak (partial evidence)
2. Parsing uncertainty (ambiguous config syntax)
3. Tool output is uncertain (low tool confidence)

**Example:**
```
Finding: "Possible default creds"
Evidence: "password='admin'"
Confidence: 0.7  ← Might be test/demo env

Score = (exploit_likelihood=3.5 × 0.4 + business_impact=4 × 0.4 + confidence=3.5 × 0.2) / 5 × 100
       = (1.4 + 1.6 + 0.7) / 5 × 100
       = 74/100  ← Lower than 95 (high confidence case)
```

---

## Failure Modes & Recovery

| Scenario | Symptom | Root Cause | Recovery |
|----------|---------|-----------|----------|
| Snapshot creation fails | Exit code 1, "Failed to create snapshot" | Disk full, permissions issue | Try again; check disk space |
| Patch application fails | "Failed to apply patch X" | File locked, wrong path | Check file permissions; manual edit |
| Validation fails | "Validation pass rate: 75%" | Syntax error in patch | Reject patch; manual review required |
| Rollback fails | Rollback success rate < 100% | File changed elsewhere | Manual rollback using provided steps |
| Config syntax error in original file | Validator detects broken config | Invalid input config | Fix original config before scanning |

---

## Audit Trail & Compliance

Every hardening run creates:
1. **JSON Report** (`.hardener/reports/<run-id>.json`)
   - All findings with metadata
   - Patch diffs and assumptions
   - Validation results
   - Rollback status

2. **Markdown Report** (`.hardener/reports/<run-id>.md`)
   - Human-readable summary
   - Risk scores with reasoning
   - Next steps guidance

3. **Snapshot** (`.hardener/snapshots/<run-id>/snapshot.json`)
   - Original file contents (for forensics)
   - Patch IDs applied

4. **History** (`.hardener/history.json`)
   - All rollback attempts
   - Success rates per snapshot
   - Timestamp tracking

**Use for:**
- Audit trail (show what was found/patched)
- Compliance evidence (PCI-DSS, SOC2)
- Incident post-mortems (what was broken → what was fixed)

---

## Best Practices

### ✅ DO:
1. **Review patches in dry-run first** before applying
2. **Test in dev/staging** before production
3. **Enable rollback** in all environments
4. **Archive reports** for compliance
5. **Use version control** (git commit before/after)
6. **Set strict validation** for critical configs

### ❌ DON'T:
1. **Use --apply in production without --dry-run first**
2. **Disable validation** (always set validation.enabled: true)
3. **Ignore critical findings** (score > 80)
4. **Assume patches are idempotent** (test carefully)
5. **Mix manual edits** with automated patches in same run
6. **Delete snapshots** until after verification

---

## Incident Response

### If Patch Causes Downtime

1. **Immediate:** Use rollback command (stored in patch.rollbackSteps)
   ```bash
   cat .hardener/reports/report-<run-id>.md
   # Follow "Rollback Steps" section
   ```

2. **Verify:** Check file contents match snapshot
   ```bash
   diff <(cat .hardener/snapshots/<run-id>/snapshot.json) <actual-file>
   ```

3. **Investigate:** Review validation results
   ```bash
   jq .validationResults .hardener/reports/report-<run-id>.json
   ```

4. **Prevent:** Adjust config or patch templates for future runs

---

## Future Hardening (Roadmap)

### Security Enhancements
- [ ] RBAC for multi-tenant `.hardener/` access
- [ ] Signed snapshots (GPG/X.509)
- [ ] Audit log append-only storage
- [ ] Integration with secrets manager (prevent credential leaks)

### Risk Scoring Improvements
- [ ] ML-based exploit likelihood prediction
- [ ] Business context aware scoring (criticality tiers)
- [ ] CVE correlation (if patching library versions)

### Patch Safety Improvements
- [ ] Semantic patch diffing (avoid false positives)
- [ ] Canary deployment validation (A/B test patch on subset)
- [ ] Patch conflict detection (overlapping changes)

---

**Last Updated:** 2024-01-29  
**Version:** 0.1.0  
**Status:** MVP (Minimal Viable Product)
