/**
 * Config reader for Nginx, Docker, and Kubernetes
 */

import { promises as fs } from 'fs';
import path from 'path';
import { SecurityFinding } from '../types.js';
import yaml from 'js-yaml';

const NGINX_CRITICAL_CHECKS = [
  {
    pattern: /server_tokens\s+on/gi,
    issue: 'Server tokens exposed',
    recommendation: 'Set server_tokens off;',
  },
  {
    pattern: /^(?!.*add_header\s+Strict-Transport-Security)/gm,
    issue: 'HSTS header missing',
    recommendation: 'Add HSTS header for HTTPS sites',
  },
  {
    pattern: /ssl_protocols\s+SSLv[23]/gi,
    issue: 'Weak SSL/TLS protocol enabled',
    recommendation: 'Use TLSv1.2 or TLSv1.3 only',
  },
  {
    pattern: /listen\s+80\s*;(?!.*return 301 https)/gi,
    issue: 'HTTP traffic not redirected to HTTPS',
    recommendation: 'Redirect HTTP to HTTPS',
  },
];

const DOCKER_CRITICAL_CHECKS = [
  {
    pattern: /^USER\s+root$/gm,
    issue: 'Running as root user',
    recommendation: 'Use non-root USER',
  },
  {
    pattern: /FROM.*:latest$/gm,
    issue: 'Using latest tag',
    recommendation: 'Pin specific image version',
  },
  {
    pattern: /RUN.*sudo|RUN.*--privileged/gi,
    issue: 'Potential privilege escalation in Dockerfile',
    recommendation: 'Avoid privileged operations',
  },
];

const normalizeSeverity = (
  severity: string | undefined
): 'critical' | 'high' | 'medium' | 'low' | 'info' => {
  const s = (severity || 'high').toLowerCase();
  if (s === 'critical' || s === 'high' || s === 'medium' || s === 'low') return s;
  return 'info';
};

export class ConfigReader {
  private parseYamlDocuments<T = unknown>(content: string): T[] {
    try {
      const docs: T[] = [];
      yaml.loadAll(content, (doc) => {
        if (doc) docs.push(doc as T);
      });
      return docs;
    } catch {
      return [];
    }
  }

  async readNginxConfig(configPath: string): Promise<SecurityFinding[]> {
    const findings: SecurityFinding[] = [];

    try {
      const content = await fs.readFile(configPath, 'utf-8');

      for (const check of NGINX_CRITICAL_CHECKS) {
        const matches = [...content.matchAll(check.pattern)];

        for (const match of matches) {
          const lineNumber = content.substring(0, match.index).split('\n').length;

          findings.push({
            id: `nginx-${check.issue.replace(/\s+/g, '-').toLowerCase()}`,
            tool: 'config-reader',
            resource: configPath,
            file: configPath,
            lineRange: { start: lineNumber, end: lineNumber },
            title: check.issue,
            description: `Nginx configuration issue: ${check.issue}`,
            severity: 'high',
            evidence: match[0],
            recommendation: check.recommendation,
            confidence: 0.95,
            category: 'nginx-config',
          });
        }
      }
    } catch (error) {
      console.warn(`Could not read nginx config: ${configPath}`, error);
    }

    return findings;
  }

  async readDockerfile(dockerfilePath: string): Promise<SecurityFinding[]> {
    const findings: SecurityFinding[] = [];

    try {
      const content = await fs.readFile(dockerfilePath, 'utf-8');

      for (const check of DOCKER_CRITICAL_CHECKS) {
        const matches = [...content.matchAll(check.pattern)];

        for (const match of matches) {
          const lineNumber = content.substring(0, match.index).split('\n').length;

          findings.push({
            id: `docker-${check.issue.replace(/\s+/g, '-').toLowerCase()}`,
            tool: 'config-reader',
            resource: dockerfilePath,
            file: dockerfilePath,
            lineRange: { start: lineNumber, end: lineNumber },
            title: check.issue,
            description: `Docker configuration issue: ${check.issue}`,
            severity: 'high',
            evidence: match[0],
            recommendation: check.recommendation,
            confidence: 0.9,
            category: 'dockerfile',
          });
        }
      }

      // Check for missing USER directive (explicit instruction, not in comments)
      if (!/^\s*USER\s+/m.test(content)) {
        findings.push({
          id: 'docker-missing-user',
          tool: 'config-reader',
          resource: dockerfilePath,
          file: dockerfilePath,
          lineRange: { start: 1, end: 1 },
          title: 'No USER directive specified',
          description: 'Container will run as root by default',
          severity: 'high',
          evidence: 'No USER instruction found',
          recommendation: 'Add USER directive with non-root user',
          confidence: 1.0,
          category: 'dockerfile',
        });
      }
    } catch (error) {
      console.warn(`Could not read Dockerfile: ${dockerfilePath}`, error);
    }

    return findings;
  }

