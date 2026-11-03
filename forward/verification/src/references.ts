/**
 * Reference integrity between reverse artifacts. These checks use only the
 * JSON artifacts; they are not live Neo4j verification.
 */
import { collectPermanentIds, owningFileId, owningSystemId, PermanentIdKind } from './ids';

export interface Finding {
  severity: 'error' | 'warning' | 'info';
  code: string;
  message: string;
  artifact?: string;
  ref?: string;
}

export interface KnownIdentities {
  systemId: string;
  fileIds: Set<string>;
  pathIds: Set<string>;
  ruleIds: Set<string>;
  gapIds: Set<string>;
}

/**
 * Every permanent ID in `value` must belong to the system and, for IDs below
 * file level, to a file the inventory registered.
 */
export function checkPermanentIdOwnership(artifact: string, value: unknown, known: KnownIdentities, limit = 20): Finding[] {
  const findings: Finding[] = [];
  const ids = collectPermanentIds(value);
  const unknownFiles = new Set<string>();
  const foreignSystem = new Set<string>();
  const unknownPaths = new Set<string>();
  for (const [kind, set] of ids) {
    for (const id of set) {
      const sys = owningSystemId(id);
      if (sys && sys !== known.systemId) foreignSystem.add(id);
      if (kind === ('path' as PermanentIdKind)) {
        if (!known.pathIds.has(id)) unknownPaths.add(id);
        continue;
      }
      const f = owningFileId(id);
      if (f && !known.fileIds.has(f)) unknownFiles.add(id);
    }
  }
  const report = (set: Set<string>, code: string, what: string): void => {
    if (set.size === 0) return;
    const sample = [...set].slice(0, limit);
    findings.push({
      severity: 'error',
      code,
      artifact,
      message: `${set.size} permanent ID(s) ${what}: ${sample.join(', ')}${set.size > sample.length ? ', ...' : ''}`,
    });
  };
  report(foreignSystem, 'foreign_system_id', `belong to a system other than ${known.systemId}`);
  report(unknownFiles, 'unknown_file_id', 'refer to a File ID the inventory does not register');
  report(unknownPaths, 'unknown_path_id', 'are Path IDs the inventory does not register');
  return findings;
}

/** Run-local references (BR-, GAP-) must exist in the catalogue of the same run. */
export function checkRunLocalRefs(
  artifact: string,
  refs: Iterable<string>,
  catalogue: Set<string>,
  kind: 'rule' | 'gap',
): Finding[] {
  const missing = [...new Set(refs)].filter((r) => !catalogue.has(r));
  if (missing.length === 0) return [];
  return [
    {
      severity: 'error',
      code: `dangling_${kind}_ref`,
      artifact,
      message: `${missing.length} ${kind} reference(s) not found in the ${kind} catalogue of this run: ${missing.slice(0, 20).join(', ')}`,
    },
  ];
}
