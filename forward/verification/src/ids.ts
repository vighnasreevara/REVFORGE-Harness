/**
 * Identifier classification. Permanent source IDs come from the reverse
 * harness's Neo4j registry and are copied unchanged; catalogue IDs (BR-, RS-,
 * GAP-, ...) are run-local and only meaningful with the reverse run that
 * produced them.
 */

export type PermanentIdKind =
  | 'system'
  | 'file'
  | 'path'
  | 'section'
  | 'paragraph'
  | 'statement'
  | 'record'
  | 'field';

export type RunLocalIdKind = 'rule' | 'rule_set' | 'gap' | 'assumption' | 'error_handler' | 'relationship' | 'condition';

const SYS = 'SYS-[A-Z0-9]{2,20}-[0-9]{3}';
const FIL = `${SYS}-FIL-[0-9]{4}`;

const PERMANENT: Array<[PermanentIdKind, RegExp]> = [
  ['statement', new RegExp(`^${FIL}-STMT-[0-9]{6}$`)],
  ['paragraph', new RegExp(`^${FIL}-PAR-[0-9]{4}$`)],
  ['section', new RegExp(`^${FIL}-SEC-[0-9]{4}$`)],
  ['record', new RegExp(`^${FIL}-REC-[0-9]{4}$`)],
  ['field', new RegExp(`^${FIL}-FLD-[0-9]{6}$`)],
  ['file', new RegExp(`^${FIL}$`)],
  ['path', new RegExp(`^${SYS}-PATH-[0-9]{4}$`)],
  ['system', new RegExp(`^${SYS}$`)],
];

const RUN_LOCAL: Array<[RunLocalIdKind, RegExp]> = [
  ['rule', /^BR-[0-9]{3,}$/],
  ['rule_set', /^RS-[0-9]{3,}$/],
  ['gap', /^GAP-[0-9]{3,}$/],
  ['assumption', /^ASM-[0-9]{3,}$/],
  ['error_handler', /^EH-[0-9]{3,}$/],
  ['relationship', /^REL-[0-9]{3,}$/],
  ['condition', /^COND-[A-Z0-9-]+$/],
];

export function permanentIdKind(id: unknown): PermanentIdKind | null {
  if (typeof id !== 'string') return null;
  for (const [kind, re] of PERMANENT) if (re.test(id)) return kind;
  return null;
}

export function isPermanentId(id: unknown): id is string {
  return permanentIdKind(id) !== null;
}

export function runLocalIdKind(id: unknown): RunLocalIdKind | null {
  if (typeof id !== 'string') return null;
  for (const [kind, re] of RUN_LOCAL) if (re.test(id)) return kind;
  return null;
}

/** File ID that owns a permanent ID (the ID itself for a file ID); null for system/path IDs. */
export function owningFileId(id: string): string | null {
  const m = new RegExp(`^(${FIL})(?:-|$)`).exec(id);
  return m ? m[1] : null;
}

/** System ID prefix of any permanent ID. */
export function owningSystemId(id: string): string | null {
  const m = new RegExp(`^(${SYS})(?:-|$)`).exec(id);
  return m ? m[1] : null;
}

/**
 * Collects every permanent ID found anywhere in a JSON value, grouped by kind.
 * Strings that only look similar (truncated IDs, IDs embedded in prose) are
 * not matched: only whole string values are classified.
 */
export function collectPermanentIds(value: unknown): Map<PermanentIdKind, Set<string>> {
  const out = new Map<PermanentIdKind, Set<string>>();
  const visit = (v: unknown): void => {
    if (typeof v === 'string') {
      const kind = permanentIdKind(v);
      if (kind) {
        if (!out.has(kind)) out.set(kind, new Set());
        out.get(kind)!.add(v);
      }
    } else if (Array.isArray(v)) {
      for (const x of v) visit(x);
    } else if (v && typeof v === 'object') {
      for (const x of Object.values(v as Record<string, unknown>)) visit(x);
    }
  };
  visit(value);
  return out;
}
