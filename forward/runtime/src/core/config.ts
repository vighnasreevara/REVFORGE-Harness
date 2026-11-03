import * as fs from 'fs';
import * as path from 'path';
import { ContractRegistry } from './contracts';
import { readJson, sha256File } from './fsutil';
import { GenerationPolicy } from './guard';

export interface ForwardConfig {
  config_version: string;
  repo_root: string;
  reverse_artifacts: Record<string, string>;
  optional_artifacts?: Record<string, string>;
  cobol_source?: { root?: string | null; env_var?: string };
  selection: { programs: 'all' | string[] };
  runs_dir: string;
  generation: GenerationPolicy & { note?: string };
  neo4j: { live_verification: boolean; note?: string };
  /** STEP 21: BMad is mandatory for the governed forward workflow (see runtime/src/bmad/governance.ts). */
  bmad_governance?: { mandatory: boolean; note?: string };
}

export interface RuntimeContext {
  forwardDir: string;
  repoRoot: string;
  configPath: string;
  configSha256: string | null;
  config: ForwardConfig;
  contracts: ContractRegistry;
  runsDir: string;
  /** Absolute COBOL source root, or null when not configured. */
  sourceRoot: string | null;
  sourceRootOrigin: 'cli' | 'env' | 'config' | 'none';
}

export interface ContextOptions {
  forwardDir?: string;
  configPath?: string;
  repoRoot?: string;
  sourceRoot?: string;
  runsDir?: string;
  programs?: string[] | 'all';
}

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

/** The forward/ directory: compiled files live in forward/dist/runtime/src/core. */
export function defaultForwardDir(): string {
  return path.resolve(__dirname, '..', '..', '..', '..');
}

export function loadContext(opts: ContextOptions = {}): RuntimeContext {
  const forwardDir = path.resolve(opts.forwardDir ?? defaultForwardDir());
  const contracts = new ContractRegistry(path.join(forwardDir, 'contracts'));
  const configPath = path.resolve(opts.configPath ?? path.join(forwardDir, 'config', 'forward.config.json'));
  const read = readJson(configPath);
  if (!read.ok) throw new ConfigError(`cannot read configuration ${configPath}: ${read.error}`);
  const v = contracts.validate('forward-config', read.data);
  if (!v.valid) throw new ConfigError(`invalid configuration ${configPath}:\n  ${v.errors.join('\n  ')}`);
  const config = read.data as ForwardConfig;
  if (opts.programs) config.selection = { programs: opts.programs };

  const repoRoot = path.resolve(opts.repoRoot ?? path.resolve(forwardDir, config.repo_root));
  const runsDir = path.resolve(opts.runsDir ?? path.resolve(repoRoot, config.runs_dir));

  let sourceRoot: string | null = null;
  let sourceRootOrigin: RuntimeContext['sourceRootOrigin'] = 'none';
  const envVar = config.cobol_source?.env_var;
  if (opts.sourceRoot) {
    sourceRoot = path.resolve(opts.sourceRoot);
    sourceRootOrigin = 'cli';
  } else if (envVar && process.env[envVar]) {
    sourceRoot = path.resolve(process.env[envVar] as string);
    sourceRootOrigin = 'env';
  } else if (config.cobol_source?.root) {
    sourceRoot = path.resolve(repoRoot, config.cobol_source.root);
    sourceRootOrigin = 'config';
  }

  return {
    forwardDir,
    repoRoot,
    configPath,
    configSha256: sha256File(configPath),
    config,
    contracts,
    runsDir,
    sourceRoot,
    sourceRootOrigin,
  };
}

export function exists(p: string): boolean {
  return fs.existsSync(p);
}
