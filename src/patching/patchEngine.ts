/**
 * Patch engine for generating minimal-change security fixes
 */

import { promises as fs } from 'fs';
import { SecurityFinding, SecurityPatch } from '../types.js';

interface PatchTemplate {
  id: string;
  findingPattern: (finding: SecurityFinding) => boolean;
  type: 'nginx' | 'docker' | 'kubernetes' | 'custom';
  generatePatch: (finding: SecurityFinding, content: string) => SecurityPatch | null;
}

const NGINX_PATCH_TEMPLATES: PatchTemplate[] = [
  {
    id: 'nginx-disable-server-tokens',
    findingPattern: (f) => f.id === 'nginx-server-tokens-exposed',
    type: 'nginx',
    generatePatch: (finding, content) => {
      const before = content;
      let after = content;

      if (content.includes('server_tokens on')) {
        after = content.replace(/server_tokens\s+on\s*;/i, 'server_tokens off;');
      } else if (!content.includes('server_tokens off')) {
        // Add it after the first server block
        after = content.replace(
          /(\s{2}listen\s+\d+;)/,
          `$1\n    server_tokens off;`
        );
      }

      if (before === after) return null;

      return {
        id: 'patch-' + finding.id,
        findingId: finding.id,
        resource: finding.resource,
        type: 'nginx',
        before,
        after,
        diff: generateDiff(before, after),
        assumptions: ['Nginx is reloadable without downtime'],
        rollbackSteps: ['Revert server_tokens to previous state', 'nginx -s reload'],
        validationSteps: ['nginx -t', 'curl -I http://localhost | grep -i server'],
        safetyNotes: 'Low-risk change; disabling server tokens reduces fingerprinting',
        applied: false,
      };
    },
  },
  {
    id: 'nginx-redirect-http-to-https',
    findingPattern: (f) =>
      f.id === 'nginx-http-traffic-not-redirected-to-https',
    type: 'nginx',
    generatePatch: (finding, content) => {
      const before = content;
      let after = content;

      // Only add redirect if no HTTPS block exists
      if (content.includes('listen 80') && !content.includes('return 301')) {
        after = content.replace(
          /listen\s+80\s*;/,
          `listen 80;\n    return 301 https://$host$request_uri;`
        );
      }

      if (before === after) return null;

      return {
        id: 'patch-' + finding.id,
        findingId: finding.id,
        resource: finding.resource,
        type: 'nginx',
        before,
        after,
        diff: generateDiff(before, after),
        assumptions: [
          'HTTPS site is already configured',
          'All clients can handle HTTP redirects',
        ],
        rollbackSteps: [
          'Remove return 301 redirect from nginx config',
          'nginx -s reload',
        ],
        validationSteps: [
          'nginx -t',
          'curl -I http://localhost (expect 301)',
          'Test HTTPS endpoint is accessible',
        ],
        safetyNotes:
          'Medium-risk change; verify HTTPS is properly configured before applying',
        applied: false,
      };
    },
  },
  {
    id: 'nginx-add-hsts',
    findingPattern: (f) => f.id === 'nginx-hsts-header-missing',
    type: 'nginx',
    generatePatch: (finding, content) => {
      const before = content;
      let after = content;

      // Only add HSTS when HTTPS is detected
      const hasHttps = content.includes('listen 443') || content.includes('ssl');
      if (!hasHttps) return null;

      if (!content.includes('Strict-Transport-Security')) {
        // Add HSTS with staging period
        const hsts =
          'add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;';
        after = content.replace(
          /listen\s+443/,
          `listen 443;\n    # HSTS header - enforces HTTPS for 1 year\n    ${hsts}`
        );
      }

      if (before === after) return null;

      return {
        id: 'patch-' + finding.id,
        findingId: finding.id,
        resource: finding.resource,
        type: 'nginx',
        before,
        after,
        diff: generateDiff(before, after),
        assumptions: [
          'All clients support HSTS',
          'HTTPS is permanent for this domain',
        ],
        rollbackSteps: [
          'Remove HSTS add_header directive',
          'nginx -s reload',
        ],
        validationSteps: [
          'nginx -t',
          'curl -I https://localhost | grep -i strict-transport-security',
        ],
        safetyNotes:
          'Medium-risk; HSTS is cached. Consider staging period (max-age=3600) first.',
        applied: false,
      };
    },
  },
  {
    id: 'nginx-set-tls-min-version',
    findingPattern: (f) => f.id === 'nginx-weak-ssl/tls-protocol-enabled',
    type: 'nginx',
    generatePatch: (finding, content) => {
      const before = content;
      let after = content;

      if (content.includes('ssl_protocols')) {
        after = content.replace(
          /ssl_protocols\s+[^;]+;/i,
          'ssl_protocols TLSv1.2 TLSv1.3;'
        );
      } else if (content.includes('listen 443')) {
        after = content.replace(
          /listen\s+443[^;]*;/,
          (match) => `${match}\n    ssl_protocols TLSv1.2 TLSv1.3;`
        );
      }

      if (before === after) return null;

      return {
        id: 'patch-' + finding.id,
        findingId: finding.id,
        resource: finding.resource,
        type: 'nginx',
        before,
        after,
        diff: generateDiff(before, after),
        assumptions: ['TLSv1.2+ is supported by clients'],
        rollbackSteps: ['Revert ssl_protocols line', 'nginx -s reload'],
        validationSteps: ['nginx -t', 'openssl s_client -tls1_2 -connect host:443'],
        safetyNotes:
          'Low-risk; removes insecure TLS protocols. Validate with legacy clients if required.',
        applied: false,
      };
    },
  },
];

