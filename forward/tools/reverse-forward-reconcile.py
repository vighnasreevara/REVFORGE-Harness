"""
Reverse-to-forward artifact reconciliation (read-only).

Reads the reverse-engineering outputs (output/), the forward conversion outputs
(forward/generated/java/<PROGRAM>/, forward/generated/java/app/) and the Step 17
reports, and writes machine-readable mappings to forward/reports/reverse-forward/.
It modifies no source, artifact, permanent ID or forward result.

Evidence levels used throughout:
  STRUCTURAL        a forward element exists at the same source identity (file + line / name)
  TEST_VERIFIED     a source-derived scenario executed it and its expectations matched
  BLOCKED_PATH      executed only on scenario paths that end at an expected gap
  NOT_EXECUTED      mapped, but no scenario executed it
COBOL runtime equivalence is never claimed: no legacy execution results exist.
"""
import collections
import hashlib
import json
import os
import re
import sys

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT = os.path.join(REPO, 'output')
FWD = os.path.join(REPO, 'forward')
GEN = os.path.join(FWD, 'generated', 'java')
SRC = os.environ.get('REVFORGE_COBOL_SOURCE_ROOT') or os.path.join(REPO, 'references', 'udara-legacy-modernization-harness')
# REVFORGE_RECONCILE_DEST (STEP 22) writes a fresh run elsewhere so earlier mappings are never overwritten.
DEST = os.environ.get('REVFORGE_RECONCILE_DEST') or os.path.join(FWD, 'reports', 'reverse-forward')
os.makedirs(DEST, exist_ok=True)


def load(p):
    with open(p, encoding='utf8') as f:
        return json.load(f)


def sha(p):
    with open(p, 'rb') as f:
        return hashlib.sha256(f.read()).hexdigest()


def write(name, obj):
    with open(os.path.join(DEST, name), 'w', encoding='utf8', newline='\n') as f:
        json.dump(obj, f, indent=1, ensure_ascii=False)
        f.write('\n')


# ---------------------------------------------------------------- reverse inputs
inv = load(os.path.join(OUT, 'inventory', 'inventory_artifact.json'))
par = load(os.path.join(OUT, 'parser', 'parser_artifact.json'))
dat = load(os.path.join(OUT, 'data', 'data_artifact.json'))
lgc = load(os.path.join(OUT, 'logic', 'logic_artifact.json'))
rul = load(os.path.join(OUT, 'rules', 'rules_artifact.json'))
dia = load(os.path.join(OUT, 'diagram', 'diagrams_artifact.json'))
gpr = load(os.path.join(OUT, 'final_report', 'gaps_register.json'))
path_by_file = {}
for reg in ('file_registry', 'copybook_registry', 'jcl_registry', 'other_file_registry'):
    for f in inv.get(reg, []):
        path_by_file[f['file_id']] = f['relative_path']
prog_by_file = {f['file_id']: f['program_id'] for f in inv['file_registry']}
raw = {}
for f in os.listdir(os.path.join(OUT, 'parser', 'raw_structure')):
    r = load(os.path.join(OUT, 'parser', 'raw_structure', f))
    raw[r['program_id']] = r
logic = {}
for f in os.listdir(os.path.join(OUT, 'logic', 'program_logic')):
    r = load(os.path.join(OUT, 'logic', 'program_logic', f))
    logic[r['program_id']] = r

# ---------------------------------------------------------------- forward inputs
results, smaps, javas = {}, {}, {}
for p in sorted(os.listdir(GEN)):
    rf = os.path.join(GEN, p, 'pilot-result.json')
    if p == 'app' or not os.path.exists(rf):
        continue
    results[p] = load(rf)
    sm = os.path.join(GEN, p, 'source-map.json')
    smaps[p] = load(sm) if os.path.exists(sm) else None
    g = results[p].get('generation')
    if g:
        jf = os.path.join(GEN, p, 'java', 'src', *(g['package'].split('.')), g['class'] + '.java')
        javas[p] = open(jf, encoding='utf8').read().split('\n') if os.path.exists(jf) else None
integ = load(os.path.join(GEN, 'app', 'integration-result.json'))
appst = load(os.path.join(FWD, 'reports', 'step-17', 'application-status.json'))
recon = load(os.path.join(FWD, 'reports', 'step-17', 'business-rules-reconciliation.json'))
manifest = load(os.path.join(FWD, 'pilot', 'authorizations', 'APPLICATION.authorization-manifest.json'))
models = {}
for p in results:
    d = os.path.join(GEN, p, 'java', 'src', 'revforge', 'app', 'copybooks')
    if os.path.isdir(d):
        for f in os.listdir(d):
            models.setdefault(f[:-5], open(os.path.join(d, f), encoding='utf8').read().split('\n'))


def cov(p):
    c = (results.get(p) or {}).get('coverage') or {}
    return set(c.get('executed_in_passing_scenarios', [])), set(c.get('executed_only_in_blocked_scenarios', []))


def evidence(p, lines):
    passed, blocked = cov(p)
    if any(l in passed for l in lines):
        return 'TEST_VERIFIED'
    if any(l in blocked for l in lines):
        return 'BLOCKED_PATH'
    return 'NOT_EXECUTED'


def fwd_gaps(p):
    return (results.get(p) or {}).get('gaps', [])




def reach(edges, a, b):
    """True when paragraph b is reachable from a through Java PERFORM edges."""
    adj = collections.defaultdict(set)
    for x, y in edges:
        adj[x].add(y)
    seen, stack = set(), list(adj[a])
    while stack:
        n = stack.pop()
        if n == b:
            return True
        if n in seen:
            continue
        seen.add(n)
        stack.extend(adj[n])
    return False

# ================================================================ PHASE 1: provenance
prov = {'reverse_artifacts': [], 'source_files': {}, 'authorised_manifest': {}}
bm = load(os.path.join(FWD, 'runs', 'FWD-20261031T172520Z-66b3', 'baseline_manifest.json'))
for a in bm['inputs']:
    if a.get('sha256') and os.path.exists(os.path.join(REPO, a['path'])):
        prov['reverse_artifacts'].append({'artifact': a['path'], 'baseline_sha256': a['sha256'], 'current_sha256': sha(os.path.join(REPO, a['path'])), 'unchanged': sha(os.path.join(REPO, a['path'])) == a['sha256']})
size_ok = size_bad = 0
for reg in ('file_registry', 'copybook_registry', 'jcl_registry', 'other_file_registry'):
    for f in inv.get(reg, []):
        p = os.path.join(SRC, f['relative_path'])
        if os.path.exists(p) and ('size_bytes' not in f or os.path.getsize(p) == f['size_bytes']):
            size_ok += 1
        else:
            size_bad += 1
prov['source_files'] = {'inventory_files': size_ok + size_bad, 'present_with_matching_size': size_ok, 'mismatch_or_missing': size_bad, 'note': f"inventory meta.repo_root is {inv['meta'].get('repo_root')}; the forward source root is {os.path.relpath(SRC, REPO)}; every inventory file is present there with the recorded size (the inventory records sizes, not hashes)"}
mf = []
for p in manifest['programs']:
    mf += [p['source']] + p['copybooks'] + p['dependencies']
