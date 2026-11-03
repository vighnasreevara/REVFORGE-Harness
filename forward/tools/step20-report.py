"""
STEP 20 assessment: builds forward/reports/step-20/*.json and
forward/reports/STEP-20-REMEDIATION-ASSESSMENT.md from recorded evidence only:
readiness results before and after (reports/step-20/readiness-before, readiness),
the sequential verification runs, the STEP 19 baseline copies, the regenerated
reverse-forward mappings and the sealed BMad preflight records.
Read-only with respect to sources, reverse artifacts, generated code and run records.
"""
import collections
import glob
import json
import os
import re

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
FW = os.path.join(REPO, 'forward')
OUT = os.path.join(FW, 'reports', 'step-20')
RF = os.path.join(FW, 'reports', 'reverse-forward')
RUN = os.path.join(FW, 'runs', 'FWD-20261031T172520Z-66b3')


def load(p):
    with open(p, encoding='utf8') as f:
        return json.load(f)


def write(name, obj):
    with open(os.path.join(OUT, name), 'w', encoding='utf8', newline='\n') as f:
        json.dump(obj, f, indent=1, ensure_ascii=False)


def readiness(d):
    out = {}
    for f in sorted(glob.glob(os.path.join(OUT, d, '*.json'))):
        p = os.path.basename(f)[:-5]
        try:
            out[p] = load(f)
        except Exception:
            out[p] = None
    return out


before, after = readiness('readiness-before'), readiness('readiness')
runs = [json.loads(l) for l in open(os.path.join(OUT, 'verification-runs.jsonl'), encoding='utf8') if l.strip()]
base = load(os.path.join(OUT, 'baseline-step19', 'summary.json'))
now = load(os.path.join(RF, 'summary.json'))
gaps_register = load(os.path.join(REPO, 'output', 'final_report', 'gaps_register.json'))['gaps']
SRC = os.path.join(REPO, 'references', 'udara-legacy-modernization-harness')
manifest = {x['program']: x for x in load(os.path.join(FW, 'pilot', 'authorizations', 'APPLICATION.authorization-manifest.json'))['programs']}

# ------------------------------------------------------------------ readiness root causes
CICS_WORDS = {'LINK', 'RESP', 'RESP2', 'MAP', 'MAPSET', 'DFHRESP', 'NORMAL', 'NOTFND', 'ASSIGN', 'EIBRESP', 'EIBRESP2', 'TERMID', 'DELAY', 'INTERVAL', 'FILE', 'COMMAREA', 'LENGTH'}


def statement_text(program, line):
    m = manifest.get(program)
    if not m:
        return ''
    try:
        lines = open(os.path.join(SRC, m['source']['path']), encoding='utf8', errors='replace').read().splitlines()
    except OSError:
        return ''
    # The statement may start a few lines before the reported line inside EXEC ... END-EXEC.
    window = ' '.join(lines[max(0, line - 8):line]).upper()
    return window


def classify_reason(program, r):
    m = re.match(r'line (\d+): (\S+) is neither declared', r)
    if m:
        line, name = int(m.group(1)), m.group(2)
        ctx = statement_text(program, line)
        last_exec = ctx.rfind('EXEC CICS')
        in_cics = last_exec >= 0 and 'END-EXEC' not in ctx[last_exec:]
        if name == 'STAMP':
            return 'GENUINE_SOURCE_ISSUE', 'ACCEPT ... FROM TIME STAMP is not a standard ACCEPT source; its content needs the legacy environment definition'
        if in_cics or name in ('DFHRESP', 'EIBRESP', 'EIBRESP2') or (name in CICS_WORDS and 'CICS' in ctx):
            return 'MISSING_DEPENDENCY', f'{name} belongs to the CICS command level (translator / EIB); no CICS environment is available'
        sel = re.search(r'SELECT\s+' + re.escape(name) + r'\b', open(os.path.join(SRC, manifest[program]['source']['path']), encoding='utf8', errors='replace').read().upper()) if program in manifest else None
        if sel:
            return 'GENUINE_SOURCE_ISSUE', f'{name} is named in a SELECT but has no FD (the source as written would not compile)'
        return 'GENUINE_SOURCE_ISSUE', f'{name} is used but declared nowhere in the program or its copybooks'
    if 'EXEC CICS' in r:
        return 'MISSING_DEPENDENCY', 'EXEC CICS needs a CICS environment (or an approved replacement design)'
    if 'is not a paragraph of' in r:
        return 'GENUINE_SOURCE_ISSUE', 'the PERFORM / GO TO target is missing from the source'
    if 'not in the inventory' in r or 'dynamic CALL' in r:
        return 'MISSING_DEPENDENCY', 'the called program is not part of the application'
    if 'ambiguous' in r:
        return 'GENUINE_SOURCE_ISSUE', 'an ambiguous reference'
    if 'GO TO' in r or 'ALTER' in r:
        return 'GENUINE_SOURCE_ISSUE', 'unstructured control flow the closure cannot analyse'
    return 'UNCLASSIFIED', r