  async readK8sManifest(manifestPath: string): Promise<SecurityFinding[]> {
    const findings: SecurityFinding[] = [];

    try {
      const content = await fs.readFile(manifestPath, 'utf-8');
      const docs = this.parseYamlDocuments<Record<string, any>>(content);

      for (const doc of docs) {
        const kind = (doc?.kind as string) || '';
        const metadataName = doc?.metadata?.name || 'unknown';

        // Detect cluster-admin bindings
        if (
          kind === 'ClusterRoleBinding' &&
          doc?.roleRef?.name === 'cluster-admin'
        ) {
          findings.push({
            id: 'k8s-cluster-admin-binding',
            tool: 'config-reader',
            resource: manifestPath,
            file: manifestPath,
            title: 'Cluster-admin role binding detected',
            description:
              'ClusterRoleBinding grants cluster-admin privileges which is overly permissive',
            severity: 'critical',
            evidence: `ClusterRoleBinding ${metadataName} -> cluster-admin`,
            recommendation:
              'Replace with least-privilege ClusterRole and limit subjects',
            confidence: 0.9,
            category: 'kubernetes-rbac',
          });
        }

        // Pods/Deployments/etc
        const podSpec =
          doc?.spec?.template?.spec ||
          doc?.spec?.jobTemplate?.spec?.template?.spec ||
          doc?.spec?.spec ||
          doc?.spec;

        const containers =
          (podSpec?.containers as Array<Record<string, any>>) || [];
        const initContainers =
          (podSpec?.initContainers as Array<Record<string, any>>) || [];
        const allContainers = [...containers, ...initContainers];

        for (const container of allContainers) {
          const cname = container?.name || 'container';
          const sc = container?.securityContext || podSpec?.securityContext;

          if (sc?.privileged === true) {
            findings.push({
              id: 'k8s-privileged-container',
              tool: 'config-reader',
              resource: manifestPath,
              file: manifestPath,
              title: 'Privileged container detected',
              description: 'Container is running with privileged flag',
              severity: 'critical',
              evidence: `${cname}: privileged: true`,
              recommendation:
                'Remove privileged flag or add restrictive securityContext',
              confidence: 0.95,
              category: 'kubernetes-pod-security',
            });
          }

          if (sc?.runAsNonRoot !== true) {
            findings.push({
              id: 'k8s-container-may-run-as-root',
              tool: 'config-reader',
              resource: manifestPath,
              file: manifestPath,
              title: 'Container may run as root',
              description: 'No runAsNonRoot enforced',
              severity: 'high',
              evidence: `${cname}: runAsNonRoot not set`,
              recommendation: 'Set runAsNonRoot: true in securityContext',
              confidence: 0.85,
              category: 'kubernetes-pod-security',
            });
          }

          if (sc?.allowPrivilegeEscalation !== false) {
            findings.push({
              id: 'k8s-allow-privilege-escalation',
              tool: 'config-reader',
              resource: manifestPath,
              file: manifestPath,
              title: 'Privilege escalation allowed',
              description:
                'allowPrivilegeEscalation is not set to false in securityContext',
              severity: 'high',
              evidence: `${cname}: allowPrivilegeEscalation not false`,
              recommendation: 'Set allowPrivilegeEscalation: false',
              confidence: 0.8,
              category: 'kubernetes-pod-security',
            });
          }

          if (!container?.resources?.requests || !container?.resources?.limits) {
            findings.push({
              id: 'k8s-missing-resource-limits',
              tool: 'config-reader',
              resource: manifestPath,
              file: manifestPath,
              title: 'Missing resource requests/limits',
              description: 'Container has no resource constraints',
              severity: 'medium',
              evidence: `${cname}: resources.requests/limits missing`,
              recommendation: 'Add resource requests and limits',
              confidence: 0.9,
              category: 'kubernetes-resource-mgmt',
            });
          }

          const caps = sc?.capabilities?.drop || [];
          if (!Array.isArray(caps) || !caps.includes('ALL')) {
            findings.push({
              id: 'k8s-capabilities-not-dropped',
              tool: 'config-reader',
              resource: manifestPath,
              file: manifestPath,
              title: 'Capabilities not dropped',
              description:
                'Container does not drop all Linux capabilities',
              severity: 'medium',
              evidence: `${cname}: capabilities.drop missing ALL`,
              recommendation: 'Set capabilities.drop: ["ALL"]',
              confidence: 0.75,
              category: 'kubernetes-pod-security',
            });
          }
        }
      }

    } catch (error) {
      console.warn(`Could not read K8s manifest: ${manifestPath}`, error);
    }

    return findings;
  }

