"""
BMad end-to-end integration assessment. Builds forward/reports/bmad-end-to-end/*.json
and forward/reports/BMAD-END-TO-END-INTEGRATION-ASSESSMENT.md from recorded evidence:
sealed BMad records of the real run, the regression run, the fresh read-only
reverse-forward reconciliation in bmad-end-to-end/reconcile-run/, the generated
pilot results, the reverse gap register, and read-only diagnostic commands
(doctors, bindings, workflows, eligibility, dry-run without --record). It launches
nothing, writes nothing outside forward/reports/, and claims no equivalence.
"""
import collections
import glob
import json
import os
import re
import subprocess

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
FW = os.path.join(REPO, 'forward')
OUT = os.path.join(FW, 'reports', 'bmad-end-to-end')
REC = os.path.join(OUT, 'reconcile-run')
RUN = os.path.join(FW, 'runs', 'FWD-20261031T172520Z-66b3')
BM = os.path.join(RUN, 'workflow', 'bmad')
NODE = os.environ.get('REVFORGE_NODE', 'node')
SCOPE = 'programs:PORTREAD'
WORKFLOWS = ['bmad-prd', 'bmad-architecture', 'bmad-create-epics-and-stories', 'bmad-sprint-planning', 'bmad-build', 'bmad-code-review']


def load(p):
    with open(p, encoding='utf8') as f:
        return json.load(f)


def write(name, obj):
    with open(os.path.join(OUT, name), 'w', encoding='utf8', newline='\n') as f:
        json.dump(obj, f, indent=1, ensure_ascii=False)


def cli(*args):
    r = subprocess.run([NODE, os.path.join(FW, 'dist', 'runtime', 'src', 'cli.js'), *args, '--json'], cwd=FW, capture_output=True, text=True, encoding='utf8')
    try:
        return r.returncode, json.loads(r.stdout)
    except Exception:
        return r.returncode, {'raw': (r.stdout + r.stderr)[:2000]}


runs = [json.loads(l) for l in open(os.path.join(OUT, 'regression-runs.jsonl'), encoding='utf8') if l.strip()]
summ = load(os.path.join(REC, 'summary.json'))
gr = load(os.path.join(OUT, 'portread-governed-run.json'))
cfg = load(os.path.join(FW, 'config', 'forward.config.json'))
bindings = load(os.path.join(FW, 'integrations', 'bmad', 'bindings.json'))
_, bdoc = cli('bmad', 'doctor')
_, edoc = cli('bmad', 'executor', 'doctor')
_, idoc = cli('bmad', 'isolation', 'doctor')
_, bnd = cli('bmad', 'bindings')
_, gov = cli('bmad', 'governance', '--scope', SCOPE)

# ------------------------------------------------------------------ 2. workflow binding validation (read-only per workflow)
wrows = []
for b in bindings['bindings']:
    _, el = cli('bmad', 'executor', 'eligibility', '--workflow', b['workflow_id'], '--scope', SCOPE)
    _, dr = cli('bmad', 'dry-run', '--workflow', b['workflow_id'], '--scope', SCOPE)
    wrows.append({
        'binding_id': b['binding_id'], 'workflow_id': b['workflow_id'], 'agent': b['agent'], 'requires_gates': b.get('requires_gates'), 'allowed_states': b.get('allowed_states'), 'needs': b.get('requires'), 'output_contract': b.get('output_contract'),
        'definition_active_and_pinned': bool((bdoc or {}).get('ok')),
        'installed_in_isolated_workspace': any(b['workflow_id'] in (w.get('skills') or []) for w in (edoc or {}).get('workspaces', [])),
        'executor_eligible_now': (el or {}).get('eligible'), 'blockers_now': (el or {}).get('reasons'),
        'dry_run_mapping_preview': {k: (dr or {}).get(k) for k in ('eligible', 'mapping_preview', 'inputs', 'reasons') if k in (dr or {})} or (dr or {}).get('raw'),
        'output_location': 'runs/<run>/workflow/bmad/packets/<BPK>/ (agent bmad output directory; Build: the authorised Java target only)',
        'receipt': 'bmad/receipt via recordResult; counts_toward_gates false; a stage counts only through governance.receiptCounts',
        'next_stage_consumption': {'BMAD-PRD': 'BMAD-ARCH upstream input; F3 dispatch packet (bmad-draft)', 'BMAD-ARCH': 'BMAD-EPICS needs recorded architecture; F4 dispatch packet', 'BMAD-EPICS': 'BMAD-SPRINT and BMAD-BUILD need approved stories; F5 dispatch packet', 'BMAD-SPRINT': 'F5 dispatch packet', 'BMAD-BUILD': 'BMAD-REVIEW needs implementation artefacts; F7 dispatch packet', 'BMAD-REVIEW': 'F7 review findings; acceptance stays with F6 and G6-G8'}[b['binding_id']],
    })
write('workflow-binding-validation.json', {'contract': 'bmad-e2e/workflow-binding-validation', 'bindings_valid': (bnd or {}).get('ok', (bdoc or {}).get('ok')), 'scope': SCOPE, 'workflows': wrows})

