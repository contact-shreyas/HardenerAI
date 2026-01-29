#!/usr/bin/env node
/**
 * CLI entry point for the hardener tool
 */

import minimist from 'minimist';
import { z } from 'zod';
import { createOrchestrator } from './orchestrator.js';
import { createConfigLoader } from './config/configLoader.js';

async function main(): Promise<void> {
  const argv = minimist(process.argv.slice(2), {
    boolean: [
      'dry-run',
      'apply',
      'enable-rollback',
      'init-config',
      'help',
      'h',
    ],
    string: ['target', 'config'],
    default: { 'dry-run': true },
  });

  const schema = z.object({
    target: z.string().optional(),
    config: z.string().optional(),
    'dry-run': z.boolean().optional(),
    apply: z.boolean().optional(),
    'enable-rollback': z.boolean().optional(),
    'init-config': z.boolean().optional(),
    help: z.boolean().optional(),
    h: z.boolean().optional(),
  });

  const parsed = schema.safeParse(argv);
  if (!parsed.success) {
    console.error('Invalid CLI arguments:', parsed.error.flatten());
    process.exit(1);
  }

  const help = argv.help || argv.h;
  if (help) {
    console.log(`
AI-Driven Cybersecurity Config Hardening Tool

Usage:
  pnpm harden [options]

Options:
  --target <path>         Target directory to scan (default: ./)
  --config <path>         Config file path (default: .hardener/config.yaml)
  --dry-run               Show changes without applying (default: true)
  --apply                 Apply patches to files
  --enable-rollback       Enable snapshot and auto-rollback on failure
  --init-config           Generate default config file
  --help, -h              Show this help message

Examples:
  # Scan and report (dry-run)
  pnpm harden --target ./

  # Generate default config
  pnpm harden --init-config

  # Apply patches with rollback enabled
  pnpm harden --target ./ --apply --enable-rollback
    `);
    process.exit(0);
  }

  const initConfig = argv['init-config'];
  if (initConfig) {
    const configLoader = createConfigLoader();
    const configPath = argv.config || '.hardener/config.yaml';
    await configLoader.generateDefaultConfig(configPath);
    console.log(`✓ Generated default config at: ${configPath}`);
    process.exit(0);
  }

  try {
    const configLoader = createConfigLoader();
    const config = await configLoader.loadConfig(argv.config);

    const orchestrator = createOrchestrator();
    await orchestrator.harden({
      target: argv.target || config.target || './',
      config,
      dryRun: argv['dry-run'] !== false && !argv.apply,
      apply: argv.apply === true,
      enableRollback: argv['enable-rollback'] === true,
      configPath: argv.config,
    });

    process.exit(0);
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
