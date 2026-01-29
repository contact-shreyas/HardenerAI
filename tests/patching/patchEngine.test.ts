import { describe, it, expect } from 'vitest';
import { createPatchEngine } from '../../src/patching/patchEngine';
import { SecurityFinding } from '../../src/types';

describe('PatchEngine', () => {
  const engine = createPatchEngine();

  it('generates patches for identifiable issues', async () => {
    const findings: SecurityFinding[] = [
      {
        id: 'nginx-weak-ssl/tls-protocol-enabled',
        tool: 'test',
        resource: 'fixtures/nginx.conf',
        title: 'Weak SSL/TLS protocol enabled',
        description: 'Weak TLS versions are enabled',
        severity: 'high',
        evidence: 'ssl_protocols TLSv1 TLSv1.1 TLSv1.2;',
        recommendation: 'Use TLSv1.2 or TLSv1.3 only',
        confidence: 0.95,
        category: 'nginx-config',
      },
    ];

    const patches = await engine.generatePatches(
      findings,
      process.cwd()
    );

    expect(patches.length).toBeGreaterThan(0);
    expect(patches[0].before).toBeDefined();
    expect(patches[0].after).toBeDefined();
    expect(patches[0].diff).toMatch(/^[-+]/m);
  });

  it('includes safety information in patches', async () => {
    const findings: SecurityFinding[] = [
      {
        id: 'docker-missing-user',
        tool: 'test',
        resource: 'fixtures/Dockerfile',
        title: 'No USER directive',
        description: 'Container runs as root',
        severity: 'high',
        evidence: 'No USER found',
        recommendation: 'Add non-root USER',
        confidence: 1.0,
        category: 'dockerfile',
      },
    ];

    const patches = await engine.generatePatches(
      findings,
      process.cwd()
    );

    if (patches.length > 0) {
      const patch = patches[0];
      expect(patch.assumptions.length).toBeGreaterThan(0);
      expect(patch.rollbackSteps.length).toBeGreaterThan(0);
      expect(patch.validationSteps.length).toBeGreaterThan(0);
      expect(patch.safetyNotes).toBeDefined();
    }
  });

  it('generates non-empty diffs for latest tag fixes', async () => {
    const findings: SecurityFinding[] = [
      {
        id: 'docker-using-latest-tag',
        tool: 'test',
        resource: 'fixtures/Dockerfile',
        title: 'Using latest tag',
        description: 'Dockerfile uses latest tag',
        severity: 'high',
        evidence: 'FROM node:latest',
        recommendation: 'Pin specific image version',
        confidence: 0.9,
        category: 'dockerfile',
      },
    ];

    const patches = await engine.generatePatches(findings, process.cwd());
    expect(patches.length).toBeGreaterThan(0);
    expect(patches[0].diff).toContain('FROM node:');
    expect(patches[0].diff).not.toEqual('');
  });
});