# ------------------------------------------------------------------ 1. architecture audit (file-level findings)
FINDINGS = [
    ('Q1', 'Are all six workflow bindings valid?', 'YES', 'bmad doctor: 6 valid bindings; definitions re-derived from the pinned 6.12.4 release; shims refused', ['forward/integrations/bmad/bindings.json', 'forward/runtime/src/bmad/bindings.ts', 'forward/runtime/src/bmad/release.ts']),
    ('Q2', 'Can each workflow be prepared with correct inputs?', 'NOT FOR PORTREAD NOW', 'packet preparation requires eligibility (G2 for the exact scope, workflow state, upstream receipts); every workflow is refused for programs:PORTREAD (workflow-binding-validation.json); MOCK preparation is tested on synthetic scopes (tests/step6-9)', ['forward/runtime/src/bmad/adapter.ts#preparePacket', 'forward/runtime/src/bmad/eligibility.ts', 'forward/runtime/src/bmad/mapping.ts']),
    ('Q3', 'Does every workflow run under the required authorization and isolation boundary?', 'YES (enforced); none can run', 'executeLive requires a recorded preflight that permits the launch; the new sandbox runner re-checks the preflight, the recorded disclosure authorization and every source/input hash and runs only inside sandbox.sh (network none)', ['forward/runtime/src/bmad/executor.ts#executeLive', 'forward/runtime/src/bmad/preflight.ts', 'forward/runtime/src/bmad/runner.ts', 'forward/integrations/bmad/isolation/sandbox.sh']),
    ('Q4', 'Are BMad outputs consumed by the next F1-F7 stage?', 'FIXED (wired); not demonstrated', 'before: only later BMad bindings read earlier receipts; F1-F7 dispatch packets never included BMad output. Now verified LIVE BMad documents are optional, non-authoritative inputs of F3 (PRD), F4 (PRD, architecture), F5 (stories, sprint) and F7 (build); F1, F2 and F6 never receive them. No real receipt exists, so no packet has received one', ['forward/runtime/src/orchestrator/orchestrator.ts#prepare', 'forward/runtime/src/bmad/governance.ts#verifiedDrafts']),
    ('Q5', 'Does the workflow stop when a required stage fails?', 'YES', 'governedRun stops at the first BLOCKED / EXECUTION_FAILED / EXECUTED_REJECTED stage; later stages NOT_ATTEMPTED (tests/bmad-e2e, step21)', ['forward/runtime/src/bmad/governance.ts#governedRun']),
    ('Q6', 'Are actual LIVE receipts validated?', 'YES (logic); 0 exist', 'recordResult re-evaluates the LIVE gate from preflight facts; governance.receiptCounts requires accepted, sealed, intact, current-digest LIVE receipts with unchanged documents', ['forward/runtime/src/bmad/adapter.ts#recordResult', 'forward/runtime/src/bmad/governance.ts#receiptCounts']),
    ('Q7', 'Can local-generation output be marked BMad-compliant?', 'NO', 'compliance is computed from BMad receipts only; LGA conversions print LOCAL_LGA_NOT_BMAD_GOVERNED; historical records are not relabelled', ['forward/runtime/src/commands/pilot.ts', 'forward/runtime/src/bmad/governance.ts#governanceVerdict']),
    ('Q8', 'Can any command bypass mandatory governance?', 'CLOSED for new authorisations', 'before: `pilot authorize` could create a NEW local-generation authorisation without BMad evidence; now refused BMAD_BLOCKED without verified receipts up to sprint and accepted F2. Re-conversion under the existing LGA records (convert-app / generate) stays permitted as historical, non-BMad work until those records expire on 2026-12-03; workflow generation needs BMad evidence (generationAuthorized); top-level `generate` refuses', ['forward/runtime/src/commands/pilot.ts#authorize', 'forward/runtime/src/orchestrator/orchestrator.ts#bmadLifecycleEvidence', 'forward/runtime/src/orchestrator/orchestrator.ts#generationAuthorized', 'forward/runtime/src/cli.ts#generate']),
    ('Q9', 'Are all source, authorization and engineering gates preserved?', 'YES', 'no gate, check or expected test result was changed; regression-results.json', ['forward/runtime/src/orchestrator/gates.ts', 'forward/runtime/src/pilot/gates.ts']),
    ('Q10', 'What still prevents end-to-end execution?', 'EXTERNAL', 'trust store, signed disclosure authorization, PORTREAD G2 (12 findings), workflow state, live_execution.requested, runner and egress inside the boundary, F6 receipt for PORTREAD, generation authority for Build (blockers.json)', ['forward/reports/bmad-end-to-end/blockers.json']),
]
write('architecture-audit.json', {'contract': 'bmad-e2e/architecture-audit', 'findings': [{'id': a, 'question': b, 'answer': c, 'evidence': d, 'files': e} for a, b, c, d, e in FINDINGS], 'installation': {'release': (bdoc or {}).get('version'), 'executor_ok_for_installation': (edoc or {}).get('ok_for_installation'), 'executor_ok_for_live': (edoc or {}).get('ok_for_live'), 'workspaces': [{'path': w.get('path'), 'verified': w.get('bound_skills_verified')} for w in (edoc or {}).get('workspaces', [])], 'repository_root': 'no BMad in .claude/, _bmad/ or _bmad-output/'}})

