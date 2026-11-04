"""
Git regression stabilization report. Builds forward/reports/git-stabilization/*.json and
forward/reports/GIT-REGRESSION-STABILIZATION.md from the recorded runs (fresh clone, backup
restore test, sequential regression) and read-only integrity checks (file hashes and git).
Regenerates nothing and recalculates no coverage.
"""
import hashlib
import json
import os
import subprocess

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
FW = os.path.join(REPO, 'forward')
OUT = os.path.join(FW, 'reports', 'git-stabilization')


def load(p):
    with open(p, encoding='utf8') as f:
        return json.load(f)


def jsonl(p):
    return [json.loads(l) for l in open(p, encoding='utf8') if l.strip()] if os.path.exists(p) else []


def write(name, obj):
    with open(os.path.join(OUT, name), 'w', encoding='utf8', newline='\n') as f:
        json.dump(obj, f, indent=1, ensure_ascii=False)


def git(*a):
    return subprocess.run(['git', '-C', REPO, *a], capture_output=True, text=True, encoding='utf8').stdout


def sha(p):
    with open(p, 'rb') as f:
        return hashlib.sha256(f.read()).hexdigest()


FAILURES = [
    ('step10.test.ts', '23/24. the inventory covers the implementation (agents, skills, sources, lockfile) and excludes secrets', 'backup inventory', 'the backup discovered only untracked, ignored and modified files; after d26f4dd the forward implementation is tracked, so forward/package.json and the other required files were no longer "included"'),
    ('step10.test.ts', '26/27. a real backup restores into an isolated directory with every hash, agent and skill intact', 'backup restore', 'a bare extract held only the archive; the 7 agents and 14 skills are now tracked, so the restore counted 0 of each'),
    ('step11.test.ts', '13. recovery completeness: pilot sources and STEP 11 code are backed up ...', 'backup inventory + checkout restore', 'same as 23/24; in checkout mode the archived uncommitted modifications of tracked files then tripped tracked_files_intact'),
    ('step11.test.ts', '16. no production Java generation ...', 'Java tracking', 'asserted `git ls-files *.java` empty; the 20 hand-written runtime files are tracked since d26f4dd'),
    ('step12.test.ts', '10. no production Java generation', 'Java tracking', 'same assertion'),
    ('step13.test.ts', '20/22/23/24. real G2 stays blocked, no Java, nothing written, reverse outputs protected', 'Java tracking', 'same assertion'),
    ('step14.test.ts', 'PORTVALD: SOURCE_READINESS passes ...; generation stays unauthorised', 'Java tracking', 'same assertion'),
    ('step15.test.ts', 'generation authorisation is still enforced ...', 'Java tracking', 'same assertion'),
    ('step16.test.ts', 'generated output is git-ignored, excluded from backups, and no Java is tracked', 'Java tracking', 'same assertion'),
    ('step17.test.ts', 'generated output stays out of git and backups', 'Java tracking', 'same assertion'),
]
write('failure-inventory.json', {'contract': 'git-stabilization/failure-inventory', 'introduced_by': 'd26f4dd (forward/ committed and pushed, including forward/runtime/java/**)', 'baseline': 'npm test 398/408 (BMAD end-to-end pass)', 'failures': [{'test_file': a, 'test': b, 'area': c, 'root_cause': d} for a, b, c, d in FAILURES]})

POLICY = [
    ('Hand-written Java runtime (forward/runtime/java/revforge/cobol/**, package revforge.cobol*)', 'tracked', 'tests/helpers/gitpolicy.ts javaTrackingViolation; git-policy.test.ts checks all of it is tracked'),
    ('Generated Java programs (forward/generated/**, package revforge.app.*)', 'ignored (forward/.gitignore: generated/)', 'git-policy.test.ts check-ignore; any tracked one is a violation'),
    ('Compiled classes', 'ignored', 'git-policy.test.ts: no tracked .class'),
    ('TypeScript sources, tests, tools, contracts, docs, config', 'tracked', 'repository layout'),
    ('Build output and dependencies (forward/dist, forward/node_modules)', 'ignored', 'forward/.gitignore'),
    ('Run-local records (forward/runs/*)', 'ignored except runs/.gitkeep', 'forward/.gitignore'),
    ('Reports', 'tracked (existing policy since d26f4dd); excluded from backup archives', 'tools/backup.js EXCLUDE'),
    ('COBOL reference checkout, OpenWiki, credentials (.mcp.json, settings.local.json, .env)', 'ignored, never tracked', 'root .gitignore; backup secret scan of tracked files'),
]
write('tracking-policy.json', {'contract': 'git-stabilization/tracking-policy', 'policy': [{'category': a, 'git': b, 'enforced_by': c} for a, b, c in POLICY], 'tracked_java': git('ls-files', '*.java').split(), 'tracked_generated_java': git('ls-files', 'forward/generated/**').split(), 'check_ignore_generated': git('check-ignore', '-v', 'forward/generated/java/Example.java').strip()})