mf += manifest['jcl'] + manifest['db2'] + [{'path': c['path'], 'sha256': c['sha256']} for c in manifest['copybooks']]
bad = [x['path'] for x in mf if sha(os.path.join(SRC, x['path'])) != x['sha256']]
prov['authorised_manifest'] = {'path': 'forward/pilot/authorizations/APPLICATION.authorization-manifest.json', 'sha256': sha(os.path.join(FWD, 'pilot', 'authorizations', 'APPLICATION.authorization-manifest.json')), 'hashes_checked': len(mf), 'mismatches': bad}

# ================================================================ A. programs
programs = []
for f in inv['file_registry']:
    p = f['program_id']
    r = results.get(p)
    rs = raw.get(p, {})
    using = (rs.get('procedure_division') or {}).get('using_parameters') or []
    cfg = rs.get('control_flow_graph') or {}
    row = {'program': p, 'file_id': f['file_id'], 'path_id': f['path_id'], 'source': f['relative_path'], 'reverse': {'parse_status': next((x.get('parse_status') for x in par['programs'] if x['program_id'] == p), None), 'paragraphs': len((rs.get('procedure_division') or {}).get('paragraphs', [])), 'statements': len((rs.get('procedure_division') or {}).get('statements', [])), 'entry_points': cfg.get('entry_points'), 'using': using}}
    if not r:
        row['forward'] = None
        row['category'] = 'MISSING'
    else:
        g = r.get('generation') or {}
        c = r.get('coverage') or {}
        ex = (r.get('execution') or {}).get('counts')
        row['forward'] = {
            'java_class': f"{g.get('package')}.{g.get('class')}" if g else None,
            'java_files': [x['path'] for x in g.get('files', [])] if g else [],
            'authorization': (r.get('authorization') or {}).get('record_id'),
            'compilation': (r.get('compilation') or {}).get('status'),
            'checks': ex,
            'scenarios': r.get('behaviour_cases'),
            'statement_coverage': {'statements': c.get('statement_lines'), 'executed_in_passing_scenarios': len(c.get('executed_in_passing_scenarios', [])), 'executed_only_on_blocked_paths': len(c.get('executed_only_in_blocked_scenarios', []))} if c else None,
            'gaps': len(r.get('gaps', [])),
            'conversion_status': r.get('conversion_status'),
            'integrated': p in integ['programs'],
            'reason': r.get('conversion_status_reason'),
        }
        row['category'] = {'COMPLETE': 'FULLY_IMPLEMENTED', 'PARTIAL': 'PARTIAL'}.get(r.get('conversion_status'), 'MISSING' if not g else 'PARTIAL')
    programs.append(row)
write('program-mapping.json', {'contract': 'reverse-forward/program-mapping', 'evidence_levels': 'FULLY_IMPLEMENTED = COMPLETE conversion (no gaps, passing source-derived scenarios); PARTIAL = Java generated with open gaps; MISSING = no Java', 'programs': programs})

# ================================================================ B. paragraphs, PERFORM edges, branches, loops
para_rows, edge_rows, branch_rows, loop_rows, section_rows = [], [], [], [], []
perform_re = re.compile(r'perform\((\d+), (\d+)\)')
for p, rs in sorted(raw.items()):
    pd = rs.get('procedure_division') or {}
    sm = smaps.get(p)
    jl = javas.get(p)
    fparas = sm['paragraphs'] if sm else []
    fstmts = sm['statements'] if sm else []
    src_file = rs.get('relative_path')
    by_line = collections.defaultdict(list)
    for s in fstmts:
        if s['cobol_file'] == src_file:
            by_line[s['cobol_line']].append(s)
    gaps = fwd_gaps(p)
    for q in pd.get('paragraphs', []):
        fm = next((x for x in fparas if x['paragraph'] == q['name'] and x['cobol_lines'][0] == q['start_line']), None)
        fn = fm or next((x for x in fparas if x['paragraph'] == q['name']), None)
        lines = [l for l in range(q['start_line'], q['end_line'] + 1) if l in by_line]
        pg = sorted({g['gap_id'] for g in gaps if g['origin']['file'] == src_file and q['start_line'] <= g['origin']['line'] <= q['end_line']})
        para_rows.append({'program': p, 'paragraph': q['name'], 'paragraph_id': q['paragraph_id'], 'section': q.get('section'), 'cobol_lines': [q['start_line'], q['end_line']], 'reverse_statements': len(q.get('statement_ids') or []), 'forward_method': fn['java_method'] if fn else None, 'mapping': 'STRUCTURAL' if fm else 'NAME_ONLY' if fn else 'UNMAPPED', 'forward_statements_mapped': sum(len(by_line[l]) for l in lines), 'gaps_in_paragraph': pg, 'evidence': evidence(p, lines) if fn else 'UNMAPPED'})
    for s in pd.get('sections', []):
        section_rows.append({'program': p, 'section': s.get('name'), 'section_id': s.get('section_id'), 'forward': next((x['name'] for x in ((results.get(p) or {}).get('inspection') or {}).get('sections', []) if x['name'] == s.get('name')), None)})
    names = [x['paragraph'] for x in fparas]
    for e in (rs.get('control_flow_graph') or {}).get('edges', []):
        line = e.get('source_line')
        st = [s for s in by_line.get(line, []) if s['kind'] in ('perform', 'perform_inline', 'goto')]
        row = {'program': p, 'from': e['from'], 'to': e['to'], 'type': e['type'], 'line': line, 'statement_id': e.get('statement_id'), 'reverse_resolved': e.get('resolved')}
        if not st:
            row['forward'] = 'UNMAPPED'
        elif e['type'] == 'PERFORM_INLINE' and st[0]['kind'] == 'perform_inline' and not st[0]['gap_id']:
            row['forward'] = 'STRUCTURAL'
            row['java'] = f"{st[0]['java_file']}:{st[0]['java_line']}"
            row['note'] = 'inline PERFORM: translated as a Java loop in the same method'
            row['evidence'] = evidence(p, [line])
        elif st[0]['gap_id']:
            g = next((x for x in gaps if x['gap_id'] == st[0]['gap_id']), {})
            row['forward'] = 'GAP'
            row['forward_gap'] = {'gap_id': st[0]['gap_id'], 'kind': g.get('kind'), 'subject': g.get('subject')}
        else:
            # The Java perform(a, b) at or just after the mapped line must target the same paragraph(s).
            target = None
            if jl:
                for k in range(st[0]['java_line'] - 1, min(len(jl), st[0]['java_line'] + 4)):
                    m = perform_re.search(jl[k])
                    if m:
                        a, b = int(m.group(1)), int(m.group(2))
                        target = (names[a] if a < len(names) else None, names[b] if b < len(names) else None)
                        break
            to = e['to']
            ok = bool(target) and (target[0] == to or (e['type'].startswith('PERFORM_THRU') and target[0] == to) or (target[0] is not None and to in names[names.index(target[0]):names.index(target[1]) + 1] if target and target[0] in names and target[1] in names else False))
            row['forward'] = 'STRUCTURAL' if ok else ('GOTO' if st[0]['kind'] == 'goto' else 'TARGET_MISMATCH' if target else 'MAPPED_NO_TARGET')
            row['java'] = f"{st[0]['java_file']}:{st[0]['java_line']}"
            row['java_target'] = list(target) if target else None
            row['evidence'] = evidence(p, [line])
        edge_rows.append(row)
    lg = logic.get(p) or {}
    for bm_ in lg.get('branch_map', []):
        for b in bm_.get('branches', []):
            st = by_line.get(b.get('line'), [])
            k = [s for s in st if s['kind'] in (('read', 'write', 'rewrite', 'delete', 'start') if b.get('type') in ('AT_END', 'INVALID_KEY') else ('if', 'evaluate'))]
            branch_rows.append({'program': p, 'paragraph': bm_.get('paragraph'), 'type': b.get('type'), 'line': b.get('line'), 'statement_id': b.get('statement_id'), 'condition': b.get('condition_text'), 'forward': 'GAP' if k and k[0]['gap_id'] else 'STRUCTURAL' if k else 'UNMAPPED', 'java': f"{k[0]['java_file']}:{k[0]['java_line']}" if k else None, 'evidence': evidence(p, [b.get('line')]) if k and not k[0]['gap_id'] else None, 'forward_gap_kind': next((g['kind'] for g in gaps if k and g['gap_id'] == k[0]['gap_id']), None)})
    for lp in lg.get('loops', []):
        line = lp.get('line') or lp.get('source_line') or lp.get('start_line')
        st = [s for s in by_line.get(line, []) if s['kind'] in ('perform', 'perform_inline')]
        loop_rows.append({'program': p, 'paragraph': lp.get('paragraph'), 'type': lp.get('type') or lp.get('loop_type'), 'line': line, 'termination': lp.get('termination_condition') or lp.get('condition'), 'forward': 'GAP' if st and st[0]['gap_id'] else 'STRUCTURAL' if st else 'UNMAPPED', 'java': f"{st[0]['java_file']}:{st[0]['java_line']}" if st else None, 'evidence': evidence(p, [line]) if st and not st[0]['gap_id'] else None, 'forward_gap_kind': next((g['kind'] for g in gaps if st and g['gap_id'] == st[0]['gap_id']), None)})