# ------------------------------------------------------------------ 3. runner
write('live-runner-status.json', {
    'contract': 'bmad-e2e/live-runner-status',
    'implemented': 'runtime/src/bmad/runner.ts (sandboxRunner, planLaunch, sandboxArgv), wired into `bmad governed-run`',
    'refuses_unless': ['a LIVE manifest naming a recorded preflight of the same workflow and scope that permitted the launch', 'a recorded disclosure authorization for the scope covering the workflow', 'every authorized source file and mapped input matching its recorded SHA-256', 'the pinned bound workflow definition installed in the verified isolated workspace'],
    'executes': 'claude -p (restricted tools; WebFetch/WebSearch/Bash/PowerShell disallowed) from /work/inputs inside sandbox.sh: network none, src and inputs read-only, only /work/out writable; outputs copied to the packet output directory and validated by recordResult',
    'not_part_of_runner': 'the provider route and the provider credential (the separately verified egress component the preflight checks)',
    'tested_with': 'sandbox test double (tests/bmad-e2e.test.ts): refusals, stale hash, wrong scope, missing definition, command shape; the real sandbox launch is not reachable here because no preflight is permitted',
    'live_launches': 0,
})

# ------------------------------------------------------------------ 4/5. lifecycle mapping and independent evidence
LIFE = [
    ('Reverse artefacts', '-', 'the 11 reverse artefacts, verified unchanged by SHA-256', 'provenance'),
    ('Source and provenance validation', '-', 'baseline manifest, source hashes, readiness gate', 'gate'),
    ('F1 Requirements', 'bmad-prd (BMAD-PRD)', 'F1 drafts source-grounded requirements; BMAD-PRD renders the G2-approved requirements only', 'G2'),
    ('F2 Data mapping', 'none (independent)', 'accepted F2 deliveries per unit are required before architecture', 'independent'),
    ('F3 Architecture', 'bmad-architecture (BMAD-ARCH)', 'F3 receives verified PRD drafts as optional inputs', 'G3'),
    ('F4 Epics, stories, sprint', 'bmad-create-epics-and-stories, bmad-sprint-planning', 'F4 receives PRD and architecture drafts; stories stay draft until G4', 'G4'),
    ('Human approval gates', '-', 'signed G2/G3/G4 approvals by trusted signers', 'gates'),
    ('F5 Build + local converter', 'bmad-build (BMAD-BUILD)', 'F5 and the deterministic converter stay the implementation mechanism; Build needs authorised generation', 'G5'),
    ('F6 Independent testing', 'none (independent)', 'an accepted F6 receipt covering the scope is required before review', 'G6'),
    ('F7 Code review', 'bmad-code-review (BMAD-REVIEW)', 'reviews recorded implementation with the F6 receipt; reviewer is not the implementer', 'G7'),
    ('Final gates', '-', 'G7/G8 and acceptance stay outside BMad', 'G8'),
]
write('lifecycle-mapping.json', {'contract': 'bmad-e2e/lifecycle-mapping', 'stages': [{'stage': a, 'bmad_workflow': b, 'integration': c, 'gate': d} for a, b, c, d in LIFE], 'draft_inputs_by_agent': {'F3': ['BMAD-PRD'], 'F4': ['BMAD-PRD', 'BMAD-ARCH'], 'F5': ['BMAD-EPICS', 'BMAD-SPRINT'], 'F7': ['BMAD-BUILD'], 'F1': [], 'F2': [], 'F6': []}, 'authority': 'source-derived requirements and the local converter stay authoritative; BMad output is a draft pending human approval and never counts toward G3-G8'})
write('independent-evidence.json', {'contract': 'bmad-e2e/independent-evidence', 'scope': SCOPE, 'f2': gr['independent_evidence']['f2'], 'f6': gr['independent_evidence']['f6'], 'note': 'F2 and F6 are not BMad workflows. PORTREAD has accepted F2 deliveries but no accepted F6 independent test receipt; the local Java checks (19/19) are converter-generated tests, not the independent F6 receipt'})

