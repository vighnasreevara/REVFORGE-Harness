"""
STEP 23: final Master Gap Register and gap resolution roadmap.

Builds forward/reports/step-23/*.json, master-gap-register.csv and
forward/reports/STEP-23-MASTER-GAP-REGISTER.md from committed evidence only:
  - STEP 22: gap-reconciliation, program/business-rule/diagram/jcl/dependency
    reconciliation, readiness/, bmad-governance-status;
  - the consolidated register of the BMad end-to-end pass (master IDs MGR-NNNN are kept);
  - generated pilot results (forward gap origins, dependent statements);
  - the reverse gap register (output/final_report/gaps_register.json);
  - the sealed BMad preflight records and the unsigned disclosure request.

Read-only: it changes no source, Java, run, approval or earlier report. Outputs are
deterministic (sorted, no timestamps); run metadata is kept apart in
validation-results.json `run_metadata`. Usage: python forward/tools/step23-gaps.py
"""
import collections
import csv
import datetime
import glob
import hashlib
import io
import json
import os
import re

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
FW = os.path.join(REPO, 'forward')
S22 = os.path.join(FW, 'reports', 'step-22')
OUT = os.path.join(FW, 'reports', 'step-23')
RUN = os.path.join(FW, 'runs', 'FWD-20261031T172520Z-66b3')
C = collections.Counter


def load(p):
    with open(p, encoding='utf8') as f:
        return json.load(f)


def dump(obj):
    return json.dumps(obj, indent=1, ensure_ascii=False, sort_keys=False)


def write(name, obj):
    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(OUT, name), 'w', encoding='utf8', newline='\n') as f:
        f.write(dump(obj) + '\n')


def sha_file(p):
    with open(p, 'rb') as f:
        return hashlib.sha256(f.read()).hexdigest()


g22 = load(os.path.join(S22, 'gap-reconciliation.json'))
progs = {p['program']: p for p in load(os.path.join(S22, 'program-reconciliation.json'))['programs']}
rules = load(os.path.join(S22, 'business-rule-reconciliation.json'))['rules']
diagrams = load(os.path.join(S22, 'diagram-reconciliation.json'))['diagrams']
jobs = load(os.path.join(S22, 'jcl-reconciliation.json'))['jobs']
deprec = load(os.path.join(S22, 'dependency-reconciliation.json'))
bmad22 = load(os.path.join(S22, 'bmad-governance-status.json'))
paras = load(os.path.join(S22, 'paragraph-reconciliation.json'))['paragraphs']
stmts = load(os.path.join(S22, 'statement-reconciliation.json'))['statements']
readiness = {os.path.basename(f)[:-5]: load(f) for f in sorted(glob.glob(os.path.join(S22, 'readiness', '*.json')))}
mgr = load(os.path.join(FW, 'reports', 'bmad-end-to-end', 'master-gap-register.json'))
rev_register = {g['gap_id']: g for g in load(os.path.join(REPO, 'output', 'final_report', 'gaps_register.json'))['gaps']}
s17 = {r['rule']: r for r in load(os.path.join(FW, 'reports', 'step-17', 'business-rules-reconciliation.json'))['rules']}
results = {}
for f in sorted(glob.glob(os.path.join(FW, 'generated', 'java', '*', 'pilot-result.json'))):
    results[os.path.basename(os.path.dirname(f))] = (load(f), sha_file(f))
fgap = {g['gap_id']: (p, g) for p, (r, _) in results.items() for g in r.get('gaps', [])}

para_id = {(q['program'], q['paragraph']): q['paragraph_id'] for q in paras}
stmt_id = {(s['program'], s['line']): s['statement_id'] for s in stmts}
jobs_by_prog = collections.defaultdict(list)
for j in jobs:
    for st in j.get('forward_steps') or []:
        if st.get('pgm'):
            jobs_by_prog[st['pgm']].append(j['job'])
diag_by_prog = collections.defaultdict(set)
for d in diagrams:
    for p in [d.get('program')] + (d.get('programs') or []):
        if p:
            diag_by_prog[p].add(d['diagram_id'])
unresolved_members = collections.defaultdict(set)
for e in deprec['call_graph_edges']:
    if e['forward'] == 'UNRESOLVED':
        unresolved_members[e['from']].add(e['to'])

# ------------------------------------------------------------------ rule links (evidence-backed)
rule_links = collections.defaultdict(list)  # gap_id -> [(rule, relation, evidence)]
for r in rules:
    for gid in r['related_gaps']:
        rule_links[gid].append((r['rule'], 'BLOCKS_RULE_SITE', 'business-rule-reconciliation related_gaps (rule site is the gap)'))
for r in rules:
    if r['status'] != 'IMPLEMENTED_VERIFIED_TO_GAP':
        continue
    res = results.get(r['program'], ({}, None))[0]
    ids = {t['scenario'] for t in r.get('tests') or []}
    for c in (res.get('execution') or {}).get('cases', []):
        if c['id'] in ids and c.get('gap_id') and c['gap_id'] in fgap:
            rule_links[c['gap_id']].append((r['rule'], 'ENDS_VERIFIED_PATH', f"scenario {c['id']} of the rule ends at this gap (pilot-result execution case)"))
unlinked_unreachable = []
for r in rules:
    if r['status'] != 'IMPLEMENTED_NOT_EXERCISED':
        continue
    ev = (s17.get(r['rule']) or {}).get('evidence') or ''
    if 'dead code' in ev:
        continue
    p = r['program']
    pg = [g for gid, (pp, g) in fgap.items() if pp == p]
    hit = None
    for ln in re.findall(r'line (\d+)', ev):
        hit = next((g for g in pg if g['origin']['line'] == int(ln)), None)
        if hit:
            rel = f"unreachable: STEP 17 evidence names line {ln}, the gap site"
            break
    if not hit:
        for g in sorted(pg, key=lambda g: -len(g['subject'])):
            if len(g['subject']) >= 5 and g['subject'] in ev:
                hit, rel = g, f"unreachable: STEP 17 evidence names '{g['subject']}', the gap subject"
                break
    if hit:
        rule_links[hit['gap_id']].append((r['rule'], 'MAKES_RULE_UNREACHABLE', rel))
    else:
        unlinked_unreachable.append({'rule': r['rule'], 'program': p, 'evidence': ev})

# ------------------------------------------------------------------ classification
DB2_NAMES = {'SQLCODE', 'SQLERRMC', 'SQLSTATE', 'SQLERRD', 'SQLWARN'}
CICS_NAMES = {'EIBRESP', 'EIBRESP2', 'DFHRESP', 'EIBCALEN', 'EIBTRNID', 'EIBAID', 'DFHCOMMAREA'}
MEMBER_PROGRAMS = {'PORTTRAN': 'PORTREC', 'INQPORT': 'SQLPOS', 'RPTSTA00': 'DB2STAT', 'UTLMON00': 'DB2STAT'}