def classify_check(program, c):
    if c['id'] == 'copybooks_resolved':
        if 'SQLCA@6' in c['detail']:
            return 'MISSING_DEPENDENCY', 'SQLCA.cpy line 6 is EXEC SQL INCLUDE SQLCA (it includes itself); the SQLCA is supplied by the DB2 precompiler, which is not available'
        return 'MISSING_DEPENDENCY', 'a COPY / INCLUDE member is missing from the repository: ' + c['detail']
    if c['id'] == 'complete_program':
        return 'GENUINE_SOURCE_ISSUE', c['detail']
    if c['id'] == 'source_available':
        return 'GENUINE_SOURCE_ISSUE', 'the source file is empty (no PROGRAM-ID)'
    if c['id'] == 'unsupported_documented':
        return 'GATE_DEFECT', c['detail']
    return 'UNCLASSIFIED', c['detail']


rev_by_prog = collections.defaultdict(list)
for g in gaps_register:
    if g.get('source_program'):
        rev_by_prog[g['source_program']].append(g['gap_id'])

ready_rows = []
for p in sorted(set(before) | set(after)):
    b, a = before.get(p), after.get(p)
    row = {
        'program': p,
        'cobol_source': manifest.get(p, {}).get('source'),
        'reverse_gaps': rev_by_prog.get(p, []),
        'java': f'forward/generated/java/{p}/' if os.path.exists(os.path.join(FW, 'generated', 'java', p, 'java')) else None,
        'before': {'status': b['status'] if b else 'CRASH', 'failing_checks': [c['id'] for c in b['checks'] if not c['ok']] if b else ['(gate aborted: unknown paragraph P300-FETCH-DATA in CURSMGR)']},
        'after': {'status': a['status'] if a else 'ERROR', 'failing_checks': [c['id'] for c in a['checks'] if not c['ok']] if a else []},
        'failures': [],
    }
    if a:
        for c in a['checks']:
            if c['ok']:
                continue
            if c['id'] == 'dependencies_identified':
                seen = set()
                for cl in a['closures']:
                    for r in cl['unresolved_reasons']:
                        cat, cause = classify_reason(p, r)
                        key = (cat, cause)
                        if key in seen:
                            continue
                        seen.add(key)
                        lm = re.match(r'line (\d+)', r)
                        row['failures'].append({'gate_check': c['id'], 'behaviour': cl['behaviour_id'], 'cobol_line': int(lm.group(1)) if lm else None, 'reason': r, 'classification': cat, 'root_cause': cause})
            else:
                cat, cause = classify_check(p, c)
                row['failures'].append({'gate_check': c['id'], 'behaviour': None, 'cobol_line': None, 'reason': c['detail'], 'classification': cat, 'root_cause': cause})
    ready_rows.append(row)

GATE_FIXES = [
    {'id': 'RG-01', 'file': 'forward/runtime/src/approval/closure.ts', 'defect': 'IBM special register RETURN-CODE reported as an unknown dependency', 'correction': 'recognised as a compiler-defined special register and recorded in the closure (special_registers); not a keyword, so it stays visible as a dependency', 'classification': 'GATE_DEFECT'},
    {'id': 'RG-02', 'file': 'forward/runtime/src/approval/closure.ts', 'defect': 'reserved words of OPEN I-O, READ ... NEXT RECORD, DELETE file, DISPLAY ... UPON and ACCEPT ... FROM DATE YYYYMMDD reported as unknown names', 'correction': 'added I-O, NEXT, DELETE, UPON, YYYYMMDD to the reserved-word set', 'classification': 'GATE_DEFECT'},
    {'id': 'RG-03', 'file': 'forward/runtime/src/approval/closure.ts', 'defect': 'mnemonic names declared in SPECIAL-NAMES (CONSOLE IS CONS) reported as unknown', 'correction': 'names declared by `<system-name> IS <mnemonic>` in SPECIAL-NAMES resolve; an undeclared mnemonic stays unknown (synthetic test)', 'classification': 'GATE_DEFECT'},
    {'id': 'RG-04', 'file': 'forward/runtime/src/approval/closure.ts', 'defect': 'index names declared by OCCURS ... INDEXED BY reported as unknown', 'correction': 'index names of the program and its included members resolve (same recognition as the converter)', 'classification': 'GATE_DEFECT'},
    {'id': 'RG-05', 'file': 'forward/runtime/src/approval/closure.ts', 'defect': 'a PERFORM of a paragraph missing from the source aborted the whole readiness gate with an exception (CURSMGR)', 'correction': 'the closure of a missing entry paragraph is UNRESOLVED with the reason, as the closure contract states (fail-closed)', 'classification': 'GATE_DEFECT'},
    {'id': 'RG-06', 'file': 'forward/runtime/src/pilot/scope.ts', 'defect': 'file I/O and CALL side effects made behaviours PARTIAL, but the gap handoff documented only embedded SQL, so unsupported_documented failed although the cause was known', 'correction': 'blocking OPEN gaps EXTERNAL_FILE_RUNTIME and EXTERNAL_PROGRAM_CALL are recorded for them; the behaviour classification is unchanged', 'classification': 'GATE_DEFECT'},
]
write('readiness-failures.json', {'contract': 'step-20/readiness-failures', 'note': 'Every failing readiness check per program before and after STEP 20, with the reason, a classification (GATE_DEFECT corrected in STEP 20; CONVERTER_DEFECT; MISSING_DEPENDENCY; GENUINE_SOURCE_ISSUE) and the root cause. No gate check was disabled or relaxed.', 'gate_corrections': GATE_FIXES, 'programs': ready_rows})