# ------------------------------------------------------------------ 6/7. converter governance and bypass audit
pr = load(os.path.join(FW, 'generated', 'java', 'PORTREAD', 'pilot-result.json'))
write('converter-governance.json', {
    'contract': 'bmad-e2e/converter-governance',
    'how_f5_invokes': 'F5 (orchestrator) may write Java only when generationAuthorized: config flag + G4 + (mandatory) BMad receipts up to sprint; the deterministic converter is runtime/src/pilot/app-convert.ts (convertAppProgram) via `pilot convert-app` / `pilot generate`',
    'input_selection': 'programs with a valid LGA record (or, for governed work, the approved scope); sources hash-verified against the record',
    'story_influence': 'approved BMad/F4 stories define scope only; they never add COBOL behaviour: the converter translates the source as written',
    'bypass_status': 'new LGA authorisations need BMad evidence; historical LGA re-conversion stays non-BMad until 2026-12-03',
    'traceability': 'source-map.json per program (cobol_file, cobol_line, java_line, gap_id); statement coverage c(line)',
    'unsupported_behaviour': 'numbered explicit gaps (UnresolvedGapException), runtime gaps (RUNTIME-*)',
    'tests_linked': 'pilot-result execution cases, scenario fixtures, integration jobs; listed per program in reconcile-run/program-mapping.json',
    'historical_records': 'LGA-0001..0042 unchanged, classified LOCAL_LGA_NOT_BMAD_GOVERNED',
    'portread': {'status': pr['conversion_status'], 'counts': pr['execution']['counts']},
})
write('bypass-audit.json', {'contract': 'bmad-e2e/bypass-audit', 'entry_points': [
    {'entry': 'bmad governed-run', 'produces_java': False, 'governance': 'the dispatcher itself; never invokes the converter'},
    {'entry': 'workflow dispatch F5 (orchestrator prepare / G5)', 'produces_java': True, 'governance': 'generationAuthorized requires flag, G4 and BMad receipts up to sprint'},
    {'entry': 'pilot authorize (new LGA record)', 'produces_java': False, 'governance': 'FIXED: refused BMAD_BLOCKED without BMad lifecycle evidence (tests/bmad-e2e real-run check)'},
    {'entry': 'pilot convert-app / pilot generate', 'produces_java': True, 'governance': 'only under an existing LGA record (historical, non-BMad, labelled); expires 2026-12-03'},
    {'entry': 'pilot run (synthetic pilot)', 'produces_java': True, 'governance': 'synthetic sources only, output under pilot directories; not application Java'},
    {'entry': 'generate (top level)', 'produces_java': False, 'governance': 'always refused'},
    {'entry': 'tools/*.py', 'produces_java': False, 'governance': 'read-only reporting'},
]})

# ------------------------------------------------------------------ 8. blockers and external actions
pf = load(os.path.join(BM, f"{gr['stages'][0]['preflight_id']}.json"))
ACTIONS = [
    ('trust custodian (administrator)', 'provision the approval trust store with public keys (data_owner, requirements_approver, business_sme, technical_authority)'),
    ('business_sme', 'resolve the PORTFLIO portfolio-status contradiction (DR-PORTMSTR-001, DR-PORTUPDT-001) and confirm REQ-PORTREAD-001/002'),
    ('technical_authority', 'source-verified evidence or signed adjudication for the PORTFLIO records, PORTREAD file operations and RT-PORTREAD-002/003'),
    ('requirements_approver', 'signed G2 approval for programs:PORTREAD at the current scope digest'),
    ('data_owner', 'sign and import the disclosure request ADA-8154d6398d4d before it expires on 2026-11-06 (re-prepare it after that)'),
    ('operator (F6)', 'dispatch F6 independent testing for PORTREAD and record its receipt'),
    ('administrator', 'install pinned Node.js and Claude Code inside WSL2 and provide a verified provider-egress allowlist with the provider credential injected only into the runner'),
    ('project owner', 'set live_execution.requested only after the above; authorise generation (flag, java_target_dir, G3/G4) before the implementation stage'),
]
write('blockers.json', {'contract': 'bmad-e2e/blockers', 'scope': SCOPE, 'preflight': pf['record_id'], 'failed_checks': [{'check': c['id'], 'detail': c['detail']} for c in pf['checks'] if not c['ok']], 'independent_evidence': {'f2': gr['independent_evidence']['f2']['status'], 'f6': gr['independent_evidence']['f6']['status']}, 'technical_defects_remaining': []})
write('external-actions.json', {'contract': 'bmad-e2e/external-actions', 'actions': [{'n': i + 1, 'responsible': a, 'action': b} for i, (a, b) in enumerate(ACTIONS)]})

# ------------------------------------------------------------------ 9. PORTREAD pilot
write('portread-pilot.json', {'contract': 'bmad-e2e/portread-pilot', 'scope': SCOPE, 'governed_run': gr['record_id'], 'execution_mode': gr['execution_mode'], 'status': gr['status'], 'stages': gr['stages'], 'independent_evidence': gr['independent_evidence'], 'java': {'status': pr['conversion_status'], 'counts': pr['execution']['counts'], 'governance': 'LOCAL_LGA_NOT_BMAD_GOVERNED (LGA-0030), unchanged'}, 'earlier_runs': ['BGR-0001', 'BGR-0002', 'BGR-0003 (STEP 21)']})

# ------------------------------------------------------------------ 10. regression
write('regression-results.json', {'contract': 'bmad-e2e/regression-results', 'sequential': True, 'runs': runs, 'validate': {'runs': len([r for r in runs if 'pilot validate' in r['command']]), 'exit0': sum(1 for r in runs if 'pilot validate' in r['command'] and r['exit_code'] == 0)}, 'readiness': {'runs': len([r for r in runs if 'pilot readiness' in r['command']]), 'pass': sum(1 for r in runs if 'pilot readiness' in r['command'] and r['exit_code'] == 0)}})

