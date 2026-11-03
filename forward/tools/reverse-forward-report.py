"""
Builds forward/reports/REVERSE-FORWARD-RECONCILIATION.md (and adds the
remediation backlog and test runs to summary.json) from the mappings written
by reverse-forward-reconcile.py and the captured check runs. Read-only with
respect to sources, artifacts and generated code.
"""
import collections
import json
import os

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
D = os.path.join(REPO, 'forward', 'reports', 'reverse-forward')


def load(n):
    with open(os.path.join(D, n), encoding='utf8') as f:
        return json.load(f)


S = load('summary.json')
P, PM, BR, DM, CB, DG, JC, DP, GR = (load(n) for n in ('program-mapping.json', 'paragraph-mapping.json', 'business-rule-mapping.json', 'data-mapping.json', 'copybook-mapping.json', 'diagram-mapping.json', 'jcl-mapping.json', 'dependency-mapping.json', 'gap-reconciliation.json'))
runs = []
vr = os.path.join(D, 'verification-runs.jsonl')
if os.path.exists(vr):
    runs = [json.loads(l) for l in open(vr, encoding='utf8') if l.strip()]

# ---------------------------------------------------------------- remediation backlog by dependency
results = {}
gen = os.path.join(REPO, 'forward', 'generated', 'java')
for p in os.listdir(gen):
    f = os.path.join(gen, p, 'pilot-result.json')
    if p != 'app' and os.path.exists(f):
        results[p] = json.load(open(f, encoding='utf8'))
MISSING_MEMBER_PROGRAMS = {'PORTTRAN': 'PORTREC', 'INQPORT': 'SQLPOS', 'RPTSTA00': 'DB2STAT (names a program)', 'UTLMON00': 'DB2STAT (names a program)'}
DB2_NAMES = {'SQLCODE', 'SQLERRMC', 'SQLSTATE', 'SQLERRD', 'SQLWARN'}
CICS_NAMES = {'EIBRESP', 'EIBRESP2', 'DFHRESP', 'EIBCALEN', 'EIBTRNID', 'EIBAID', 'DFHCOMMAREA'}


def dep_of_gap(p, g):
    k, sub = g['kind'], g['subject']
    if k == 'EXTERNAL_SYSTEM_BOUNDARY':
        return 'D1 DB2 runtime' if sub.startswith('EXEC SQL') else 'D2 CICS runtime'
    if k == 'UNDECLARED_NAME' and sub in DB2_NAMES:
        return 'D1 DB2 runtime'
    if k in ('UNDECLARED_NAME', 'UNSUPPORTED_DATA') and (sub in CICS_NAMES or sub.startswith('EIB')):
        return 'D2 CICS runtime'
    if p in MISSING_MEMBER_PROGRAMS and k in ('UNDECLARED_NAME', 'UNSUPPORTED_DATA'):
        return 'D4 Missing COPY/INCLUDE members'
    if k == 'COMPILER_OPTION_DEPENDENT' or (k == 'UNTRANSLATED_STATEMENT' and 'USER-ID' in sub):
        return 'D5 Legacy environment definitions'
    if k == 'UNDEFINED_EXTERNAL_CALL' or (k == 'UNTRANSLATED_STATEMENT' and 'CALL' in sub):
        return 'D6 Platform services and utilities'
    if k == 'DATA_CONVERSION_UNDEFINED':
        return 'D7 Business decisions'
    return 'D3 Corrected source (declarations, paragraphs, layouts, invalid statements)'


backlog = collections.defaultdict(lambda: {'gaps': 0, 'programs': set(), 'blocked_rules': set(), 'unreachable_rules': set(), 'examples': []})
for p, r in results.items():
    for g in r.get('gaps', []):
        d = dep_of_gap(p, g)
        b = backlog[d]
        b['gaps'] += 1
        b['programs'].add(p)
        if len(b['examples']) < 5:
            b['examples'].append(f"{g['gap_id']} {g['subject'][:40]} ({g['origin']['file'].split('/')[-1]}:{g['origin']['line']})")
for x in BR['rules']:
    if x['status'] == 'BLOCKED':
        for bl in x.get('blockers') or []:
            backlog[dep_of_gap(x['program'], bl)]['blocked_rules'].add(x['rule'])
    elif x['status'] == 'IMPLEMENTED_NOT_EXERCISED':
        ev = x.get('evidence', '')
        d = 'D7 Business decisions' if 'dead code' in ev else 'D1 DB2 runtime' if 'EXEC SQL' in ev or 'SQL' in ev else 'D2 CICS runtime' if 'CICS' in ev else 'D4 Missing COPY/INCLUDE members' if 'PORTREC' in ev or 'DB2STAT' in ev else 'D5 Legacy environment definitions' if 'TIME STAMP' in ev or 'RANDOM' in ev else 'D6 Platform services and utilities' if 'CEE3ABD' in ev or 'DELAY' in ev else 'D3 Corrected source (declarations, paragraphs, layouts, invalid statements)'
        backlog[d]['unreachable_rules'].add(x['rule'])