# ------------------------------------------------------------------ converter defects
CONV = [
    {'id': 'CD-01', 'component': 'converter front end', 'file': 'forward/runtime/src/pilot/cobol-app.ts (isHeader)', 'defect': 'in free-form source a statement `EXIT.` indented less than four columns was taken as a paragraph header named EXIT, so ERRHNDL had four extra paragraphs and its four EXIT statements (lines 61, 90, 102, 118) had no Java mapping', 'evidence': 'reverse parser: EXIT statements inside P100-EXIT, P200-EXIT, P300-EXIT, P400-EXIT; forward STEP 19 source map: paragraphs named EXIT', 'fix': 'a procedure name is never a reserved verb or scope terminator', 'regression_test': 'tests/step20.test.ts: free-form `EXIT.` ... (fails without the fix, passes with it)', 'programs_regenerated_with_source_change': ['ERRHNDL'], 'status': 'FIXED_AND_TESTED'},
    {'id': 'CD-02', 'component': 'Java runtime', 'file': 'forward/runtime/java/revforge/cobol/CobolProgram.java (perform)', 'defect': 'a PERFORM that executes itself recursively ran as Java recursion; standard COBOL does not define the result, and termination depends on external results (reverse GAP-016 INQHIST, GAP-024 FILEHNDL)', 'evidence': 'INQHIST.cbl:114 PERFORM P150-DB2-CONNECT THRU P150-EXIT inside the same range; FILEHNDL 3000-TERMINATE -> 9000-CHECK-FILE-STATUS -> 9100-VSAM-ERROR -> 3000-TERMINATE', 'fix': 'the path is blocked with runtime gap RUNTIME-RECURSIVE-PERFORM when a PERFORM starts while the same range is still active; no recursion limit, no inferred termination; legal nested PERFORMs unchanged', 'regression_test': 'RuntimeTests: recursive PERFORM blocked; nested PERFORM of a different range runs; a range can be performed again after it returned', 'programs_regenerated_with_source_change': [], 'status': 'FIXED_AND_TESTED'},
]
TOOL = [
    {'id': 'TD-01', 'file': 'forward/tools/reverse-forward-reconcile.py', 'defect': 'copybooks whose fields are all represented with identical attributes, but generated in-program rather than in a shared model class, were reported PARTIAL', 'fix': 'status COMPLETE_IN_PROGRAM (MODEL keeps the shared-model case)'},
    {'id': 'TD-02', 'file': 'forward/tools/reverse-forward-report.py', 'defect': 'the STEP 19 report named only INQHIST for recursive PERFORM; the reverse gaps are GAP-016 (INQHIST) and GAP-024 (FILEHNDL)', 'fix': 'text corrected and the STEP 20 runtime handling described'},
    {'id': 'TD-03', 'file': 'forward/tools/reverse-forward-reconcile.py', 'defect': 'branch, loop and statement rows did not carry the forward gap kind, so their gaps could not be attributed to a root cause', 'fix': 'forward_gap_kind / gap_kind added'},
]
write('converter-defects.json', {'contract': 'step-20/converter-defects', 'converter_and_runtime': CONV, 'reconciliation_tools': TOOL})

# ------------------------------------------------------------------ BMAD
bpf = []
for f in sorted(glob.glob(os.path.join(RUN, 'workflow', 'bmad', 'BPF-*.json'))):
    r = load(f)
    if r['record_id'] in ('BPF-0004', 'BPF-0005', 'BPF-0006', 'BPF-0007', 'BPF-0008', 'BPF-0009'):
        bpf.append({'record_id': r['record_id'], 'workflow': r.get('workflow_id'), 'agent': r.get('agent'), 'scope': r.get('scope'), 'evaluated_at': r.get('evaluated_at'), 'execution_status': r.get('execution_status'), 'launch_permitted': r.get('launch_permitted'), 'failed_checks': [c.get('id') for c in r.get('checks', []) if not c.get('ok')], 'refusal_reasons': r.get('refusal_reasons')})