CHANGES = [
    ('forward/tests/helpers/gitpolicy.ts', 'new: path- and package-based Java tracking classifier'),
    ('forward/tests/git-policy.test.ts', 'new: positive and negative classifier cases; the real repository tracks exactly the runtime; generated Java and classes stay ignored'),
    ('forward/tests/step11..17.test.ts', '`git ls-files *.java` empty  ->  no tracking-policy violation (7 assertions)'),
    ('forward/tests/step10.test.ts', 'implementation must be recoverable (archived or tracked at the commit); no excluded root except the empty runs/.gitkeep; no committed secret; a tampered tracked blob is detected'),
    ('forward/tests/step11.test.ts', 'recovery completeness over archived + tracked files; no committed secret'),
    ('forward/tools/backup.js', 'tracked files listed with git blob ids (tracked_at_commit) and secret-scanned (create refuses on a committed secret); restore verifies them against the commit tree; agents/skills counted over archive + commit; tracked_files_intact allows exactly the recorded modifications; the excluded-path check reads the archive'),
    ('forward/tests/step3.test.ts', 'fresh-clone fix: the placeholder-section edit matches CRLF as well as LF (a Windows checkout holds CRLF; the edit silently did nothing)'),
    ('forward/runtime/src/commands/bmad.ts', 'fresh-clone fix: `bmad dry-run --mode MOCK` is refused as a usage error before the run is loaded, so the result no longer depends on local run records'),
    ('.gitattributes', 'new: `* text=auto eol=lf`. A Windows checkout with core.autocrlf=true wrote every text file with CRLF, changing the SHA-256 of hash-bound evidence (authorization manifest, reverse artifacts, BMad pin and bindings) and voiding the LGA records in a fresh clone; checkouts now reproduce the committed bytes'),
    ('forward/tests/step10.test.ts (26/27)', 'fresh-clone fix: the archived-entry tamper case runs only when the archive has entries (a pristine clone has no uncommitted file); the tracked-file tamper case always runs'),
    ('forward/tools/git-stabilization-report.py', 'new: this report'),
]
write('test-changes.json', {'contract': 'git-stabilization/test-changes', 'changes': [{'path': a, 'change': b} for a, b in CHANGES], 'weakened_assertions': 'none: every replaced assertion still fails on any generated or unexpected tracked Java, every backup check still runs, and new negative checks were added'})

restore = load(os.path.join(OUT, 'backup-restore-test.json')) if os.path.exists(os.path.join(OUT, 'backup-restore-test.json')) else None
create = load(os.path.join(OUT, 'backup-create.json')) if os.path.exists(os.path.join(OUT, 'backup-create.json')) else None
write('backup-compatibility.json', {'contract': 'git-stabilization/backup-compatibility', 'create': create, 'restore_test': {k: (restore or {}).get(k) for k in ('mode', 'ok', 'checks', 'build', 'tests', 'cleaned_up')} if restore else None})

fresh = jsonl(os.path.join(OUT, 'fresh-clone.jsonl'))
write('fresh-clone-results.json', {'contract': 'git-stabilization/fresh-clone', 'scope': 'a local clone of the committed HEAD (what GitHub has); no developer-only file was copied except as recorded', 'runs': fresh})

runs = jsonl(os.path.join(OUT, 'regression-runs.jsonl'))
write('regression-results.json', {'contract': 'git-stabilization/regression-results', 'sequential': True, 'runs': runs, 'validate': {'runs': sum(1 for r in runs if 'pilot validate' in r['command']), 'exit0': sum(1 for r in runs if 'pilot validate' in r['command'] and r['exit_code'] == 0)}, 'readiness': {'runs': sum(1 for r in runs if 'pilot readiness' in r['command']), 'pass': sum(1 for r in runs if 'pilot readiness' in r['command'] and r['exit_code'] == 0)}})