need = {
    'D1 DB2 runtime': 'a DB2 instance (or an approved, DB2-validated data-access layer) plus the precompiler SQLCA and the missing DCLGEN',
    'D2 CICS runtime': 'a CICS environment or an approved replacement design for COMMAREA, RESP, LINK, HANDLE CONDITION and the EIB',
    'D3 Corrected source (declarations, paragraphs, layouts, invalid statements)': 'corrected COBOL from the owner (missing paragraphs and declarations, empty-group layouts, SELECTs without FD, statements invalid as written)',
    'D4 Missing COPY/INCLUDE members': 'the members PORTREC, SQLPOS and the intended DB2STAT layout from the original libraries',
    'D5 Legacy environment definitions': 'the legacy definitions of ACCEPT FROM TIME STAMP, FUNCTION RANDOM and FUNCTION USER-ID',
    'D6 Platform services and utilities': 'CEE3ABD, ILBOABN0, DELAY and IDCAMS behaviour (or approved replacements)',
    'D7 Business decisions': 'owner/SME decisions: non-digit amounts (PORTVALD, PORTUPDT); whether PORTTRAN should post positions (2200 is never performed)',
}
rows = []
for d, b in backlog.items():
    rows.append({'dependency': d, 'needed': need[d], 'forward_gaps': b['gaps'], 'programs': sorted(b['programs']), 'blocked_rules': sorted(b['blocked_rules']), 'unreachable_rules_unlocked': sorted(b['unreachable_rules']), 'impact_score': len(b['blocked_rules']) * 3 + len(b['unreachable_rules']) * 2 + len(b['programs']), 'examples': b['examples']})
rows.append({'dependency': 'D8 COBOL runtime for differential testing', 'needed': 'a COBOL compiler (or captured legacy executions) to run the original programs on the same inputs as the source-derived scenarios', 'forward_gaps': 0, 'programs': sorted(results), 'blocked_rules': [], 'unreachable_rules_unlocked': [], 'impact_score': 1000, 'examples': ['equivalence of all 82 implemented rules, 210 scenarios and 3 end-to-end jobs is unverified without it']})
rows.sort(key=lambda r: -r['impact_score'])
S['remediation_backlog'] = rows
S['verification_runs'] = runs
with open(os.path.join(D, 'summary.json'), 'w', encoding='utf8', newline='\n') as f:
    json.dump(S, f, indent=1, ensure_ascii=False, default=list)

# ---------------------------------------------------------------- markdown


def c(d, k):
    return d.get(k, 0)


pr = S['programs']['by_category']
pa = S['paragraphs']
pe = S['perform_edges']
br = S['branches']
st = S['statements']
fl = S['fields']
co = S['conditions_88']
rc = S['records']
cbk = S['copybooks']['by_status']
dg = S['diagrams']
jb = S['jcl']['by_status']
dp = S['dependencies']
gp = S['gaps']
rules = S['business_rules']['by_status']
pfe = collections.Counter()
for k, v in dg['process_flow_edges'].items():
    pfe[k.replace(' [uncertain in reverse]', '')] += v
pfe_total = sum(pfe.values())
pfe_supported = sum(v for k, v in pfe.items() if k.startswith(('PERFORM_CALL', 'RETURN', 'FALL_THROUGH', 'SEQUENTIAL', 'INTRA_PARAGRAPH (structural')))
pfe_gap = sum(v for k, v in pfe.items() if 'GAP' in k or 'through a gap' in k or 'UNRESOLVED' in k)
pfe_unass = sum(v for k, v in pfe.items() if k.startswith('UNASSESSABLE'))
pfe_nf = pfe.get('NOT_FOUND_IN_JAVA', 0)
nodes = dg['process_flow_nodes']
comp = [d for d in DG['diagrams'] if d['type'] in ('component', 'component_neighbourhood', 'sequence')]
ce = collections.Counter()
for d in comp:
    for k, v in d.get('program_edges', {}).items():
        ce[k] += v
erd = [d for d in DG['diagrams'] if d['type'] == 'erd']
runs_ok = [r for r in runs if r['command'].startswith('node dist/runtime/src/cli.js pilot validate')]
val_pass = sum(1 for r in runs_ok if r['exit_code'] == 0)
rd = [r for r in runs if 'pilot readiness' in r['command']]
rd_pass = sum(1 for r in rd if r['exit_code'] == 0)
other = [r for r in runs if not ('pilot validate' in r['command'] or 'pilot readiness' in r['command'])]
unm = [x for x in PM['paragraphs'] if x['mapping'] == 'UNMAPPED']
unm_named = [f"{x['program']} {x['paragraph']} (line {x['cobol_lines'][0]}, {', '.join(x['gaps_in_paragraph']) or 'no gap'})" for x in unm if x['paragraph'] != '(UNNAMED)']
c88s = [f"{x['name']} ({x['source']})" for x in DM['conditions'] if x.get('evidence') != 'TEST_VERIFIED']
unmappable = [d['diagram_id'] for d in DG['diagrams'] if d['mapping'] == 'UNMAPPABLE']
cg_bad = [x for x in DP['call_graph_edges'] if x['forward'] not in ('RESOLVED_IN_JAVA_BUILD', 'IMPLEMENTED_CALL (converted callee)') and not x['forward'].startswith('BOUNDARY')]
comp_nf = [(d['diagram_id'], x[0], x[1]) for d in comp for x in d.get('program_edge_detail', []) if x[2] == 'NOT_FOUND_IN_JAVA']
val_fail = [r for r in runs_ok if r['exit_code'] != 0]
nf_edges = [(d['diagram_id'], e) for d in DG['diagrams'] for e in d.get('edges_not_found_in_java', [])]