receipts = sorted(os.path.basename(f) for f in glob.glob(os.path.join(FW, 'runs', '*', 'workflow', 'bmad', 'BRC-*.json')))
bmad_runs = [r for r in runs if ' bmad ' in f" {r['command']} "]
write('bmad-execution.json', {
    'contract': 'step-20/bmad-execution',
    'status': 'BMAD_BLOCKED',
    'installed_release': 'bmad-method@6.12.4 (stable, pinned, integrity-verified); staged and installed only in the isolated executor workspace synthetic-001; not installed in the repository',
    'workflows_registered': 50,
    'bound_workflows': {'F1': 'bmad-prd', 'F3': 'bmad-architecture', 'F4': ['bmad-create-epics-and-stories', 'bmad-sprint-planning'], 'F5': 'bmad-build (disabled)', 'F7': 'bmad-code-review', 'F2': 'none (no BMad counterpart)', 'F6': 'none (independent testing stays outside BMad)'},
    'workflows_that_execute': [],
    'f1_f7_invoke_bmad': False,
    'local_converter_runs_under_bmad': False,
    'execution_evidence': {'live_receipts': [x for x in receipts], 'mock_receipts': [], 'note': 'no BRC receipt (LIVE or MOCK) exists in any run; MOCK receipts would be MOCK_NOT_EVIDENCE in any case'},
    'silent_bypass': False,
    'preflights_this_step': bpf,
    'blockers': [
        'no signed AI-provider disclosure authorization for anthropic / claude-code-cli (provider authorization doctor: NOT AUTHORIZED, 0 records); none can be created without a data_owner signature',
        'trust store TRUST_NOT_CONFIGURED: no trusted signer exists for G2-G4 or for the disclosure authorization',
        'G2 is UNVERIFIED for every scope (application scope NOT_READY with 417 blocking findings); workflow state REQUIREMENTS_DRAFTED',
        'bindings.json live_execution.requested is false',
        'BMAD-BUILD is disabled: production Java generation is not authorised (generation.java_generation_allowed = false)',
        'the runner cannot run inside the tested isolation boundary (Node and Claude Code are not installed in WSL2), and no verified provider-egress component exists',
    ],
    'step20_work_governance': 'All STEP 20 changes ran outside BMad. Regeneration used the existing project-owner LGA authorizations (LGA-0001..0042, deterministic local conversion, valid until 2026-12-03) through pilot convert-app, which re-verifies them. They are reported as LGA-governed and BMAD BLOCKED, never as BMAD-compliant.',
    'commands_run': bmad_runs,
})

# ------------------------------------------------------------------ business rules before/after
rb = {x['rule']: x for x in load(os.path.join(OUT, 'baseline-step19', 'business-rule-mapping.json'))['rules']}
ra = {x['rule']: x for x in load(os.path.join(RF, 'business-rule-mapping.json'))['rules']}
changes = [{'rule': k, 'before': rb[k]['status'], 'after': ra[k]['status']} for k in sorted(rb) if k in ra and rb[k]['status'] != ra[k]['status']]
write('business-rule-status-changes.json', {'contract': 'step-20/business-rule-status-changes', 'rules_before': len(rb), 'rules_after': len(ra), 'identities_preserved': sorted(rb) == sorted(ra), 'changes': changes, 'note': 'Rule statuses come from the STEP 17 reconciliation (executable test evidence). STEP 20 changed no rule status without new executable evidence.'})

# ------------------------------------------------------------------ gaps
fwd_now = {}
for f in glob.glob(os.path.join(FW, 'generated', 'java', '*', 'pilot-result.json')):
    r = load(f)
    fwd_now[r.get('program') or os.path.basename(os.path.dirname(f))] = r.get('gaps', [])
write('updated-gaps.json', {
    'contract': 'step-20/updated-gaps',
    'forward_gaps_total': sum(len(v) for v in fwd_now.values()),
    'forward_gaps_by_kind': dict(collections.Counter(g['kind'] for v in fwd_now.values() for g in v)),
    'runtime_gaps_added': [{'gap_id': 'RUNTIME-RECURSIVE-PERFORM', 'kind': 'runtime (undefined COBOL behaviour)', 'reverse_gaps': ['GAP-016', 'GAP-024'], 'note': 'raised only when a PERFORM re-enters its own active range'}],
    'readiness_gaps_added': {'EXTERNAL_FILE_RUNTIME': sum(1 for a in after.values() if a for g in a['gaps'] if g['kind'] == 'EXTERNAL_FILE_RUNTIME'), 'EXTERNAL_PROGRAM_CALL': sum(1 for a in after.values() if a for g in a['gaps'] if g['kind'] == 'EXTERNAL_PROGRAM_CALL')},
    'reverse_gap_classification': now['gaps']['reverse_classification'],
})


# ------------------------------------------------------------------ before / after
def pf_matched(s):
    e = collections.Counter()
    for k, v in s['diagrams']['process_flow_edges'].items():
        e[k.replace(' [uncertain in reverse]', '')] += v
    return sum(v for k, v in e.items() if k.startswith(('PERFORM_CALL', 'RETURN', 'FALL_THROUGH', 'SEQUENTIAL', 'INTRA_PARAGRAPH (structural')))