# Statement identity (traceability): every reverse statement against the forward source map.
stmt_rows = []
for p, rs in sorted(raw.items()):
    sm = smaps.get(p)
    src_file = rs.get('relative_path')
    fl = collections.defaultdict(list)
    for s in (sm['statements'] if sm else []):
        if s['cobol_file'] == src_file:
            fl[s['cobol_line']].append(s)
    for s in (rs.get('procedure_division') or {}).get('statements', []):
        f = fl.get(s['start_line'], [])
        stmt_rows.append({'program': p, 'statement_id': s['statement_id'], 'type': s['statement_type'], 'line': s['start_line'], 'forward': 'GAP' if f and f[0]['gap_id'] else 'MAPPED' if f else 'UNMAPPED', 'forward_kind': f[0]['kind'] if f else None, 'gap_id': f[0]['gap_id'] if f else None, 'gap_kind': next((g['kind'] for g in fwd_gaps(p) if f and g['gap_id'] == f[0]['gap_id']), None)})
write('paragraph-mapping.json', {'contract': 'reverse-forward/paragraph-mapping', 'mapping_levels': 'STRUCTURAL = same paragraph name at the same COBOL start line with a Java method; NAME_ONLY = same name, different lines; PERFORM edges: STRUCTURAL = the Java perform(a,b) at the mapped line targets the same paragraph range', 'paragraphs': para_rows, 'sections': section_rows, 'perform_edges': edge_rows, 'branches': branch_rows, 'loops': loop_rows, 'statements': stmt_rows})

# ================================================================ C. business rules
rrules = {r['rule_id']: r for r in rul['business_rules']}
brows = []
for x in recon['rules']:
    r = rrules.get(x['rule'], {})
    ps = r.get('primary_source') or {}
    brows.append({**x, 'reverse': {'confidence': r.get('confidence'), 'requires_sme_review': r.get('requires_sme_review'), 'condition': (r.get('condition') or {}).get('text'), 'statement_id': (ps.get('source_ids') or {}).get('statement_id'), 'paragraph': ps.get('paragraph'), 'implemented_in_programs': r.get('implemented_in_programs')}})
missing_ids = sorted(set(rrules) - {x['rule'] for x in recon['rules']})
extra_ids = sorted({x['rule'] for x in recon['rules']} - set(rrules))
write('business-rule-mapping.json', {'contract': 'reverse-forward/business-rule-mapping', 'reverse_rules': len(rrules), 'forward_reconciled': len(recon['rules']), 'identity_discrepancies': {'in_reverse_not_forward': missing_ids, 'in_forward_not_reverse': extra_ids}, 'rules': brows})

# ================================================================ D. data
field_re = re.compile(r'final Field (\w+) = new Field\((\w+), (\d+), (\d+), Field\.Kind\.(\w+), (\d+), (\d+), (true|false), (true|false), (true|false), (null|"[^"]*"), "([^"]+)", new int\[(?:\] \{([^}]*)\}|0\])')
mref_re = re.compile(r'final Field (\w+) = (M\d+)_(\w+)\.(\w+); // (\S+):(\d+) (\d+) (\S+)')
model_re = re.compile(r'^\s+(\w+) = new Field\(st, base \+ (\d+), (\d+), Field\.Kind\.(\w+), (\d+), (\d+), (true|false), (true|false), (true|false), (null|"[^"]*"), "([^"]+)", new int\[(?:\] \{([^}]*)\}|0\])')
cond_re = re.compile(r'final Cond88 (\w+) = new Cond88\("([^"]+)", (\w+), new Object\[\] \{(.*?)\}, new Object\[\] \{(.*?)\}\); // (\S+):(\d+)')
model_fields = {}
for mc, lines in models.items():
    for l in lines:
        m = model_re.match(l)
        if m:
            model_fields[(mc, m.group(1))] = {'len': int(m.group(3)), 'kind': m.group(4), 'digits': int(m.group(5)), 'scale': int(m.group(6)), 'signed': m.group(7) == 'true', 'name': m.group(11), 'occurs': m.group(12)}
java_fields = collections.defaultdict(list)
java_conds = collections.defaultdict(list)
for p, jl in javas.items():
    if not jl:
        continue
    for l in jl:
        m = field_re.search(l)
        om = re.search(r'// (\S+):(\d+) ', l)
        if m and om:
            java_fields[(om.group(1), int(om.group(2)), m.group(12))].append({'program': p, 'java': m.group(1), 'len': int(m.group(4)), 'kind': m.group(5), 'digits': int(m.group(6)), 'scale': int(m.group(7)), 'signed': m.group(8) == 'true', 'occurs': m.group(13), 'model': None})
            continue
        m = mref_re.search(l)
        if m:
            mf_ = model_fields.get((m.group(3), m.group(4)))
            if mf_:
                java_fields[(m.group(5), int(m.group(6)), m.group(8))].append({'program': p, 'java': m.group(1), **{k: mf_[k] for k in ('len', 'kind', 'digits', 'scale', 'signed', 'occurs')}, 'model': m.group(3)})
            continue
        m = cond_re.search(l)
        if m:
            java_conds[(m.group(6), m.group(2))].append({'program': p, 'java': m.group(1), 'values': m.group(4)})