L = []
A = L.append
A('# Reverse-engineering vs forward-engineering artifact reconciliation')
A('')
A('**Equivalence status:** COBOL runtime equivalence is **not established**. No COBOL compiler or captured legacy execution results exist, so every forward verification below is either structural (a Java element at the same source identity) or source-derived (scenarios written from the COBOL by test-design agents and executed against the Java).')
A('')
A('Machine-readable detail is in `forward/reports/reverse-forward/`:')
A('')
A('| File | Contents |')
A('|---|---|')
for n, what in [('summary.json', 'counts, provenance, remediation backlog, captured check runs'), ('program-mapping.json', 'programs'), ('paragraph-mapping.json', 'paragraphs, PERFORM edges, branches, loops, statements'), ('business-rule-mapping.json', 'business rules'), ('data-mapping.json', 'fields, level-88 conditions, records, files'), ('copybook-mapping.json', 'copybooks'), ('diagram-mapping.json', 'diagrams'), ('jcl-mapping.json', 'JCL jobs'), ('dependency-mapping.json', 'call graph and external operations'), ('gap-reconciliation.json', 'reverse and forward gaps'), ('verification-runs.jsonl', 'commands and exit codes of the checks run for this report')]:
    A(f'| `{n}` | {what} |')
A('')
A('The mappings are produced by `forward/tools/reverse-forward-reconcile.py`, and this report by `forward/tools/reverse-forward-report.py`. Both are read-only with respect to sources, reverse artifacts and generated code.')
A('')
A('## 1. Source snapshot and provenance')
A('')
pv = S['provenance']
un = sum(1 for a in pv['reverse_artifacts'] if a['unchanged'])
A('| Check | Result |')
A('|---|---|')
A(f"| Reverse artifacts vs the forward baseline manifest (`forward/runs/FWD-20261031T172520Z-66b3/baseline_manifest.json`) | **{un} / {len(pv['reverse_artifacts'])} unchanged** (SHA-256): inventory, parser, data, logic, rules, diagrams, gap register and others |")
A(f"| Reverse inventory files vs the forward source root | **{pv['source_files']['present_with_matching_size']} / {pv['source_files']['inventory_files']}** present with the recorded size |")
A(f"| Authorised manifest (`{pv['authorised_manifest']['path']}`) | **{pv['authorised_manifest']['hashes_checked']} hashes, {len(pv['authorised_manifest']['mismatches'])} mismatches** |")
A('')
A('**Snapshot identity.** The reverse inventory records its source root as `references/upstream-harness`; forward used `references/udara-legacy-modernization-harness`. Every inventory file is present in the forward root with the recorded size. The inventory records sizes, not hashes, so file identity rests on path plus size. The forward manifest then binds each file by SHA-256 from conversion onwards.')
A('')
A('**Permanent IDs.** The forward mappings key on the reverse IDs (file, paragraph, statement, record, field, condition, rule). No permanent ID was created, altered or removed.')
A('')
A('## 2. Inventory: recalculated counts vs reported baselines')
A('')
A('Every count is recalculated from the artifact records, not taken from stats.')
A('')
A('| Artifact | Recalculated | Reported baseline | Note |')
A('|---|---|---|---|')
A(f"| Programs | {S['programs']['reverse_total']} | {S['programs']['reported_baseline']} | inventory `file_registry` |")
A(f"| Paragraphs | {pa['reverse_total']} | {pa['reported_baseline']} | parser raw structures |")
A(f"| Sections | {S['sections']['reverse_total']} PROCEDURE DIVISION sections | {S['sections']['reported_baseline']} | the 140 are division sections (ENVIRONMENT/DATA); the source has no procedure sections |")
A(f"| PERFORM edges | {pe['reverse_total']} | {pe['reported_baseline_perform_edges']} | control-flow-graph edges, 21 of them inline PERFORMs |")
A(f"| Statements | {st['reverse_total']} | {st['reported_baseline']} | |")
A(f"| Branches | {br['reverse_total']} | {br['reported_baseline']} | logic `branch_map` |")
A(f"| Loops | {S['loops']['reverse_total']} | {S['loops']['reported_baseline']} | |")
A(f"| Business rules | {S['business_rules']['reverse_total']} | 154 | all 154 Step 17 identities present: {len(S['business_rules']['identity_discrepancies']['in_reverse_not_forward'])} missing, {len(S['business_rules']['identity_discrepancies']['in_forward_not_reverse'])} extra |")
A(f"| Fields | {fl['reverse_total']} | {fl['reported_baseline']} | 30 at level 01, 979 subordinate (field_catalogue) |")
A(f"| Level-88 conditions | {co['reverse_total']} | {co['reported_baseline']} | |")
A(f"| Records | {rc['reverse_total']} | {rc['reported_baseline']} | |")
A(f"| Copybooks | {S['copybooks']['reverse_total']} | {S['copybooks']['reported_baseline_copybooks']} copybooks + {S['copybooks']['reported_baseline_db2_includes']} DB2 includes | forward counted 25 because it includes the DB2 includes |")
A(f"| Diagrams | {dg['reverse_total']} | {dg['reported_baseline']} | {', '.join(f'{k} {v}' for k, v in dg['by_type'].items())} |")
A(f"| JCL jobs | {S['jcl']['reverse_total']} | {S['jcl']['reported_baseline']} | |")
A(f"| Call-graph edges | {dp['call_graph_edges']} | {dp['reported_baseline']} | COPY 89, STATIC_CALL 17, SQL_INCLUDE 10, CICS_LINK 14 |")
A(f"| Reverse gaps | {gp['reverse_total']} | 217 | |")
A('')
A('## 3. Reconciliation by category')
A('')
A('**Status columns:**')
A('')
A('| Column | Meaning |')
A('|---|---|')
A('| Fully | Implemented with test evidence (a passing source-derived scenario or generated check) |')
A('| Partial | Implemented, but only structurally or on paths ending at a gap |')
A('| Missing | No Java counterpart |')
A('| Blocked | Java site is an explicit gap |')
A('| Unassessable | Cannot be compared from machine-readable evidence |')
A('')
A('| Category | Reverse total | Forward mapped | Fully | Partial | Missing | Blocked | Unassessable | Coverage formula |')
A('|---|---|---|---|---|---|---|---|---|')
A(f"| Programs | 42 | {42 - c(pr, 'MISSING')} | {c(pr, 'FULLY_IMPLEMENTED')} | {c(pr, 'PARTIAL')} | {c(pr, 'MISSING')} | 0 | 0 | COMPLETE ÷ 42 = {c(pr, 'FULLY_IMPLEMENTED') / 42:.1%}; Java generated ÷ 42 = {(42 - c(pr, 'MISSING')) / 42:.1%} |")
A(f"| Paragraphs | {pa['reverse_total']} | {c(pa['mapping'], 'STRUCTURAL')} | {c(pa['evidence'], 'TEST_VERIFIED')} | {c(pa['evidence'], 'BLOCKED_PATH') + c(pa['evidence'], 'NOT_EXECUTED')} | {c(pa['mapping'], 'UNMAPPED')} | {pa['with_forward_gaps']} contain a gap | 0 | structural ÷ 402 = {c(pa['mapping'], 'STRUCTURAL') / 402:.1%}; test-executed ÷ 402 = {c(pa['evidence'], 'TEST_VERIFIED') / 402:.1%} |")
A(f"| PERFORM edges | {pe['reverse_total']} | {pe['reverse_total']} | {c(pe['evidence'], 'TEST_VERIFIED')} | {c(pe['evidence'], 'BLOCKED_PATH') + c(pe['evidence'], 'NOT_EXECUTED')} | 0 | {c(pe['forward'], 'GAP')} | 0 | structural target match ÷ 524 = {c(pe['forward'], 'STRUCTURAL') / 524:.1%} |")
A(f"| Branches | {br['reverse_total']} | {br['reverse_total']} | {c(br['evidence'], 'TEST_VERIFIED')} | {c(br['evidence'], 'BLOCKED_PATH') + c(br['evidence'], 'NOT_EXECUTED')} | {c(br['forward'], 'UNMAPPED')} | {c(br['forward'], 'GAP')} | 0 | structural ÷ 254 = {c(br['forward'], 'STRUCTURAL') / 254:.1%} |")
A(f"| Loops | {S['loops']['reverse_total']} | {S['loops']['reverse_total']} | – | {c(S['loops']['forward'], 'STRUCTURAL')} | 0 | {c(S['loops']['forward'], 'GAP')} | 0 | structural ÷ 32 |")
A(f"| Statements | {st['reverse_total']} | {c(st['forward'], 'MAPPED') + c(st['forward'], 'GAP')} | – | {c(st['forward'], 'MAPPED')} | {c(st['forward'], 'UNMAPPED')} | {c(st['forward'], 'GAP')} | 0 | mapped (incl. gap sites) ÷ 1936 = {(c(st['forward'], 'MAPPED') + c(st['forward'], 'GAP')) / 1936:.1%} |")
A(f"| Business rules | 154 | 154 | {c(rules, 'IMPLEMENTED_VERIFIED')} | {c(rules, 'IMPLEMENTED_VERIFIED_TO_GAP')} to-gap + {c(rules, 'IMPLEMENTED_NOT_EXERCISED')} unreachable | 0 | {c(rules, 'BLOCKED')} | 0 | verified ÷ 154 = {c(rules, 'IMPLEMENTED_VERIFIED') / 154:.1%}; verified incl. to-gap ÷ 154 = {(c(rules, 'IMPLEMENTED_VERIFIED') + c(rules, 'IMPLEMENTED_VERIFIED_TO_GAP')) / 154:.1%} |")
A(f"| Fields | {fl['reverse_total']} | {c(fl['forward'], 'CONSISTENT') + c(fl['forward'], 'DISCREPANCY')} | {c(fl['forward'], 'CONSISTENT')} attribute-consistent | {c(fl['forward'], 'DISCREPANCY')} with discrepancies | {c(fl['forward'], 'NOT_REPRESENTED')} | – | 0 | consistent ÷ 1009 = {c(fl['forward'], 'CONSISTENT') / 1009:.1%} |")
A(f"| Level-88 conditions | {co['reverse_total']} | {c(co['forward'], 'REPRESENTED')} | {c(co['evidence'], 'TEST_VERIFIED')} | {c(co['evidence'], 'STRUCTURAL')} | {c(co['forward'], 'NOT_REPRESENTED')} | 0 | 0 | value-checked ÷ 259 = {c(co['evidence'], 'TEST_VERIFIED') / 259:.1%} |")
A(f"| Records | {rc['reverse_total']} | {c(rc['forward'], 'REPRESENTED')} | – | {c(rc['forward'], 'REPRESENTED')} | {c(rc['forward'], 'NOT_REPRESENTED')} | – | 0 | represented ÷ 231 = {c(rc['forward'], 'REPRESENTED') / 231:.1%} |")
A(f"| Copybooks | 25 | {c(cbk, 'MODEL') + c(cbk, 'COMPLETE_IN_PROGRAM') + c(cbk, 'PARTIAL')} | {c(cbk, 'MODEL') + c(cbk, 'COMPLETE_IN_PROGRAM')} complete ({c(cbk, 'MODEL')} shared model, {c(cbk, 'COMPLETE_IN_PROGRAM')} in-program) | {c(cbk, 'PARTIAL')} | {c(cbk, 'NOT_USED')} not COPYed by any program | – | 0 | complete ÷ 25 |")
A(f"| Diagrams | 65 | {65 - c(dg['mapping'], 'UNMAPPABLE')} | {c(dg['mapping'], 'STRUCTURAL')} structural | {c(dg['mapping'], 'PARTIAL') + c(dg['mapping'], 'STRUCTURAL_ONLY')} | 0 | – | {c(dg['mapping'], 'UNMAPPABLE')} | see section 6 |")
A(f"| JCL jobs | 15 | 15 | {c(jb, 'IMPLEMENTED_TEST_VERIFIED')} | {c(jb, 'IMPLEMENTED_BLOCKED_AT_STEP')} blocked at a program gap | 0 | {c(jb, 'STEP_NOT_CONVERTED (utility)')} utility | 0 | end-to-end verified ÷ 15 |")
A(f"| Call-graph edges | 130 | 130 | {dp['by_type_and_status'].get('STATIC_CALL: IMPLEMENTED_CALL (converted callee)', 0)} CALLs to converted programs | {dp['by_type_and_status'].get('COPY: RESOLVED_IN_JAVA_BUILD', 0) + dp['by_type_and_status'].get('SQL_INCLUDE: RESOLVED_IN_JAVA_BUILD', 0)} COPY/INCLUDE resolved | {dp['by_type_and_status'].get('COPY: UNRESOLVED', 0) + dp['by_type_and_status'].get('SQL_INCLUDE: UNRESOLVED', 0)} unresolved members | {dp['by_type_and_status'].get('CICS_LINK: BOUNDARY_GAP (EXEC CICS LINK)', 0) + dp['by_type_and_status'].get('STATIC_CALL: GAP (UNDEFINED_EXTERNAL_CALL / untranslated)', 0)} | 0 | – |")
A('')
A('## 4. Programs, paragraphs and control flow')
A('')
A('**Programs.**')
A(f"- {c(pr, 'FULLY_IMPLEMENTED')} are COMPLETE: PORTREAD and PROGNAME.")
A(f"- {c(pr, 'PARTIAL')} are PARTIAL: Java is generated, compiled and tested, but explicit gaps remain open.")
A('- POSUPDT is MISSING: its source is empty (1 byte), which matches reverse GAP-001.')
A('')
A('Per program, `program-mapping.json` records the Java class and files, the authorization record, compilation, check counts, scenario counts, statement coverage and integration.')
A('')
A(f"**Paragraphs.** {c(pa['mapping'], 'STRUCTURAL')} of 402 map structurally: the same name at the same COBOL start line, with a Java method.")
A(f"- {c(pa['mapping'], 'UNMAPPED')} are unmapped:")
A(f"  - {len(unm) - len(unm_named)} are reverse `(UNNAMED)` lead-in paragraphs (statements before the first paragraph label). Their statements are mapped individually (section 4, statements), but there is no named Java method to match the paragraph to.")
for x in unm_named:
    A(f"  - {x}: the paragraph header is a forward gap site.")
