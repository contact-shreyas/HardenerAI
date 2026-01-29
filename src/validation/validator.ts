/**
 * Validator for ensuring patches are safe and correct
 */

import { SecurityPatch, ValidationResult } from '../types.js';

export class Validator {
  /**
   * Validate a patch against known patterns
   */
  async validatePatch(patch: SecurityPatch): Promise<ValidationResult> {
    const timestamp = new Date();

    // Basic syntax checks based on type
    if (patch.type === 'nginx') {
      return this.validateNginx(patch, timestamp);
    }

    if (patch.type === 'docker') {
      return this.validateDocker(patch, timestamp);
    }

    if (patch.type === 'kubernetes') {
      return this.validateKubernetes(patch, timestamp);
    }

    return {
      patchId: patch.id,
      passed: false,
      message: `Unknown patch type: ${patch.type}`,
      timestamp,
    };
  }

  private async validateNginx(
    patch: SecurityPatch,
    timestamp: Date
  ): Promise<ValidationResult> {
    // Check for syntax errors in nginx config
    const hasBalancedBraces =
      (patch.after.match(/{/g) || []).length ===
      (patch.after.match(/}/g) || []).length;

    if (!hasBalancedBraces) {
      return {
        patchId: patch.id,
        passed: false,
        message: 'Nginx config syntax error: unbalanced braces',
        timestamp,
      };
    }

    // Check for empty content
    if (patch.after.trim().length === 0) {
      return {
        patchId: patch.id,
        passed: false,
        message: 'Nginx config is empty',
        timestamp,
      };
    }

    return {
      patchId: patch.id,
      passed: true,
      message: 'Nginx config is valid',
      timestamp,
    };
  }

  private async validateDocker(
    patch: SecurityPatch,
    timestamp: Date
  ): Promise<ValidationResult> {
    // Check for common Docker anti-patterns
    const afterLines = patch.after.split('\n');

    // Check for FROM directive
    const hasFrom = afterLines.some((line) =>
      /^FROM\s+/i.test(line)
    );

    if (!hasFrom) {
      return {
        patchId: patch.id,
        passed: false,
        message: 'Dockerfile must have FROM directive',
        timestamp,
      };
    }

    // Check for obvious syntax errors
    const invalidDirectives = afterLines.filter(
      (line) =>
        /^(RUN|CMD|ENTRYPOINT|COPY|ADD|WORKDIR|USER|EXPOSE|ENV|ARG|HEALTHCHECK|ONBUILD|LABEL)\s+/i.test(
          line
        ) && !line.includes(' ')
    );

    if (invalidDirectives.length > 0) {
      return {
        patchId: patch.id,
        passed: false,
        message: `Dockerfile has invalid directives: ${invalidDirectives.join(', ')}`,
        timestamp,
      };
    }

    return {
      patchId: patch.id,
      passed: true,
      message: 'Dockerfile syntax valid',
      timestamp,
    };
  }

  private async validateKubernetes(
    patch: SecurityPatch,
    timestamp: Date
  ): Promise<ValidationResult> {
    // Basic YAML structure validation
    const lines = patch.after.split('\n');

    // Check for common K8s resource kinds
    const hasKind = lines.some((line) => /^kind:\s+/i.test(line));

    if (!hasKind) {
      return {
        patchId: patch.id,
        passed: false,
        message: 'Kubernetes manifest must have kind field',
        timestamp,
      };
    }

    // Check for valid indentation
    for (const line of lines) {
      if (line.trim().length === 0) continue;

      const indent = line.search(/\S/);
      // YAML should have even indentation (typically 2 or 4 spaces)
      if (indent % 2 !== 0) {
        return {
          patchId: patch.id,
          passed: false,
          message: `Kubernetes manifest has invalid indentation at: ${line.substring(0, 50)}`,
          timestamp,
        };
      }
    }

    // Try dry-run if kubectl available
    try {
      // This would require kubectl to be installed
      // const { stderr } = await execPromise(`kubectl apply --dry-run=client -f ${patch.resource}`);
      // For now, just return success on basic checks
    } catch (error) {
      // kubectl not available, skip
    }

    return {
      patchId: patch.id,
      passed: true,
      message: 'Kubernetes manifest syntax valid',
      timestamp,
    };
  }
}

export function createValidator(): Validator {
  return new Validator();
}