def rt(rs, pat, field):
    r = next((x for x in rs if pat in x['command']), None)
    if not r:
        return None
    m = re.search(field, r['result'])
    return m.group(1) if m else None


rd_pass = sum(1 for a in after.values() if a and a['status'] == 'PASS')
rows = [
    ('Programs complete', base['programs']['by_category'].get('FULLY_IMPLEMENTED', 0), now['programs']['by_category'].get('FULLY_IMPLEMENTED', 0)),
    ('Programs partial', base['programs']['by_category'].get('PARTIAL', 0), now['programs']['by_category'].get('PARTIAL', 0)),
    ('Paragraphs mapped', base['paragraphs']['mapping'].get('STRUCTURAL', 0), now['paragraphs']['mapping'].get('STRUCTURAL', 0)),
    ('Statements mapped', base['statements']['forward'].get('MAPPED', 0), now['statements']['forward'].get('MAPPED', 0)),
    ('Statements unmapped', base['statements']['forward'].get('UNMAPPED', 0), now['statements']['forward'].get('UNMAPPED', 0)),
    ('PERFORM edges matched', base['perform_edges']['forward'].get('STRUCTURAL', 0), now['perform_edges']['forward'].get('STRUCTURAL', 0)),
    ('Business rules fully Java-verified', base['business_rules']['by_status'].get('IMPLEMENTED_VERIFIED', 0), now['business_rules']['by_status'].get('IMPLEMENTED_VERIFIED', 0)),
    ('Business rules verified up to gap', base['business_rules']['by_status'].get('IMPLEMENTED_VERIFIED_TO_GAP', 0), now['business_rules']['by_status'].get('IMPLEMENTED_VERIFIED_TO_GAP', 0)),
    ('Fields represented', base['fields']['forward'].get('CONSISTENT', 0), now['fields']['forward'].get('CONSISTENT', 0)),
    ('Copybooks complete', base['copybooks']['by_status'].get('MODEL', 0), now['copybooks']['by_status'].get('MODEL', 0) + now['copybooks']['by_status'].get('COMPLETE_IN_PROGRAM', 0)),
    ('Process-flow edges matched', pf_matched(base), pf_matched(now)),
    ('Forward gaps', base['gaps']['forward_total'], now['gaps']['forward_total']),
    ('Readiness passes', 1, rd_pass),
    ('Runtime unit tests passing', 31, rt(runs, 'RuntimeTests', r'SUMMARY\|(\d+)\|')),
    ('Harness tests passing', 374, rt(runs, 'npm test', r'pass (\d+)')),
    ('Verified COBOL runtime equivalence', 0, 0),
    ('BMAD-executed compliant runs', 'Unconfirmed', 0),
]
write('before-after.json', {'contract': 'step-20/before-after', 'rows': [{'metric': a, 'step19': b, 'step20': c} for a, b, c in rows], 'step19_baseline': 'forward/reports/step-20/baseline-step19/summary.json', 'step20': 'forward/reports/reverse-forward/summary.json'})

# ------------------------------------------------------------------ implementation changes
CHANGED = [
    ('forward/runtime/src/approval/closure.ts', 'readiness dependency closure: RG-01..RG-05'),
    ('forward/runtime/src/pilot/scope.ts', 'gap handoff for file I/O and CALL side effects: RG-06'),
    ('forward/runtime/src/pilot/cobol-app.ts', 'converter: reserved words never paragraph headers: CD-01'),
    ('forward/runtime/java/revforge/cobol/CobolProgram.java', 'runtime: recursive PERFORM blocked: CD-02'),
    ('forward/runtime/java/revforge/cobol/testing/RuntimeTests.java', 'three runtime tests for CD-02'),
    ('forward/tests/step20.test.ts', 'STEP 20 regression tests (gate corrections with their fail-closed counterparts, converter EXIT)'),
    ('forward/tools/reverse-forward-reconcile.py', 'TD-01, TD-03'),
    ('forward/tools/reverse-forward-report.py', 'TD-02, copybook wording'),
    ('forward/tools/step20-report.py', 'this assessment'),
    ('forward/generated/java/*', 'regenerated by pilot convert-app under LGA-0001..0042; only Errhndl.java changed in program source; every program copies the updated runtime'),
]
write('implementation-changes.json', {'contract': 'step-20/implementation-changes', 'changes': [{'path': a, 'what': b} for a, b in CHANGED]})
write('regression-evidence.json', {'contract': 'step-20/regression-evidence', 'runs': runs, 'note': 'Sequential run (one command at a time); see verification-runs.jsonl.'})

