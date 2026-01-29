# Contributing to Hardener

## Code of Conduct
Be respectful, inclusive, and security-conscious. All contributions must follow our security model.

## Development Setup

```bash
# Clone and install
git clone <repo>
cd hardener
pnpm install

# Build and test
pnpm build
pnpm test
```

## Branch Strategy

- `main` — Production-ready, tagged releases
- `develop` — Integration branch for features
- `feature/*` — New features (from `develop`)
- `fix/*` — Bug fixes (from `develop`)
- `docs/*` — Documentation only

## Pull Request Process

1. **Create branch** from `develop`:
   ```bash
   git checkout -b feature/your-feature develop
   ```

2. **Make changes** with clear commits:
   ```bash
   git commit -m "feat: add Trivy scanner integration"
   ```

3. **Run checks** locally:
   ```bash
   pnpm lint && pnpm test && pnpm build
   ```

4. **Push and open PR**:
   ```bash
   git push origin feature/your-feature
   ```

5. **Address review feedback** and CI failures

6. **Squash and merge** when approved:
   ```bash
   git merge --squash feature/your-feature
   ```

## Commit Message Convention

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(scoring): add exploit likelihood factors for network exposure
^--^  ^-----  ^-----
│     │       └─ Summary in present tense
│     │
│     └─ Scope (what changed)
│
└─ Type: feat, fix, docs, test, refactor, perf, chore
```

## Adding New Checks

### 1. Add Finding to Config Reader
File: `src/ingestion/configReader.ts`

```typescript
const CUSTOM_CHECKS = [
  {
    pattern: /your-pattern/i,
    issue: 'Clear issue name',
    recommendation: 'How to fix',
  },
];
```

### 2. Add Patch Template
File: `src/patching/patchEngine.ts`

```typescript
const CUSTOM_PATCH: PatchTemplate = {
  id: 'custom-id',
  findingPattern: (f) => f.id === 'custom-issue-id',
  type: 'custom',
  generatePatch: (finding, content) => ({
    id: 'patch-' + finding.id,
    // ... rest of patch
  }),
};
this.templates.push(CUSTOM_PATCH);
```

### 3. Add Tests
File: `tests/patching/patchEngine.test.ts`

```typescript
it('generates correct patch for custom issue', async () => {
  const findings = [{ id: 'custom-issue-id', /* ... */ }];
  const patches = await engine.generatePatches(findings, '.');
  expect(patches).toHaveLength(1);
  expect(patches[0].diff).toMatch(/expected-pattern/);
});
```

## Testing

### Unit Tests
```bash
pnpm test                # Run once
pnpm test:watch         # Watch mode
pnpm test:coverage      # With coverage
```

### Integration Tests
```bash
pnpm integration-test   # Uses fixtures/
```

### Manual Testing
```bash
pnpm build
pnpm harden --target ./fixtures
cat .hardener/reports/report-*.md
```

## Documentation

- **README.md** — User guide
- **SECURITY.md** — Threat model & safety
- **Code comments** — Explain "why", not "what"

## Security Policy

- ❌ **Don't:** Commit secrets, API keys, credentials
- ✅ **Do:** Use `.env` for local development
- ✅ **Do:** Report security issues privately
- ✅ **Do:** Keep dependencies up-to-date

## Release Process (Maintainers Only)

1. Prepare release on `main`:
   ```bash
   npm version patch  # or minor, major
   git push origin main --tags
   ```

2. GitHub Actions builds and publishes automatically

3. Update changelog with release notes

## Questions?

- **Feature discussion:** Open an issue first
- **Security concern:** Report privately (not GitHub issues)
- **Documentation:** Check README and SECURITY.md