A(f"- {c(pa['evidence'], 'TEST_VERIFIED')} paragraphs have a statement executed by a passing scenario.")
A(f"- {c(pa['evidence'], 'BLOCKED_PATH')} run only on paths that end at a gap.")
A(f"- {c(pa['evidence'], 'NOT_EXECUTED')} are not executed.")
A('')
A('**PERFORM edges.** An edge counts as STRUCTURAL only when the Java `perform(a, b)` at the mapped line targets the same paragraph range:')
A(f"- {c(pe['forward'], 'STRUCTURAL')} of 524 match, including 21 inline PERFORMs translated as Java loops.")
A(f"- {c(pe['forward'], 'GAP')} are explicit gaps. Most are PERFORMs of paragraphs that do not exist in the source.")
A('- No mapped edge targets a different paragraph than the reverse graph says.')
A('')
A(f"**Branches and loops.** {c(br['forward'], 'STRUCTURAL')} of 254 branches map to Java conditions; AT END and INVALID KEY phrases are attached to the I/O statement. {c(br['forward'], 'GAP')} branches sit on gap sites. Loops: {c(S['loops']['forward'], 'STRUCTURAL')} of 32 map to structural Java loops and {c(S['loops']['forward'], 'GAP')} are gaps.")
A('')
A(f"**Statements (permanent statement IDs).** {c(st['forward'], 'MAPPED')} of 1,936 map to Java statements and {c(st['forward'], 'GAP')} map to explicit gap sites. {c(st['forward'], 'UNMAPPED')} are unmapped: EXIT statements in ERRHNDL, a column-1 free-format source, listed in the JSON.")
A('')
A('## 5. Business rules, data and copybooks')
A('')
A('**Business rules.** All 154 identities are preserved, and the Step 17 statuses are unchanged by this audit:')
A('')
A('| Status | Rules |')
A('|---|---|')
A(f"| Verified | {c(rules, 'IMPLEMENTED_VERIFIED')} |")
A(f"| Verified to gap | {c(rules, 'IMPLEMENTED_VERIFIED_TO_GAP')} |")
A(f"| Unreachable (38 behind gaps, 2 dead code) | {c(rules, 'IMPLEMENTED_NOT_EXERCISED')} |")
A(f"| Blocked | {c(rules, 'BLOCKED')} |")
A('')
A('Each rule in `business-rule-mapping.json` adds the reverse confidence, SME flag, condition and statement ID to its forward location, tests and reasons.')
A('')
A(f"**Fields.** {c(fl['forward'], 'CONSISTENT')} of 1,009 reverse fields have a Java Field at the same source line and name, with identical length, sign, scale, storage class (DISPLAY/BINARY/PACKED) and OCCURS. **0 attribute discrepancies.** The other {c(fl['forward'], 'NOT_REPRESENTED')} are not represented, each with a reason:")
A('- 35 belong to COMMON.cpy, which no program COPYs.')
A('- 8 are in records with no determinable layout.')
A('')
A('Defaults (VALUE clauses) are checked by the generated INIT tests, with expected bytes encoded independently of the runtime.')
A('')
A(f"**Level-88 conditions.** All 259 are represented as `Cond88` objects. {c(co['evidence'], 'TEST_VERIFIED')} pass a generated value check: SET TO TRUE stores the declared value, encoded independently, and the condition then tests true. {c(co['evidence'], 'STRUCTURAL')} are represented but have no generated value check: {', '.join(c88s)}.")
A('')
A(f"**Records.** {c(rc['forward'], 'REPRESENTED')} of 231 are represented. {c(rc['forward'], 'NOT_REPRESENTED')} are not:")
A('- 7 COMMON.cpy records that are never COPYed.')
A('- 28 empty-group or unresolved-include records. An example is `01 WS-DB2-AREA.` followed by `EXEC SQL INCLUDE SQLCA`, whose member starts with its own 01. These match reverse GAP-002 and GAP-004.')
A('')
A('**File status semantics.** These are implemented in `forward/runtime/java/revforge/cobol/CobolFile.java` (00, 10, 2x, 35, 4x) and tested by the runtime unit tests. Each converted file and its FILE STATUS item are listed in `data-mapping.json` under `files`.')
A('')
A('**Copybooks:**')
A(f"- {c(cbk, 'MODEL')} have every field represented through a shared model class.")
A(f"- {c(cbk, 'COMPLETE_IN_PROGRAM')} have every field represented with identical attributes, but the converter generates their items inside each program because the COPY sits inside an outer record or table. Before STEP 20 these were reported as partial.")
A(f"- {c(cbk, 'PARTIAL')} are partial (some fields not represented).")
A(f"- {c(cbk, 'NOT_USED')} are not COPYed by any program: COMMON, ERRLOG, PORTPLAN, POSHIST, RTNCODES and DB2-DEFINITIONS.")
A('')
A('Layout identity was checked: each shared model class is byte-identical across all its users.')
A('')
A('## 6. Diagrams (65)')
A('')
A('**Method.** Edges are parsed from the Mermaid sources, and nodes are bound to source IDs through `diagrams_artifact.json` `node_sources`. No diagram is judged equivalent by its name or how it looks.')
A('')
A('| Type | Count | What was compared | Result |')
A('|---|---|---|---|')
A(f"| Process flow | 45 | Each node's statement ID against the forward statement; each edge, by the paragraphs of its end nodes, against the Java PERFORM graph | {nodes.get('MAPPED', 0)} nodes on mapped Java statements, {nodes.get('GAP', 0)} on gap sites, {nodes.get('PARAGRAPH_ONLY', 0)} paragraph-only, {nodes.get('UNBOUND', 0)} unbound; {dg['process_flow_nodes_test_verified']} nodes executed by passing scenarios. {pfe_total} edges: {pfe_supported} supported by Java structure, {pfe_gap} through or into gaps, {pfe_unass} unassessable, **{pfe_nf} not found in Java** |")
A(f"| Component and neighbourhood | 15 | Program-to-program edges against Java CALLs and CICS/external boundaries | {', '.join(f'{k} {v}' for k, v in ce.items())} |")
A('| Sequence | 2 | Programs in flow and messages | Every message in the CICS inquiry flows crosses an EXEC CICS LINK boundary, so the mapping is structural only and the behaviour is blocked |')
A(f"| ERD | 3 | Entities against records | {sum(d.get('entities_represented_in_java', 0) for d in erd)} of {sum(d.get('entities_with_record_ids', 0) for d in erd)} bound entities represented. Relationships are data-model inferences with no Java counterpart, so they are unassessable. |")
A('')
A(f"**The {pfe_nf} process-flow edges not found in Java** come from:")
A('- runtime transfers that are themselves gaps: CICS HANDLE CONDITION in INQPORT and SQL error routing in DB2HNDL;')
A('- PERFORMs nested inside a blocked statement: PORTADD 2100 is reached only from inside its ambiguous READ;')
A('- diagram simplifications, such as a shared decision node reused across paragraphs in DB2CMT;')
A('- one edge to an unnamed paragraph (DB2ONLN).')
A('')
A('They are listed per diagram in `diagram-mapping.json`.')
A('')
if comp_nf:
    A(f"**Component and sequence edges not found in Java:** {len(comp_nf)}. " + '; '.join(f'{a} → {b} ({i})' for i, a, b in comp_nf) + '.')