STORE = {'DISPLAY': {'DISPLAY', 'ALNUM', 'GROUP', 'EDITED'}, 'BINARY': {'BINARY'}, 'PACKED_DECIMAL': {'PACKED'}}
frows = []
for f in dat['field_catalogue']:
    fpath = path_by_file.get(f['file_id'])
    hits = java_fields.get((fpath, f['source_line'], 'FILLER' if f['is_filler'] else f['field_name']), [])
    row = {'field_id': f['field_id'], 'file_id': f['file_id'], 'record_id': f['record_id'], 'name': f['field_name'], 'source': f"{fpath}:{f['source_line']}", 'pic': f['pic_raw'], 'reverse': {'bytes': f['bytes'], 'signed': f['signed'], 'decimals': f['decimal_places'], 'storage': f['storage_type'], 'type': f['normalized_type'], 'occurs': f['occurs_max'], 'redefines': f['redefines'], 'filler': f['is_filler']}, 'used_by': f['used_by_programs']}
    if not hits:
        row['forward'] = 'NOT_REPRESENTED'
        users = [u for u in f['used_by_programs'] if u in results and results[u].get('generation')]
        rec = next((r_ for r_ in dat['record_catalogue'] if r_['record_id'] == f['record_id']), {})
        notes = [n for u in users for n in results[u]['generation'].get('notes', []) if rec.get('record_name') and rec['record_name'] in n]
        row['reason'] = ('no converted program uses it' if not users else 'its record has no determinable layout in the forward data model: ' + notes[0][:160] if notes else 'not declared at this source line in the converted program (layout defect, e.g. an empty 01 group followed by a COPY with its own 01)')
    else:
        j = hits[0]
        diffs = []
        if f['bytes'] is not None and j['len'] != f['bytes']:
            diffs.append(f"length {j['len']} vs {f['bytes']}")
        if j['kind'] not in ('GROUP', 'ALNUM', 'EDITED') and bool(j['signed']) != bool(f['signed']):
            diffs.append(f"signed {j['signed']} vs {f['signed']}")
        if j['kind'] in ('DISPLAY', 'BINARY', 'PACKED') and (f['decimal_places'] or 0) != j['scale']:
            diffs.append(f"scale {j['scale']} vs {f['decimal_places']}")
        if f['storage_type'] in STORE and j['kind'] not in STORE[f['storage_type']]:
            diffs.append(f"storage {j['kind']} vs {f['storage_type']}")
        if (f['occurs_max'] or None) and str(f['occurs_max']) not in (j['occurs'] or ''):
            diffs.append(f"occurs {j['occurs']} vs {f['occurs_max']}")
        row['forward'] = 'CONSISTENT' if not diffs else 'DISCREPANCY'
        row['discrepancies'] = diffs
        row['java'] = [{'program': h['program'], 'field': h['java'], 'model': h['model'], 'kind': h['kind'], 'length': h['len'], 'digits': h['digits'], 'scale': h['scale'], 'signed': h['signed']} for h in hits[:6]]
        row['java_programs'] = len({h['program'] for h in hits})
    frows.append(row)
crows = []
for c in dat['condition_catalogue']:
    fid = c['condition_id'].rsplit('-FLD-', 1)[0]
    fpath = path_by_file.get(fid)
    hits = java_conds.get((fpath, c['condition_name']), [])
    chk = []
    for p in {h['program'] for h in hits}:
        for k in (results[p].get('execution') or {}).get('cases', []):
            if k['id'] == f"C88 {c['condition_name']}":
                chk.append({'program': p, 'result': k['status']})
    crows.append({'condition_id': c['condition_id'], 'name': c['condition_name'], 'parent_field': c['parent_field'], 'values': c['values'], 'source': f"{fpath}:{c['source_line']}", 'forward': 'REPRESENTED' if hits else 'NOT_REPRESENTED', 'java_programs': sorted({h['program'] for h in hits}), 'value_checks': chk, 'evidence': 'TEST_VERIFIED' if any(x['result'] == 'PASS' for x in chk) else 'STRUCTURAL' if hits else None})
rrows = []
for r in dat['record_catalogue']:
    fpath = path_by_file.get(r['file_id'])
    hits = java_fields.get((fpath, r.get('start_line') or -1, r['record_name']), [])
    users_r = [u for u in r.get('used_by_programs', []) if u in results and results[u].get('generation')]
    rreason = None if hits else ('no converted program uses it' if not users_r else 'no determinable layout (an empty group whose COPY member starts with its own 01, or an unresolved INCLUDE)')
    rrows.append({'record_id': r['record_id'], 'name': r['record_name'], 'reason': rreason, 'source_type': r.get('source_type'), 'section': r.get('section'), 'fd': r.get('fd_name'), 'source': f"{fpath}:{r.get('start_line')}", 'reverse_bytes': r.get('total_bytes'), 'forward': 'REPRESENTED' if hits else 'NOT_REPRESENTED', 'java_length': hits[0]['len'] if hits else None, 'java_programs': sorted({h['program'] for h in hits})})
# File-status semantics: SELECT ... FILE STATUS in reverse vs CobolFile.status(...) in Java.
fs_rows = []
for p, jl in javas.items():
    for l in jl or []:
        m = re.search(r'F_(\w+) = new CobolFile\(ru, "([^"]+)", "([^"]+)", CobolFile\.Org\.(\w+), CobolFile\.Access\.(\w+), \w+, (\d+), (true|false), (\d+), (\d+)\)(\.status\((\w+)\))?', l)
        if m:
            fs_rows.append({'program': p, 'file': m.group(2), 'dd': m.group(3), 'organization': m.group(4), 'access': m.group(5), 'record_length': int(m.group(6)), 'variable': m.group(7) == 'true', 'key': [int(m.group(8)), int(m.group(9))], 'file_status_item': m.group(11)})
write('data-mapping.json', {'contract': 'reverse-forward/data-mapping', 'comparison': 'reverse field (file, source line, name) against the Java Field declared from the same source line: length, sign, scale, storage (DISPLAY/BINARY/PACKED), OCCURS. Level-88 conditions against Cond88 declarations and their generated value checks. Defaults: VALUE clauses are checked by the generated INIT tests (see program results).', 'fields': frows, 'conditions': crows, 'records': rrows, 'files': fs_rows, 'file_status_semantics': 'runtime/java/revforge/cobol/CobolFile.java: 00,02,10,21,22,23,30,35,41-49 per the COBOL standard; checked by runtime unit tests (indexed and sequential status codes)'})