const DOCKER_PATCH_TEMPLATES: PatchTemplate[] = [
  {
    id: 'docker-remove-latest-tag',
    findingPattern: (f) => f.id === 'docker-using-latest-tag',
    type: 'docker',
    generatePatch: (finding, content) => {
      const before = content;
      let after = content;

      // Extract base image and replace :latest with a stable version
      // Common stable versions for popular base images
      const versionMap: Record<string, string> = {
        node: '20.11.0-alpine',
        python: '3.11-slim',
        nginx: '1.25-alpine',
        alpine: '3.19',
        ubuntu: '22.04',
        debian: '12-slim',
        redis: '7-alpine',
        postgres: '16-alpine',
      };

      // Match FROM statements with :latest
      const latestRegex = /FROM\s+([a-z0-9\-\/]+):latest/gi;
      after = after.replace(latestRegex, (_match, imageName) => {
        const baseImage = imageName.split('/').pop() || imageName;
        const stableVersion = versionMap[baseImage] || '1.0.0';
        return `FROM ${imageName}:${stableVersion}`;
      });

      if (before === after) return null;

      return {
        id: 'patch-' + finding.id,
        findingId: finding.id,
        resource: finding.resource,
        type: 'docker',
        before,
        after,
        diff: generateDiff(before, after),
        assumptions: [
          'Stable version is compatible with application',
          'Build caching is acceptable',
          'Version pinning improves reproducibility',
        ],
        rollbackSteps: ['Revert FROM clause to :latest tag'],
        validationSteps: [
          'docker build --no-cache -t test .',
          'docker run --rm test --version || true',
          'Verify application starts successfully',
        ],
        safetyNotes:
          'MEDIUM-RISK: Pins to commonly-used stable version. Verify compatibility before production deployment.',
        applied: false,
      };
    },
  },
  {
    id: 'docker-add-user',
    findingPattern: (f) => f.id === 'docker-missing-user',
    type: 'docker',
    generatePatch: (finding, content) => {
      const before = content;
      let after = content;

      if (!content.includes('USER')) {
        // Add appuser pattern (common practice)
        after = content.concat(
          '\n\n# Security: run as non-root user\nRUN useradd -m -u 1000 appuser\nUSER appuser\n'
        );
      }

      if (before === after) return null;

      return {
        id: 'patch-' + finding.id,
        findingId: finding.id,
        resource: finding.resource,
        type: 'docker',
        before,
        after,
        diff: generateDiff(before, after),
        assumptions: [
          'Application does not require root',
          'Port >= 1024 is acceptable',
        ],
        rollbackSteps: ['Remove RUN useradd and USER directives'],
        validationSteps: [
          'docker build -t test .',
          'docker run --rm test id (expect uid=1000)',
        ],
        safetyNotes:
          'Low-to-medium risk. Verify application runs with uid 1000 and no elevated permissions needed.',
        applied: false,
      };
    },
  },
];

