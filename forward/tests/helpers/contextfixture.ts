/**
 * Synthetic source-context fixture (STEP 10): BRAVO02 includes a copybook
 * that declares level-88 conditions; its requirement cites the IF statement
 * that SETs one of them. Options vary the claim, the cited line, the
 * copybook (self-inclusion, extra conditions), the program text and the
 * reverse condition catalogue. Synthetic data only.
 */
import { Fixture } from './fixture';
import { Edit } from './g2fixture';
import { designFixture } from './designfixture';

export interface ContextOpts {
  claim?: string;
  citeLine?: number;
  value?: string;
  copyExtra?: string[];
  progExtra?: string[];
  catalogueParent?: string;
  approveG2?: boolean;
  /** STEP 12: further edits of the synthetic deliverables (e.g. an extra decision in the F1 register). */
  extraEdit?: Edit;
}

export function contextFixture(fixtures: Fixture[], o: ContextOpts = {}) {
  const value = o.value ?? 'Q';
  const prog = [
    '       IDENTIFICATION DIVISION.',
    '       PROGRAM-ID. BRAVO02.',
    '       DATA DIVISION.',
    '       WORKING-STORAGE SECTION.',
    '       COPY RECLAYT.',
    '       01  WS-LIMIT PIC 9(4).',
    '       PROCEDURE DIVISION.',
    '       P1.',
    '           MOVE 1000 TO WS-LIMIT.',
    '           IF WS-LIMIT > 500',
    '              SET BRV-HIGH TO TRUE',
    '           END-IF.',
    ...(o.progExtra ?? []),
    '           GOBACK.',
  ];
  const copy = ['       01  BRV-STATUS-AREA.', '           05  BRV-STATUS   PIC X.', `               88  BRV-HIGH VALUE '${value}'.`, "               88  BRV-LOW  VALUE 'L'.", ...(o.copyExtra ?? [])];
  let fx: Fixture;
  const mutate = (f: Fixture) => {
    fx = f;
    const b = f.programs[1];
    const cb = f.copybooks[0];
    f.write(`cobol-src/${b.rel}`, prog.join('\n') + '\n');
    f.write(`cobol-src/${cb.rel}`, copy.join('\n') + '\n');
    const statements = [
      { statement_id: `${b.fileId}-STMT-000001`, statement_type: 'MOVE', start_line: 9, end_line: 9 },
      { statement_id: `${b.fileId}-STMT-000002`, statement_type: 'IF', start_line: 10, end_line: 12 },
      ...(o.progExtra?.length ? [{ statement_id: `${b.fileId}-STMT-000003`, statement_type: o.progExtra[0].trim().split(/\s+/)[0], start_line: 13, end_line: 12 + o.progExtra.length }] : []),
    ];
    f.write(`output/parser/raw_structure/${b.fileId}__${b.name}.json`, { program_summary: {}, program_id: b.name, file_id: b.fileId, procedure_division: { paragraphs: [{ paragraph_id: `${b.fileId}-PAR-0001`, name: 'P1', start_line: 8, end_line: prog.length }], statements } });
    const data = f.read('output/data/data_artifact.json');
    data.condition_catalogue = [
      { condition_id: `${cb.fileId}-FLD-000002`, condition_name: 'BRV-HIGH', parent_field: o.catalogueParent ?? 'BRV-STATUS', parent_field_id: `${cb.fileId}-FLD-000001`, parent_record: 'BRV-STATUS-AREA', parent_record_id: `${cb.fileId}-REC-0001`, values: [value], values_raw: `'${value}'`, programs_in_scope: [b.name], source_line: 3 },
      { condition_id: `${cb.fileId}-FLD-000003`, condition_name: 'BRV-LOW', parent_field: 'BRV-STATUS', parent_field_id: `${cb.fileId}-FLD-000001`, parent_record: 'BRV-STATUS-AREA', parent_record_id: `${cb.fileId}-REC-0001`, values: ['L'], values_raw: "'L'", programs_in_scope: [b.name], source_line: 4 },
    ];
    f.write('output/data/data_artifact.json', data);
  };
  const edit: Edit = (a, unit, docs, packet) => {
    o.extraEdit?.(a, unit, docs, packet);
    if (a !== 'F1' || unit !== fx.programs[1].name) return;
    const r = docs['draft_requirements.json'].requirements[0];
    r.evidence_status = 'verified_from_source';
    r.statement = o.claim ?? `When the processing limit exceeds 500 the program marks the status HIGH ('${value}').`;
    r.source_refs = [{ ...r.source_refs[0], statement_id: `${fx.programs[1].fileId}-STMT-000002`, line: o.citeLine ?? 10 }];
  };
  const out = designFixture(fixtures, { approveG2: false, resolve: false, mutate, edit });
  return { ...out, req: `REQ-${out.f.programs[1].name}-001` };
}
