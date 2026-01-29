import { describe, it, expect } from 'vitest';
import { createConfigReader } from '../../src/ingestion/configReader';
import path from 'path';

describe('ConfigReader', () => {
  const reader = createConfigReader();
  const fixtureDir = path.join(process.cwd(), 'fixtures');

  it('reads nginx configuration and finds security issues', async () => {
    const nginxPath = path.join(fixtureDir, 'nginx.conf');
    const findings = await reader.readNginxConfig(nginxPath);

    expect(findings.length).toBeGreaterThan(0);
    expect(findings[0].severity).toBe('high');
    expect(findings.some((f) => f.category === 'nginx-config')).toBe(true);
  });

  it('reads Dockerfile and detects missing USER', async () => {
    const dockerfilePath = path.join(fixtureDir, 'Dockerfile');
    const findings = await reader.readDockerfile(dockerfilePath);

    const userIssues = findings.filter((f) =>
      f.id.includes('user')
    );
    expect(userIssues.length).toBeGreaterThan(0);
  });

  it('reads K8s manifests and finds security issues', async () => {
    const k8sPath = path.join(fixtureDir, 'vulnerable-k8s.yaml');
    const findings = await reader.readK8sManifest(k8sPath);

    expect(findings.length).toBeGreaterThan(0);
    expect(
      findings.some((f) =>
        f.category.includes('kubernetes')
      )
    ).toBe(true);
  });

  it('scans directory recursively', async () => {
    const findings = await reader.scanDirectory(fixtureDir);

    expect(findings.length).toBeGreaterThan(0);
    expect(
      findings.some((f) => f.category === 'nginx-config')
    ).toBe(true);
    expect(
      findings.some((f) => f.category === 'dockerfile')
    ).toBe(true);
  });
});