  async readDockerCompose(composePath: string): Promise<SecurityFinding[]> {
    const findings: SecurityFinding[] = [];

    try {
      const content = await fs.readFile(composePath, 'utf-8');
      const docs = this.parseYamlDocuments<Record<string, any>>(content);
      const compose = docs[0] || {};
      const services = compose?.services || {};

      for (const [serviceName, service] of Object.entries(services)) {
        const svc = service as Record<string, any>;
        const image = (svc.image as string) || '';
        const user = (svc.user as string) || '';

        if (image.includes(':latest')) {
          findings.push({
            id: 'docker-compose-using-latest-tag',
            tool: 'config-reader',
            resource: composePath,
            file: composePath,
            title: 'Compose service using latest tag',
            description: 'Docker Compose service uses :latest tag',
            severity: 'high',
            evidence: `${serviceName}: ${image}`,
            recommendation: 'Pin specific image version',
            confidence: 0.9,
            category: 'docker-compose',
          });
        }

        if (svc.privileged === true) {
          findings.push({
            id: 'docker-compose-privileged',
            tool: 'config-reader',
            resource: composePath,
            file: composePath,
            title: 'Privileged container in compose',
            description: 'Compose service runs with privileged flag',
            severity: 'critical',
            evidence: `${serviceName}: privileged: true`,
            recommendation: 'Remove privileged: true from compose service',
            confidence: 0.95,
            category: 'docker-compose',
          });
        }

        if (user === 'root' || user === '0') {
          findings.push({
            id: 'docker-compose-root-user',
            tool: 'config-reader',
            resource: composePath,
            file: composePath,
            title: 'Compose service running as root',
            description: 'Compose service runs as root user',
            severity: 'high',
            evidence: `${serviceName}: user: ${user}`,
            recommendation: 'Set non-root user for service',
            confidence: 0.85,
            category: 'docker-compose',
          });
        }

        if (svc.read_only !== true) {
          findings.push({
            id: 'docker-compose-read-only-fs',
            tool: 'config-reader',
            resource: composePath,
            file: composePath,
            title: 'Read-only filesystem not enabled',
            description: 'Compose service does not enable read_only filesystem',
            severity: 'medium',
            evidence: `${serviceName}: read_only not set`,
            recommendation: 'Set read_only: true for service',
            confidence: 0.7,
            category: 'docker-compose',
          });
        }
      }
    } catch (error) {
      console.warn(`Could not read docker-compose: ${composePath}`, error);
    }

    return findings;
  }

  async readHelmValues(valuesPath: string): Promise<SecurityFinding[]> {
    const findings: SecurityFinding[] = [];

    try {
      const content = await fs.readFile(valuesPath, 'utf-8');

      if (content.includes('tag: latest')) {
        findings.push({
          id: 'helm-image-using-latest-tag',
          tool: 'config-reader',
          resource: valuesPath,
          file: valuesPath,
          title: 'Helm chart uses latest image tag',
          description: 'Image tag is set to latest, which is non-deterministic',
          severity: 'high',
          evidence: 'tag: latest',
          recommendation: 'Pin a specific image tag',
          confidence: 0.85,
          category: 'helm-values',
        });
      }

      if (content.includes('runAsNonRoot: false')) {
        findings.push({
          id: 'helm-run-as-non-root-false',
          tool: 'config-reader',
          resource: valuesPath,
          file: valuesPath,
          title: 'Helm chart allows root user',
          description: 'runAsNonRoot is explicitly disabled',
          severity: 'high',
          evidence: 'runAsNonRoot: false',
          recommendation: 'Set runAsNonRoot: true',
          confidence: 0.8,
          category: 'helm-values',
        });
      }

      if (content.includes('privileged: true')) {
        findings.push({
          id: 'helm-privileged-true',
          tool: 'config-reader',
          resource: valuesPath,
          file: valuesPath,
          title: 'Helm chart enables privileged mode',
          description: 'privileged is set to true in values',
          severity: 'critical',
          evidence: 'privileged: true',
          recommendation: 'Set privileged: false',
          confidence: 0.9,
          category: 'helm-values',
        });
      }
    } catch (error) {
      console.warn(`Could not read Helm values: ${valuesPath}`, error);
    }

    return findings;
  }