const DOCKER_COMPOSE_PATCH_TEMPLATES: PatchTemplate[] = [
  {
    id: 'docker-compose-remove-latest-tag',
    findingPattern: (f) => f.id === 'docker-compose-using-latest-tag',
    type: 'docker',
    generatePatch: (finding, content) => {
      const before = content;
      let after = content;

      // Version map for stable image versions
      const versionMap: Record<string, string> = {
        node: '20.11.0-alpine',
        python: '3.11-slim',
        nginx: '1.25-alpine',
        alpine: '3.19',
        ubuntu: '22.04',
        debian: '12-slim',
        redis: '7-alpine',
        postgres: '16-alpine',
        mysql: '8.0',
        mongo: '7.0',
      };

      // Match image: statements with :latest
      const latestRegex = /image:\s*([a-z0-9\-\/]+):latest/gi;
      after = after.replace(latestRegex, (_match, imageName) => {
        const baseImage = imageName.split('/').pop() || imageName;
        const stableVersion = versionMap[baseImage] || '1.0.0';
        return `image: ${imageName}:${stableVersion}`;
      });

      if (before === after) return null;

      return {
        id: 'patch-' + finding.id,
        findingId: finding.id,
        resource: finding.resource,
        type: 'docker',
        before,
        after,
        diff: generateDiff(before, after),
        assumptions: [
          'Stable version is compatible with service',
          'Version pinning improves reproducibility',
        ],
        rollbackSteps: ['Revert image tag to :latest', 'docker-compose up -d'],
        validationSteps: [
          'docker-compose config (validate YAML)',
          'docker-compose up -d',
          'docker-compose ps (verify services running)',
        ],
        safetyNotes:
          'MEDIUM-RISK: Pins to commonly-used stable version. Test in staging first.',
        applied: false,
      };
    },
  },
  {
    id: 'docker-compose-disable-privileged',
    findingPattern: (f) => f.id === 'docker-compose-privileged',
    type: 'docker',
    generatePatch: (finding, content) => {
      const before = content;
      const after = content.replace(/privileged:\s*true/gi, 'privileged: false');

      if (before === after) return null;

      return {
        id: 'patch-' + finding.id,
        findingId: finding.id,
        resource: finding.resource,
        type: 'docker',
        before,
        after,
        diff: generateDiff(before, after),
        assumptions: ['Service does not require privileged mode'],
        rollbackSteps: ['Revert privileged: false to true', 'docker-compose up -d'],
        validationSteps: [
          'docker-compose config',
          'docker-compose up -d',
          'Verify service functions without privileged access',
        ],
        safetyNotes:
          'MEDIUM-RISK: Removing privileged mode may break services that require host access.',
        applied: false,
      };
    },
  },
  {
    id: 'docker-compose-change-root-user',
    findingPattern: (f) => f.id === 'docker-compose-root-user',
    type: 'docker',
    generatePatch: (finding, content) => {
      const before = content;
      let after = content;

      // Replace user: root or user: "0" with non-root user
      after = after.replace(/user:\s*(root|"0"|'0')/gi, 'user: "1000:1000"');

      if (before === after) return null;

      return {
        id: 'patch-' + finding.id,
        findingId: finding.id,
        resource: finding.resource,
        type: 'docker',
        before,
        after,
        diff: generateDiff(before, after),
        assumptions: [
          'Container image supports non-root user',
          'Service does not require root privileges',
        ],
        rollbackSteps: ['Revert user to root', 'docker-compose up -d'],
        validationSteps: [
          'docker-compose config',
          'docker-compose up -d',
          'docker-compose exec <service> id (verify uid=1000)',
        ],
        safetyNotes:
          'MEDIUM-RISK: Verify container has uid 1000 user and service functions correctly.',
        applied: false,
      };
    },
  },
  {
    id: 'docker-compose-add-read-only-fs',
    findingPattern: (f) => f.id === 'docker-compose-read-only-fs',
    type: 'docker',
    generatePatch: (finding, content) => {
      const before = content;
      let after = content;

      // Add read_only: true to services that don't have it
      // This is a simplified pattern - in production you'd want more sophisticated YAML parsing
      const serviceBlockRegex = /(\s+)image:\s*\S+(\n(?:\1  .+\n)*)/g;
      after = after.replace(serviceBlockRegex, (match) => {
        if (!match.includes('read_only:')) {
          // Insert read_only after the first line
          return match.replace(/(\n)/, '\n    read_only: true$1');
        }
        return match;
      });

      if (before === after) return null;

      return {
        id: 'patch-' + finding.id,
        findingId: finding.id,
        resource: finding.resource,
        type: 'docker',
        before,
        after,
        diff: generateDiff(before, after),
        assumptions: [
          'Service does not need write access to filesystem',
          'Temporary files use tmpfs volumes',
        ],
        rollbackSteps: ['Remove read_only: true', 'docker-compose up -d'],
        validationSteps: [
          'docker-compose config',
          'docker-compose up -d',
          'Verify service starts and functions correctly',
        ],
        safetyNotes:
          'MEDIUM-to-HIGH RISK: Read-only filesystem may break services that write logs/temp files.',
        applied: false,
      };
    },
  },
];