else:
    A('**Component and sequence edges not found in Java:** none.')
A('- PORTMSTR → ERRPROC and PORTMSTR → AUDPROC are CALL statements whose USING arguments are undeclared in the source, so they are classed as CALL_SITE_GAP, not as implemented calls.')
A('- Sequence reply messages (`-->>`) are compared against the call they return from.')
A('')
A(f"**Unmappable diagrams ({len(unmappable)}):** {', '.join(unmappable)}. FLOW-POSUPDT has no program; the other four are overview or summary diagrams with no program-to-program edges.")
A('')
A('## 7. JCL, external operations and dependencies')
A('')
A('**JCL** (15 jobs). Each job has a Java job definition (`revforge.app.batch.Jobs`):')
A(f"- {c(jb, 'IMPLEMENTED_TEST_VERIFIED')} run end-to-end with passing integration tests: PORTREAD, PORTUPDT and PORTDEL.")
A(f"- {c(jb, 'IMPLEMENTED_BLOCKED_AT_STEP')} run and stop where the program's own gap is.")
A('- PORTDEF needs the IDCAMS utility, which is not converted.')
A('')
A('The JCL has no PARM, COND or RESTART parameters. Restart and checkpoint behaviour is not emulated. Each job lists its steps, datasets and status in `jcl-mapping.json`.')
A('')
A(f"**External operations** (EXEC SQL, EXEC CICS, CALL). {dp['external_operations']} reverse statements: {', '.join(f'{k} {v}' for k, v in dp['external_operation_status'].items())}.")
A('- No SQL or CICS operation is stubbed as successful.')
A('- The 12 implemented operations are CALLs to converted programs, resolved through the program registry.')
A('- The 3 declarative ones are cursor and table declarations.')
A('')
A('**Call graph.** All 14 CICS LINKs are boundaries. Every other COPY, INCLUDE and static CALL edge resolves in the Java build or reaches a converted program, except these:')
A('')
A('| Type | From | To | Forward |')
A('|---|---|---|---|')
for x in cg_bad:
    A(f"| {x['type']} | {x['from']} | {x['to']} | {x['forward']} |")