  async readExternalScanOutput(filePath: string): Promise<SecurityFinding[]> {
    const findings: SecurityFinding[] = [];

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      if (filePath.endsWith('.json')) {
        const parsed = JSON.parse(content);

        // Trivy config scan JSON
        if (parsed?.Results && Array.isArray(parsed.Results)) {
          for (const result of parsed.Results) {
            const misconfigs = result?.Misconfigurations || [];
            for (const m of misconfigs) {
              findings.push({
                id: `trivy-${m.ID}`,
                tool: 'trivy',
                resource: result.Target || filePath,
                file: result.Target || filePath,
                title: m.Title || m.ID,
                description: m.Description || 'Trivy config misconfiguration',
                severity: normalizeSeverity(m.Severity),
                evidence: m.Message || m.CauseMetadata?.Resource || 'Trivy finding',
                recommendation: m.Recommendation || 'Review Trivy guidance',
                confidence: 0.9,
                category: 'trivy-config',
              });
            }
          }
        }

        // kube-bench JSON
        if (parsed?.Controls && Array.isArray(parsed.Controls)) {
          for (const control of parsed.Controls) {
            for (const group of control.Groups || []) {
              for (const check of group.Checks || []) {
                if (check.State === 'FAIL' || check.State === 'WARN') {
                  findings.push({
                    id: `kube-bench-${check.ID}`,
                    tool: 'kube-bench',
                    resource: filePath,
                    file: filePath,
                    title: check.Text || check.ID,
                    description: check.Remediation || 'Kube-bench failed check',
                    severity: check.State === 'FAIL' ? 'high' : 'medium',
                    evidence: check.Actual || 'Kube-bench failure',
                    recommendation: check.Remediation || 'Apply kube-bench guidance',
                    confidence: 0.8,
                    category: 'kube-bench',
                  });
                }
              }
            }
          }
        }
      } else if (filePath.endsWith('.txt') || filePath.endsWith('.log')) {
        // kube-bench text format (simple parse)
        if (content.includes('[FAIL]') || content.includes('[WARN]')) {
          const lines = content.split('\n');
          for (const line of lines) {
            if (line.includes('[FAIL]') || line.includes('[WARN]')) {
              const severity = line.includes('[FAIL]') ? 'high' : 'medium';
              const title = line.replace(/\[FAIL\]|\[WARN\]/g, '').trim();
              findings.push({
                id: `kube-bench-text-${title.replace(/\s+/g, '-')}`,
                tool: 'kube-bench',
                resource: filePath,
                file: filePath,
                title,
                description: 'Kube-bench failed or warned check',
                severity,
                evidence: line.trim(),
                recommendation: 'Review kube-bench output for remediation',
                confidence: 0.7,
                category: 'kube-bench',
              });
            }
          }
        }
      }
    } catch (error) {
      console.warn(`Could not read external scan output: ${filePath}`, error);
    }

    return findings;
  }

  async scanDirectory(scanPath: string): Promise<SecurityFinding[]> {
    const findings: SecurityFinding[] = [];

    const scanDir = async (dir: string): Promise<void> => {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
            await scanDir(fullPath);
          }
        } else if (entry.isFile()) {
          if (
            entry.name === 'nginx.conf' ||
            entry.name.endsWith('.conf')
          ) {
            const nginxFindings = await this.readNginxConfig(fullPath);
            findings.push(...nginxFindings);
          }

          if (entry.name === 'Dockerfile' || entry.name === 'dockerfile') {
            const dockerFindings = await this.readDockerfile(fullPath);
            findings.push(...dockerFindings);
          }

          if (
            entry.name === 'docker-compose.yml' ||
            entry.name === 'docker-compose.yaml' ||
            entry.name === 'compose.yml' ||
            entry.name === 'compose.yaml'
          ) {
            const composeFindings = await this.readDockerCompose(fullPath);
            findings.push(...composeFindings);
          }

          if (entry.name === 'values.yaml' || entry.name === 'values.yml') {
            const helmFindings = await this.readHelmValues(fullPath);
            findings.push(...helmFindings);
          }

          if (entry.name.endsWith('.yaml') || entry.name.endsWith('.yml')) {
            const k8sFindings = await this.readK8sManifest(fullPath);
            findings.push(...k8sFindings);
          }

          if (
            entry.name.endsWith('.json') ||
            entry.name.endsWith('.txt') ||
            entry.name.endsWith('.log')
          ) {
            if (
              entry.name.includes('trivy') ||
              entry.name.includes('kube-bench') ||
              entry.name.includes('kubebench')
            ) {
              const externalFindings = await this.readExternalScanOutput(fullPath);
              findings.push(...externalFindings);
            }
          }
        }
      }
    };

    await scanDir(scanPath);
    return findings;
  }
}

export function createConfigReader(): ConfigReader {
  return new ConfigReader();
}