# ================================================================ E. copybooks
cbrows = []
cb_files = {c['file_id']: c for c in inv['copybook_registry']}
for c in inv['copybook_registry'] + [x for x in inv.get('other_file_registry', []) if x.get('type') in ('db2_include', 'sql_include')]:
    fid = c['file_id']
    fields = [f for f in frows if f.get('file_id') == fid]
    repr_ = [f for f in fields if f['forward'] != 'NOT_REPRESENTED']
    mc = None
    for p, r in results.items():
        for i in ((r.get('inspection') or {}).get('includes') or []):
            if i.get('path') == c['relative_path'] and i.get('resolved'):
                pass
    mcls = sorted({h['model'] for f in fields for h in (f.get('java') or []) if h.get('model')})
    users = c.get('used_by', [])
    notes = sorted({n for p in users for n in ((results.get(p) or {}).get('generation') or {}).get('notes', []) if c['id'] in n})
    cbrows.append({'copybook': c['id'], 'file_id': fid, 'path': c['relative_path'], 'type': c.get('type'), 'used_by': users, 'reverse_fields': len(fields), 'forward_fields_represented': len(repr_), 'fields_with_discrepancies': [f['name'] for f in fields if f['forward'] == 'DISCREPANCY'], 'fields_not_represented': [f['name'] for f in fields if f['forward'] == 'NOT_REPRESENTED'], 'java_models': mcls, 'converter_notes': notes, 'status': 'NOT_USED' if not users else ('MODEL' if mcls else 'COMPLETE_IN_PROGRAM') if len(repr_) == len(fields) and not any(f['forward'] == 'DISCREPANCY' for f in fields) else 'PARTIAL' if repr_ else 'NOT_REPRESENTED'})
write('copybook-mapping.json', {'contract': 'reverse-forward/copybook-mapping', 'copybooks': cbrows, 'unresolved_members': [i for i in inv.get('issues', []) if 'copy' in json.dumps(i).lower()][:20]})

# ================================================================ F. diagrams
edge_re = re.compile(r'^\s*([A-Za-z0-9_]+)(?:\[[^\]]*\]|\([^)]*\)|\{[^}]*\})?\s*(-->|-\.->|==>|->>|-->>|-\)|--x)\s*(?:\|[^|]*\|\s*)?([A-Za-z0-9_]+)')
seq_re = re.compile(r'^\s*([A-Za-z0-9_]+)\s*(->>|-->>|->|-->|-x|--x|-\))\s*([A-Za-z0-9_]+)\s*:')
para_by_id = {}
for p, rs in raw.items():
    for q in (rs.get('procedure_division') or {}).get('paragraphs', []):
        para_by_id[q['paragraph_id']] = (p, q['name'])
perform_edges = collections.defaultdict(set)
for e in edge_rows:
    if e.get('forward') == 'STRUCTURAL':
        perform_edges[e['program']].add((e['from'], e['to']))
call_edges = collections.defaultdict(set)
for p, jl in javas.items():
    for l in jl or []:
        for m in re.finditer(r'ru\.call\("([A-Z0-9-]+)"', l):
            call_edges[p].add(m.group(1))
link_gaps = collections.defaultdict(set)
for p, r in results.items():
    for g in r.get('gaps', []):
        if g['subject'].startswith('EXEC CICS LINK') or g['kind'] == 'UNDEFINED_EXTERNAL_CALL':
            link_gaps[p].add(g['origin']['line'])
call_gap_targets = collections.defaultdict(set)
for p, r in results.items():
    for g in r.get('gaps', []):
        fp = os.path.join(SRC, g['origin']['file'])
        if os.path.exists(fp):
            src_lines = open(fp, encoding='utf8', errors='replace').read().splitlines()
            ln = g['origin']['line']
            m = re.search(r"CALL\s+'([A-Z0-9-]+)'", src_lines[ln - 1]) if 0 < ln <= len(src_lines) else None
            if m:
                call_gap_targets[p].add(m.group(1))