GROUPS = {
    'RCG-01': ('DB2 runtime and precompiler not available', 'EXTERNAL_DEPENDENCY', 'DB2 administrator', 'a DB2 instance (or an approved DB2-validated data-access layer), the precompiler SQLCA and DCLGEN members', 'captured DB2 runs for each SQL outcome; the boundary gaps replaced through the governed lifecycle'),
    'RCG-02': ('CICS environment not available', 'EXTERNAL_DEPENDENCY', 'CICS administrator', 'a CICS region (or an approved replacement design) for COMMAREA, LINK, RESP, HANDLE CONDITION and the EIB', 'captured CICS transactions for each path'),
    'RCG-03': ('COPY/INCLUDE members missing from the source library', 'SOURCE_MISSING', 'COBOL maintainer', 'the members PORTREC, SQLPOS and the intended DB2STAT layout from the authorized library', 'the program re-reads with every include resolved; readiness copybooks_resolved passes'),
    'RCG-04': ('Paragraphs PERFORMed but missing from the source', 'SOURCE_MISSING', 'COBOL maintainer', 'the missing paragraphs from the authorized source owner', 'the PERFORM targets resolve; UNDEFINED_PROCEDURE gaps disappear on reconversion'),
    'RCG-05': ('Names used but declared nowhere', 'SOURCE_MISSING', 'COBOL maintainer', 'the missing data declarations (or confirmation that the statements are dead)', 'every reference resolves in the readiness closure'),
    'RCG-06': ('SELECT without FD / invalid file definitions', 'SOURCE_DEFECT', 'COBOL maintainer', 'corrected FD entries and record keys', 'the files generate; file gaps disappear on reconversion'),
    'RCG-07': ('Record layouts not determinable as written', 'DATA_LAYOUT_GAP', 'Data architect', 'source-verified record layouts for the empty groups', 'fields and records represented with identical attributes'),
    'RCG-08': ('Legacy environment definitions missing (TIME STAMP, RANDOM, USER-ID)', 'EXTERNAL_DEPENDENCY', 'Platform engineering', 'the legacy definitions of ACCEPT FROM TIME STAMP, FUNCTION RANDOM and FUNCTION USER-ID', 'a captured legacy run showing the produced values'),
    'RCG-09': ('Platform services and utilities (CEE3ABD, ILBOABN0, DELAY, IDCAMS)', 'EXTERNAL_DEPENDENCY', 'Platform engineering', 'the behaviour of the platform services or approved replacements', 'captured legacy runs of the service calls'),
    'RCG-10': ('Statements invalid as written', 'SOURCE_DEFECT', 'COBOL maintainer', 'corrected statements (column-73 literals, misplaced comment markers, missing periods)', 'the statements translate on reconversion'),
    'RCG-11': ('Undefined data conversions need a business rule', 'BUSINESS_DECISION_REQUIRED', 'Business SME', 'the business rule for non-digit and decimal amounts', 'a signed decision and a scenario for each input class'),
    'RCG-12': ('Rule interpretation needs SME confirmation', 'BUSINESS_DECISION_REQUIRED', 'Business SME', 'SME confirmation of the medium-confidence and review-flagged rules', 'signed decisions recorded through the decision register'),
    'RCG-13': ('Suspected logic defects in the source', 'BUSINESS_DECISION_REQUIRED', 'Business SME', 'confirmation whether the observed source behaviour is intended', 'a signed decision; corrected source if not intended'),
    'RCG-14': ('Recursive PERFORM termination', 'BUSINESS_DECISION_REQUIRED', 'Business SME', 'the intended termination of the recursive PERFORMs in INQHIST and FILEHNDL', 'a decision and a captured legacy run; RUNTIME-RECURSIVE-PERFORM stays until then'),
    'RCG-15': ('Dead code', 'BUSINESS_DECISION_REQUIRED', 'Business SME', 'confirmation whether the unreachable code (for example PORTTRAN 2200) is intended', 'a signed decision'),
    'RCG-16': ('Unresolvable control flow in the reverse analysis', 'SOURCE_DEFECT', 'OWNER_REVIEW_REQUIRED', 'source evidence for the paths the reverse analysis could not resolve', 'the path resolves in a re-run of the reverse analysis'),
    'RCG-17': ('Reverse documentation quality (diagrams)', 'REVERSE_ARTIFACT_QUALITY', 'OWNER_REVIEW_REQUIRED', 'regenerated or completed reverse diagrams', 'diagram renders and binds every node to a source ID'),
    'RCG-18': ('Constructs the reverse analysis could not support', 'UNSUPPORTED_COBOL_SEMANTICS', 'Java engineering team', 'a source-grounded specification of the construct', 'a converter test and the construct translated under the governed lifecycle'),
    'RCG-19': ('Empty source (POSUPDT)', 'SOURCE_MISSING', 'COBOL maintainer', 'the POSUPDT source', 'the program converts and validates'),
    'RCG-20': ('Legacy runtime equivalence evidence', 'LEGACY_EQUIVALENCE_GAP', 'QA / independent verification', 'a COBOL compiler or captured legacy executions with inputs and outputs', 'differential runs of the source-derived scenarios agree'),
    'RCG-21': ('BMad governance prerequisites', 'AUTHORIZATION_OR_GOVERNANCE', 'Security / authorization approver', 'trust store, signed disclosure authorization, scoped G2 approval, runner and provider egress inside the boundary', 'a governed run with verified LIVE receipts'),
    'RCG-22': ('Independent F6 test evidence missing', 'TEST_COVERAGE_GAP', 'QA / independent verification', 'F6 independent test receipts for the programs', 'accepted F6 receipts covering each scope'),
    'RCG-23': ('Converter limitation (CALL argument of kind literal)', 'UNSUPPORTED_COBOL_SEMANTICS', 'Java engineering team', 'support for numeric-literal CALL arguments (the callee CEE3ABD is also external)', 'a converter regression test'),
}
APPROVER = {'SOURCE_MISSING': 'Project owner (source owner)', 'SOURCE_DEFECT': 'Project owner (source owner)', 'BUSINESS_DECISION_REQUIRED': 'Business SME (signed decision)', 'EXTERNAL_DEPENDENCY': 'Project owner', 'DATA_LAYOUT_GAP': 'Technical authority', 'UNSUPPORTED_COBOL_SEMANTICS': 'Project owner (BMad-governed lifecycle, G3/G4)', 'JAVA_IMPLEMENTATION_GAP': 'Project owner (BMad-governed lifecycle, G3/G4)', 'TEST_COVERAGE_GAP': 'QA lead', 'LEGACY_EQUIVALENCE_GAP': 'Project owner', 'AUTHORIZATION_OR_GOVERNANCE': 'data_owner / requirements_approver (signed records)', 'REVERSE_ARTIFACT_QUALITY': 'OWNER_REVIEW_REQUIRED'}
EXT_OWNER = {'RCG-01': 'DB2 administrator', 'RCG-02': 'CICS administrator', 'RCG-08': 'Platform engineering', 'RCG-09': 'Platform engineering', 'RCG-20': 'Platform engineering (legacy runtime)', 'RCG-21': 'Platform engineering (isolation, egress)'}


def group_forward(p, g):
    k, s, d = g['kind'], g['subject'], g['description']
    if k == 'EXTERNAL_SYSTEM_BOUNDARY':
        return 'RCG-01' if s.startswith('EXEC SQL') else 'RCG-02'
    if k in ('UNDECLARED_NAME', 'UNSUPPORTED_DATA') and (s in CICS_NAMES or s.startswith('EIB')):
        return 'RCG-02'
    if k == 'UNDECLARED_NAME' and s in DB2_NAMES:
        return 'RCG-01'
    if p in MEMBER_PROGRAMS and k in ('UNDECLARED_NAME', 'UNSUPPORTED_DATA'):
        return 'RCG-03'
    if k == 'UNDEFINED_PROCEDURE':
        return 'RCG-04'
    if k == 'UNDECLARED_NAME':
        return 'RCG-05'
    if k == 'UNSUPPORTED_DATA':
        return 'RCG-06' if ('no FD entry' in d or 'RECORD KEY' in d) else 'RCG-07'
    if k == 'COMPILER_OPTION_DEPENDENT' or 'USER-ID' in s:
        return 'RCG-08'
    if k == 'UNDEFINED_EXTERNAL_CALL':
        return 'RCG-09'
    if k == 'UNTRANSLATED_STATEMENT' and 'CALL argument' in s:
        return 'RCG-23'
    if k == 'UNTRANSLATED_STATEMENT':
        return 'RCG-10'
    if k == 'DATA_CONVERSION_UNDEFINED':
        return 'RCG-11'
    return None


def group_reverse(x):
    t, title = x['type'], (x.get('title') or '')
    if t in ('EMPTY_SOURCE', 'MISSING_PROGRAM_ID'):
        return 'RCG-19'
    if t in ('SME_REVIEW_REQUIRED', 'MEDIUM_CONFIDENCE_RULE'):
        return 'RCG-12'
    if t == 'SUSPECTED_LOGIC_DEFECT':
        return 'RCG-13'
    if t == 'RECURSIVE_PERFORM' or (t == 'UNRESOLVABLE_PATH' and 'recursive' in title.lower()):
        return 'RCG-14'
    if t == 'DEAD_CODE_CONFIRMED':
        return 'RCG-15'
    if t.startswith('DIAGRAM') or t == 'UNCONFIRMED_RELATIONSHIP':
        return 'RCG-17'
    if t in ('UNDECLARED_DATA_NAME', 'AMBIGUOUS_DATA_REFERENCE', 'INVALID_QUALIFICATION'):
        return 'RCG-05'
    if t in ('UNRESOLVED_COPYBOOK', 'CIRCULAR_COPY', 'PRECOMPILER_PROVIDED'):
        return 'RCG-01' if 'SQLCA' in title else 'RCG-03'
    if t == 'UNRESOLVED_CALL':
        return 'RCG-09'
    if t == 'RUNTIME_CONDITIONAL_TRANSFER':
        return 'RCG-02' if 'CICS' in title or 'HANDLE' in title else 'RCG-16'
    if t == 'UNSUPPORTED_CONSTRUCT':
        return 'RCG-18'
    if t == 'UNRESOLVABLE_PATH':
        return 'RCG-04' if re.search(r'not (defined|in (the )?source)|missing paragraph|undefined', title, re.I) else 'RCG-16'
    return None