const HELM_PATCH_TEMPLATES: PatchTemplate[] = [
  {
    id: 'helm-remove-latest-tag',
    findingPattern: (f) => f.id === 'helm-image-using-latest-tag',
    type: 'custom',
    generatePatch: (finding, content) => {
      const before = content;
      let after = content;

      // Replace tag: latest or tag: "latest" with a stable version
      after = after.replace(
        /(\s+tag:\s*)(latest|"latest"|'latest')/gi,
        '$1"1.0.0"  # Changed from latest to stable version'
      );

      if (before === after) return null;

      return {
        id: 'patch-' + finding.id,
        findingId: finding.id,
        resource: finding.resource,
        type: 'custom',
        before,
        after,
        diff: generateDiff(before, after),
        assumptions: [
          'Version 1.0.0 is a placeholder - update to actual stable version',
          'Image repository has tagged releases',
        ],
        rollbackSteps: ['Revert tag to latest in values.yaml', 'helm upgrade'],
        validationSteps: [
          'helm lint',
          'helm template . | kubectl apply --dry-run=client -f -',
          'helm upgrade --dry-run',
        ],
        safetyNotes:
          'MEDIUM-RISK: Replace 1.0.0 with actual stable version before applying.',
        applied: false,
      };
    },
  },
  {
    id: 'helm-enable-run-as-non-root',
    findingPattern: (f) => f.id === 'helm-run-as-non-root-false',
    type: 'custom',
    generatePatch: (finding, content) => {
      const before = content;
      const after = content.replace(
        /runAsNonRoot:\s*false/gi,
        'runAsNonRoot: true'
      );

      if (before === after) return null;

      return {
        id: 'patch-' + finding.id,
        findingId: finding.id,
        resource: finding.resource,
        type: 'custom',
        before,
        after,
        diff: generateDiff(before, after),
        assumptions: [
          'Container image has non-root user configured',
          'Application does not require root privileges',
        ],
        rollbackSteps: ['Revert runAsNonRoot to false', 'helm upgrade'],
        validationSteps: [
          'helm lint',
          'helm upgrade --dry-run',
          'Deploy to test environment and verify pod starts',
        ],
        safetyNotes:
          'LOW-to-MEDIUM RISK: Verify container image supports non-root execution.',
        applied: false,
      };
    },
  },
  {
    id: 'helm-disable-privileged',
    findingPattern: (f) => f.id === 'helm-privileged-true',
    type: 'custom',
    generatePatch: (finding, content) => {
      const before = content;
      const after = content.replace(/privileged:\s*true/gi, 'privileged: false');

      if (before === after) return null;

      return {
        id: 'patch-' + finding.id,
        findingId: finding.id,
        resource: finding.resource,
        type: 'custom',
        before,
        after,
        diff: generateDiff(before, after),
        assumptions: ['Workload does not require privileged container access'],
        rollbackSteps: ['Revert privileged to true', 'helm upgrade'],
        validationSteps: [
          'helm lint',
          'helm upgrade --dry-run',
          'Test in non-production environment',
        ],
        safetyNotes:
          'MEDIUM-to-HIGH RISK: Removing privileged access may break system-level operations.',
        applied: false,
      };
    },
  },
];