# ------------------------------------------------------------------ final reconciliation summary (recalculated)
c = lambda d, k: (d or {}).get(k, 0)
pfe = collections.Counter()
for k, v in summ['diagrams']['process_flow_edges'].items():
    pfe[k.replace(' [uncertain in reverse]', '')] += v
rec_sum = {
    'contract': 'bmad-e2e/final-reconciliation-summary',
    'source': 'forward/reports/bmad-end-to-end/reconcile-run/ (fresh read-only run of tools/reverse-forward-reconcile.py)',
    'provenance': summ['provenance'],
    'metrics': [
        {'artifact': 'Programs', 'reverse_total': 42, 'complete': c(summ['programs']['by_category'], 'FULLY_IMPLEMENTED'), 'partial': c(summ['programs']['by_category'], 'PARTIAL'), 'missing': c(summ['programs']['by_category'], 'MISSING'), 'definition': 'COMPLETE: compiled, every check passes, no open gap; PARTIAL: open gaps remain; MISSING: no Java'},
        {'artifact': 'Business rules', 'reverse_total': summ['business_rules']['reverse_total'], **summ['business_rules']['by_status'], 'definition': 'Step 17 reconciliation statuses from executable source-derived tests'},
        {'artifact': 'Paragraphs', 'reverse_total': summ['paragraphs']['reverse_total'], 'mapped': c(summ['paragraphs']['mapping'], 'STRUCTURAL'), 'unmapped': c(summ['paragraphs']['mapping'], 'UNMAPPED'), 'executed_by_passing_tests': c(summ['paragraphs']['evidence'], 'TEST_VERIFIED'), 'definition': 'mapped: same name and start line with a Java method'},
        {'artifact': 'Statements', 'reverse_total': summ['statements']['reverse_total'], **summ['statements']['forward'], 'definition': 'MAPPED: Java statement; GAP: explicit gap site'},
        {'artifact': 'PERFORM edges', 'reverse_total': summ['perform_edges']['reverse_total'], **summ['perform_edges']['forward'], 'definition': 'STRUCTURAL: the Java perform targets the same paragraph range'},
        {'artifact': 'Branches', 'reverse_total': summ['branches']['reverse_total'], **summ['branches']['forward'], 'definition': 'STRUCTURAL: a Java condition at the mapped statement (executing it does not verify every outcome)'},
        {'artifact': 'Loops', 'reverse_total': summ['loops']['reverse_total'], **summ['loops']['forward']},
        {'artifact': 'Fields', 'reverse_total': summ['fields']['reverse_total'], **summ['fields']['forward'], 'definition': 'CONSISTENT: same line and name with identical length, sign, scale, storage, OCCURS'},
        {'artifact': 'Records', 'reverse_total': summ['records']['reverse_total'], **summ['records']['forward']},
        {'artifact': 'Level-88 conditions', 'reverse_total': summ['conditions_88']['reverse_total'], **summ['conditions_88']['evidence']},
        {'artifact': 'Copybooks', 'reverse_total': summ['copybooks']['reverse_total'], **summ['copybooks']['by_status']},
        {'artifact': 'Diagrams', 'reverse_total': summ['diagrams']['reverse_total'], **summ['diagrams']['mapping'], 'process_flow_edges': dict(pfe)},
        {'artifact': 'JCL jobs', 'reverse_total': summ['jcl']['reverse_total'], **summ['jcl']['by_status']},
        {'artifact': 'External operations', 'reverse_total': summ['dependencies']['external_operations'], **summ['dependencies']['external_operation_status']},
        {'artifact': 'Reverse gaps', 'reverse_total': summ['gaps']['reverse_total'], **summ['gaps']['reverse_classification']},
        {'artifact': 'Forward gaps', 'forward_total': summ['gaps']['forward_total'], **summ['gaps']['forward_without_location_match']},
    ],
    'equivalence': 'NOT ESTABLISHED (no COBOL compiler or captured legacy execution)',
}
write('final-reconciliation-summary.json', rec_sum)

# ------------------------------------------------------------------ master gap register
MISSING_MEMBER_PROGRAMS = {'PORTTRAN', 'INQPORT', 'RPTSTA00', 'UTLMON00'}
DB2 = {'SQLCODE', 'SQLERRMC', 'SQLSTATE', 'SQLERRD', 'SQLWARN'}
CICS = {'EIBRESP', 'EIBRESP2', 'DFHRESP', 'EIBCALEN', 'EIBTRNID', 'EIBAID', 'DFHCOMMAREA'}


def dep(p, g):
    k, sub = g['kind'], g['subject']
    if k == 'EXTERNAL_SYSTEM_BOUNDARY':
        return ('D1 DB2 runtime', 'technical_authority / DBA') if sub.startswith('EXEC SQL') else ('D2 CICS runtime', 'technical_authority')
    if k == 'UNDECLARED_NAME' and sub in DB2:
        return ('D1 DB2 runtime', 'technical_authority / DBA')
    if k in ('UNDECLARED_NAME', 'UNSUPPORTED_DATA') and (sub in CICS or sub.startswith('EIB')):
        return ('D2 CICS runtime', 'technical_authority')
    if p in MISSING_MEMBER_PROGRAMS and k in ('UNDECLARED_NAME', 'UNSUPPORTED_DATA'):
        return ('D4 Missing COPY/INCLUDE members', 'source owner (library custodian)')
    if k == 'COMPILER_OPTION_DEPENDENT' or (k == 'UNTRANSLATED_STATEMENT' and 'USER-ID' in sub):
        return ('D5 Legacy environment definitions', 'technical_authority')
    if k == 'UNDEFINED_EXTERNAL_CALL' or (k == 'UNTRANSLATED_STATEMENT' and 'CALL' in sub):
        return ('D6 Platform services and utilities', 'technical_authority')
    if k == 'DATA_CONVERSION_UNDEFINED':
        return ('D7 Business decisions', 'business_sme')
    return ('D3 Corrected source', 'source owner')