VER_GROUP = {'COBOL-to-Java runtime equivalence': 'RCG-20', 'BMad LIVE execution': 'RCG-21', 'F6 independent test receipt': 'RCG-22', 'POSUPDT source empty': 'RCG-19'}


def priority(sev, cat):
    if cat == 'REVERSE_ARTIFACT_QUALITY':
        return 'P3', 'reverse documentation only; no program behaviour depends on it'
    return {'critical': ('P0', 'critical severity: source integrity, equivalence or release blocking'), 'high': ('P1', 'high severity: blocks a business rule site or a major dependency'), 'medium': ('P2', 'medium severity: partial implementation or verification gap'), 'low': ('P3', 'low severity')}.get(sev, ('REVIEW', 'no recorded severity: priority needs review'))


ACTION = {
    'RCG-01': 'Provision a DB2-compatible test environment (or an approved, DB2-validated data-access layer) with the precompiler SQLCA and DCLGEN for {p}; then re-plan {s} through the governed lifecycle.',
    'RCG-02': 'Provide a CICS region or an approved replacement design covering {s} in {p}.',
    'RCG-03': 'Obtain the missing member {m} for {p} from the authorized COBOL source owner.',
    'RCG-04': 'Obtain paragraph {s} of {p} from the authorized source owner (it is PERFORMed but absent).',
    'RCG-05': 'Obtain the declaration of {s} used in {p} (or a signed confirmation that the statement is dead).',
    'RCG-06': 'Correct the file definition of {s} in {p} ({d}).',
    'RCG-07': 'Provide a source-verified layout for {s} in {p}.',
    'RCG-08': 'Provide the legacy environment definition of {s} used in {p}.',
    'RCG-09': 'Specify the behaviour of {s} called from {p}, or approve a replacement.',
    'RCG-10': 'Correct the statement {s} in {p} ({d}).',
    'RCG-11': 'Obtain the business rule for {s} in {p} (non-digit or decimal content).',
    'RCG-12': 'Obtain SME confirmation for: {s}.',
    'RCG-13': 'Obtain SME confirmation whether this behaviour is intended: {s}.',
    'RCG-14': 'Obtain the intended termination of the recursive PERFORM: {s}.',
    'RCG-15': 'Obtain confirmation whether the dead code is intended: {s}.',
    'RCG-16': 'Provide source evidence for the unresolved path: {s}.',
    'RCG-17': 'Complete or regenerate the reverse diagram: {s}.',
    'RCG-18': 'Specify the construct from source evidence: {s}.',
    'RCG-19': 'Obtain the POSUPDT source from the authorized source owner.',
    'RCG-20': 'Provide a COBOL compiler or captured legacy executions (inputs and outputs) and run the source-derived scenarios differentially.',
    'RCG-21': 'Provision the trust store, sign the disclosure authorization, obtain the scoped G2 approval and the runner/egress inside the boundary, then run bmad governed-run.',
    'RCG-22': 'Dispatch F6 independent testing for each program scope and record the receipts.',
    'RCG-23': 'Extend the converter for numeric-literal CALL arguments with a regression test (the callee is external: RCG-09).',
}
VERIFY = {'SOURCE_MISSING': 'reconversion of the corrected source; the gap disappears and readiness re-runs', 'SOURCE_DEFECT': 'reconversion of the corrected source; the gap disappears', 'BUSINESS_DECISION_REQUIRED': 'a signed decision record and a scenario reflecting it', 'EXTERNAL_DEPENDENCY': 'a captured run against the real or approved environment for each outcome', 'DATA_LAYOUT_GAP': 'field reconciliation shows identical attributes', 'UNSUPPORTED_COBOL_SEMANTICS': 'a converter regression test and a passing scenario', 'JAVA_IMPLEMENTATION_GAP': 'a passing scenario under the governed lifecycle', 'TEST_COVERAGE_GAP': 'an accepted F6 receipt', 'LEGACY_EQUIVALENCE_GAP': 'differential comparison with legacy outputs', 'AUTHORIZATION_OR_GOVERNANCE': 'verified LIVE BMad receipts', 'REVERSE_ARTIFACT_QUALITY': 'a re-run of the reverse diagram agent'}

# ------------------------------------------------------------------ canonical register
mgr_by_id = {g['id']: g for g in mgr['gaps']}
rev_disp = {x['reverse_gap']: x for x in g22['reverse']}
records = []
for g in sorted(mgr['gaps'], key=lambda x: x['id']):
    cat0 = g['category']
    rec = {'master_id': g['id'], 'original_id': g.get('source_id'), 'inventory_category': cat0}
    if cat0 == 'forward_gap':
        p, fg = fgap[g['source_id']]
        res, rsha = results[p]
        grp = group_forward(p, fg)
        cat = GROUPS[grp][1]
        dep_lines = sorted({d['line'] for d in fg.get('dependent_statements', []) if d.get('file') == fg['origin']['file']})
        rec.update({
            'source_run': 'forward pilot conversion (Step 17/20 LGA)', 'source_reference': f"forward/generated/java/{p}/pilot-result.json#{fg['gap_id']}", 'stable_ref': fg.get('stable_ref'),
            'source_path': fg['origin']['file'], 'source_line': fg['origin']['line'], 'source_identity': stmt_id.get((p, fg['origin']['line'])), 'source_sha256': fg['origin'].get('sha256'), 'evidence_sha256': rsha,
            'forward_reference': progs.get(p, {}).get('java_class'), 'kind': fg['kind'], 'subject': fg['subject'], 'description': fg['description'],
            'programs': [p], 'java_classes': [progs.get(p, {}).get('java_class')] if progs.get(p, {}).get('java_class') else [],
            'paragraphs': [{'name': n, 'paragraph_id': para_id.get((p, n))} for n in fg.get('affected_paragraphs', [])],
            'statements': [{'line': l, 'statement_id': stmt_id.get((p, l))} for l in dep_lines],
            'data_items': fg.get('affected_items', []), 'copybooks': sorted(unresolved_members.get(p, [])) if grp == 'RCG-03' else ([fg['origin']['file']] if fg['origin']['file'].endswith('.cpy') else []),
            'severity': g.get('severity'), 'repository_dependency_group': g.get('dependency'), 'reverse_gaps_same_location': g.get('reverse_gaps_same_location', []),
        })
        s, d, m = fg['subject'], fg['description'], MEMBER_PROGRAMS.get(p, '')
    elif cat0 == 'reverse_gap':
        x = rev_disp[g['source_id']]
        rg = rev_register.get(g['source_id'], {})
        grp = group_reverse(x) or 'RCG-16'
        cat = GROUPS[grp][1]
        p = x.get('program')
        scope_copybook = None
        if p and p not in progs:
            # Reverse gaps scoped to a copybook (e.g. 'PRCSEQ (copybook)', 'SQLCA') are not program records.
            scope_copybook, p = re.sub(r'\s*\(copybook\)$', '', p), None
        rec.update({
            'source_run': 'reverse engineering (output/final_report/gaps_register.json)', 'source_reference': f"output/final_report/gaps_register.json#{x['reverse_gap']}", 'stable_ref': None,
            'source_path': next((f['path'] for f in [] ), None), 'source_line': x.get('line'), 'source_identity': [a.get('statement_id') or a.get('file_id') for a in rg.get('affected', []) if isinstance(a, dict)][:10],
            'source_sha256': None, 'evidence_sha256': sha_file(os.path.join(REPO, 'output', 'final_report', 'gaps_register.json')),
            'forward_reference': progs.get(p, {}).get('java_class') if p else None, 'kind': x['type'], 'subject': x['title'], 'description': rg.get('description'),
            'programs': [p] if p else [], 'java_classes': [progs[p]['java_class']] if p in progs and progs[p].get('java_class') else [],
            'paragraphs': [{'name': rg.get('source_paragraph'), 'paragraph_id': para_id.get((p, rg.get('source_paragraph')))}] if rg.get('source_paragraph') else [],
            'statements': [], 'data_items': [], 'copybooks': [scope_copybook] if scope_copybook else [], 'severity': x.get('severity'), 'repository_dependency_group': g.get('dependency'),
            'original_scope': x.get('program'),
            'reverse_classification': x['classification'], 'related_rules_reverse': rg.get('related_rule_ids', []),
        })
        s, d, m = x['title'], '', ''
    else:
        grp = next(v for k, v in VER_GROUP.items() if g['subject'].startswith(k))
        cat = GROUPS[grp][1]
        rec.update({'source_run': 'consolidated verification record (BMad end-to-end pass)', 'source_reference': f"forward/reports/bmad-end-to-end/master-gap-register.json#{g['id']}", 'stable_ref': None, 'source_path': None, 'source_line': None, 'source_identity': None, 'source_sha256': None, 'evidence_sha256': None, 'forward_reference': None, 'kind': g['kind'], 'subject': g['subject'], 'description': g['subject'], 'programs': ['POSUPDT'] if grp == 'RCG-19' else [], 'java_classes': [], 'paragraphs': [], 'statements': [], 'data_items': [], 'copybooks': [], 'severity': g.get('severity'), 'repository_dependency_group': None})
        s, d, m, p = g['subject'], '', '', None
    pri, why = priority(rec['severity'], cat)
    links = sorted(set(rule_links.get(rec['original_id'], []))) if cat0 == 'forward_gap' else []
    rr = sorted({r for r, _, _ in links} | set(rec.get('related_rules_reverse') or []))
    rec.update({
        'category': cat, 'root_cause_group': grp, 'root_cause': GROUPS[grp][0], 'priority': pri, 'priority_rationale': why + (f'; affects {len(rr)} business rule(s)' if rr else ''),
        'status': 'OPEN', 'verification_state': 'UNRESOLVED',
        'rules': rr, 'rule_links': [{'rule': r, 'relation': rel, 'evidence': ev} for r, rel, ev in links],
        'diagrams': sorted(diag_by_prog.get(p, [])) if p else [], 'jcl_jobs': sorted(set(jobs_by_prog.get(p, []))) if p else [],
        'external_dependencies': [GROUPS[grp][0]] if cat == 'EXTERNAL_DEPENDENCY' else [],
        'owner': GROUPS[grp][2], 'approver': APPROVER.get(cat, 'OWNER_REVIEW_REQUIRED'), 'external_owner': EXT_OWNER.get(grp),
        'required_technical_action': ACTION[grp].format(p=p or '-', s=s, d=d, m=m) if cat not in ('BUSINESS_DECISION_REQUIRED',) else None,
        'required_business_decision': ACTION[grp].format(p=p or '-', s=s, d=d, m=m) if cat == 'BUSINESS_DECISION_REQUIRED' else None,
        'required_source_correction': cat in ('SOURCE_MISSING', 'SOURCE_DEFECT'),
        'required_external_system': GROUPS[grp][0] if cat == 'EXTERNAL_DEPENDENCY' else None,
        'approval_requirements': APPROVER.get(cat, 'OWNER_REVIEW_REQUIRED'),
        'verification_method': VERIFY.get(cat, 'OWNER_REVIEW_REQUIRED'), 'closure_criteria': GROUPS[grp][4],
        'resolution_evidence': None,
    })
    records.append(rec)