const KUBERNETES_PATCH_TEMPLATES: PatchTemplate[] = [
  {
    id: 'k8s-add-security-context',
    findingPattern: (f) =>
      f.id === 'k8s-container-may-run-as-root' ||
      f.id === 'k8s-privileged-container' ||
      f.id === 'k8s-root-container',
    type: 'kubernetes',
    generatePatch: (finding, content) => {
      const before = content;
      let after = content;

      // This is a simplified example
      if (content.includes('containers:') && !content.includes('securityContext:')) {
        after = content.replace(
          /containers:/,
          `securityContext:\n      runAsNonRoot: true\n      runAsUser: 1000\n      allowPrivilegeEscalation: false\n      capabilities:\n        drop:\n          - ALL\n    containers:`
        );
      }

      if (before === after) return null;

      return {
        id: 'patch-' + finding.id,
        findingId: finding.id,
        resource: finding.resource,
        type: 'kubernetes',
        before,
        after,
        diff: generateDiff(before, after),
        assumptions: [
          'Application does not require privileges',
          'Container image has non-root user (uid 1000)',
        ],
        rollbackSteps: [
          'Remove or revert securityContext section',
          'kubectl apply -f manifest.yaml',
        ],
        validationSteps: [
          'kubectl apply --dry-run=client -f manifest.yaml',
          'kubectl get pod -o yaml | grep securityContext',
        ],
        safetyNotes:
          'Medium-risk. Test thoroughly in dev/staging before production rollout.',
        applied: false,
      };
    },
  },
  {
    id: 'k8s-add-resource-limits',
    findingPattern: (f) =>
      f.id === 'k8s-missing-resource-limits' ||
      f.id === 'k8s-no-resource-limits' ||
      f.category === 'kubernetes-resource-mgmt',
    type: 'kubernetes',
    generatePatch: (finding, content) => {
      const before = content;
      let after = content;

      // Add resource limits to containers section
      if (
        content.includes('containers:') &&
        !content.includes('resources:')
      ) {
        after = content.replace(
          /(containers:\s*\n\s*-\s*name:\s*\S+)/,
          `$1\n        resources:\n          requests:\n            memory: "128Mi"\n            cpu: "100m"\n          limits:\n            memory: "256Mi"\n            cpu: "500m"`
        );
      }

      if (before === after) return null;

      return {
        id: 'patch-' + finding.id,
        findingId: finding.id,
        resource: finding.resource,
        type: 'kubernetes',
        before,
        after,
        diff: generateDiff(before, after),
        assumptions: [
          'Application can run within 256Mi memory',
          'Application does not need > 500m CPU',
          'QoS class: Burstable is acceptable',
        ],
        rollbackSteps: [
          'Remove resources section from container spec',
          'kubectl apply -f manifest.yaml',
        ],
        validationSteps: [
          'kubectl apply --dry-run=client -f manifest.yaml',
          'kubectl top pod <pod-name> (verify usage within limits)',
          'Test application under normal load',
        ],
        safetyNotes:
          'LOW-RISK: Conservative limits set. Monitor pod for OOMKilled events and adjust if needed.',
        applied: false,
      };
    },
  },
  {
    id: 'k8s-disable-privilege-escalation',
    findingPattern: (f) => f.id === 'k8s-allow-privilege-escalation',
    type: 'kubernetes',
    generatePatch: (finding, content) => {
      const before = content;
      let after = content;

      if (content.includes('securityContext:')) {
        after = content.replace(
          /securityContext:\s*\n/,
          `securityContext:\n      allowPrivilegeEscalation: false\n`
        );
      }

      if (before === after) return null;

      return {
        id: 'patch-' + finding.id,
        findingId: finding.id,
        resource: finding.resource,
        type: 'kubernetes',
        before,
        after,
        diff: generateDiff(before, after),
        assumptions: ['Application does not require privilege escalation'],
        rollbackSteps: ['Remove allowPrivilegeEscalation from securityContext'],
        validationSteps: ['kubectl apply --dry-run=client -f manifest.yaml'],
        safetyNotes:
          'Low-risk. Prevents privilege escalation within the container.',
        applied: false,
      };
    },
  },
  {
    id: 'k8s-drop-all-capabilities',
    findingPattern: (f) => f.id === 'k8s-capabilities-not-dropped',
    type: 'kubernetes',
    generatePatch: (finding, content) => {
      const before = content;
      let after = content;

      if (content.includes('securityContext:')) {
        after = content.replace(
          /securityContext:\s*\n/,
          `securityContext:\n      capabilities:\n        drop:\n          - ALL\n`
        );
      }

      if (before === after) return null;

      return {
        id: 'patch-' + finding.id,
        findingId: finding.id,
        resource: finding.resource,
        type: 'kubernetes',
        before,
        after,
        diff: generateDiff(before, after),
        assumptions: ['Dropping Linux capabilities does not break workload'],
        rollbackSteps: ['Remove capabilities.drop section'],
        validationSteps: ['kubectl apply --dry-run=client -f manifest.yaml'],
        safetyNotes:
          'Medium-risk. Dropping capabilities may require app testing.',
        applied: false,
      };
    },
  },
  {
    id: 'k8s-replace-cluster-admin',
    findingPattern: (f) => f.id === 'k8s-cluster-admin-binding',
    type: 'kubernetes',
    generatePatch: (finding, content) => {
      const before = content;
      const after = content.replace(
        /name:\s*cluster-admin/g,
        'name: view'
      );

      if (before === after) return null;

      return {
        id: 'patch-' + finding.id,
        findingId: finding.id,
        resource: finding.resource,
        type: 'kubernetes',
        before,
        after,
        diff: generateDiff(before, after),
        assumptions: [
          'Read-only access is sufficient for affected subjects',
          'Least privilege is acceptable for this binding',
        ],
        rollbackSteps: ['Revert roleRef.name back to cluster-admin'],
        validationSteps: ['kubectl auth can-i --as <subject> --list'],
        safetyNotes:
          'High-impact change. Validate RBAC requirements carefully.',
        applied: false,
      };
    },
  },
];

