import { describe, it, expect } from 'vitest';
import { createValidator } from '../../src/validation/validator';
import { SecurityPatch } from '../../src/types';

describe('Validator', () => {
  const validator = createValidator();

  it('validates correct nginx configuration syntax', async () => {
    const patch: SecurityPatch = {
      id: 'test-patch-1',
      findingId: 'test-1',
      resource: 'nginx.conf',
      type: 'nginx',
      before: 'server { listen 80; }',
      after: 'server { listen 80; server_tokens off; }',
      diff: '+ server_tokens off;',
      assumptions: [],
      rollbackSteps: [],
      validationSteps: [],
      safetyNotes: 'Test',
      applied: false,
    };

    const result = await validator.validatePatch(patch);

    expect(result.passed).toBe(true);
    expect(result.message).toContain('valid');
  });

  it('detects unbalanced braces in nginx config', async () => {
    const patch: SecurityPatch = {
      id: 'test-patch-2',
      findingId: 'test-2',
      resource: 'nginx.conf',
      type: 'nginx',
      before: 'server { listen 80; }',
      after: 'server { { listen 80; }', // Unbalanced
      diff: '',
      assumptions: [],
      rollbackSteps: [],
      validationSteps: [],
      safetyNotes: 'Test',
      applied: false,
    };

    const result = await validator.validatePatch(patch);

    expect(result.passed).toBe(false);
  });

  it('validates Docker configuration syntax', async () => {
    const patch: SecurityPatch = {
      id: 'test-patch-3',
      findingId: 'test-3',
      resource: 'Dockerfile',
      type: 'docker',
      before: 'FROM node:latest\nRUN npm install',
      after:
        'FROM node:20\nRUN npm install\nUSER appuser',
      diff: '+FROM node:20\n+USER appuser',
      assumptions: [],
      rollbackSteps: [],
      validationSteps: [],
      safetyNotes: 'Test',
      applied: false,
    };

    const result = await validator.validatePatch(patch);

    expect(result.passed).toBe(true);
  });

  it('validates Kubernetes manifest syntax', async () => {
    const patch: SecurityPatch = {
      id: 'test-patch-4',
      findingId: 'test-4',
      resource: 'pod.yaml',
      type: 'kubernetes',
      before: 'apiVersion: v1\nkind: Pod\nmetadata:',
      after:
        'apiVersion: v1\nkind: Pod\nmetadata:\n  name: test\nspec:',
      diff: '+  name: test\n+spec:',
      assumptions: [],
      rollbackSteps: [],
      validationSteps: [],
      safetyNotes: 'Test',
      applied: false,
    };

    const result = await validator.validatePatch(patch);

    expect(result.passed).toBe(true);
  });
});