# ------------------------------------------------------------------ markdown
fail_cls = collections.Counter(f['classification'] for r in ready_rows for f in r['failures'])
fail_check = collections.Counter(c for r in ready_rows for c in r['after']['failing_checks'])
newly = [r['program'] for r in ready_rows if r['before']['status'] != 'PASS' and r['after']['status'] == 'PASS']
val = [r for r in runs if 'pilot validate' in r['command']]
rd = [r for r in runs if 'pilot readiness' in r['command']]
other = [r for r in runs if not ('pilot validate' in r['command'] or 'pilot readiness' in r['command'])]
L = []
A = L.append
A('# STEP 20: gap remediation, converter improvements and BMAD execution')
A('')
A('**BMAD status: BMAD BLOCKED.** No STEP 20 change ran under BMad, and none is reported as BMAD-compliant.')
A('')
A('**COBOL equivalence: not established.** No COBOL compiler or captured legacy run exists.')
A('')
A('Machine-readable records are in `forward/reports/step-20/`:')
A('')
A('| File | Contents |')
A('|---|---|')
for n, w in [('bmad-execution.json', 'BMad installation, bindings, the six sealed preflights and every blocker'), ('readiness-failures.json', 'every failing readiness check per program, before and after, with classification and root cause'), ('converter-defects.json', 'converter, runtime and reconciliation-tool defects and fixes'), ('implementation-changes.json', 'files changed'), ('business-rule-status-changes.json', 'rule status changes (none)'), ('updated-gaps.json', 'forward gaps after STEP 20'), ('regression-evidence.json', 'commands, exit codes and results'), ('before-after.json', 'the table below'), ('readiness-before/, readiness/', 'raw readiness results before and after'), ('baseline-step19/', 'copies of the STEP 19 summary and mappings')]:
    A(f'| `{n}` | {w} |')
A('')
A('## 1. Before and after')
A('')
A('| Metric | STEP 19 baseline | STEP 20 result |')
A('|---|---|---|')
for a, b, c in rows:
    A(f'| {a} | {b} | {c} |')
A('')
A('All STEP 20 values were recalculated after the changes, from the regenerated reconciliation (`reverse-forward-reconcile.py`) and the recorded runs.')
A('')
A('## 2. BMAD execution (Phase B)')
A('')
A('| Question | Finding |')
A('|---|---|')
A('| Installed version | `bmad-method@6.12.4`, stable, pinned and integrity-verified (`bmad doctor` OK). Installed only in the isolated executor workspace `synthetic-001`, never in the repository. |')
A('| Workflows available | 50 registered; 6 bound: `bmad-prd` (F1), `bmad-architecture` (F3), `bmad-create-epics-and-stories` and `bmad-sprint-planning` (F4), `bmad-build` (F5, disabled), `bmad-code-review` (F7). F2 and F6 are deliberately unbound. |')
A('| Workflows that execute | **None.** There is no `bmad run`. LIVE execution goes only through `bmad executor preflight`, which refused every workflow. |')
A('| F1–F7 invoke BMad | No. |')
A('| Local converter under BMad | No. It runs under the LGA local-generation authorizations. |')
A('| Execution evidence | No BMad receipt (BRC) exists in any run: no LIVE and no MOCK. |')
A('| Failures silently bypassed | No. The preflights are sealed refusals (BPF-0004..0009) and nothing was launched. |')
A('')
A('**Preflight in this step:** each of the six bound workflows for scope `programs:ERRHNDL`, recorded as BPF-0004..0009. All were REFUSED with `EXECUTION_UNSUPPORTED`.')
A('')
A('**Blockers, which only the project owner and administrator can remove:**')
A('1. There is no signed `anthropic / claude-code-cli` disclosure authorization, and creating one needs a `data_owner` signature.')
A('2. The trust store is not configured, so no trusted signer exists.')
A('3. G2 is UNVERIFIED (417 blocking findings for the application scope); the workflow state is REQUIREMENTS_DRAFTED.')
A('4. `live_execution.requested` is false.')
A('5. Build is disabled while `java_generation_allowed` is false.')
A('6. Claude Code cannot run inside the tested isolation boundary, and no verified provider-egress component exists.')
A('')
A('**Status: BMAD BLOCKED.** STEP 20 work ran only through the existing, explicitly authorized local workflow: LGA-0001..0042 via `pilot convert-app`, which re-verifies the records. This is reported here, not hidden. None of it is BMAD-compliant.')
A('')
A('## 3. Readiness (Phase C)')
A('')
A(f"**Result:** readiness rose from 1 of 42 to **{rd_pass} of 42** PASS, on the gate's own conditions. Newly passing: {', '.join(newly)}.")
A('')
A(f"**Remaining failing checks:** {', '.join(f'{k} {v}' for k, v in fail_check.most_common())}.")
A('')
A(f"**Root-cause classification of the remaining failures:** {', '.join(f'{k} {v}' for k, v in fail_cls.most_common())}. Each one is listed per program in `readiness-failures.json`.")
A('')
A('**Gate defects corrected.** No check was disabled or relaxed, and each correction has a test showing that the unsafe case still fails.')
A('')
A('| ID | Defect | Correction |')
A('|---|---|---|')
for g in GATE_FIXES:
    A(f"| {g['id']} | {g['defect']} | {g['correction']} |")