export class PatchEngine {
  private templates: PatchTemplate[] = [
    ...NGINX_PATCH_TEMPLATES,
    ...DOCKER_PATCH_TEMPLATES,
    ...DOCKER_COMPOSE_PATCH_TEMPLATES,
    ...HELM_PATCH_TEMPLATES,
    ...KUBERNETES_PATCH_TEMPLATES,
  ];

  async generatePatches(
    findings: SecurityFinding[],
    _workspaceRoot: string
  ): Promise<SecurityPatch[]> {
    const patches: SecurityPatch[] = [];

    for (const finding of findings) {
      const template = this.templates.find((t) =>
        t.findingPattern(finding)
      );

      if (!template) {
        console.warn(`No patch template found for finding: ${finding.id}`);
        continue;
      }

      try {
        const content = await fs.readFile(finding.resource, 'utf-8');
        const patch = template.generatePatch(finding, content);

        if (patch) {
          patches.push(patch);
        }
      } catch (error) {
        console.warn(
          `Could not generate patch for ${finding.resource}:`,
          error
        );
      }
    }

    return patches;
  }
}

function generateDiff(before: string, after: string): string {
  const beforeLines = before.split('\n');
  const afterLines = after.split('\n');
  const diff: string[] = [];

  const maxLen = Math.max(beforeLines.length, afterLines.length);

  for (let i = 0; i < maxLen; i++) {
    const beforeLine = beforeLines[i] || '';
    const afterLine = afterLines[i] || '';

    if (beforeLine !== afterLine) {
      if (beforeLine) {
        diff.push(`- ${beforeLine}`);
      }
      if (afterLine) {
        diff.push(`+ ${afterLine}`);
      }
    } else {
      diff.push(`  ${beforeLine}`);
    }
  }

  return diff.join('\n');
}

export function createPatchEngine(): PatchEngine {
  return new PatchEngine();
}