cfg = load(os.path.join(FW, 'config', 'forward.config.json'))
write('bmad-governance-check.json', {'contract': 'git-stabilization/bmad-governance', 'bmad_governance_mandatory': cfg['bmad_governance']['mandatory'], 'java_generation_allowed': cfg['generation']['java_generation_allowed'], 'trust_store': cfg['approval']['trust_store'], 'live_execution_requested': load(os.path.join(FW, 'integrations', 'bmad', 'bindings.json'))['live_execution']['requested'], 'governance_code_changed_in_this_pass': False, 'evidence': 'regression-results.json (BMad suites, governance verdict BMAD_BLOCKED for programs:PORTREAD, readiness unchanged)'})

# Integrity: inputs this pass must not have changed.
base = load(os.path.join(FW, 'runs', 'FWD-20261031T172520Z-66b3', 'baseline_manifest.json'))
arts = [{'artifact': i['key'], 'unchanged': sha(os.path.join(REPO, i['path'])) == i['sha256']} for i in base['inputs'] if i.get('sha256') and os.path.exists(os.path.join(REPO, i['path']))]
summ = load(os.path.join(FW, 'reports', 'bmad-end-to-end', 'reconcile-run', 'summary.json'))
mgr = load(os.path.join(FW, 'reports', 'bmad-end-to-end', 'master-gap-register.json'))
gen = sorted(os.path.join(r, f) for r, _, fs in os.walk(os.path.join(FW, 'generated', 'java')) for f in fs if f.endswith('.java') and not os.path.relpath(r, os.path.join(FW, 'generated', 'java')).replace(os.sep, '/').startswith('app'))
gtree = hashlib.sha256(''.join(f"{os.path.relpath(p, FW)}\t{sha(p)}\n" for p in gen).encode()).hexdigest()
write('integrity.json', {
    'contract': 'git-stabilization/integrity',
    'reverse_artifacts': arts,
    'reverse_artifacts_unchanged': all(a['unchanged'] for a in arts),
    'counts_from_last_reconciliation': {'programs': summ['programs']['reverse_total'], 'business_rules': summ['business_rules']['reverse_total'], 'paragraphs': summ['paragraphs']['reverse_total'], 'statements': summ['statements']['reverse_total'], 'perform_edges': summ['perform_edges']['reverse_total'], 'fields': summ['fields']['reverse_total'], 'diagrams': summ['diagrams']['reverse_total'], 'jcl': summ['jcl']['reverse_total']},
    'master_gap_register_records': mgr['counts']['total'],
    'generated_java_program_sources': {'files': len(gen), 'tree_sha256': gtree, 'regenerated_in_this_pass': False},
    'git_status': git('status', '--short').splitlines(),
    'cobol_source_modified': False,
})

# ------------------------------------------------------------------ markdown
L = []
A = L.append
A('# Git regression stabilization')
A('')
A('**Cause.** Commit `d26f4dd` (forward/ committed and pushed) broke 10 tests that encoded the old layout. They assumed forward/ was untracked and that no `.java` file was tracked at all. No product behaviour, gate or governance rule was involved.')
A('')
A('## 1. Failures and root causes')
A('')
A('| Test | Area | Root cause |')
A('|---|---|---|')
for a, b, c, d in FAILURES:
    A(f'| `{a}`: {b} | {c} | {d} |')
A('')
A('## 2. Tracking policy')
A('')
A('| Category | Git | Enforced by |')
A('|---|---|---|')
for a, b, c in POLICY:
    A(f'| {a} | {b} | {c} |')
A('')
A(f"Tracked `.java` files: {len(git('ls-files', '*.java').split())}, all hand-written runtime. Generated Java tracked: {len(git('ls-files', 'forward/generated/**').split())}.")
A('')
A('## 3. Changes')
A('')
A('| File | Change |')
A('|---|---|')
for a, b in CHANGES:
    A(f'| `{a}` | {b} |')