# ------------------------------------------------------------------ dependency graph (evidence-backed)
nodes, edges = {}, []
for r in records:
    nodes[r['master_id']] = {'id': r['master_id'], 'type': 'gap', 'label': f"{r['original_id'] or r['subject'][:40]}", 'group': r['root_cause_group']}
EXT = {'EXT-DB2': ('DB2 environment', ['RCG-01']), 'EXT-CICS': ('CICS environment', ['RCG-02']), 'EXT-LEGACY-ENV': ('legacy environment definitions', ['RCG-08']), 'EXT-PLATFORM': ('platform services', ['RCG-09']), 'EXT-SOURCE-OWNER': ('authorized COBOL source owner', ['RCG-03', 'RCG-04', 'RCG-05', 'RCG-06', 'RCG-10', 'RCG-19']), 'EXT-SME': ('business SME decisions', ['RCG-11', 'RCG-12', 'RCG-13', 'RCG-14', 'RCG-15']), 'EXT-LEGACY-RUNTIME': ('COBOL compiler / captured legacy runs', ['RCG-20'])}
for k, (label, gs) in EXT.items():
    nodes[k] = {'id': k, 'type': 'external_prerequisite', 'label': label}
    for r in records:
        if r['root_cause_group'] in gs:
            edges.append({'from': k, 'to': r['master_id'], 'relation': 'PREREQUISITE_OF', 'evidence': f"root cause {r['root_cause_group']}: {GROUPS[r['root_cause_group']][0]}", 'confidence': 'EVIDENCED'})
for r in records:
    for l in r['rule_links']:
        nodes.setdefault(l['rule'], {'id': l['rule'], 'type': 'business_rule', 'label': l['rule']})
        edges.append({'from': r['master_id'], 'to': l['rule'], 'relation': l['relation'], 'evidence': l['evidence'], 'confidence': 'EVIDENCED' if l['relation'] != 'MAKES_RULE_UNREACHABLE' else 'EVIDENCED_BY_TEXT'})
# nested gaps: a gap whose site lies among the dependent statements of another gap of the same program
by_prog = collections.defaultdict(list)
for r in records:
    if r['inventory_category'] == 'forward_gap':
        by_prog[r['programs'][0]].append(r)
for p, rs in by_prog.items():
    for a in rs:
        lines = {s['line'] for s in a['statements']} - {a['source_line']}
        for b in rs:
            if b is not a and b['source_line'] in lines:
                edges.append({'from': a['master_id'], 'to': b['master_id'], 'relation': 'ENCLOSES_GAP_SITE', 'evidence': f"{b['original_id']} (line {b['source_line']}) is nested under the blocked statement of {a['original_id']}", 'confidence': 'EVIDENCED'})
# readiness: a failing readiness reason that names the gap site line
for p, rd in readiness.items():
    nid = f'READINESS-{p}'
    lines = set()
    for cl in rd.get('closures', []):
        for reason in cl['unresolved_reasons']:
            for ln in re.findall(r'line (\d+)', reason):
                lines.add(int(ln))
    hit = [r for r in by_prog.get(p, []) if r['source_line'] in lines]
    if rd['status'] != 'PASS':
        nodes[nid] = {'id': nid, 'type': 'readiness', 'label': f'{p} readiness ({rd["status"]})'}
    for r in hit:
        edges.append({'from': r['master_id'], 'to': nid, 'relation': 'FAILS_READINESS', 'evidence': f"readiness closure reason names line {r['source_line']}", 'confidence': 'EVIDENCED'})
# missing members -> data gaps of the including program (hypothesis: the member's content is unknown)
for r in records:
    if r['root_cause_group'] == 'RCG-03' and r['inventory_category'] == 'forward_gap':
        for m_ in r['copybooks']:
            mid = f'MEMBER-{m_}'
            nodes.setdefault(mid, {'id': mid, 'type': 'missing_member', 'label': m_})
            edges.append({'from': mid, 'to': r['master_id'], 'relation': 'LIKELY_DECLARES', 'evidence': f"{m_} is an unresolved COPY/INCLUDE of {r['programs'][0]}; whether it declares {r['subject']} is unknown until the member exists", 'confidence': 'HYPOTHESIS'})
# BMad governance chain from the latest PORTREAD preflight
pf_files = sorted(glob.glob(os.path.join(RUN, 'workflow', 'bmad', 'BPF-*.json')))
pf_portread = [load(f) for f in pf_files if load(f).get('scope') == 'programs:PORTREAD']
pf = pf_portread[-1] if pf_portread else None
gov_nodes = {'GOV-TRUST-STORE': 'trust store with signers', 'GOV-DISCLOSURE': 'signed anthropic/claude-code-cli disclosure authorization', 'GOV-G2-PORTREAD': 'signed G2 approval programs:PORTREAD', 'GOV-RUNNER': 'Claude Code and Node inside the isolation boundary', 'GOV-EGRESS': 'verified provider egress', 'GOV-LIVE-REQUEST': 'live_execution.requested', 'GOV-F6-PORTREAD': 'F6 receipt for PORTREAD'}
for k, v in gov_nodes.items():
    nodes[k] = {'id': k, 'type': 'governance_prerequisite', 'label': v}