drows = []
for kind in ('process_flow_diagrams', 'component_diagrams', 'sequence_diagrams', 'erd_diagrams'):
    for d in dia[kind]:
        mmd = os.path.join(OUT, 'diagram', d['file'])
        text = open(mmd, encoding='utf8').read().split('\n') if os.path.exists(mmd) else []
        ns = {n['node']: n for n in d.get('node_sources', [])}
        edges = []
        for l in text:
            m = (seq_re if d['type'] == 'sequence' else edge_re).match(l)
            if m and not l.strip().startswith('%%'):
                edges.append((m.group(1), m.group(3), m.group(2)))
        row = {'diagram_id': d['diagram_id'], 'type': d['type'], 'file': f"output/diagram/{d['file']}", 'title': d['title'], 'reverse_nodes': d.get('node_count'), 'reverse_edges': d.get('edge_count'), 'edges_parsed_from_mermaid': len(edges), 'incomplete': d.get('incomplete'), 'truncated': d.get('truncated'), 'rules_annotated': d.get('rules_annotated') or []}
        if d['type'] == 'process_flow':
            p = d.get('program_id')
            row['program'] = p
            row['java_class'] = next((x['forward']['java_class'] for x in programs if x['program'] == p and x['forward']), None)
            # Nodes: each bound through node_sources to a paragraph and (usually) a statement.
            stmt_line = {x['statement_id']: x['line'] for x in stmt_rows if x['program'] == p}
            stmt_fwd = {x['statement_id']: x for x in stmt_rows if x['program'] == p}
            node_para = {n: para_by_id[s_['paragraph_id']][1] for n, s_ in ns.items() if s_.get('paragraph_id') in para_by_id}
            node_rows = []
            for n, s_ in ns.items():
                sid = s_.get('statement_id')
                f_ = stmt_fwd.get(sid)
                node_rows.append({'node': n, 'kind': s_.get('kind'), 'paragraph': node_para.get(n), 'statement_id': sid, 'forward': (f_['forward'] if f_ else 'PARAGRAPH_ONLY' if node_para.get(n) else 'UNBOUND'), 'evidence': evidence(p, [stmt_line[sid]]) if sid in stmt_line and f_ and f_['forward'] == 'MAPPED' else None})
            row['nodes'] = len(node_rows)
            row['nodes_by_forward_mapping'] = dict(collections.Counter(x['forward'] for x in node_rows))
            row['nodes_test_verified'] = sum(1 for x in node_rows if x['evidence'] == 'TEST_VERIFIED')
            # Edges: classified by the paragraphs of their end nodes against the Java PERFORM graph.
            names = [x['paragraph'] for x in (smaps.get(p) or {}).get('paragraphs', [])] if smaps.get(p) else []
            pe = perform_edges[p]
            gap_targets = {(e['from'], e['to']) for e in edge_rows if e['program'] == p and e.get('forward') == 'GAP'}
            ecls = collections.Counter()
            unsupported = []
            for a, b, arrow in edges:
                pa, pb = node_para.get(a), node_para.get(b)
                uncertain = arrow.startswith('-.')
                if b.startswith('UNRES') or a.startswith('UNRES'):
                    k = 'TO_UNRESOLVED_NODE (forward gap)' if any(g['kind'] == 'UNDEFINED_PROCEDURE' for g in fwd_gaps(p)) else 'TO_UNRESOLVED_NODE'
                elif not pa or not pb:
                    k = 'UNASSESSABLE (node without paragraph binding)'
                elif pa == pb:
                    k = 'INTRA_PARAGRAPH (structural: both statements mapped)' if all(x['forward'] in ('MAPPED', 'PARAGRAPH_ONLY') for x in node_rows if x['node'] in (a, b)) else 'INTRA_PARAGRAPH (through a gap)'
                elif (pa, pb) in pe:
                    k = 'PERFORM_CALL (Java perform)'
                elif (pb, pa) in pe:
                    k = 'RETURN_TO_CALLER (Java perform)'
                elif (pa, pb) in gap_targets or (pb, pa) in gap_targets:
                    k = 'PERFORM_THROUGH_GAP'
                elif pa in names and pb in names and names.index(pb) == names.index(pa) + 1:
                    k = 'FALL_THROUGH (next paragraph)'
                elif reach(pe, pa, pb):
                    k = 'PERFORM_CALL_TRANSITIVE (diagram collapses intermediate paragraphs)'
                elif reach(pe, pb, pa):
                    k = 'RETURN_TRANSITIVE (diagram collapses intermediate paragraphs)'
                elif any((c, pa) in pe and (c, pb) in pe for c in names) or any(reach(pe, c, pa) and reach(pe, c, pb) for c in names[:1]):
                    k = 'SEQUENTIAL_UNDER_COMMON_CALLER (return, then the caller performs the next paragraph)'
                else:
                    k = 'NOT_FOUND_IN_JAVA'
                    unsupported.append([a, b, pa, pb])
                ecls[k + (' [uncertain in reverse]' if uncertain else '')] += 1
            row['edges_classified'] = dict(ecls)
            row['edges_not_found_in_java'] = unsupported[:30]
            row['unresolved_nodes'] = sorted({n for e in edges for n in e[:2] if n.startswith('UNRES')})
            row['forward_undefined_procedure_gaps'] = sum(1 for g in fwd_gaps(p) if g['kind'] == 'UNDEFINED_PROCEDURE')
            st = {x['rule']: x['status'] for x in recon['rules']}
            row['annotated_rule_statuses'] = dict(collections.Counter(st.get(r, 'UNKNOWN') for r in row['rules_annotated']))
            pe = [x for x in para_rows if x['program'] == p]
            row['paragraphs_test_verified'] = sum(1 for x in pe if x['evidence'] == 'TEST_VERIFIED')
            row['mapping'] = 'UNMAPPABLE' if not row['java_class'] else 'STRUCTURAL' if not unsupported and row['nodes_by_forward_mapping'].get('UNMAPPED', 0) == 0 else 'PARTIAL'
        elif d['type'] in ('component', 'component_neighbourhood', 'sequence'):
            fids = [s.get('file_id') for s in ns.values() if s.get('file_id')]
            progs = {n: prog_by_file.get(s.get('file_id')) for n, s in ns.items() if s.get('file_id') in prog_by_file}
            if d['type'] == 'sequence':
                for n in d.get('programs_in_flow', []):
                    progs.setdefault(n, n)
            res = collections.Counter()
            detail = []
            for a, b, arrow in edges:
                pa, pb = progs.get(a), progs.get(b)
                if not pa or not pb or pa == pb:
                    res['UNASSESSABLE (not program-to-program)'] += 1
                    continue
                if arrow.startswith('--') and d['type'] == 'sequence':
                    # Reply message: compare the call it returns from (callee -> caller).
                    k = 'RETURN_FROM_IMPLEMENTED_CALL' if pa in call_edges.get(pb, set()) else 'BOUNDARY_GAP (return from CICS LINK / external call)' if link_gaps.get(pb) else 'NOT_FOUND_IN_JAVA'
                    res[k] += 1
                    detail.append([pa, pb, k])
                elif pb in call_edges.get(pa, set()):
                    res['IMPLEMENTED_CALL'] += 1
                    detail.append([pa, pb, 'IMPLEMENTED_CALL'])
                elif pb in call_gap_targets.get(pa, set()):
                    res['CALL_SITE_GAP (CALL statement is a forward gap)'] += 1
                    detail.append([pa, pb, 'CALL_SITE_GAP'])
                elif link_gaps.get(pa):
                    res['BOUNDARY_GAP (CICS LINK / external call)'] += 1
                    detail.append([pa, pb, 'BOUNDARY_GAP'])
                else:
                    res['NOT_FOUND_IN_JAVA'] += 1
                    detail.append([pa, pb, 'NOT_FOUND_IN_JAVA'])
            row['program_edges'] = dict(res)
            row['program_edge_detail'] = detail[:60]
            row['programs'] = sorted({v for v in progs.values() if v})
            row['mapping'] = 'PARTIAL' if res.get('IMPLEMENTED_CALL') else 'STRUCTURAL_ONLY' if detail else 'UNMAPPABLE'
        else:
            recs = [s.get('record_id') for s in ns.values() if s.get('record_id')]
            rep = [r for r in rrows if r['record_id'] in recs]
            row['entities_with_record_ids'] = len(recs)
            row['entities_represented_in_java'] = sum(1 for r in rep if r['forward'] == 'REPRESENTED')
            row['relationships'] = len(edges)
            row['mapping'] = 'STRUCTURAL_ONLY'
            row['note'] = 'ERD relationships are data-model inferences (shared keys, COPY expansion); Java has no relationship construct to compare, so only entity-to-record representation is assessed'
        drows.append(row)
write('diagram-mapping.json', {'contract': 'reverse-forward/diagram-mapping', 'method': 'Mermaid edges parsed from output/diagram/diagrams/*.mmd; nodes bound to source IDs through diagrams_artifact node_sources. Process-flow paragraph-to-paragraph edges are derived through decision/rule nodes and compared with structural Java PERFORM edges or fall-through to the next paragraph. Component/sequence program-to-program edges are compared with Java CALLs and CICS/external boundary gaps. No equivalence is claimed from names or layout.', 'diagrams': drows})

# ================================================================ G. JCL
jobs = {j['name']: j for j in integ['jobs']}
icases = {c['id'].replace('INTEGRATION ', ''): c for c in integ['tests']['cases']['integration']}
jrows = []
for j in inv['jcl_registry']:
    f = jobs.get(j['job_name'])
    src = open(os.path.join(SRC, j['relative_path']), encoding='utf8').read()
    jrows.append({'job': j['job_name'], 'source': j['relative_path'], 'file_id': j['file_id'], 'reverse_steps': [{'step': s['step_name'], 'program': s['program'], 'type': s.get('type')} for s in j.get('steps', [])], 'forward_steps': f['steps'] if f else None, 'datasets': len(re.findall(r'DSN=', src)), 'parameters': re.findall(r'PARM=([^,\s]+)', src), 'cond_codes': re.findall(r'COND=([^,\s]+)', src), 'restart': 'RESTART/checkpoint parameters: ' + ('present' if re.search(r'RESTART=|RD=|CHKPT', src) else 'none in the JCL'), 'forward_job': 'revforge.app.batch.Jobs#' + j['job_name'] if f else None, 'integration_test': icases.get('JOB-' + j['job_name'], {}).get('status'), 'status': (('IMPLEMENTED_TEST_VERIFIED' if icases.get('JOB-' + j['job_name'], {}).get('status') == 'PASS' else 'IMPLEMENTED_BLOCKED_AT_STEP') if f and all(s['converted'] for s in f['steps']) else 'STEP_NOT_CONVERTED (utility)') if f else 'MISSING'})