A('')
A('## 8. Gap reconciliation')
A('')
A('Reverse gaps (217, analysis scope) and forward gaps (391, conversion scope) differ in scope, so their counts are compared, not subtracted.')
A('')
A('| Reverse gap classification | Count |')
A('|---|---|')
for k, v in sorted(gp['reverse_classification'].items(), key=lambda x: -x[1]):
    A(f'| {k} | {v} |')
A('')
A('- **No reverse gap is classed RESOLVED_WITH_TEST_EVIDENCE.**')
A('- The 10 RESOLVED_WITH_CODE_EVIDENCE are the UNSTRUCTURED_FLOW gaps: PERFORM THRU and fall-through are translated by the paragraph-range executor.')
A('- SME_REVIEW_REQUIRED and MEDIUM_CONFIDENCE_RULE stay unresolved: forward tests verify only source-as-written behaviour, not business intent.')
A('- Diagram-quality gaps are NOT_COMPARABLE.')
A('')
A(f"**Forward gaps with no reverse gap at the same location:** {', '.join(f'{k} {v}' for k, v in gp['forward_without_location_match'].items())}. NEWLY_INTRODUCED_IN_FORWARD covers the DB2/CICS boundaries and the converter limitations that exist only because of the forward environment.")
A('')
A('**Recursive PERFORM (reverse GAP-016 INQHIST, GAP-024 FILEHNDL).** A PERFORM that executes itself recursively has no defined result in standard COBOL, and termination depends on DB2 recovery results (INQHIST) or file statuses (FILEHNDL) the source does not establish.')
A('- Since STEP 20 the Java runtime blocks such a path with the runtime gap `RUNTIME-RECURSIVE-PERFORM` when a PERFORM starts while the same range is still active.')
A('- It is neither executed as Java recursion nor bounded by a limit; non-recursive executions of the same PERFORM are unchanged.')
A('- Both reverse gaps remain unresolved: their intended termination is a question for the owner.')
A('')
A('## 9. Verification runs (this audit)')
A('')
A(f"**CONVERSION_VALIDATION** (`pilot validate --out generated/java/<P>`): {len(runs_ok)} runs.")
A(f"- {val_pass} PASS.")
for r in val_fail:
    A(f"- FAIL (exit {r['exit_code']}): `{r['command']}`: {r['result'][:200]}. POSUPDT has an empty source, so no conversion was produced to validate.")