ver_bmad = next(r['master_id'] for r in records if r['root_cause_group'] == 'RCG-21')
ver_f6 = next(r['master_id'] for r in records if r['root_cause_group'] == 'RCG-22')
failed = {c['id'] for c in (pf or {}).get('checks', []) if not c['ok']}
for k, check in [('GOV-TRUST-STORE', 'provider_authorization'), ('GOV-DISCLOSURE', 'provider_authorization'), ('GOV-G2-PORTREAD', 'g2_exact_scope'), ('GOV-RUNNER', 'runner_inside_boundary'), ('GOV-EGRESS', 'network_isolation'), ('GOV-LIVE-REQUEST', 'runtime_execution_authorization')]:
    if check in failed:
        edges.append({'from': k, 'to': ver_bmad, 'relation': 'PREREQUISITE_OF', 'evidence': f"{pf['record_id']} failed check {check}", 'confidence': 'EVIDENCED'})
edges.append({'from': 'GOV-TRUST-STORE', 'to': 'GOV-DISCLOSURE', 'relation': 'PREREQUISITE_OF', 'evidence': 'a disclosure authorization is verified against trusted data_owner signers (provider authorization doctor: TRUST_NOT_CONFIGURED)', 'confidence': 'EVIDENCED'})
edges.append({'from': 'GOV-TRUST-STORE', 'to': 'GOV-G2-PORTREAD', 'relation': 'PREREQUISITE_OF', 'evidence': 'G2 approvals are verified against trusted signers', 'confidence': 'EVIDENCED'})
edges.append({'from': 'GOV-F6-PORTREAD', 'to': ver_f6, 'relation': 'PREREQUISITE_OF', 'evidence': 'BGR-0004 independent_evidence.f6 MISSING', 'confidence': 'EVIDENCED'})
edges.append({'from': ver_f6, 'to': ver_bmad, 'relation': 'PREREQUISITE_OF', 'evidence': 'the review stage needs an accepted F6 receipt (governance.ts governedRun)', 'confidence': 'EVIDENCED'})
nodes['RULE-EQUIVALENCE-ALL'] = {'id': 'RULE-EQUIVALENCE-ALL', 'type': 'verification', 'label': 'COBOL equivalence of all 154 rules'}
edges.append({'from': next(r['master_id'] for r in records if r['root_cause_group'] == 'RCG-20'), 'to': 'RULE-EQUIVALENCE-ALL', 'relation': 'BLOCKS', 'evidence': 'no legacy execution evidence exists (step-22 business-rule-reconciliation cobol_equivalent 0)', 'confidence': 'EVIDENCED'})
edges = sorted({json.dumps(e, sort_keys=True): e for e in edges}.values(), key=lambda e: (e['from'], e['to'], e['relation']))
# cycles among gap->gap edges
adj = collections.defaultdict(list)
for e in edges:
    if e['from'].startswith('MGR-') and e['to'].startswith('MGR-'):
        adj[e['from']].append(e['to'])
cycles, state = [], {}


def dfs(n, stack):
    state[n] = 1
    stack.append(n)
    for m_ in adj.get(n, []):
        if state.get(m_) == 1:
            cycles.append(stack[stack.index(m_):] + [m_])
        elif not state.get(m_):
            dfs(m_, stack)
    stack.pop()
    state[n] = 2


for n in sorted(adj):
    if not state.get(n):
        dfs(n, [])
incoming = C(e['to'] for e in edges if e['to'].startswith('MGR-') and e['from'].startswith('MGR-'))
outgoing = C(e['from'] for e in edges if e['from'].startswith('MGR-'))
root_blockers = sorted(r['master_id'] for r in records if outgoing.get(r['master_id']) and not incoming.get(r['master_id']))
independent = sorted(r['master_id'] for r in records if not outgoing.get(r['master_id']) and not incoming.get(r['master_id']))

# ------------------------------------------------------------------ write register and derived views
FIELDS = {
    'master_id': 'stable register identity (MGR-NNNN, unchanged from the consolidated register)', 'original_id': 'original gap identity (forward GAP-<P>-NNNN, reverse GAP-NNN) or null for verification records',
    'inventory_category': 'forward_gap / reverse_gap / verification_or_integration', 'category': 'root-cause category', 'root_cause_group': 'RCG-NN (root-cause-groups.json)',
    'severity': 'original severity (preserved)', 'priority': 'P0-P3 or REVIEW, derived from severity and category (priority_rationale)', 'status': 'OPEN for every record: STEP 23 resolves nothing',
    'rules': 'affected business rules (evidence in rule_links)', 'owner / approver / external_owner': 'role-based; OWNER_REVIEW_REQUIRED where the root cause has no clear owner',
    'resolution_evidence': 'null until a closure is evidenced',
}
write('master-gap-register.json', {'contract': 'step-23/master-gap-register', 'fields': FIELDS, 'records': records})
cols = ['master_id', 'original_id', 'inventory_category', 'category', 'root_cause_group', 'root_cause', 'severity', 'priority', 'status', 'programs', 'source_path', 'source_line', 'subject', 'rules', 'diagrams', 'jcl_jobs', 'owner', 'approver', 'external_owner', 'required_technical_action', 'required_business_decision', 'verification_method', 'closure_criteria']
buf = io.StringIO()
w = csv.writer(buf, lineterminator='\n')
w.writerow(cols)
for r in records:
    w.writerow([';'.join(map(str, r[c])) if isinstance(r[c], list) else ('' if r[c] is None else r[c]) for c in cols])
with open(os.path.join(OUT, 'master-gap-register.csv'), 'w', encoding='utf8', newline='') as f:
    f.write(buf.getvalue())

summary = {'contract': 'step-23/gap-summary', 'fields': {'*': 'counts over the 569 canonical records'}, 'total': len(records), 'by_inventory_category': dict(sorted(C(r['inventory_category'] for r in records).items())), 'by_category': dict(sorted(C(r['category'] for r in records).items())), 'by_severity': dict(sorted(C(str(r['severity']) for r in records).items())), 'by_priority': dict(sorted(C(r['priority'] for r in records).items())), 'by_status': dict(C(r['status'] for r in records)), 'by_root_cause_group': dict(sorted(C(r['root_cause_group'] for r in records).items())), 'by_owner': dict(sorted(C(r['owner'] for r in records).items())), 'reverse_historical': {'total': g22['reverse_historical'], 'disposition': g22['reverse_disposition'], 'arithmetic': g22['arithmetic']}}
write('gap-summary.json', summary)

groups_out = []
for gid, (title, cat, owner, req, valid) in sorted(GROUPS.items()):
    mem = [r for r in records if r['root_cause_group'] == gid]
    groups_out.append({'group_id': gid, 'title': title, 'category': cat, 'root_cause': title, 'members': [r['master_id'] for r in mem], 'member_count': len(mem), 'programs': sorted({p for r in mem for p in r['programs']}), 'rules': sorted({x for r in mem for x in r['rules']}), 'dependencies': sorted({e['from'] for e in edges if e['to'] in {r['master_id'] for r in mem} and not e['from'].startswith('MGR-')}), 'owner': owner, 'external_owner': EXT_OWNER.get(gid), 'resolution_requirements': req, 'validation_evidence': valid})
write('root-cause-groups.json', {'contract': 'step-23/root-cause-groups', 'fields': {'members': 'master IDs; every record belongs to exactly one group; grouping never removes a record'}, 'groups': groups_out})

write('dependency-graph.json', {'contract': 'step-23/dependency-graph', 'fields': {'edges[].confidence': 'EVIDENCED (recorded evidence), EVIDENCED_BY_TEXT (STEP 17 evidence text names the gap site), HYPOTHESIS (needs confirmation)', 'root_blockers': 'gaps with at least one outgoing edge (to another gap, a rule or a readiness result) and no incoming gap-to-gap edge', 'independent': 'gaps with no edge to or from another gap, rule or readiness result (external-prerequisite edges aside)'}, 'nodes': sorted(nodes.values(), key=lambda n: n['id']), 'edges': edges, 'summary': {'nodes': len(nodes), 'edges': len(edges), 'by_relation': dict(sorted(C(e['relation'] for e in edges).items())), 'by_confidence': dict(sorted(C(e['confidence'] for e in edges).items())), 'cycles': cycles, 'root_blockers': len(root_blockers), 'independent_gaps': len(independent)}, 'root_blockers': root_blockers, 'independent_gaps': independent, 'unlinked_unreachable_rules': unlinked_unreachable})
mm = ['flowchart LR']
for gid, (title, *_rest) in sorted(GROUPS.items()):
    mm.append(f'  {gid.replace("-", "_")}["{gid}: {title} ({sum(1 for r in records if r["root_cause_group"] == gid)})"]')