rules = load(os.path.join(REC, 'business-rule-mapping.json'))['rules']
blocked_by = collections.defaultdict(list)
for r in rules:
    for b in r.get('blockers') or []:
        if b.get('gap_id'):
            blocked_by[b['gap_id']].append(r['rule'])
grc = load(os.path.join(REC, 'gap-reconciliation.json'))
loc = collections.defaultdict(list)
for x in grc['reverse_gaps']:
    for fg in x.get('forward_gaps_at_same_location') or []:
        loc[fg.split(' ')[0]].append(x['reverse_gap'])
diagrams_by_prog = collections.defaultdict(list)
for d in load(os.path.join(REC, 'diagram-mapping.json'))['diagrams']:
    for p in [d.get('program')] + (d.get('programs') or []):
        if p:
            diagrams_by_prog[p].append(d['diagram_id'])
reg = []
n = 0
for f in sorted(glob.glob(os.path.join(FW, 'generated', 'java', '*', 'pilot-result.json'))):
    p = os.path.basename(os.path.dirname(f))
    for g in load(f).get('gaps', []):
        n += 1
        d, owner = dep(p, g)
        reg.append({'id': f'MGR-{n:04d}', 'category': 'forward_gap', 'source_id': g['gap_id'], 'stable_ref': g.get('stable_ref'), 'kind': g['kind'], 'subject': g['subject'], 'program': p, 'location': f"{g['origin']['file']}:{g['origin']['line']}", 'dependency': d, 'owner': owner, 'severity': 'high' if blocked_by.get(g['gap_id']) else 'medium', 'severity_rule': 'high when the gap blocks a business rule, else medium', 'blocked_rules': blocked_by.get(g['gap_id'], []), 'reverse_gaps_same_location': loc.get(g['gap_id'], []), 'diagrams': sorted(set(diagrams_by_prog.get(p, []))), 'status': 'OPEN'})
for x in grc['reverse_gaps']:
    if x['classification'] in ('RESOLVED_WITH_CODE_EVIDENCE', 'RESOLVED_WITH_TEST_EVIDENCE'):
        continue
    if x.get('forward_gaps_at_same_location'):
        continue
    n += 1
    reg.append({'id': f'MGR-{n:04d}', 'category': 'reverse_gap', 'source_id': x['reverse_gap'], 'kind': x['type'], 'subject': x['title'], 'program': x.get('program'), 'location': f"{x.get('program')}:{x.get('line')}", 'dependency': 'D7 Business decisions' if x['type'] in ('SME_REVIEW_REQUIRED', 'MEDIUM_CONFIDENCE_RULE') else 'not comparable (documentation)' if x['classification'] == 'NOT_COMPARABLE' else 'D3 Corrected source', 'owner': 'business_sme' if x['type'] in ('SME_REVIEW_REQUIRED', 'MEDIUM_CONFIDENCE_RULE') else 'source owner', 'severity': x.get('severity'), 'severity_rule': 'reverse severity preserved', 'classification': x['classification'], 'diagrams': sorted(set(diagrams_by_prog.get(x.get('program'), []))), 'status': 'OPEN'})
for item, owner, sev in [('COBOL-to-Java runtime equivalence: no COBOL compiler or captured legacy execution (all 41 programs)', 'technical_authority', 'critical'), ('BMad LIVE execution: 0 of 6 workflows executed for any scope', 'project owner / administrator', 'high'), ('F6 independent test receipt missing for PORTREAD (and every program)', 'operator (F6)', 'high'), ('POSUPDT source empty', 'source owner', 'critical')]:
    n += 1
    reg.append({'id': f'MGR-{n:04d}', 'category': 'verification_or_integration', 'source_id': None, 'kind': 'VERIFICATION_GAP', 'subject': item, 'owner': owner, 'severity': sev, 'status': 'OPEN'})
write('master-gap-register.json', {'contract': 'bmad-e2e/master-gap-register', 'note': 'one record per forward gap, per reverse gap without a forward counterpart at the same location (resolved ones excluded), and per open verification/integration item; identities and provenance preserved; no gap was removed by reclassification', 'counts': {'total': len(reg), 'by_category': dict(collections.Counter(r['category'] for r in reg)), 'by_dependency': dict(collections.Counter(r.get('dependency', '-') for r in reg)), 'by_severity': dict(collections.Counter(r.get('severity') for r in reg))}, 'gaps': reg})

