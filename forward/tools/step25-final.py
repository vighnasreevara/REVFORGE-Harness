#!/usr/bin/env python3
"""STEP 25: final integrity, coverage, register, governance and handover audit.

Read-only towards everything it audits. It writes only forward/reports/step-25/*.json
and forward/handover/HANDOVER-MANIFEST.json.

  python forward/tools/step25-final.py snapshot OUT.json   hashes of generated Java, the integration
                                                           copy and the local run records (before/after)
  python forward/tools/step25-final.py audit               writes the STEP-25 evidence and the manifest

Every check states the environment it needs:
  A  pure Git checkout (committed files only)
  B  developer environment (adds the configured COBOL source root, forward/runs, forward/generated)
A check whose inputs are absent is reported NOT_VERIFIABLE_HERE, never as passed.
Deterministic except bmad.disclosure_request.evaluated_at (the clock reading the expiry is compared with).
"""
import collections
import datetime
import glob
import hashlib
import json
import os
import subprocess
import sys

FW = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
REPO = os.path.dirname(FW)
OUT = os.path.join(FW, 'reports', 'step-25')
HANDOVER = os.path.join(FW, 'handover')
S22 = os.path.join(FW, 'reports', 'step-22')
S23 = os.path.join(FW, 'reports', 'step-23')
S24 = os.path.join(FW, 'reports', 'step-24')
RUN_ID = 'FWD-20261031T172520Z-66b3'
RUN = os.path.join(FW, 'runs', RUN_ID)
GEN = os.path.join(FW, 'generated', 'java')
SRC = os.environ.get('REVFORGE_COBOL_SOURCE_ROOT') or ''


def load(p):
    with open(p, encoding='utf8') as f:
        return json.load(f)


def sha(p):
    h = hashlib.sha256()
    with open(p, 'rb') as f:
        for b in iter(lambda: f.read(1 << 20), b''):
            h.update(b)
    return h.hexdigest()


def git(*args):
    r = subprocess.run(['git', '-C', REPO, *args], capture_output=True, text=True, encoding='utf8')
    return r.stdout.strip() if r.returncode == 0 else None


def write(name, obj, root=OUT):
    os.makedirs(root, exist_ok=True)
    with open(os.path.join(root, name), 'w', encoding='utf8', newline='\n') as f:
        f.write(json.dumps(obj, indent=1, ensure_ascii=False) + '\n')


def chk(cid, ok, detail, env='A'):
    status = 'PASS' if ok is True else 'FAIL' if ok is False else 'NOT_VERIFIABLE_HERE'
    return {'id': cid, 'status': status, 'environment': env, 'detail': detail}


# ---------------------------------------------------------------- snapshot mode
def generated_tree():
    """STEP-22 definition: every .java under generated/java/<P>/, integration copy (app/) excluded."""
    if not os.path.isdir(GEN):
        return None
    gen = sorted(os.path.join(r, f) for r, _, fs in os.walk(GEN) for f in fs
                 if f.endswith('.java') and not os.path.relpath(r, GEN).replace(os.sep, '/').startswith('app'))
    return {'files': len(gen), 'tree_sha256': hashlib.sha256(''.join(f"{os.path.relpath(p, FW)}\t{sha(p)}\n" for p in gen).encode()).hexdigest()}


def dir_hashes(root, skip=()):
    out = {}
    if not os.path.isdir(root):
        return out
    for r, _, fs in os.walk(root):
        for f in fs:
            p = os.path.join(r, f)
            rel = os.path.relpath(p, root).replace(os.sep, '/')
            if any(rel.startswith(s) for s in skip):
                continue
            out[rel] = sha(p)
    return out


def snapshot(dest):
    app_src = dir_hashes(os.path.join(GEN, 'app'), skip=('classes/',))
    snap = {
        'generated_program_sources': generated_tree(),
        'integration_copy': {'files': len(app_src), 'tree_sha256': hashlib.sha256(''.join(f'{k}\t{v}\n' for k, v in sorted(app_src.items())).encode()).hexdigest()} if app_src else None,
        'run_records': dir_hashes(RUN),
    }
    with open(dest, 'w', encoding='utf8', newline='\n') as f:
        json.dump(snap, f, indent=1)
    print(f"snapshot: generated {snap['generated_program_sources']}, run files {len(snap['run_records'])}")