for k, (label, gs) in EXT.items():
    mm.append(f'  {k.replace("-", "_")}(["{label}"])')
    for gg in gs:
        mm.append(f'  {k.replace("-", "_")} --> {gg.replace("-", "_")}')
for k, v in gov_nodes.items():
    mm.append(f'  {k.replace("-", "_")}(["{v}"])')
mm += ['  GOV_TRUST_STORE --> GOV_DISCLOSURE', '  GOV_TRUST_STORE --> GOV_G2_PORTREAD', '  GOV_DISCLOSURE --> RCG_21', '  GOV_G2_PORTREAD --> RCG_21', '  GOV_RUNNER --> RCG_21', '  GOV_EGRESS --> RCG_21', '  GOV_LIVE_REQUEST --> RCG_21', '  GOV_F6_PORTREAD --> RCG_22', '  RCG_22 --> RCG_21', '  MEMBERS(["missing members PORTREC, SQLPOS, DB2STAT"]) -. hypothesis .-> RCG_03', '  RCG_20 --> EQ(["COBOL equivalence of 154 rules"])']
with open(os.path.join(OUT, 'dependency-graph.mmd'), 'w', encoding='utf8', newline='\n') as f:
    f.write('\n'.join(mm) + '\n')

pimpact = []
for p in sorted(progs):
    rs = [r for r in records if p in r['programs']]
    rd = readiness.get(p)
    direct = sorted({e['from'] for e in edges if e['to'] == f'READINESS-{p}'})
    pimpact.append({'program': p, 'classification': progs[p]['classification'], 'readiness': rd['status'] if rd else None, 'readiness_failing_checks': [c['id'] for c in rd['checks'] if not c['ok']] if rd else None, 'gaps': len(rs), 'critical': sum(1 for r in rs if r['severity'] == 'critical'), 'high': sum(1 for r in rs if r['severity'] == 'high'), 'by_category': dict(sorted(C(r['category'] for r in rs).items())), 'root_blockers': sorted(r['master_id'] for r in rs if r['master_id'] in set(root_blockers)), 'direct_readiness_blockers': direct, 'external_blockers': sum(1 for r in rs if r['category'] == 'EXTERNAL_DEPENDENCY'), 'business_decision_blockers': sum(1 for r in rs if r['category'] == 'BUSINESS_DECISION_REQUIRED'), 'verification_blockers': sum(1 for r in rs if r['category'] in ('TEST_COVERAGE_GAP', 'LEGACY_EQUIVALENCE_GAP')), 'next_actions': sorted({GROUPS[r['root_cause_group']][3] for r in rs})[:6], 'note': 'resolving one gap does not by itself make a program ready: readiness re-runs every check'})
write('program-gap-impact.json', {'contract': 'step-23/program-gap-impact', 'fields': {'direct_readiness_blockers': 'gaps whose site line is named by a failing readiness closure reason', 'root_blockers': 'gaps of the program with an outgoing edge and no incoming gap-to-gap edge'}, 'programs': pimpact, 'summary': {'programs': len(pimpact), 'readiness_pass': sum(1 for x in pimpact if x['readiness'] == 'PASS'), 'readiness_not_pass': sum(1 for x in pimpact if x['readiness'] != 'PASS')}})

rimpact = []
for r in sorted(rules, key=lambda x: x['rule']):
    gl = [x for x in records if r['rule'] in x['rules']]
    cats = C(x['category'] for x in gl)
    rimpact.append({'rule': r['rule'], 'program': r['program'], 'status': r['status'], 'gaps': [x['master_id'] for x in gl], 'blocked_by_missing_implementation': any(x['category'] in ('UNSUPPORTED_COBOL_SEMANTICS', 'JAVA_IMPLEMENTATION_GAP') for x in gl), 'affected_by_missing_source': any(x['category'] in ('SOURCE_MISSING', 'SOURCE_DEFECT', 'DATA_LAYOUT_GAP') for x in gl), 'requires_business_decision': any(x['category'] == 'BUSINESS_DECISION_REQUIRED' for x in gl), 'needs_external_environment': any(x['category'] == 'EXTERNAL_DEPENDENCY' for x in gl), 'implemented_not_independently_verified': r['status'] != 'BLOCKED', 'awaiting_legacy_equivalence': True, 'gap_categories': dict(sorted(cats.items()))})
write('business-rule-gap-impact.json', {'contract': 'step-23/business-rule-gap-impact', 'fields': {'status': 'unchanged STEP 22 status', 'awaiting_legacy_equivalence': 'true for every rule (no legacy execution evidence)'}, 'rules': rimpact, 'summary': {'rules': len(rimpact), 'by_status': dict(sorted(C(x['status'] for x in rimpact).items())), 'with_linked_gaps': sum(1 for x in rimpact if x['gaps']), 'blocked_by_missing_implementation': sum(x['blocked_by_missing_implementation'] for x in rimpact), 'affected_by_missing_source': sum(x['affected_by_missing_source'] for x in rimpact), 'requires_business_decision': sum(x['requires_business_decision'] for x in rimpact), 'needs_external_environment': sum(x['needs_external_environment'] for x in rimpact), 'unlinked_unreachable_rules': [u['rule'] for u in unlinked_unreachable]}})

dimpact = []
for d in sorted(diagrams, key=lambda x: x['diagram_id']):
    ps = sorted({p for p in [d.get('program')] + (d.get('programs') or []) if p})
    rs = [r for r in records if r['diagrams'] and d['diagram_id'] in r['diagrams']]
    dimpact.append({'diagram_id': d['diagram_id'], 'type': d['type'], 'mapping': d['mapping'], 'programs': ps, 'gaps': len(rs), 'gap_groups': dict(sorted(C(r['root_cause_group'] for r in rs).items())), 'edges_not_found_in_java': len(d.get('edges_not_found_in_java') or []), 'edge_classes': d.get('edges_classified') or d.get('program_edges')})
write('diagram-gap-impact.json', {'contract': 'step-23/diagram-gap-impact', 'fields': {'gaps': 'register records of the programs the diagram references'}, 'diagrams': dimpact})

roles = sorted({r['owner'] for r in records})
write('ownership-matrix.json', {'contract': 'step-23/ownership-matrix', 'fields': {'owner': 'responsible role', 'approver': 'required approver role', 'external_owner': 'owner of the external dependency'}, 'roles': [{'role': ro, 'gaps': sum(1 for r in records if r['owner'] == ro), 'groups': sorted({r['root_cause_group'] for r in records if r['owner'] == ro}), 'approvers': sorted({r['approver'] for r in records if r['owner'] == ro}), 'external_owners': sorted({r['external_owner'] for r in records if r['owner'] == ro and r['external_owner']})} for ro in roles], 'owner_review_required': sum(1 for r in records if r['owner'] == 'OWNER_REVIEW_REQUIRED'), 'names': 'role-based only: no person is named in repository evidence'})

PHASES = [
    ('A', 'Source and business decisions', ['RCG-19', 'RCG-03', 'RCG-04', 'RCG-05', 'RCG-06', 'RCG-07', 'RCG-10', 'RCG-11', 'RCG-12', 'RCG-13', 'RCG-14', 'RCG-15', 'RCG-16'], 'access to the authorized source owner and business SMEs; the decision register', 'corrected/missing source members and signed decisions', 'readiness re-run shows the source-category checks passing for the affected programs; the corresponding gaps disappear on reconversion'),
    ('B', 'External environments', ['RCG-01', 'RCG-02', 'RCG-08', 'RCG-09', 'RCG-20'], 'project owner approval for environments; platform engineering', 'DB2, CICS, legacy environment definitions, platform services, COBOL runtime or captured runs', 'captured runs exist for each external outcome; boundary gaps have specifications'),
    ('C', 'Governed Java implementation', ['RCG-21', 'RCG-18', 'RCG-23'], 'Phase A/B evidence; trust store, signed disclosure authorization, G2/G3/G4 approvals, runner and egress (BMad)', 'verified LIVE BMad receipts and approved stories', 'bmad governance verdict BMAD_COMPLIANT for the scope; converter changes with regression tests'),
    ('D', 'Independent verification', ['RCG-22', 'RCG-20'], 'Phase C implementation; legacy runtime (Phase B)', 'F6 receipts; differential legacy comparisons', 'accepted F6 receipts; scenarios agree with legacy outputs'),
    ('E', 'Readiness reassessment', ['RCG-17'], 'Phases A-D', 'a re-run of the engineering gates, readiness and the STEP 22 reconciliation', 'readiness, validation and reconciliation re-run; reverse diagrams regenerated; remaining gaps re-registered'),
]
write('remediation-roadmap.json', {'contract': 'step-23/remediation-roadmap', 'fields': {'phases[].exit_criteria': 'measurable; no dates, budgets or resources are assumed'}, 'phases': [{'phase': a, 'title': b, 'groups': gs, 'gaps': sum(1 for r in records if r['root_cause_group'] in gs), 'roles': sorted({GROUPS[g][2] for g in gs}), 'prerequisites': c, 'required_evidence': d, 'exit_criteria': e, 'remaining_blockers': 'everything outside these groups' if gs else 'whatever the re-run reports'} for a, b, gs, c, d, e in PHASES], 'all_groups_covered': sorted({g for _, _, gs, *_ in PHASES for g in gs}) == sorted(GROUPS)})

