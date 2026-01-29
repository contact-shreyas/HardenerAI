/**
 * Configuration loader from YAML
 */

import { promises as fs } from 'fs';
import * as yaml from 'js-yaml';
import path from 'path';
import { HardenerConfig } from '../types.js';

const DEFAULT_CONFIG: HardenerConfig = {
  target: './',
  scanners: {
    enabled: ['config-reader'],
    custom: {
      enabled: true,
    },
  },
  autoFix: {
    enabled: false,
    categories: ['nginx-config', 'dockerfile'],
  },
  validation: {
    enabled: true,
    strict: false,
  },
  rollback: {
    enabled: false,
    autoRollbackOnFailure: false,
  },
  reporting: {
    outputDir: '.hardener/reports',
    markdown: true,
    json: true,
  },
  thresholds: {
    ignoreBelow: 20,
    warnAbove: 60,
    criticalAbove: 80,
  },
};

export class ConfigLoader {
  async loadConfig(configPath?: string): Promise<HardenerConfig> {
    if (!configPath) {
      // Try default location
      const defaultPath = path.join('.hardener', 'config.yaml');
      try {
        return await this.loadFromFile(defaultPath);
      } catch {
        return DEFAULT_CONFIG;
      }
    }

    return this.loadFromFile(configPath);
  }

  private async loadFromFile(filePath: string): Promise<HardenerConfig> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const parsed = yaml.load(content);

      if (typeof parsed !== 'object' || parsed === null) {
        throw new Error('Invalid config file');
      }

      // Merge with defaults
      return {
        ...DEFAULT_CONFIG,
        ...(parsed as Partial<HardenerConfig>),
      };
    } catch (error) {
      console.warn(`Could not load config from ${filePath}:`, error);
      return DEFAULT_CONFIG;
    }
  }

  async generateDefaultConfig(outputPath: string): Promise<void> {
    const configYaml = `# AI-Driven Cybersecurity Config Hardening
# Configuration file for the hardener tool

target: ./

scanners:
  enabled:
    - config-reader
    # - trivy
    # - kube-bench
  
  trivy:
    enabled: false
    scanType: config

  kubeBench:
    enabled: false

  custom:
    enabled: true
    rulesPath: .hardener/custom-rules.json

autoFix:
  enabled: false
  categories:
    - nginx-config
    - dockerfile
    - kubernetes-pod-security
  # Patterns to exclude from auto-fix
  excludePatterns:
    - "**/production/**"
    - "sensitive-*.yaml"

validation:
  enabled: true
  strict: false

rollback:
  enabled: false
  autoRollbackOnFailure: false

reporting:
  outputDir: .hardener/reports
  markdown: true
  json: true

# Risk scoring thresholds
thresholds:
  ignoreBelow: 20
  warnAbove: 60
  criticalAbove: 80
`;

    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, configYaml);
  }
}

export function createConfigLoader(): ConfigLoader {
  return new ConfigLoader();
}