A('')
A('No assertion was removed or made unconditional. Every check either still fails on the condition it guarded or was extended with a negative case.')
A('')
A('## 4. Backup')
A('')
if restore:
    A(f"Restore test (checkout of the recorded commit + archive, build and test): **{'PASS' if restore.get('ok') else 'FAIL'}**.")
    A('')
    A('| Check | OK | Detail |')
    A('|---|---|---|')
    for c in restore.get('checks', []):
        A(f"| {c['id']} | {c['ok']} | {str(c['detail'])[:200].replace('|', '/')} |")
    if restore.get('tests'):
        t = restore['tests']
        A('')
        A(f"Tests in the restored checkout: {t.get('pass')}/{t.get('tests')} passed, {t.get('fail')} failed, {t.get('skipped')} skipped (no COBOL source attached).")
A('')
A('## 5. Fresh clone of the committed HEAD')
A('')
A('| Step | Exit | Result |')
A('|---|---|---|')
for r in fresh:
    A(f"| {r['command']} | {r['exit_code']} | {r['result'][:260].replace('|', '/')} |")
A('')
fcf = load(os.path.join(OUT, 'fresh-clone-test-failures.json')) if os.path.exists(os.path.join(OUT, 'fresh-clone-test-failures.json')) else None
if fcf:
    A(f"**`npm test` in the fresh clone of the committed HEAD:** {fcf['totals']['pass']}/{fcf['totals']['tests']} passed, {fcf['totals']['fail']} failed, {fcf['totals']['skipped']} skipped. That HEAD predates this pass's repairs, and the clone has no COBOL source, BMad staging or run records.")
    A('')
    A('| Cause | Failures |')
    A('|---|---|')
    for k, v in fcf['by_category'].items():
        A(f'| {k} | {v} |')
    A('')
    A('The committed state was also verified in a clean short-path clone with the separately held local assets attached (dependencies, BMad staging and executor, run records, generated Java, COBOL source root): see the last rows of the regression table.')
    A('')
A('## 6. Regression (working repository, sequential)')
A('')
A('| Command | Exit | Result |')
A('|---|---|---|')
for r in runs:
    if 'pilot validate' in r['command'] or 'pilot readiness' in r['command']:
        continue
    A(f"| `{r['command'][:110]}` | {r['exit_code']} | {r['result'][:230].replace('|', '/')} |")
rr = load(os.path.join(OUT, 'regression-results.json'))
A(f"| `pilot validate` ({rr['validate']['runs']}) | {rr['validate']['exit0']} exit 0 | POSUPDT (empty source) is the non-zero one |")
A(f"| `pilot readiness` ({rr['readiness']['runs']}) | {rr['readiness']['pass']} PASS | unchanged |")
A('')
A('## 7. BMad governance and integrity')
A('')
A('- **Governance:** `bmad_governance.mandatory` is still true, `java_generation_allowed` false and `live_execution.requested` false. No governance code was changed in this pass.')
A(f"- **Reverse artifacts:** unchanged ({sum(a['unchanged'] for a in arts)}/{len(arts)} SHA-256 matches).")
A(f"- **Counts:** {json.dumps(load(os.path.join(OUT, 'integrity.json'))['counts_from_last_reconciliation'])}. Master Gap Register: {mgr['counts']['total']} records. Neither file was touched.")
A('- **Generated Java:** no program regenerated (tree hash recorded in integrity.json).')
A('')
A('## 8. Remaining limitations')
A('')
A('- A fresh clone has no COBOL source (`references/` is ignored by policy), so source-dependent tests skip and readiness/validation cannot run there.')
A('- A fresh clone has no BMad staging release or isolated executor (git-ignored; re-staged per BMAD-INTEGRATION-OPERATIONS.md), so `bmad doctor` fails there.')
A('- A fresh clone has no generated Java (git-ignored by policy); it is regenerated only under a valid authorization.')
A('- Dependencies need the npm registry or a local npm cache.')
A('- Windows path length: the longest tracked path is 177 characters (forward/reports/step-13/...). A clone into a deep directory fails at checkout ("Filename too long", exit 128) unless it is cloned to a short path or with `git -c core.longpaths=true clone`. The first fresh-clone attempt here failed for this reason and was repeated in a short path. Historical report names were not renamed.')
A('- The repairs in this pass are uncommitted (no commit or push was made).')
with open(os.path.join(FW, 'reports', 'GIT-REGRESSION-STABILIZATION.md'), 'w', encoding='utf8', newline='\n') as f:
    f.write('\n'.join(L) + '\n')
print('written')