A('')
rf = collections.Counter(l.split()[2] for l in open(os.path.join(D, 'readiness-failed-checks.txt'), encoding='utf8') if l.strip())
A(f"**SOURCE_READINESS** (`pilot readiness --program <P>`): {len(rd)} runs, {rd_pass} PASS, {len(rd) - rd_pass} FAIL. This is the pre-conversion readiness gate; it is unchanged and was not relaxed. Failing checks across the programs (`readiness-failed-checks.txt`): " + ', '.join(f'{k} {v}' for k, v in rf.most_common()) + '.')
A('- `dependencies_identified` fails on names declared nowhere, PERFORM targets missing from the source, EXEC CICS and the non-standard ACCEPT FROM TIME STAMP. STEP 20 corrected the analyser misclassifying RETURN-CODE, reserved words, SPECIAL-NAMES mnemonics and INDEXED BY index names (`forward/reports/STEP-20-REMEDIATION-ASSESSMENT.md`).')
A('- `copybooks_resolved` fails on the circular SQLCA member (it includes itself: `SQLCA@6`) in the DB2 programs, and on the missing PORTREC, SQLPOS and DB2STAT members.')
A('- `complete_program` fails for CKPRST and FILEHNDL, which have paragraphs without statements; `source_available` fails for POSUPDT, whose source is empty.')
A('- Each run also reports that generation is not authorised through the workflow: `java_generation_allowed` is false and G4 is BLOCKED without trusted signers. The Step 17 Java exists under the separate LGA authorizations.')
A('')
A('**Other checks:**')
A('')
A('| Command | Exit | Result |')
A('|---|---|---|')
for r in other:
    A(f"| `{r['command']}` | {r['exit_code']} | {r['result'][:260].replace('|', '/')} |")