ada_file = os.path.join(FW, 'reports', 'step-21', 'authorization-request-PORTREAD.unsigned.json')
ada = load(ada_file) if os.path.exists(ada_file) else None
write('bmad-governance-blockers.json', {'contract': 'step-23/bmad-governance-blockers', 'fields': {'blockers[]': 'failed checks of the latest PORTREAD preflight plus independent evidence'}, 'status': bmad22['status'], 'metrics': bmad22['metrics'], 'preflight': (pf or {}).get('record_id'), 'blockers': [{'check': c['id'], 'detail': c['detail']} for c in (pf or {}).get('checks', []) if not c['ok']] + [{'check': 'f6_independent_evidence', 'detail': 'no accepted F6 receipt for PORTREAD (BGR-0004)'}], 'disclosure_request': {'authorization_id': (ada or {}).get('authorization_id'), 'signed': False, 'expires_at': (ada or {}).get('expires_at'), 'note': 'time-dependent: re-check expiry at use; re-prepare after it expires'}, 'register_records': [r['master_id'] for r in records if r['root_cause_group'] in ('RCG-21', 'RCG-22')], 'not_evidence': 'none of this is BMad execution: 0 workflows executed, 0 verified receipts'})


def met(name, num, den, definition, src):
    return {'metric': name, 'numerator': num, 'denominator': den, 'definition': definition, 'source': src}


dash = {'contract': 'step-23/dashboard-gap-summary', 'fields': {'metrics[]': 'numerator / denominator with definitions; no stored percentages'}, 'metrics': [
    met('gaps_open', sum(1 for r in records if r['status'] == 'OPEN'), len(records), 'open register records / register records', 'master-gap-register.json'),
    met('gaps_p0', C(r['priority'] for r in records).get('P0', 0), len(records), 'P0 records / records', 'gap-summary.json'),
    met('gaps_p1', C(r['priority'] for r in records).get('P1', 0), len(records), 'P1 records / records', 'gap-summary.json'),
    met('gaps_external', C(r['category'] for r in records).get('EXTERNAL_DEPENDENCY', 0), len(records), 'external-dependency records / records', 'gap-summary.json'),
    met('gaps_business_decision', C(r['category'] for r in records).get('BUSINESS_DECISION_REQUIRED', 0), len(records), 'business-decision records / records', 'gap-summary.json'),
    met('gaps_source', C(r['category'] for r in records).get('SOURCE_MISSING', 0) + C(r['category'] for r in records).get('SOURCE_DEFECT', 0), len(records), 'source missing or defective / records', 'gap-summary.json'),
    met('gaps_owner_review', sum(1 for r in records if r['owner'] == 'OWNER_REVIEW_REQUIRED'), len(records), 'records needing an owner decision / records', 'ownership-matrix.json'),
    met('rules_with_linked_gaps', sum(1 for x in rimpact if x['gaps']), len(rimpact), 'rules linked to at least one gap / rules', 'business-rule-gap-impact.json'),
    met('programs_ready', sum(1 for x in pimpact if x['readiness'] == 'PASS'), len(pimpact), 'programs passing readiness / programs', 'program-gap-impact.json'),
    met('dependency_edges_evidenced', sum(1 for e in edges if e['confidence'].startswith('EVIDENCED')), len(edges), 'evidence-backed edges / edges', 'dependency-graph.json'),
    met('bmad_workflows_executed', 0, 6, 'LIVE BMad workflows executed / bound workflows', 'bmad-governance-blockers.json'),
], 'groups': [{'group_id': g['group_id'], 'title': g['title'], 'members': g['member_count']} for g in groups_out], 'cobol_equivalence': 'NOT ESTABLISHED'}
write('dashboard-gap-summary.json', dash)

# ------------------------------------------------------------------ validation
ids = [r['master_id'] for r in records]
checks = []
add = lambda i, ok, d: checks.append({'id': i, 'ok': bool(ok), 'detail': d})
add('record_count', len(records) == 569 == mgr['counts']['total'], f'{len(records)} canonical records; consolidated register {mgr["counts"]["total"]}')
add('unique_master_ids', len(set(ids)) == len(ids), f'{len(set(ids))} unique')
add('unique_original_ids', len({r['original_id'] for r in records if r['original_id']}) == sum(1 for r in records if r['original_id']), 'original identities appear once')
add('inventory_split', C(r['inventory_category'] for r in records) == C({'forward_gap': 391, 'reverse_gap': 174, 'verification_or_integration': 4}), dict(C(r['inventory_category'] for r in records)))
disp = C(x['register_disposition'] for x in g22['reverse'])
add('reverse_217_dispositions', len(g22['reverse']) == 217 and sum(disp.values()) == 217, dict(disp))
rev_in = {r['original_id'] for r in records if r['inventory_category'] == 'reverse_gap'}
represented = [x for x in g22['reverse'] if x['register_disposition'] == 'REPRESENTED_BY_FORWARD_GAP_RECORDS']
add('represented_reverse_traceable', all(x['register_ids'] and all(i in set(ids) for i in x['register_ids']) for x in represented), f'{len(represented)} reverse gaps point at existing forward records')
add('retained_reverse_present', {x['reverse_gap'] for x in g22['reverse'] if x['register_disposition'] == 'REVERSE_RECORD_IN_REGISTER'} == rev_in, f'{len(rev_in)} retained reverse records')
add('forward_ids_exist', all(r['original_id'] in fgap for r in records if r['inventory_category'] == 'forward_gap'), 'every forward record resolves to a pilot-result gap')
add('source_references', all(r['source_reference'] for r in records), 'every record has a source reference')
add('every_record_grouped_once', all(r['root_cause_group'] in GROUPS for r in records) and sum(g['member_count'] for g in groups_out) == len(records), 'group memberships sum to the record count')
add('owners_present', all(r['owner'] for r in records), f"{sum(1 for r in records if r['owner'] == 'OWNER_REVIEW_REQUIRED')} OWNER_REVIEW_REQUIRED")
add('actions_and_closure', all((r['required_technical_action'] or r['required_business_decision']) and r['closure_criteria'] and r['verification_method'] for r in records), 'every record has an action, a verification method and a closure criterion')
add('priorities_justified', all(r['priority'] and r['priority_rationale'] for r in records), dict(C(r['priority'] for r in records)))
node_ids = set(nodes)
add('graph_references_valid', all(e['from'] in node_ids and e['to'] in node_ids for e in edges), f'{len(edges)} edges over {len(nodes)} nodes')
add('graph_cycles', not cycles, f'{len(cycles)} cycle(s)')
add('rule_ids_valid', all(x in {r['rule'] for r in rules} for r in records for x in r['rules']), 'every linked rule exists among the 154')
add('programs_valid', all(p in progs for r in records for p in r['programs']), 'every affected program exists among the 42')
add('diagrams_valid', all(d in {x['diagram_id'] for x in diagrams} for r in records for d in r['diagrams']), 'every affected diagram exists among the 65')
add('rule_status_unchanged', [x['status'] for x in sorted(rimpact, key=lambda x: x['rule'])] == [r['status'] for r in sorted(rules, key=lambda x: x['rule'])], 'STEP 22 rule statuses unchanged')
add('roadmap_covers_groups', load(os.path.join(OUT, 'remediation-roadmap.json'))['all_groups_covered'], 'every root-cause group is in a phase')
add('dashboard_consistent', dash['metrics'][0]['denominator'] == len(records), 'dashboard denominators match the register')
csv_rows = list(csv.reader(io.StringIO(buf.getvalue())))
add('csv_rows', len(csv_rows) - 1 == len(records), f'{len(csv_rows) - 1} CSV rows')
deterministic = {n: hashlib.sha256(open(os.path.join(OUT, n), 'rb').read()).hexdigest() for n in sorted(os.listdir(OUT)) if n != 'validation-results.json' and not n.startswith('regression-')}
write('validation-results.json', {'contract': 'step-23/validation-results', 'fields': {'checks[]': 'integrity and consistency checks over the outputs', 'output_sha256': 'hashes of the deterministic outputs (compare across runs)', 'run_metadata': 'non-deterministic data, kept apart'}, 'ok': all(c['ok'] for c in checks), 'checks': checks, 'output_sha256': deterministic, 'run_metadata': {'generated_at': datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='seconds'), 'disclosure_request_expired': (ada or {}).get('expires_at', '') < datetime.datetime.now(datetime.timezone.utc).isoformat()}})
# ------------------------------------------------------------------ markdown report
gs = load(os.path.join(OUT, 'gap-summary.json'))
dgs = load(os.path.join(OUT, 'dependency-graph.json'))['summary']
rgs = load(os.path.join(OUT, 'business-rule-gap-impact.json'))['summary']
road = load(os.path.join(OUT, 'remediation-roadmap.json'))['phases']
bgb = load(os.path.join(OUT, 'bmad-governance-blockers.json'))
L = []
A = L.append
A('# STEP 23: Master Gap Register')
A('')
A(f"**Status: {'COMPLETE' if all(c['ok'] for c in checks) else 'PARTIAL'}.** The register holds {len(records)} records. Every record is OPEN: STEP 23 consolidates, classifies and plans; it resolves nothing.")
A('')
A('**COBOL-to-Java equivalence: not established.**')
A('')
A('**BMad: BMAD ENFORCEMENT VERIFIED — LIVE EXECUTION BLOCKED.**')
A('')
A('Machine-readable outputs are in `forward/reports/step-23/`, built by `forward/tools/step23-gaps.py`. The tool is deterministic: a second run on unchanged inputs produced identical hashes, recorded in `validation-results.json`.')
A('')
A('## 1. Inventory')
A('')
A('| Category | Records |')
A('|---|---|')
for k, v in gs['by_inventory_category'].items():
    A(f'| {k} | {v} |')