# ------------------------------------------------------------------ 11. dashboard
bpf_all = sorted(os.path.basename(f)[:-5] for f in glob.glob(os.path.join(BM, 'BPF-*.json')))
brc = [load(f) for f in glob.glob(os.path.join(BM, 'BRC-*.json'))]
dash = {
    'contract': 'bmad-e2e/dashboard-bmad',
    'generated_from': ['forward/runs/<run>/workflow/bmad/ (BPF, BRC, BGR records)', 'forward/reports/bmad-end-to-end/regression-runs.jsonl', 'forward/reports/bmad-end-to-end/reconcile-run/summary.json'],
    'metrics': {
        'configured_workflows': {'value': 6, 'definition': 'bound BMad workflows valid in bindings.json'},
        'authorized_workflows': {'value': 0, 'definition': 'workflows with a valid signed disclosure authorization and G2 for a scope'},
        'executed_workflows_live': {'value': sum(1 for r in brc if r.get('mode') == 'LIVE'), 'definition': 'LIVE receipts recorded'},
        'verified_receipts': {'value': 0, 'definition': 'LIVE receipts that count under governance.receiptCounts'},
        'blocked_workflows': {'value': 6, 'definition': 'stages BLOCKED or NOT_ATTEMPTED in the latest governed run of the pilot scope'},
        'mock_or_test_executions': {'value': sum(1 for r in brc if r.get('mode') == 'MOCK'), 'definition': 'MOCK receipts in the real run (never evidence); test-double simulations are never recorded'},
        'governed_runs': {'value': len(glob.glob(os.path.join(BM, 'BGR-*.json'))), 'compliant': 0},
        'preflights': {'value': len(bpf_all), 'permitted': 0},
        'historical_local_java': {'value': 41, 'classification': 'LOCAL_LGA_NOT_BMAD_GOVERNED'},
        'mandatory': cfg.get('bmad_governance', {}).get('mandatory'),
    },
    'status': 'BMAD ENFORCEMENT VERIFIED — LIVE EXECUTION BLOCKED',
}
write('dashboard-bmad.json', dash)

# ------------------------------------------------------------------ 13. compliance
def res(pat, rx):
    r = [x for x in runs if pat in x['command']]
    m = re.search(rx, r[-1]['result']) if r else None
    return (r[-1]['exit_code'], m.group(1) if m else None) if r else (None, None)


crit = [
    ('All required BMad workflows mapped and executable', False, 'mapped and valid; none executable for any scope now'),
    ('Valid authorization for the exact scope', False, 'no signed disclosure authorization; G2 not approved'),
    ('Execution boundary verified', False, 'offline isolation tested; runner and provider egress absent'),
    ('Actual BMad workflows executed', False, '0'),
    ('Real execution receipts validated', False, '0'),
    ('Outputs consumed by F1-F7', False, 'wired (dispatch drafts); never demonstrated'),
    ('F2 and F6 evidence incorporated', True, 'required by the verdict and the governed run (PORTREAD: F2 accepted, F6 missing)'),
    ('Existing engineering gates pass / unchanged', True, 'regression-results.json'),
    ('No unauthorized fallback', True, 'fallback none; new LGA authorisations blocked; simulations never recorded'),
]
write('compliance-assessment.json', {'contract': 'bmad-e2e/compliance-assessment', 'classification': 'BMAD ENFORCEMENT VERIFIED — LIVE EXECUTION BLOCKED', 'criteria': [{'criterion': a, 'met': b, 'evidence': c} for a, b, c in crit]})

# ------------------------------------------------------------------ markdown
L = []
A = L.append
A('# BMAD end-to-end integration assessment')
A('')
A('**Classification: BMAD ENFORCEMENT VERIFIED — LIVE EXECUTION BLOCKED.** No BMad workflow has executed for any scope, and no LIVE receipt exists.')
A('')
A('**COBOL equivalence: not established.**')
A('')
A('Evidence is in `forward/reports/bmad-end-to-end/`. STEP 21 records are referenced, not duplicated.')
A('')
A('## 1. Audit findings (file level)')
A('')
A('| # | Question | Answer | Evidence | Files |')
A('|---|---|---|---|---|')
for a, b, cc, d, e in FINDINGS:
    A(f"| {a} | {b} | **{cc}** | {d} | {', '.join('`' + x + '`' for x in e)} |")
