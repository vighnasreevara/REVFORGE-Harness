import Ajv, { ErrorObject, ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';
import * as fs from 'fs';
import * as path from 'path';

const BASE = 'https://revforge.local/contracts/';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/** Loads every *.schema.json under the contracts directory and compiles on demand. */
export class ContractRegistry {
  private readonly ajv: Ajv;
  private readonly cache = new Map<string, ValidateFunction>();
  readonly names: string[] = [];

  constructor(readonly contractsDir: string) {
    this.ajv = new Ajv({ allErrors: true, strict: false });
    addFormats(this.ajv);
    for (const file of walk(contractsDir)) {
      if (!file.endsWith('.schema.json')) continue;
      const schema = JSON.parse(fs.readFileSync(file, 'utf8'));
      const rel = path.relative(contractsDir, file).split(path.sep).join('/');
      if (!schema.$id) schema.$id = BASE + rel;
      this.ajv.addSchema(schema);
      this.names.push(rel.replace(/\.schema\.json$/, ''));
    }
  }

  /** `name` is the path under contracts/ without ".schema.json", e.g. "input/rules-artifact". */
  validate(name: string, data: unknown): ValidationResult {
    let fn = this.cache.get(name);
    if (!fn) {
      fn = this.ajv.getSchema(`${BASE}${name}.schema.json`);
      if (!fn) throw new Error(`unknown contract: ${name}`);
      this.cache.set(name, fn);
    }
    const valid = fn(data) as boolean;
    return { valid, errors: valid ? [] : formatErrors(fn.errors ?? []) };
  }
}

function formatErrors(errors: ErrorObject[], limit = 25): string[] {
  const out = errors.slice(0, limit).map((e) => `${e.instancePath || '/'} ${e.message ?? 'invalid'}${e.params && 'allowedValues' in e.params ? ` ${JSON.stringify((e.params as { allowedValues: unknown }).allowedValues)}` : ''}`);
  if (errors.length > limit) out.push(`... ${errors.length - limit} more`);
  return out;
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out.sort();
}