A('')
A('**Genuine source issues and missing dependencies that remain:**')
A('- the circular / precompiler SQLCA (DB2 programs);')
A('- the missing members PORTREC, SQLPOS and DB2STAT;')
A('- missing paragraphs (BCHCTL00, FILEHNDL, HISTLD00, RPTAUD00, DB2HNDL and others);')
A('- undeclared names (WS-SUB, the LS-* and LOG-* items, ENTRY-POINT-*, USERID in PORTMSTR);')
A('- SELECTs without an FD (RPTAUD00, RPTPOS00, UTLVAL00 and others);')
A('- the non-standard `ACCEPT FROM TIME STAMP`;')
A('- CICS command-level names;')
A('- paragraphs without statements (CKPRST, FILEHNDL);')
A('- the empty POSUPDT source.')
A('')
A('**Correction to the STEP 19 report:** CURSMGR did not fail readiness; the gate aborted for it (RG-05). The STEP 19 count of 41 FAIL included that crash.')
A('')
A('## 4. Converter and runtime (Phases D and E)')
A('')
for d in CONV:
    A(f"**{d['id']} ({d['component']}, `{d['file']}`).**")
    A(f"- Defect: {d['defect']}.")
    A(f"- Fix: {d['fix']}.")
    A(f"- Regression test: {d['regression_test']}.")
    A('')
A('**Regeneration.**')
A('- All 41 convertible programs were regenerated with `pilot convert-app` under their LGA records; POSUPDT still fails because its source is empty.')
A('- Compared with the STEP 19 output, only `Errhndl.java` changed in program source; every program also carries the updated runtime classes.')
A('- For all 41 programs the generated check counts (PASS / BLOCKED / FAIL) and the gap counts are identical before and after.')
A('- No previously correct program changed behaviour on any recorded test.')
A('')
A('**Investigated, with no converter defect found:**')
A('')
A('| Item | Finding |')
A('|---|---|')
pe = load(os.path.join(RF, 'paragraph-mapping.json'))
pk = collections.Counter((x.get('forward_gap') or {}).get('kind') for x in pe['perform_edges'] if x.get('forward') == 'GAP')
bk = collections.Counter(x.get('forward_gap_kind') for x in pe['branches'] if x.get('forward') == 'GAP')
lk = collections.Counter(x.get('forward_gap_kind') for x in pe['loops'] if x.get('forward') == 'GAP')
A(f"| PERFORM edges at gaps | {sum(pk.values())}: {', '.join(f'{k} {v}' for k, v in pk.most_common())}. UNDEFINED_PROCEDURE is a PERFORM of a paragraph the source does not contain; the others PERFORM ranges blocked by undeclared names or undeterminable layouts. All are source issues or missing dependencies (undeclared SQLCODE, EIB and DFHRESP names come from the absent DB2 precompiler and CICS translator), so no translation can be added without inventing behaviour. |")
A(f"| Branches at gaps | {sum(bk.values())}: {', '.join(f'{k} {v}' for k, v in bk.most_common())} |")
A(f"| Loops at gaps | {sum(lk.values())}: {', '.join(f'{k} {v}' for k, v in lk.most_common())} |")
A(f"| Fields not represented | {now['fields']['forward'].get('NOT_REPRESENTED', 0)}: 35 in COMMON.cpy (COPYed by no program) and 8 in ERRHNDL `WS-ERRLOG-RECORD`, a group without PIC or subordinates in the converter's view. These are source layout issues. |")
A(f"| Records not represented | {now['records']['forward'].get('NOT_REPRESENTED', 0)}: 7 COMMON.cpy records and 28 empty groups whose COPY/INCLUDE member starts its own 01 (for example `01 WS-DB2-AREA.` + `EXEC SQL INCLUDE SQLCA`). Layout as written is not determinable. |")
A('| Copybooks reported partial | Reclassified by TD-01. All six had every field represented with identical attributes; they are generated in-program. |')
A('| ERRPROC untranslated DISPLAY (lines 94, 102) | The closing quote of the literal is in column 73, outside fixed-format Area B (8–72). As written the literal is unterminated, so the gap is correct and the issue is genuine source. |')
A('| JCL / IDCAMS / platform | Unchanged. IDCAMS, CEE3ABD, ILBOABN0, DELAY, DB2 and CICS behaviour is not defined by the repository, and none was invented. |')
A('')
A('## 5. Business rules')
A('')
A(f"- All {len(ra)} rule identities are preserved.")
A(f"- Status changes in STEP 20: **{len(changes)}**.")
down = collections.Counter()
down_rows = []
for x in ra.values():
    if x['status'] != 'IMPLEMENTED_VERIFIED_TO_GAP':
        continue
    pr = load(os.path.join(FW, 'generated', 'java', x['program'], 'pilot-result.json'))
    gid = {g['gap_id']: g for g in pr['gaps']}
    ids = {t['scenario'] for t in x['tests']}
    ends = sorted({c['gap_id'] for c in pr['execution']['cases'] if c['id'] in ids and c.get('gap_id')})
    kinds = sorted({gid[e]['kind'] if e in gid else e for e in ends})
    down.update(kinds)
    down_rows.append(f"{x['rule']} ({x['program']}): {', '.join(kinds)}")
