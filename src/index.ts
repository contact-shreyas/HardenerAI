/**
 * Main entry point - exports all public APIs
 */

export type {
  SecurityFinding,
  RiskScore,
  SecurityPatch,
  HardeningReport,
  FindingGroup,
  PrioritizedFinding,
  ValidationResult,
  RollbackResult,
  ReportStatistics,
  HardenerConfig,
  ScannerOutput,
} from './types.js';

export { createRiskScorer, RiskScorer } from './scoring/riskScorer.js';
export { createConfigReader, ConfigReader } from './ingestion/configReader.js';
export { createPatchEngine, PatchEngine } from './patching/patchEngine.js';
export { createValidator, Validator } from './validation/validator.js';
export { createRollbackManager, RollbackManager } from './safety/rollbackManager.js';
export { createReportGenerator, ReportGenerator } from './reporting/reportGenerator.js';
export { createHistoryManager, HistoryManager } from './reporting/historyManager.js';
export { FindingGrouper } from './deduplication/grouper.js';
export { createConfigLoader, ConfigLoader } from './config/configLoader.js';
export { createOrchestrator, Orchestrator } from './orchestrator.js';
export type { OrchestratorOptions } from './orchestrator.js';