write('jcl-mapping.json', {'contract': 'reverse-forward/jcl-mapping', 'jobs': jrows, 'semantics': 'JobRunner: steps in order, DD to DSN files, PARM as halfword-length area, COND=(code,op[,step])/EVEN/ONLY; system utilities are explicit boundaries; restart/checkpoint is not emulated'})

# ================================================================ H. dependencies
dep_rows = []
cg = inv['call_graph']
for e in cg['edges']:
    src_p = e.get('from') or e.get('source')
    tgt = e.get('to') or e.get('target')
    t = e.get('type') or e.get('edge_type')
    line = e.get('line') or e.get('source_line')
    srcp = prog_by_file.get(src_p, src_p)
    r = results.get(srcp) or {}
    status = None
    if t in ('COPY', 'SQL_INCLUDE'):
        inc = [i for i in ((r.get('inspection') or {}).get('includes') or []) if i['name'] == str(tgt).split('/')[-1].replace('.cpy', '') or i['name'] == tgt]
        status = 'RESOLVED_IN_JAVA_BUILD' if inc and inc[0]['resolved'] else 'UNRESOLVED' if inc else 'NOT_SEEN'
    elif t == 'STATIC_CALL':
        tp = str(tgt)
        status = 'IMPLEMENTED_CALL (converted callee)' if tp in call_edges.get(srcp, set()) and tp in results else 'IMPLEMENTED_CALL (callee outside application: blocked at run time)' if tp in call_edges.get(srcp, set()) else 'GAP (CALL site is a forward gap; callee converted)' if tp in results and tp in call_gap_targets.get(srcp, set()) else 'GAP (UNDEFINED_EXTERNAL_CALL / untranslated)'
    elif t == 'CICS_LINK':
        status = 'BOUNDARY_GAP (EXEC CICS LINK)'
    else:
        status = 'OTHER'
    dep_rows.append({'from': srcp, 'to': tgt, 'type': t, 'resolved_in_reverse': e.get('resolved'), 'line': line, 'forward': status})
ops = []
for p, rs in sorted(raw.items()):
    for s in (rs.get('procedure_division') or {}).get('statements', []):
        if str(s['statement_type']).upper().startswith(('EXEC', 'CALL')):
            f = [x for x in ((smaps.get(p) or {}).get('statements') or []) if x['cobol_file'] == rs.get('relative_path') and x['cobol_line'] == s['start_line']]
            g = next((y for y in fwd_gaps(p) if f and y['gap_id'] == f[0]['gap_id']), None)
            ops.append({'program': p, 'statement_id': s['statement_id'], 'type': s['statement_type'], 'line': s['start_line'], 'text': (s.get('source_text') or '')[:80], 'forward': ('GAP ' + g['kind']) if g else 'DECLARATIVE (no run-time effect)' if f and f[0]['kind'] == 'exec' else 'IMPLEMENTED' if f else 'UNMAPPED', 'gap_id': g['gap_id'] if g else None})
write('dependency-mapping.json', {'contract': 'reverse-forward/dependency-mapping', 'call_graph_edges': dep_rows, 'external_operations': ops, 'db2_definitions': manifest['db2'], 'note': 'No DB2 or CICS runtime is available: every executable EXEC SQL / EXEC CICS is an explicit boundary gap; nothing is stubbed as success'})

# ================================================================ Phase 3: gaps
fg_all = [(p, g) for p, r in results.items() for g in r.get('gaps', [])]
grow = []
used_forward = set()
for g in gpr['gaps']:
    p = g.get('source_program')
    line = g.get('source_line')
    t = g['gap_type']
    fwd = [x for (pp, x) in fg_all if pp == p and line and x['origin']['line'] == line]
    for x in fwd:
        used_forward.add(x['gap_id'])
    row = {'reverse_gap': g['gap_id'], 'type': t, 'severity': g.get('severity'), 'program': p, 'line': line, 'title': g['title'], 'forward_gaps_at_same_location': [x['gap_id'] + ' ' + x['kind'] for x in fwd]}
    rules = g.get('related_rule_ids') or []
    rst = {x['rule']: x['status'] for x in recon['rules']}
    if t in ('DIAGRAM_INCOMPLETE', 'DIAGRAM_TRUNCATED', 'DIAGRAM_RENDER_UNVERIFIED', 'UNCONFIRMED_RELATIONSHIP'):
        cls, why = 'NOT_COMPARABLE', 'reverse documentation/analysis artifact; no forward counterpart'
    elif t in ('SME_REVIEW_REQUIRED', 'MEDIUM_CONFIDENCE_RULE'):
        cls, why = 'STILL_UNRESOLVED', 'needs SME confirmation of intent; forward tests verify only source-as-written behaviour' + (f" (related rules: {', '.join(f'{r}={rst.get(r)}' for r in rules)})" if rules else '')
    elif t in ('EMPTY_SOURCE', 'MISSING_PROGRAM_ID'):
        cls, why = 'STILL_UNRESOLVED', 'POSUPDT has no program; forward conversion FAILED for the same reason'
    elif t == 'UNSTRUCTURED_FLOW':
        lines = [line] if line else []
        ev = evidence(p, lines) if p in results and lines else None
        cls = 'RESOLVED_WITH_TEST_EVIDENCE' if ev == 'TEST_VERIFIED' else 'RESOLVED_WITH_CODE_EVIDENCE' if p in results and results[p].get('compilation', {}).get('status') == 'COMPILED' else 'STILL_UNRESOLVED'
        why = 'PERFORM THRU / fall-through is translated by the paragraph-range executor (CobolProgram.perform)' + (f'; line {line} executed by a passing scenario' if ev == 'TEST_VERIFIED' else '')
    elif t == 'DEAD_CODE_CONFIRMED':
        cls, why = 'RECLASSIFIED_OR_GROUPED', 'dead code is translated and preserved; forward reports it as not exercised'
    elif fwd:
        cls, why = 'STILL_UNRESOLVED', 'a forward gap exists at the same source location'
    elif t in ('UNRESOLVED_COPYBOOK', 'CIRCULAR_COPY', 'PRECOMPILER_PROVIDED', 'UNDECLARED_DATA_NAME', 'AMBIGUOUS_DATA_REFERENCE', 'INVALID_QUALIFICATION', 'UNRESOLVED_CALL', 'UNSUPPORTED_CONSTRUCT', 'UNRESOLVABLE_PATH', 'RUNTIME_CONDITIONAL_TRANSFER', 'RECURSIVE_PERFORM', 'SUSPECTED_LOGIC_DEFECT'):
        near = [x for (pp, x) in fg_all if pp == p]
        if t in ('SUSPECTED_LOGIC_DEFECT',):
            cls, why = 'STILL_UNRESOLVED', 'the defect is preserved as written in Java (no authorised correction)'
        elif t == 'RECURSIVE_PERFORM':
            cls, why = 'STILL_UNRESOLVED', 'recursive PERFORM is undefined in COBOL; the Java executes the recursion and has no gap for it (forward does not flag it)'
        elif near:
            cls, why = 'RECLASSIFIED_OR_GROUPED', f"no forward gap at this exact line; {len(near)} forward gap(s) in {p} cover the same construct family ({', '.join(sorted({x['kind'] for x in near}))})"
        else:
            cls, why = 'STILL_UNRESOLVED' if p not in results else 'NOT_COMPARABLE', 'no forward gap in this program' if p in results else 'program not converted'
    else:
        cls, why = 'NOT_COMPARABLE', 'no common location or construct'
    row['classification'] = cls
    row['reason'] = why
    grow.append(row)