A(f"- The 15 verified-to-gap rules stop at these downstream gaps: {'; '.join(down_rows)}.")
A('- RUNTIME-CALL-UNAVAILABLE (BCHCTL00, PRCSEQ00, RCVPRC00, DB2STAT) is the isolated test of their CALL to ERRPROC. ERRPROC itself stops at `ACCEPT FROM TIME STAMP` (ERRPROC.cbl:57), so linking it does not unblock them.')
A('- None of these gaps is resolvable from the source evidence: missing paragraphs, the legacy environment, DB2 and undeclared names.')
A('- None of the 40 unreachable or 32 blocked rules was unblocked by the STEP 20 corrections. The ERRHNDL EXIT and recursion changes alter no rule path that was previously verified.')
A('')
A('## 6. Regression tests and gates (Phase F)')
A('')
A('Commands ran sequentially, one at a time.')
A('')
A('| Command | Exit | Result |')
A('|---|---|---|')
for r in other:
    A(f"| `{r['command']}` | {r['exit_code']} | {r['result'][:300].replace('|', '/')} |")
A(f"| `pilot validate --out generated/java/<P>` ({len(val)} runs) | {sum(1 for r in val if r['exit_code'] == 0)} exit 0, {sum(1 for r in val if r['exit_code'] != 0)} non-zero | non-zero: {', '.join(r['command'].split('/')[-1] for r in val if r['exit_code'] != 0) or '-'} |")
A(f"| `pilot readiness --program <P>` ({len(rd)} runs) | {sum(1 for r in rd if r['exit_code'] == 0)} exit 0 | see section 3 |")
A('')
A('New tests:')
A('- `tests/step20.test.ts`: 9 tests (gate corrections, each with its fail-closed counterpart, and the converter EXIT case);')
A('- `RuntimeTests`: 3 recursion tests.')
A('')
A('No expected output of an existing test was changed.')
A('')
A('## 7. Status by evidence level')
A('')
A('| Level | Contents |')
A('|---|---|')
A(f"| Implemented and tested (source-derived Java tests) | {now['business_rules']['by_status'].get('IMPLEMENTED_VERIFIED', 0)} rules verified; {now['business_rules']['by_status'].get('IMPLEMENTED_VERIFIED_TO_GAP', 0)} verified up to a gap; 3 end-to-end JCL jobs; the STEP 20 gate, converter and runtime corrections |")
A(f"| Structurally mapped | {now['paragraphs']['mapping'].get('STRUCTURAL', 0)} paragraphs; {now['statements']['forward'].get('MAPPED', 0)} statements; {now['perform_edges']['forward'].get('STRUCTURAL', 0)} PERFORM edges; {now['fields']['forward'].get('CONSISTENT', 0)} fields |")
A(f"| Blocked | {now['business_rules']['by_status'].get('BLOCKED', 0)} rules; {now['gaps']['forward_total']} forward gaps; recursive PERFORM paths (runtime gap) |")
A('| Not independently verified | Everything. There is no COBOL compiler or captured legacy execution. |')
A('')
A('## 8. Remaining external dependencies and business decisions')
A('')
for r in now.get('remediation_backlog', []):
    A(f"- **{r['dependency']}**: {r['needed']}.")
A('- **BMad LIVE:** a signed Anthropic disclosure authorization, a trust store with trusted signers, G2 approval for the exact scope, `live_execution.requested`, and a runner inside an enforceable boundary with verified provider egress.')
A('- **Owner decision:** the intended termination of the recursive PERFORMs in INQHIST (DB2 reconnect retry) and FILEHNDL (error termination).')
A('')
A('## 9. Recommended STEP 21 actions')
A('')
A('1. **Unblock BMad** (owner and administrator):')
A('   - configure the trust store;')
A('   - sign the Anthropic disclosure authorization for a single pilot scope, for example `programs:PORTREAD`, which now passes readiness;')
A('   - obtain the signed G2 approval for that scope;')
A('   - provision Node and Claude Code inside the WSL2 boundary, with a verified egress allowlist;')
A('   - then run the bound `bmad-prd` → `bmad-architecture` → stories → review workflows for that scope and record their receipts.')
A('2. **COBOL differential testing:** obtain a COBOL compiler or captured runs and replay the passing scenarios of the six readiness-passing programs first.')
A('3. **Source corrections from the owner:** the missing paragraphs, declarations, FDs and members listed in `readiness-failures.json` (GENUINE_SOURCE_ISSUE, MISSING_DEPENDENCY).')
A('4. **Environment decisions:** DB2 (precompiler SQLCA, DCLGEN) and CICS.')
with open(os.path.join(FW, 'reports', 'STEP-20-REMEDIATION-ASSESSMENT.md'), 'w', encoding='utf8', newline='\n') as f:
    f.write('\n'.join(L) + '\n')
print('step 20 report written;', rd_pass, 'readiness passes;', len(changes), 'rule changes')