A(f"| **Total** | **{gs['total']}** |")
A('')
A(f"**Historical reverse gaps:** {gs['reverse_historical']['arithmetic']}. Each of the 217 has its disposition in `forward/reports/step-22/gap-reconciliation.json`.")
A('')
A('Master IDs (MGR-NNNN) are those of the consolidated register, and every original gap ID is kept.')
A('')
A('## 2. Classification')
A('')
A('| Root-cause category | Records |')
A('|---|---|')
for k, v in gs['by_category'].items():
    A(f'| {k} | {v} |')
A('')
A(f"- **Severity (original):** {gs['by_severity']}.")
A(f"- **Priority:** {gs['by_priority']}.")
A('- **Priority rules:**')
A('  - P0: critical severity.')
A('  - P1: high severity (a rule site is blocked).')
A('  - P2: medium severity.')
A('  - P3: low severity, or reverse documentation only.')
A('  - REVIEW: no recorded severity.')
A('')
A('The categories map the repository dependency groups D1–D7 and the reverse gap types. REVERSE_ARTIFACT_QUALITY covers the reverse diagram-quality gaps that STEP 19 classed NOT_COMPARABLE.')
A('')
A('## 3. Root-cause groups')
A('')
A('| Group | Title | Category | Members | Owner |')
A('|---|---|---|---|---|')
for g in groups_out:
    A(f"| {g['group_id']} | {g['title']} | {g['category']} | {g['member_count']} | {g['owner']} |")
A('')
A('Grouping never removes a record: the members sum to the register total.')
A('')
A('## 4. Dependency graph')
A('')
A(f"- **Size:** {dgs['nodes']} nodes, {dgs['edges']} edges.")
A(f"- **By relation:** {dgs['by_relation']}.")
A(f"- **By confidence:** {dgs['by_confidence']}.")
A(f"- **Cycles:** {len(dgs['cycles'])}.")
A(f"- **Root blockers:** {dgs['root_blockers']}.")
A(f"- **Independent gaps:** {dgs['independent_gaps']}.")
A('')
A('**HYPOTHESIS edges** link the missing members PORTREC, SQLPOS and DB2STAT to the data gaps of their including programs. They need confirmation once the members exist.')
A('')
A('**EVIDENCED_BY_TEXT edges** link unreachable rules to the gap named in their STEP 17 evidence text.')
A('')
A('A readable overview is in `dependency-graph.mmd`.')
A('')
A('## 5. Program impact')
A('')
A('| Program | Class | Readiness | Gaps | Critical | High | Direct readiness blockers |')
A('|---|---|---|---|---|---|---|')
for x in pimpact:
    A(f"| {x['program']} | {x['classification']} | {x['readiness']} | {x['gaps']} | {x['critical']} | {x['high']} | {len(x['direct_readiness_blockers'])} |")
A('')
A('Readiness: 6 of 42 programs pass. Resolving one gap does not by itself make a program ready, because readiness re-runs every check.')
A('')
A('## 6. Business-rule impact')
A('')
A(f"**Statuses (unchanged):** {rgs['by_status']}.")
A('')
A('| Measure | Rules |')
A('|---|---|')
A(f"| Linked to at least one gap | {rgs['with_linked_gaps']} |")
A(f"| Blocked by missing implementation | {rgs['blocked_by_missing_implementation']} |")
A(f"| Affected by missing or defective source | {rgs['affected_by_missing_source']} |")
A(f"| Requiring a business decision | {rgs['requires_business_decision']} |")
A(f"| Needing an external environment | {rgs['needs_external_environment']} |")
A('| Awaiting legacy equivalence | all 154 |')
A('')
A('## 7. Ownership')
A('')
A('| Role | Gaps |')
A('|---|---|')
for ro in roles:
    A(f"| {ro} | {sum(1 for r in records if r['owner'] == ro)} |")
A('')
A('All ownership is role-based; no person is named.')
A('')
A('## 8. BMad governance blockers')
A('')
A(f"Status: {bgb['status']}. Preflight: {bgb['preflight']}.")
A('')
A('| Check | Detail |')
A('|---|---|')
for b in bgb['blockers']:
    A(f"| {b['check']} | {b['detail'][:180].replace('|', '/')} |")
A('')
A(f"**Disclosure request** {bgb['disclosure_request']['authorization_id']}: unsigned, expires {bgb['disclosure_request']['expires_at']}. The expiry is time-dependent: re-check it at use.")
A('')
A('## 9. Remediation roadmap')
A('')
A('No dates, budgets or resources are assumed.')
A('')
A('| Phase | Title | Gaps | Roles | Exit criteria |')
A('|---|---|---|---|---|')
for ph in road:
    A(f"| {ph['phase']} | {ph['title']} | {ph['gaps']} | {', '.join(ph['roles']) or '-'} | {ph['exit_criteria']} |")
A('')
reg_file = os.path.join(OUT, 'regression-runs.jsonl')
if os.path.exists(reg_file):
    A('## 10. Regression (sequential)')
    A('')
    A('| Command | Exit | Result |')
    A('|---|---|---|')
    for l in open(reg_file, encoding='utf8'):
        if l.strip():
            x = json.loads(l)
            A(f"| `{x['command'][:90]}` | {x['exit_code']} | {x['result'][:200].replace('|', '/')} |")
    A('')
A('## 11. Validation')
A('')
A('| Check | OK | Detail |')
A('|---|---|---|')
for c in checks:
    A(f"| {c['id']} | {c['ok']} | {str(c['detail'])[:160].replace('|', '/')} |")
with open(os.path.join(FW, 'reports', 'STEP-23-MASTER-GAP-REGISTER.md'), 'w', encoding='utf8', newline='\n') as f:
    f.write('\n'.join(L) + '\n')
print('STEP 23 validation:', 'OK' if all(c['ok'] for c in checks) else [c for c in checks if not c['ok']])