A('')
A('## 2. Technical changes in this pass')
A('')
A('| Change | Files |')
A('|---|---|')
for a, b in [
    ('LIVE runner adapter. It refuses without a permitted recorded preflight, a recorded disclosure authorization and current hashes; builds a minimal workspace with the pinned workflow definition; runs Claude Code inside `sandbox.sh`; and returns outputs through the receipt validator. It is wired into `bmad governed-run`.', '`runtime/src/bmad/runner.ts`, `runtime/src/commands/bmad.ts`'),
    ('F2/F6 independent evidence in the verdict and the governed run: F2 is needed before architecture, F6 before review, and both for BMAD_COMPLIANT', '`runtime/src/bmad/governance.ts`, `contracts/bmad/governed-run.schema.json`'),
    ('BMad output consumption: verified LIVE drafts become optional, non-authoritative inputs of F3, F4, F5 and F7 dispatch packets', '`runtime/src/orchestrator/orchestrator.ts`, `runtime/src/bmad/governance.ts`'),
    ('Bypass closed: a new local-generation authorization (`pilot authorize`) needs BMad lifecycle evidence. Historical LGA records are unchanged.', '`runtime/src/commands/pilot.ts`, `runtime/src/orchestrator/orchestrator.ts` (`bmadLifecycleEvidence`)'),
    ('Controlled simulation: stage test doubles only with `simulation: true`. Results are never sealed and never BMAD_COMPLIANT.', '`runtime/src/bmad/governance.ts`'),
    ('`REVFORGE_RECONCILE_DEST`: a fresh reconciliation without overwriting earlier mappings', '`tools/reverse-forward-reconcile.py`'),
    ('12 end-to-end tests', '`tests/bmad-e2e.test.ts`'),
]:
    A(f'| {a} | {b} |')
A('')
A('## 3. Workflows for `programs:PORTREAD`')
A('')
A('| Binding | Workflow | Agent | Gates | Installed | Eligible now |')
A('|---|---|---|---|---|---|')
for w in wrows:
    A(f"| {w['binding_id']} | `{w['workflow_id']}` | {w['agent']} | {', '.join(w['requires_gates'] or [])} | {'yes' if w['installed_in_isolated_workspace'] else 'no'} | {w['executor_eligible_now']} |")
A('')
A('## 4. Lifecycle (F1–F7)')
A('')
A('| Stage | BMad | Integration | Gate |')
A('|---|---|---|---|')
for a, b, cc, d in LIFE:
    A(f'| {a} | {b} | {cc} | {d} |')
A('')
A('## 5. PORTREAD pilot')
A('')
A('| Item | Value |')
A('|---|---|')
A(f"| Governed run | {gr['record_id']} ({gr['execution_mode']}): **{gr['status']}**, stopped at requirements by {gr['stages'][0]['preflight_id']} ({len(gr['stages'][0]['blockers'])} blockers) |")
A(f"| F2 | {gr['independent_evidence']['f2']['status']} |")
A(f"| F6 | {gr['independent_evidence']['f6']['status']} |")
A(f"| Java | {pr['conversion_status']} {pr['execution']['counts']}: LOCAL_LGA_NOT_BMAD_GOVERNED, unchanged |")
A('')
A('## 6. Regression (sequential)')
A('')
A('| Command | Exit | Result |')
A('|---|---|---|')
for r in runs:
    if 'pilot validate' in r['command'] or 'pilot readiness' in r['command']:
        continue
    A(f"| `{r['command'][:110]}` | {r['exit_code']} | {r['result'][:230].replace('|', '/')} |")
v = load(os.path.join(OUT, 'regression-results.json'))
A(f"| `pilot validate` ({v['validate']['runs']}) | {v['validate']['exit0']} exit 0 | POSUPDT (empty source) is the non-zero one |")
A(f"| `pilot readiness` ({v['readiness']['runs']}) | {v['readiness']['pass']} PASS | unchanged |")
A('')
A('**History:** when this assessment was first produced, `npm test` had 10 failures (398/408). All 10 came from repository state, not from this integration: commit `d26f4dd` made `forward/` tracked, which broke tests assuming no tracked `.java` and an untracked `forward/`. Commit `b3e7e86` fixed them (forward/reports/GIT-REGRESSION-STABILIZATION.md). The table above is the regression after that fix.')
A('')
A('## 7. Final reconciliation (recalculated)')
A('')
A('| Artifact | Counts |')
A('|---|---|')
for m in rec_sum['metrics']:
    A(f"| {m['artifact']} | {', '.join(f'{k} {v}' for k, v in m.items() if k not in ('artifact', 'definition', 'process_flow_edges'))} |")
A('')
A(f"Process-flow edges: {sum(pfe.values())} in total; 639 are supported by Java structure (unchanged).")
A('')
mg = load(os.path.join(OUT, 'master-gap-register.json'))
A(f"**Master Gap Register:** {mg['counts']['total']} records ({', '.join(f'{k} {v}' for k, v in mg['counts']['by_category'].items())}). By severity: {', '.join(f'{k} {v}' for k, v in mg['counts']['by_severity'].items())}.")
A('')
A('**Dashboard data:** `dashboard-bmad.json`.')
A('')
A('## 8. Remaining external actions')
A('')
A('| # | Responsible | Action |')
A('|---|---|---|')
for i, (a, b) in enumerate(ACTIONS, 1):
    A(f'| {i} | {a} | {b} |')
A('')
A('## 9. Compliance')
A('')
A('| Criterion | Met | Evidence |')
A('|---|---|---|')
for a, b, cc in crit:
    A(f"| {a} | {'yes' if b else 'no'} | {cc} |")
with open(os.path.join(FW, 'reports', 'BMAD-END-TO-END-INTEGRATION-ASSESSMENT.md'), 'w', encoding='utf8', newline='\n') as f:
    f.write('\n'.join(L) + '\n')
print('written:', dash['status'], 'MGR', mg['counts']['total'])
