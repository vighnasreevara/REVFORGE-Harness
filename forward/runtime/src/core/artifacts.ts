import * as fs from 'fs';
import * as path from 'path';
import { RuntimeContext } from './config';
import { combinedHash, readJson, sha256File } from './fsutil';

/** Reverse artifact keys and the input contract each must satisfy. */
export const ARTIFACT_CONTRACTS: Record<string, string> = {
  inventory: 'input/inventory-artifact',
  parser: 'input/parser-artifact',
  data: 'input/data-artifact',
  logic: 'input/logic-artifact',
  rules: 'input/rules-artifact',
  diagrams: 'input/diagrams-artifact',
  gaps: 'input/gaps-register',
};

export interface LoadedArtifact {
  key: string;
  path: string;
  repo_path: string;
  required: boolean;
  format: 'json' | 'markdown';
  present: boolean;
  parsed: boolean;
  valid: boolean;
  errors: string[];
  sha256: string | null;
  bytes: number | null;
  agent_version: string | null;
  generated_at: string | null;
  run_ids: string[];
  data: any;
}

export interface PerProgramFile {
  kind: 'logic' | 'raw_structure';
  program_id: string;
  file_id: string | null;
  repo_path: string;
  present: boolean;
  valid: boolean;
  errors: string[];
  sha256: string | null;
  data: any;
}

export interface ArtifactSet {
  artifacts: Record<string, LoadedArtifact>;
  logicFiles: PerProgramFile[];
  rawStructureFiles: PerProgramFile[];
  perProgramHashes: { logic: { count: number; sha256: string }; raw_structure: { count: number; sha256: string } };
}

function runIdsOf(meta: any): string[] {
  if (!meta || typeof meta !== 'object') return [];
  const out = new Set<string>();
  for (const k of ['parse_run_ids', 'data_run_ids']) {
    if (Array.isArray(meta[k])) for (const x of meta[k]) if (typeof x === 'string') out.add(x);
  }
  const sa = meta.source_artifacts;
  if (sa && typeof sa === 'object') {
    for (const k of ['parse_run_ids', 'data_run_ids']) if (Array.isArray(sa[k])) for (const x of sa[k]) out.add(x);
  }
  return [...out].sort();
}

function loadOne(ctx: RuntimeContext, key: string, rel: string, required: boolean): LoadedArtifact {
  const abs = path.resolve(ctx.repoRoot, rel);
  const isJson = rel.toLowerCase().endsWith('.json');
  const base: LoadedArtifact = {
    key,
    path: abs,
    repo_path: rel,
    required,
    format: isJson ? 'json' : 'markdown',
    present: fs.existsSync(abs),
    parsed: false,
    valid: false,
    errors: [],
    sha256: null,
    bytes: null,
    agent_version: null,
    generated_at: null,
    run_ids: [],
    data: null,
  };
  if (!base.present) {
    base.errors.push(`missing ${required ? 'required' : 'optional'} artifact: ${rel}`);
    return base;
  }
  if (!isJson) {
    base.sha256 = sha256File(abs);
    base.bytes = fs.statSync(abs).size;
    base.parsed = true;
    base.valid = base.bytes > 0;
    if (!base.valid) base.errors.push(`${rel} is empty`);
    base.data = fs.readFileSync(abs, 'utf8');
    return base;
  }
  const r = readJson(abs);
  if (!r.ok) {
    base.errors.push(`${rel}: ${r.reason}: ${r.error}`);
    base.sha256 = sha256File(abs);
    return base;
  }
  base.parsed = true;
  base.sha256 = r.sha256;
  base.bytes = r.bytes;
  base.data = r.data;
  const meta = (r.data as any)?.meta;
  base.agent_version = typeof meta?.agent_version === 'string' ? meta.agent_version : null;
  base.generated_at = typeof meta?.generated_at === 'string' ? meta.generated_at : null;
  base.run_ids = runIdsOf(meta);
  const contract = ARTIFACT_CONTRACTS[key];
  if (contract) {
    const v = ctx.contracts.validate(contract, r.data);
    base.valid = v.valid;
    base.errors.push(...v.errors.map((e) => `${rel}: ${e}`));
  } else {
    base.valid = true;
  }
  return base;
}

/** Loads all configured reverse artifacts plus per-program logic and raw_structure files. */
export function loadArtifacts(ctx: RuntimeContext): ArtifactSet {
  const artifacts: Record<string, LoadedArtifact> = {};
  for (const [k, rel] of Object.entries(ctx.config.reverse_artifacts)) artifacts[k] = loadOne(ctx, k, rel, true);
  for (const [k, rel] of Object.entries(ctx.config.optional_artifacts ?? {})) artifacts[k] = loadOne(ctx, k, rel, false);

  const logicFiles: PerProgramFile[] = [];
  const logic = artifacts.logic;
  if (logic?.valid) {
    const dir = path.dirname(logic.path);
    for (const p of logic.data.programs as any[]) {
      if (!p.logic_file) continue;
      logicFiles.push(loadPerProgram(ctx, 'logic', p.program_id, p.file_id ?? null, path.resolve(dir, p.logic_file), 'input/logic-program-file'));
    }
  }
  const rawStructureFiles: PerProgramFile[] = [];
  const parser = artifacts.parser;
  if (parser?.valid) {
    const dir = path.dirname(parser.path);
    for (const p of parser.data.programs as any[]) {
      if (!p.ast_file) continue;
      const f = p.ast_file.endsWith('.json') ? p.ast_file : `${p.ast_file}.json`;
      rawStructureFiles.push(loadPerProgram(ctx, 'raw_structure', p.program_id, p.file_id ?? null, path.resolve(dir, f), null));
    }
  }
  return {
    artifacts,
    logicFiles,
    rawStructureFiles,
    perProgramHashes: {
      logic: combinedHash(logicFiles.map((f) => path.resolve(ctx.repoRoot, f.repo_path))),
      raw_structure: combinedHash(rawStructureFiles.map((f) => path.resolve(ctx.repoRoot, f.repo_path))),
    },
  };
}

function loadPerProgram(
  ctx: RuntimeContext,
  kind: PerProgramFile['kind'],
  programId: string,
  fileId: string | null,
  abs: string,
  contract: string | null,
): PerProgramFile {
  const repo_path = path.relative(ctx.repoRoot, abs).split(path.sep).join('/');
  const r = readJson(abs);
  if (!r.ok) {
    return { kind, program_id: programId, file_id: fileId, repo_path, present: r.reason !== 'missing', valid: false, errors: [`${repo_path}: ${r.reason}: ${r.error}`], sha256: null, data: null };
  }
  const errors: string[] = [];
  let valid = true;
  if (contract) {
    const v = ctx.contracts.validate(contract, r.data);
    valid = v.valid;
    errors.push(...v.errors.map((e) => `${repo_path}: ${e}`));
  }
  const declared = (r.data as any)?.file_id;
  if (fileId && declared && declared !== fileId) {
    valid = false;
    errors.push(`${repo_path}: file_id ${declared} differs from the manifest entry ${fileId}`);
  }
  return { kind, program_id: programId, file_id: fileId, repo_path, present: true, valid, errors, sha256: r.sha256, data: r.data };
}

export function requiredFailures(set: ArtifactSet): LoadedArtifact[] {
  return Object.values(set.artifacts).filter((a) => a.required && (!a.present || !a.parsed || !a.valid));
}