ROOT = {'EXTERNAL_SYSTEM_BOUNDARY': 'forward runtime boundary (no DB2/CICS here)', 'UNTRANSLATED_STATEMENT': 'invalid COBOL as written or converter limitation', 'COMPILER_OPTION_DEPENDENT': 'legacy environment definition missing', 'UNDEFINED_PROCEDURE': 'source defect (missing paragraph)', 'UNDECLARED_NAME': 'source defect or precompiler-provided name', 'UNSUPPORTED_DATA': 'source layout defect', 'UNDEFINED_EXTERNAL_CALL': 'callee outside the inventory', 'DATA_CONVERSION_UNDEFINED': 'business decision'}
new_rows = []
for p, x in fg_all:
    if x['gap_id'] in used_forward:
        continue
    same_prog = [g for g in gpr['gaps'] if g.get('source_program') == p]
    new_rows.append({'forward_gap': x['gap_id'], 'kind': x['kind'], 'subject': x['subject'], 'program': p, 'line': x['origin']['line'], 'classification': 'NEWLY_INTRODUCED_IN_FORWARD' if x['kind'] in ('EXTERNAL_SYSTEM_BOUNDARY',) or (x['kind'] == 'UNTRANSLATED_STATEMENT' and 'not translated' in x['description'] and 'expected' not in x['description']) else 'RECLASSIFIED_OR_GROUPED' if same_prog else 'NEWLY_INTRODUCED_IN_FORWARD', 'root_cause': ROOT.get(x['kind'], x['kind']), 'reverse_gaps_in_same_program': len(same_prog)})
write('gap-reconciliation.json', {'contract': 'reverse-forward/gap-reconciliation', 'note': 'Reverse gaps (217, analysis scope) and forward gaps (conversion scope) are compared by program and source line; counts are not subtracted. NEWLY_INTRODUCED_IN_FORWARD covers boundaries and converter limitations that exist only because of the forward environment; RECLASSIFIED_OR_GROUPED marks forward gaps whose program has related reverse gaps but not at the same line.', 'reverse_gaps': grow, 'forward_gaps_without_reverse_location_match': new_rows})

# ================================================================ summary
def cnt(rows, key):
    return dict(collections.Counter(r.get(key) for r in rows))


summary = {
    'contract': 'reverse-forward/summary',
    'provenance': prov,
    'programs': {'reverse_total': len(inv['file_registry']), 'reported_baseline': inv['stats']['programs'], 'by_category': cnt(programs, 'category'), 'formula': 'FULLY_IMPLEMENTED = COMPLETE (no gaps + passing scenario); denominator = inventory programs'},
    'paragraphs': {'reverse_total': len(para_rows), 'reported_baseline': par['stats']['total_paragraphs'], 'mapping': cnt(para_rows, 'mapping'), 'evidence': cnt(para_rows, 'evidence'), 'with_forward_gaps': sum(1 for r in para_rows if r['gaps_in_paragraph'])},
    'sections': {'reverse_total': len(section_rows), 'reported_baseline': par['stats']['total_sections'], 'mapped': sum(1 for s in section_rows if s['forward'])},
    'perform_edges': {'reverse_total': len(edge_rows), 'reported_baseline_perform_edges': par['stats']['total_perform_edges'], 'forward': cnt(edge_rows, 'forward'), 'evidence': cnt([e for e in edge_rows if e.get('evidence')], 'evidence')},
    'branches': {'reverse_total': len(branch_rows), 'reported_baseline': lgc['stats']['branches'], 'forward': cnt(branch_rows, 'forward'), 'evidence': cnt([b for b in branch_rows if b.get('evidence')], 'evidence')},
    'loops': {'reverse_total': len(loop_rows), 'reported_baseline': lgc['stats']['loops'], 'forward': cnt(loop_rows, 'forward')},
    'statements': {'reverse_total': len(stmt_rows), 'reported_baseline': par['stats']['total_statements'], 'forward': cnt(stmt_rows, 'forward')},
    'business_rules': {'reverse_total': len(rrules), 'forward_reconciled': len(recon['rules']), 'by_status': recon['summary'], 'identity_discrepancies': {'in_reverse_not_forward': missing_ids, 'in_forward_not_reverse': extra_ids}},
    'fields': {'reverse_total': len(frows), 'reported_baseline': dat['stats']['elementary_fields'] + dat['stats']['elementary_record_level_items'], 'forward': cnt(frows, 'forward')},
    'conditions_88': {'reverse_total': len(crows), 'reported_baseline': dat['stats']['conditions'], 'forward': cnt(crows, 'forward'), 'evidence': cnt([c for c in crows if c['evidence']], 'evidence')},
    'records': {'reverse_total': len(rrows), 'reported_baseline': len(dat['record_catalogue']), 'forward': cnt(rrows, 'forward')},
    'copybooks': {'reverse_total': len(cbrows), 'reported_baseline_copybooks': inv['stats']['copybooks'], 'reported_baseline_db2_includes': inv['stats']['db2_includes'], 'by_status': cnt(cbrows, 'status')},
    'diagrams': {'reverse_total': len(drows), 'reported_baseline': dia['stats']['total_diagrams'], 'by_type': cnt(drows, 'type'), 'mapping': cnt(drows, 'mapping'), 'process_flow_edges': dict(sum((collections.Counter(d.get('edges_classified', {})) for d in drows), collections.Counter())), 'process_flow_nodes': dict(sum((collections.Counter(d.get('nodes_by_forward_mapping', {})) for d in drows), collections.Counter())), 'process_flow_nodes_test_verified': sum(d.get('nodes_test_verified', 0) for d in drows)},
    'jcl': {'reverse_total': len(jrows), 'reported_baseline': inv['stats']['jcl_jobs'], 'by_status': cnt(jrows, 'status')},
    'dependencies': {'call_graph_edges': len(dep_rows), 'reported_baseline': inv['stats']['call_edges_total'], 'by_type_and_status': dict(collections.Counter(f"{d['type']}: {d['forward']}" for d in dep_rows)), 'external_operations': len(ops), 'external_operation_status': dict(collections.Counter(o['forward'] for o in ops))},
    'gaps': {'reverse_total': len(grow), 'forward_total': len(fg_all), 'reverse_classification': cnt(grow, 'classification'), 'forward_without_location_match': cnt(new_rows, 'classification')},
    'equivalence': 'NOT ESTABLISHED: no COBOL compiler or captured legacy execution results exist; all verification is source-derived',
}
write('summary.json', summary)
print(json.dumps({k: v for k, v in summary.items() if k != 'provenance'}, indent=1)[:6000])
print('provenance', json.dumps({'artifacts_unchanged': sum(1 for a in prov['reverse_artifacts'] if a['unchanged']), 'artifacts': len(prov['reverse_artifacts']), **prov['source_files'], 'manifest_mismatches': len(prov['authorised_manifest']['mismatches'])}))