A('')
A('All commands and exit codes are in `verification-runs.jsonl`; the commands ran sequentially, one at a time. No check was weakened. The STEP 19 run records are kept in `forward/reports/step-20/baseline-step19/`.')
A('')
A('## 10. Remediation backlog')
A('')
A('Ordered by dependency and impact, not by artifact count. The impact score is 3 × blocked rules + 2 × unreachable rules unlocked + programs affected. D8 ranks first because without it no equivalence claim is possible.')
A('A blocked rule is counted under every dependency it waits on, so the blocked column sums to more than the 32 blocked rules.')
A('')
A('| # | Missing dependency | What is needed | Forward gaps | Programs | Blocked rules | Unreachable rules unlocked |')
A('|---|---|---|---|---|---|---|')
for i, r in enumerate(rows, 1):
    A(f"| {i} | {r['dependency']} | {r['needed']} | {r['forward_gaps']} | {len(r['programs'])} | {len(r['blocked_rules'])} | {len(r['unreachable_rules_unlocked'])} |")
A('')
A('## 11. Recommended next engineering milestone')
A('')
A('**COBOL-runtime differential testing for the gap-free paths.**')
A('1. Obtain a COBOL compiler or captured legacy runs (D8).')
A('2. Replay the 210 source-derived scenarios and the 3 end-to-end JCL jobs against both the original COBOL and the Java.')
A('3. Start with the 67 verified rules and the batch file workflows (PORTREAD, PORTUPDT, PORTDEL, PORTMSTR, PRCSEQ00, RCVPRC00, RTNCDE00, PORTVALD).')
A('4. In parallel, request the D3/D4 source corrections, which unlock the most blocked and unreachable rules without new infrastructure.')
A('')
A('DB2 and CICS (D1, D2) need an environment decision before any further conversion work on the online and database programs.')
A('')
with open(os.path.join(REPO, 'forward', 'reports', 'REVERSE-FORWARD-RECONCILIATION.md'), 'w', encoding='utf8', newline='\n') as f:
    f.write('\n'.join(L) + '\n')
print('report written;', len(rows), 'backlog groups;', len(runs), 'runs')