# ---------------------------------------------------------------- audit
def audit():
    head = git('rev-parse', 'HEAD')
    results = {}

    # ---- 1. repository integrity ------------------------------------------------------------
    tracked = (git('ls-files') or '').splitlines()
    status = [l for l in (git('status', '--porcelain', '--untracked-files=all') or '').splitlines() if l]
    hand = [p for p in tracked if p.startswith('forward/runtime/java/') and p.endswith('.java')]
    forbidden = [p for p in tracked if p.startswith(('references/', 'OpenWiki/', 'forward/generated/')) or p.endswith(('.mcp.json', 'settings.local.json', '.class'))
                 or (p.startswith('forward/runs/') and p != 'forward/runs/.gitkeep') or '/node_modules/' in p or p.startswith('forward/dashboard/dist/') or p.startswith('forward/dashboard/public/evidence/')]
    ign = lambda p: subprocess.run(['git', '-C', REPO, 'check-ignore', '-q', p]).returncode == 0
    repo_checks = [
        chk('head_recorded', bool(head), head or 'not a git checkout'),
        chk('gitattributes_lf', os.path.exists(os.path.join(REPO, '.gitattributes')) and 'eol=lf' in open(os.path.join(REPO, '.gitattributes'), encoding='utf8').read(), '.gitattributes enforces LF'),
        chk('handwritten_runtime_tracked', len(hand) == 20, f'{len(hand)} hand-written runtime Java files tracked (expected 20)'),
        chk('generated_java_ignored', ign('forward/generated/java/X/x.java') and ign('forward/generated/java/app/src/x.java'), 'forward/generated/ is git-ignored'),
        chk('no_forbidden_tracked', not forbidden, 'no restricted source, generated Java, run records, credentials, class files or dashboard build output tracked' if not forbidden else f'{forbidden[:5]}'),
        chk('dashboard_outputs_ignored', all(ign(p) for p in ('forward/dashboard/node_modules/x', 'forward/dashboard/dist/x', 'forward/dashboard/public/evidence/x')), 'dashboard node_modules, dist and evidence copies are git-ignored'),
    ]
    results['repository'] = {'head': head, 'branch': git('rev-parse', '--abbrev-ref', 'HEAD'), 'origin_main': git('rev-parse', 'origin/main'), 'working_tree_entries': status, 'checks': repo_checks}

    # ---- 2. source and artifact integrity ---------------------------------------------------
    si = load(os.path.join(S22, 'source-integrity.json'))
    inv = load(os.path.join(REPO, 'output', 'inventory', 'inventory_artifact.json'))
    man = load(os.path.join(FW, 'pilot', 'authorizations', 'APPLICATION.authorization-manifest.json'))
    man_sha = {}
    for p in man['programs']:
        man_sha[p['source']['path']] = p['source']['sha256']
        for c in p.get('copybooks', []):
            man_sha[c['path']] = c['sha256']
    for k in ('copybooks', 'jcl', 'db2'):
        for x in man.get(k, []):
            man_sha[x['path']] = x['sha256']
    inv_files = [(f['file_id'], f['relative_path'], f.get('size_bytes'), reg) for reg in ('file_registry', 'copybook_registry', 'jcl_registry', 'other_file_registry') for f in inv[reg]]
    no_auth = [{'file_id': fid, 'path': rel, 'registry': reg} for fid, rel, _, reg in inv_files if rel not in man_sha]
    src_ok = bool(SRC) and os.path.isdir(SRC)
    rec22 = {f['path']: f['sha256'] for f in si['files']}
    present = sha_match = size_match = size_rec = 0
    unchanged_since_22 = 0
    if src_ok:
        for fid, rel, size, _ in inv_files:
            p = os.path.join(SRC, rel)
            if not os.path.exists(p):
                continue
            present += 1
            h = sha(p)
            if rel in man_sha and h == man_sha[rel]:
                sha_match += 1
            if size is not None:
                size_rec += 1
                size_match += os.path.getsize(p) == size
            unchanged_since_22 += h == rec22.get(rel)
    arts22 = {a['path']: a['recorded_sha256'] for a in si['reverse_artifacts']}
    art_now = {p: (sha(os.path.join(REPO, p)) if os.path.exists(os.path.join(REPO, p)) else None) for p in arts22}
    base_path = os.path.join(RUN, 'baseline_manifest.json')
    base = load(base_path) if os.path.exists(base_path) else None
    base_match = None
    if base:
        items = [i for i in base['inputs'] if i.get('sha256')]
        base_match = sum(1 for i in items if os.path.exists(os.path.join(REPO, i['path'])) and sha(os.path.join(REPO, i['path'])) == i['sha256'])
    # The blob Git holds decides reproducibility: a fresh checkout gets the blob, not this working copy.
    # The index blob is read (equal to HEAD once committed; includes a staged correction before that).
    def blob_bytes(p):
        r = subprocess.run(['git', '-C', REPO, 'cat-file', 'blob', f':{p}'], capture_output=True)
        return r.stdout if r.returncode == 0 else None
    blob_diff = []
    for p, h in arts22.items():
        b = blob_bytes(p)
        if b is not None and hashlib.sha256(b).hexdigest() != h:
            w = open(os.path.join(REPO, p), 'rb').read() if os.path.exists(os.path.join(REPO, p)) else b''
            blob_diff.append({'path': p, 'recorded_sha256': h, 'committed_blob_sha256': hashlib.sha256(b).hexdigest(), 'identical_after_crlf_to_lf': w.replace(b'\r\n', b'\n') == b.replace(b'\r\n', b'\n'), 'working_copy_crlf_lines': w.count(b'\r\n')})
    gt = generated_tree()
    rule_rev = sorted(r['rule_id'] for r in load(os.path.join(REPO, 'output', 'rules', 'rules_artifact.json'))['business_rules'])
    rule_17 = sorted(r['rule'] for r in load(os.path.join(FW, 'reports', 'step-17', 'business-rules-reconciliation.json'))['rules'])
    rule_22 = sorted(r['rule'] for r in load(os.path.join(S22, 'business-rule-reconciliation.json'))['rules'])
    rule_23 = sorted(r['rule'] for r in load(os.path.join(S23, 'business-rule-gap-impact.json'))['rules'])
    raw_ids = []
    for f in sorted(glob.glob(os.path.join(REPO, 'output', 'parser', 'raw_structure', '*.json'))):
        raw_ids += [s['statement_id'] for s in (load(f).get('procedure_division') or {}).get('statements', [])]
    st22 = {s['statement_id'] for s in load(os.path.join(S22, 'statement-reconciliation.json'))['statements']}
    src_checks = [
        chk('inventoried_sources_present', (present == 83) if src_ok else None, f'{present}/83 inventoried source files present in the configured source root' if src_ok else 'COBOL source root not configured (restricted source is not in Git)', 'B'),
        chk('authorization_hashes_match', (sha_match == 82) if src_ok else None, f'{sha_match}/82 recorded authorization hashes match' if src_ok else 'needs the restricted source', 'B'),
        chk('authorization_hash_coverage_disclosed', len(no_auth) == 1, f'{len(inv_files)} inventoried files, {len(man_sha)} with a recorded authorization hash; without one: ' + ', '.join(f"{x['path']} ({x['registry']})" for x in no_auth)),
        chk('program_sizes_match', (size_match == size_rec == 42) if src_ok else None, f'{size_match}/{size_rec} recorded program sizes match' if src_ok else 'needs the restricted source', 'B'),
        chk('sources_unchanged_since_step22', (unchanged_since_22 == 83) if src_ok else None, f'{unchanged_since_22}/83 source files have the SHA-256 recorded by STEP-22' if src_ok else 'needs the restricted source', 'B'),
        chk('reverse_artifacts_unchanged', all(art_now[p] == h for p, h in arts22.items()) and len(arts22) == 11, f"{sum(art_now[p] == h for p, h in arts22.items())}/{len(arts22)} reverse artifacts match the hashes STEP-22 recorded"),
        chk('reverse_artifacts_committed_bytes_match_recorded', not blob_diff, 'the Git blob (index) of every reverse artifact has its recorded SHA-256, so a fresh checkout reproduces the recorded bytes' if not blob_diff else '; '.join(f"{d['path']}: the committed (LF) blob hashes to {d['committed_blob_sha256'][:16]}…, not to the recorded {d['recorded_sha256'][:16]}…; this working copy has {d['working_copy_crlf_lines']} CRLF lines and equals the blob after CRLF→LF: {d['identical_after_crlf_to_lf']}. The recorded hash is of a CRLF working copy, so a fresh checkout fails this hash check." for d in blob_diff)),
        chk('reverse_artifacts_match_run_baseline', (base_match == 11) if base else None, f'{base_match}/11 match the forward run baseline manifest' if base else 'forward run baseline manifest is local-only (forward/runs/)', 'B'),
        chk('generated_java_unchanged', (gt['files'] == 145 and gt['tree_sha256'] == si['generated_java']['tree_sha256']) if gt else None, f"{gt['files']} generated program sources, tree {gt['tree_sha256'][:16]}… (recorded {si['generated_java']['tree_sha256'][:16]}…)" if gt else 'generated Java is local-only (git-ignored)', 'B'),
        chk('business_rule_identities', rule_rev == rule_17 == rule_22 == rule_23 and len(rule_rev) == 154 and len(set(rule_rev)) == 154, f'{len(rule_rev)} rule IDs; identical in the reverse artifact, STEP-17, STEP-22 and STEP-23'),
        chk('statement_identities', len(raw_ids) == 1936 and len(set(raw_ids)) == 1936 and set(raw_ids) == st22, f'{len(raw_ids)} reverse statement IDs, {len(set(raw_ids))} unique, {len(set(raw_ids) & st22)} traced in the STEP-22 statement reconciliation'),
    ]
    results['source_integrity'] = {'source_root_configured': src_ok, 'files_without_authorization_hash': no_auth, 'reverse_artifact_line_ending_findings': blob_diff, 'checks': src_checks}

    # ---- 3. coverage recount from STEP-22 detail ---------------------------------------------
    rows = lambda f, k: load(os.path.join(S22, f))[k]
    C = collections.Counter
    progs = rows('program-reconciliation.json', 'programs')
    rules = rows('business-rule-reconciliation.json', 'rules')
    paras = rows('paragraph-reconciliation.json', 'paragraphs')
    stmts = rows('statement-reconciliation.json', 'statements')
    cf = load(os.path.join(S22, 'control-flow-reconciliation.json'))
    fr = load(os.path.join(S22, 'field-reconciliation.json'))
    recs = rows('record-reconciliation.json', 'records')
    cbs = rows('copybook-reconciliation.json', 'copybooks')
    diags = rows('diagram-reconciliation.json', 'diagrams')
    jobs = rows('jcl-reconciliation.json', 'jobs')
    cov = {
        'programs': {'total': len(progs), 'with_java': sum(1 for p in progs if p['java_class']), **dict(C(p['classification'] for p in progs)), 'missing_programs': [p['program'] for p in progs if p['classification'] == 'MISSING'], 'complete_programs': sorted(p['program'] for p in progs if p['classification'] == 'COMPLETE'), 'cobol_equivalent': sum(1 for p in progs if p['cobol_equivalence'] != 'NOT_ESTABLISHED')},
        'business_rules': {'total': len(rules), **dict(C(r['status'] for r in rules)), 'cobol_equivalent': sum(1 for r in rules if r['cobol_equivalent'])},
        'paragraphs': {'total': len(paras), 'mapped': sum(1 for p in paras if p['mapping'] == 'STRUCTURAL'), 'test_executed': sum(1 for p in paras if p['evidence'] == 'TEST_VERIFIED')},
        'statements': {'total': len(stmts), 'mapped': sum(1 for s in stmts if s['forward'] == 'MAPPED'), 'at_gaps': sum(1 for s in stmts if s['forward'] == 'GAP'), 'test_executed': sum(1 for s in stmts if s['execution'] == 'TEST_EXECUTED')},
        'perform_edges': {'total': len(cf['perform_edges']), 'structural': sum(1 for e in cf['perform_edges'] if e['forward'] == 'STRUCTURAL')},
        'branches': {'total': len(cf['branches']), 'mapped': sum(1 for e in cf['branches'] if e['forward'] == 'STRUCTURAL')},
        'loops': {'total': len(cf['loops']), 'mapped': sum(1 for e in cf['loops'] if e['forward'] == 'STRUCTURAL')},
        'fields': {'total': len(fr['fields_rows']), 'consistent': sum(1 for f in fr['fields_rows'] if f['forward'] == 'CONSISTENT')},
        'conditions_88': {'total': len(fr['conditions']), 'value_tested': sum(1 for c in fr['conditions'] if c['evidence'] == 'TEST_VERIFIED')},
        'records': {'total': len(recs), 'represented': sum(1 for r in recs if r['forward'] == 'REPRESENTED')},
        'copybooks': {'total': len(cbs), **dict(C(c['status'] for c in cbs)), 'used_and_complete': sum(1 for c in cbs if c['status'] in ('MODEL', 'COMPLETE_IN_PROGRAM'))},
        'diagrams': {'total': len(diags), 'with_java_counterpart': sum(1 for d in diags if d['mapping'] != 'UNMAPPABLE'), 'without': sorted(d['diagram_id'] for d in diags if d['mapping'] == 'UNMAPPABLE')},
        'jcl_jobs': {'total': len(jobs), **dict(C(j['status'] for j in jobs))},
    }
    want = {('programs', 'total'): 42, ('programs', 'with_java'): 41, ('programs', 'COMPLETE'): 2, ('programs', 'PARTIAL'): 39, ('programs', 'MISSING'): 1,
            ('business_rules', 'total'): 154, ('business_rules', 'IMPLEMENTED_VERIFIED'): 67, ('business_rules', 'IMPLEMENTED_VERIFIED_TO_GAP'): 15, ('business_rules', 'IMPLEMENTED_NOT_EXERCISED'): 40, ('business_rules', 'BLOCKED'): 32,
            ('paragraphs', 'total'): 402, ('paragraphs', 'mapped'): 390, ('paragraphs', 'test_executed'): 95,
            ('statements', 'total'): 1936, ('statements', 'mapped'): 1337, ('statements', 'at_gaps'): 599, ('statements', 'test_executed'): 414,
            ('perform_edges', 'total'): 524, ('perform_edges', 'structural'): 397, ('branches', 'total'): 254, ('branches', 'mapped'): 190, ('loops', 'total'): 32, ('loops', 'mapped'): 26,
            ('fields', 'total'): 1009, ('fields', 'consistent'): 966, ('records', 'total'): 231, ('records', 'represented'): 196, ('conditions_88', 'total'): 259, ('conditions_88', 'value_tested'): 257,
            ('copybooks', 'total'): 25, ('copybooks', 'used_and_complete'): 19, ('diagrams', 'total'): 65, ('diagrams', 'with_java_counterpart'): 60,
            ('jcl_jobs', 'total'): 15, ('jcl_jobs', 'IMPLEMENTED_TEST_VERIFIED'): 3, ('jcl_jobs', 'IMPLEMENTED_BLOCKED_AT_STEP'): 11, ('jcl_jobs', 'STEP_NOT_CONVERTED (utility)'): 1}
    fs22 = {m['metric']: m for m in load(os.path.join(S22, 'final-summary.json'))['metrics']}
    cov_checks = [chk(f'{a}.{b}', cov[a].get(b) == v, f'recounted {cov[a].get(b)}, reported baseline {v}') for (a, b), v in want.items()]
    cov_checks.append(chk('no_equivalence', cov['programs']['cobol_equivalent'] == 0 and cov['business_rules']['cobol_equivalent'] == 0, 'no program or rule carries legacy-equivalence evidence'))
    results['coverage'] = {'recounted_from': 'forward/reports/step-22 detail records', 'values': cov, 'checks': cov_checks, 'final_summary_metrics': {k: f"{m['numerator']}/{m['denominator']}" for k, m in fs22.items()}}

    # ---- 4. master gap register ----------------------------------------------------------------
    reg = load(os.path.join(S23, 'master-gap-register.json'))['records']
    ids = [r['master_id'] for r in reg]
    g22 = load(os.path.join(S22, 'gap-reconciliation.json'))
    grp = load(os.path.join(S23, 'root-cause-groups.json'))['groups']
    dg = load(os.path.join(S23, 'dependency-graph.json'))
    road = load(os.path.join(S23, 'remediation-roadmap.json'))['phases']
    nodes = {n['id'] for n in dg['nodes']}
    adj = collections.defaultdict(list)
    for e in dg['edges']:
        adj[e['from']].append(e['to'])
    state, cyc = {}, False
    for s0 in list(adj):
        if s0 in state:
            continue
        stack = [(s0, iter(adj[s0]))]
        state[s0] = 1
        while stack:
            u, it = stack[-1]
            v = next(it, None)
            if v is None:
                state[u] = 2
                stack.pop()
            elif state.get(v) == 1:
                cyc = True
            elif v not in state:
                state[v] = 1
                stack.append((v, iter(adj[v])))
    mem = collections.Counter(m for g in grp for m in g['members'])
    sizes = {g['group_id']: g['members'] for g in grp}
    memb = [m for p in road for g in p['groups'] for m in sizes.get(g, [])]
    disp = C(x['register_disposition'] for x in g22['reverse'])
    gap_checks = [
        chk('records_569', len(reg) == 569, f'{len(reg)} records'),
        chk('ids_exactly_once', sorted(ids) == [f'MGR-{i:04d}' for i in range(1, 570)], 'MGR-0001..MGR-0569 each exactly once'),
        chk('inventory_391_174_4', dict(C(r['inventory_category'] for r in reg)) == {'forward_gap': 391, 'reverse_gap': 174, 'verification_or_integration': 4}, json.dumps(dict(C(r['inventory_category'] for r in reg)))),
        chk('all_open', all(r['status'] == 'OPEN' for r in reg) and all(r.get('resolution_evidence') is None for r in reg), 'every record OPEN with no resolution evidence'),
        chk('reverse_217_dispositions', len(g22['reverse']) == 217 and sum(disp.values()) == 217, json.dumps(dict(disp))),
        chk('root_cause_every_record', all(r.get('root_cause_group') and r.get('category') for r in reg), 'every record has a root-cause group and category'),
        chk('severity_priority_separate', all(r.get('severity') in ('critical', 'high', 'medium', 'low') and r.get('priority') in ('P0', 'P1', 'P2', 'P3') for r in reg), 'severity and priority are separate recorded fields'),
        chk('owner_every_record', all(r.get('owner') for r in reg), f"owner role on every record; {sum(1 for r in reg if r['owner'] == 'OWNER_REVIEW_REQUIRED')} OWNER_REVIEW_REQUIRED"),
        chk('closure_criteria_every_record', all(r.get('closure_criteria') and r.get('verification_method') for r in reg), 'closure criteria and verification method on every record'),
        chk('groups_23_cover_once', len(grp) == 23 and sorted(mem) == sorted(ids) and all(v == 1 for v in mem.values()), '23 groups; each record in exactly one'),
        chk('graph_705_877', len(dg['nodes']) == 705 and len(dg['edges']) == 877, f"{len(dg['nodes'])} nodes, {len(dg['edges'])} edges"),
        chk('graph_confidence', dict(C(e['confidence'] for e in dg['edges'])) == {'EVIDENCED': 794, 'EVIDENCED_BY_TEXT': 38, 'HYPOTHESIS': 45}, json.dumps(dict(C(e['confidence'] for e in dg['edges'])))),
        chk('graph_edges_valid_acyclic', all(e['from'] in nodes and e['to'] in nodes for e in dg['edges']) and not cyc, 'every edge references a node; no cycle'),
        chk('dependencies_preserved', sum(1 for e in dg['edges'] if e['from'].startswith('MGR-') or e['to'].startswith('MGR-')) > 0 and len(dg['root_blockers']) == 215, f"{len(dg['root_blockers'])} root blockers, {len(dg['independent_gaps'])} independent gaps"),
        chk('phases_5_memberships_570_unique_569', [p['phase'] for p in road] == list('ABCDE') and len(memb) == 570 and len(set(memb)) == 569, f'{len(memb)} phase memberships, {len(set(memb))} unique records'),
    ]
    results['gap_register'] = {'checks': gap_checks, 'by_category': dict(C(r['category'] for r in reg)), 'by_severity': dict(C(r['severity'] for r in reg)), 'by_priority': dict(C(r['priority'] for r in reg))}

    # ---- 5. BMad governance --------------------------------------------------------------------
    pin = load(os.path.join(FW, 'integrations', 'bmad', 'release.pin.json'))
    bindings = load(os.path.join(FW, 'integrations', 'bmad', 'bindings.json'))
    cfg = load(os.path.join(FW, 'config', 'forward.config.json'))
    st = load(os.path.join(S22, 'bmad-governance-status.json'))
    gr = load(os.path.join(FW, 'reports', 'bmad-end-to-end', 'portread-governed-run.json'))
    ada = load(os.path.join(FW, 'reports', 'step-21', 'authorization-request-PORTREAD.unsigned.json'))
    run_bmad = os.path.join(RUN, 'workflow', 'bmad')
    kinds = C(os.path.basename(p).split('-')[0] for p in glob.glob(os.path.join(run_bmad, '*'))) if os.path.isdir(run_bmad) else None
    exp = ada.get('expires_at')
    now = datetime.datetime.now(datetime.timezone.utc)
    expired = None
    if exp:
        expired = datetime.datetime.fromisoformat(exp.replace('Z', '+00:00')) <= now
    signed = bool(ada.get('signer_id') or ada.get('signed_at'))
    stages = [(s['binding_id'], s['status'], s.get('receipt_id')) for s in gr['stages']]
    bmad_checks = [
        chk('release_pinned_6_12_4', pin['package'] == 'bmad-method' and pin['version'] == '6.12.4', f"{pin['package']}@{pin['version']}"),
        chk('six_bindings', len(bindings['bindings']) == 6 and st.get('bindings_valid') is True, f"{len(bindings['bindings'])} bindings; recorded valid: {st.get('bindings_valid')}"),
        chk('mandatory', cfg['bmad_governance']['mandatory'] is True, 'config bmad_governance.mandatory is true'),
        chk('live_execution_not_requested', bindings['live_execution']['requested'] is False, 'bindings.json live_execution.requested is false'),
        chk('java_generation_not_authorized', cfg['generation']['java_generation_allowed'] is False, 'config generation.java_generation_allowed is false'),
        chk('no_live_execution', st['metrics']['executed_live'] == 0 and st['metrics']['verified_receipts'] == 0 and st['metrics']['authorized_workflows'] == 0, '0 authorized, 0 executed live, 0 verified receipts'),
        chk('no_receipt_records', (kinds.get('BRC', 0) == 0) if kinds is not None else None, f'local BMad records: {dict(kinds)} (no BRC receipt of any mode)' if kinds is not None else 'run records are local-only', 'B'),
        chk('portread_blocked', gr['status'] == 'BMAD_BLOCKED' and stages[0][1] == 'BLOCKED' and all(s[1] == 'NOT_ATTEMPTED' for s in stages[1:]) and not any(s[2] for s in stages), f"{gr['record_id']}: " + ', '.join(f'{b} {s}' for b, s, _ in stages)),
        chk('f2_accepted_f6_missing', gr['independent_evidence']['f2']['status'] == 'ACCEPTED' and gr['independent_evidence']['f6']['status'] == 'MISSING', f"F2 {gr['independent_evidence']['f2']['status']}, F6 {gr['independent_evidence']['f6']['status']}"),
        chk('disclosure_request_unsigned', not signed, f"{ada.get('authorization_id', 'ADA-8154d6398d4d')}: unsigned"),
    ]
    results['bmad'] = {
        'status': st['status'],
        'checks': bmad_checks,
        'disclosure_request': {'authorization_id': 'ADA-8154d6398d4d', 'signed': signed, 'expires_at': exp, 'evaluated_at': now.replace(microsecond=0).isoformat(), 'expired_at_evaluation': expired, 'action': 'none: not renewed, signed, extended or used'},
        'prerequisites_unresolved': ['signer trust store (TRUST_NOT_CONFIGURED)', 'signed source-disclosure authorization', 'G2 approval for the exact scope (417 blocking findings recorded)', 'independent F6 receipt', 'verified isolated runtime with the runner inside the boundary', 'authorized provider network route (egress component)', 'live execution enablement (bindings.json live_execution.requested)', 'Java generation authorization (generation.java_generation_allowed)'],
    }

    # ---- 6. dashboard ---------------------------------------------------------------------------
    mv = load(os.path.join(S24, 'metric-validation.json'))
    results['dashboard'] = {'committed_step24_metric_validation': {'status': mv['status'], 'primary': f"{sum(x['agrees'] for x in mv['primary_metrics'])}/{len(mv['primary_metrics'])}", 'coverage': f"{sum(x['agrees'] for x in mv['coverage_metrics'])}/{len(mv['coverage_metrics'])}", 'cross_checks': f"{mv['cross_checks']['agree']}/{mv['cross_checks']['total']}"}}

    # ---- 7. regression and snapshots --------------------------------------------------------------
    rr = os.path.join(OUT, 'regression-runs.jsonl')
    runs = [json.loads(l) for l in open(rr, encoding='utf8') if l.strip()] if os.path.exists(rr) else []
    snaps = {}
    for k in ('before', 'after'):
        p = os.path.join(OUT, f'snapshot-{k}.json')
        snaps[k] = load(p) if os.path.exists(p) else None
    change = None
    if snaps['before'] and snaps['after']:
        b, a = snaps['before'], snaps['after']
        rb, ra = b['run_records'], a['run_records']
        change = {
            'generated_program_sources_unchanged': b['generated_program_sources'] == a['generated_program_sources'],
            'generated_program_sources': a['generated_program_sources'],
            'integration_copy_rebuilt_identical': b['integration_copy'] == a['integration_copy'],
            'run_records_added': sorted(set(ra) - set(rb)),
            'run_records_changed': sorted(k for k in set(ra) & set(rb) if ra[k] != rb[k]),
            'run_records_removed': sorted(set(rb) - set(ra)),
        }
    results['regression'] = {'runs': runs, 'local_state_change': change}
    for name, key in (('repository-integrity.json', 'repository'), ('source-integrity.json', 'source_integrity'), ('coverage.json', 'coverage'), ('gap-register-validation.json', 'gap_register'), ('bmad-governance.json', 'bmad'), ('dashboard-validation.json', 'dashboard'), ('regression-summary.json', 'regression')):
        write(name, {'contract': f'step-25/{name[:-5]}', 'baseline_commit': head, **results[key]})

    # ---- 8. handover manifest ---------------------------------------------------------------------
    refs = ['forward/reports/STEP-20-REMEDIATION-ASSESSMENT.md', 'forward/reports/STEP-21-BMAD-INTEGRATION-ASSESSMENT.md', 'forward/reports/BMAD-END-TO-END-INTEGRATION-ASSESSMENT.md', 'forward/reports/GIT-REGRESSION-STABILIZATION.md', 'forward/reports/STEP-22-FINAL-RECONCILIATION.md', 'forward/reports/STEP-23-MASTER-GAP-REGISTER.md', 'forward/reports/STEP-24-DASHBOARD-ASSESSMENT.md', 'forward/reports/STEP-25-FINAL-HANDOVER-ASSESSMENT.md']
    evid = ['forward/reports/step-22/final-summary.json', 'forward/reports/step-22/source-integrity.json', 'forward/reports/step-22/program-reconciliation.json', 'forward/reports/step-22/business-rule-reconciliation.json', 'forward/reports/step-22/bmad-governance-status.json', 'forward/reports/step-23/master-gap-register.json', 'forward/reports/step-23/master-gap-register.csv', 'forward/reports/step-23/dependency-graph.json', 'forward/reports/step-23/root-cause-groups.json', 'forward/reports/step-23/remediation-roadmap.json', 'forward/reports/step-23/ownership-matrix.json', 'forward/reports/step-23/bmad-governance-blockers.json', 'forward/reports/step-24/metric-validation.json', 'forward/reports/step-24/evidence-source-mapping.json', 'forward/reports/bmad-end-to-end/portread-governed-run.json', 'forward/integrations/bmad/bindings.json', 'forward/integrations/bmad/release.pin.json', 'forward/pilot/authorizations/APPLICATION.authorization-manifest.json', 'output/final_report/brd.md', 'output/final_report/gaps_register.json', 'output/rules/rules_artifact.json']
    docs = sorted(os.path.relpath(p, REPO).replace(os.sep, '/') for p in glob.glob(os.path.join(HANDOVER, '*.md')))
    s25 = sorted(os.path.relpath(p, REPO).replace(os.sep, '/') for p in glob.glob(os.path.join(OUT, '*')))
    entry = lambda p: {'path': p, 'sha256': sha(os.path.join(REPO, p)) if os.path.exists(os.path.join(REPO, p)) else None, 'last_commit': git('log', '-1', '--format=%H', '--', p) or None}
    all_checks = [c for k in ('repository', 'source_integrity', 'coverage', 'gap_register', 'bmad') for c in results[k]['checks']]
    manifest = {
        'contract': 'revforge/handover-manifest',
        'handover_version': '1.0.0',
        'baseline_commit': head,
        'note': 'Hashes are of the working files when the manifest was generated; last_commit is null for files not yet committed. The manifest does not hash itself.',
        'handover_documents': [entry(p) for p in docs],
        'referenced_reports': [entry(p) for p in refs],
        'referenced_evidence': [entry(p) for p in evid],
        'step25_evidence': [entry(p) for p in s25],
        'source_provenance': {
            'cobol_source': 'restricted reference checkout (references/, git-ignored); 83 inventoried files with permanent file IDs; 82 recorded authorization hashes in forward/pilot/authorizations/APPLICATION.authorization-manifest.json',
            'reverse_artifacts': '11 artifacts under output/, hashes recorded in forward/reports/step-22/source-integrity.json',
            'generated_java': 'forward/generated/java/ (git-ignored, local only): 145 program sources, tree hash recorded in STEP-22',
            'permanent_ids': 'SYS-/FIL-/PATH-/PAR-/STMT-/REC-/FLD- identities from the Neo4j registry, carried in every artifact',
        },
        'validation_results': {'checks': len(all_checks), 'pass': sum(c['status'] == 'PASS' for c in all_checks), 'fail': sum(c['status'] == 'FAIL' for c in all_checks), 'not_verifiable_here': sum(c['status'] == 'NOT_VERIFIABLE_HERE' for c in all_checks), 'regression_runs': len(runs)},
        'outstanding_dependencies': results['bmad']['prerequisites_unresolved'] + ['DB2 runtime and precompiler', 'CICS environment', 'missing COPY/INCLUDE members and paragraphs from the source owner', 'business SME decisions (108 records)', 'legacy COBOL runtime or captured executions for equivalence', 'named owners for role-based ownership (28 OWNER_REVIEW_REQUIRED)'],
    }
    write('HANDOVER-MANIFEST.json', manifest, HANDOVER)
    fails = [c for c in all_checks if c['status'] == 'FAIL']
    print(f"audit: {manifest['validation_results']['pass']} pass, {len(fails)} fail, {manifest['validation_results']['not_verifiable_here']} not verifiable here; regression runs {len(runs)}")
    for c in fails:
        print('  FAIL', c['id'], c['detail'])


if __name__ == '__main__':
    if len(sys.argv) >= 3 and sys.argv[1] == 'snapshot':
        snapshot(sys.argv[2])
    elif len(sys.argv) == 2 and sys.argv[1] == 'audit':
        audit()
    else:
        print(__doc__)
        sys.exit(2)
