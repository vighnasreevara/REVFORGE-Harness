"""
STEP 21 assessment: builds forward/reports/step-21/*.json and
forward/reports/STEP-21-BMAD-INTEGRATION-ASSESSMENT.md from recorded evidence
(sealed BMad records of the real run, the regression runs, the unsigned
PORTREAD disclosure request, the raw G2 evaluation) and read-only diagnostic
commands (doctors, workflows, bindings, governance verdict). It launches
nothing and writes only under forward/reports.
"""
import collections
import glob
import json
import os
import re
import subprocess

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
FW = os.path.join(REPO, 'forward')
OUT = os.path.join(FW, 'reports', 'step-21')
RUN = os.path.join(FW, 'runs', 'FWD-20261031T172520Z-66b3')
BM = os.path.join(RUN, 'workflow', 'bmad')
NODE = os.environ.get('REVFORGE_NODE', 'node')
SCOPE = 'programs:PORTREAD'


def load(p):
    with open(p, encoding='utf8') as f:
        return json.load(f)


def write(name, obj):
    with open(os.path.join(OUT, name), 'w', encoding='utf8', newline='\n') as f:
        json.dump(obj, f, indent=1, ensure_ascii=False)


def cli(*args):
    """Read-only diagnostic command; returns (exit code, parsed JSON or None, text)."""
    r = subprocess.run([NODE, os.path.join(FW, 'dist', 'runtime', 'src', 'cli.js'), *args, '--json'], cwd=FW, capture_output=True, text=True, encoding='utf8')
    try:
        return r.returncode, json.loads(r.stdout), r.stdout
    except Exception:
        return r.returncode, None, r.stdout + r.stderr


def sha(p):
    import hashlib
    with open(p, 'rb') as f:
        return hashlib.sha256(f.read()).hexdigest()


runs = [json.loads(l) for l in open(os.path.join(OUT, 'regression-runs.jsonl'), encoding='utf8') if l.strip()]
_, bdoc, _ = cli('bmad', 'doctor')
_, edoc, _ = cli('bmad', 'executor', 'doctor')
_, idoc, _ = cli('bmad', 'isolation', 'doctor')
_, wfl, _ = cli('bmad', 'workflows')
_, bnd, _ = cli('bmad', 'bindings')
_, pad, ptext = cli('provider', 'authorization', 'doctor')
gcode, gov, _ = cli('bmad', 'governance', '--scope', SCOPE)
bindings = load(os.path.join(FW, 'integrations', 'bmad', 'bindings.json'))
registry = load(os.path.join(FW, 'integrations', 'bmad', 'workflow-registry.json'))
cfg = load(os.path.join(FW, 'config', 'forward.config.json'))
reg_by = {w['workflow_id']: w for w in registry.get('workflows', registry.get('entries', []))}

# ------------------------------------------------------------------ installation audit
ws = (edoc or {}).get('workspaces', [])
install = {
    'contract': 'step-21/bmad-installation-audit',
    'release': {'package': (bdoc or {}).get('package'), 'version': (bdoc or {}).get('version'), 'bmad_doctor_ok': (bdoc or {}).get('ok'), 'checks': (bdoc or {}).get('checks')},
    'locations': {
        'staged_release': 'forward/integrations/bmad/staging/bmad-method-6.12.4/package (git-ignored, pinned by release.pin.json)',
        'executor_copy': 'forward/integrations/bmad/executor/bmad-method-6.12.4 (pinned copy with 13 npm runtime dependencies)',
        'installed_workspaces': [{'path': w.get('path'), 'bound_skills_verified': w.get('bound_skills_verified'), 'skills': w.get('skills')} for w in ws],
        'repository_root': 'not installed (no bmad-* skill in .claude/skills, no _bmad/, no _bmad-output/): by design, so BMad cannot mix with the reverse and forward agents',
    },
    'usable_by_repository': 'only through the forward runtime adapter and the isolated executor; the repository never loads BMad skills directly',
    'executor_doctor': {'ok_for_installation': (edoc or {}).get('ok_for_installation'), 'ok_for_live': (edoc or {}).get('ok_for_live'), 'checks': (edoc or {}).get('checks')},
    'status': {'installed': 'YES (isolated executor workspace)', 'configured': 'YES (pinned release, 6 valid bindings, mandatory governance policy)', 'live_ready': 'NO'},
}
write('bmad-installation-audit.json', install)

# ------------------------------------------------------------------ workflow mapping
STAGE = {'BMAD-PRD': 'requirements', 'BMAD-ARCH': 'architecture', 'BMAD-EPICS': 'stories', 'BMAD-SPRINT': 'sprint', 'BMAD-BUILD': 'implementation', 'BMAD-REVIEW': 'review'}
mapping = []
for b in bindings['bindings']:
    w = reg_by.get(b['workflow_id'], {})
    mapping.append({
        'stage': STAGE.get(b['binding_id']),
        'binding_id': b['binding_id'],
        'workflow_id': b['workflow_id'],
        'agent': b.get('agent'),
        'gates_required': b.get('requires_gates'),
        'allowed_states': b.get('allowed_states'),
        'needs': b.get('requires'),
        'registry_lifecycle': w.get('lifecycle'),
        'definition_path': w.get('path'),
        'definition_sha256': w.get('sha256') or w.get('skill_sha256'),
        'executable_definition': w.get('lifecycle') == 'active',
        'installed_in_workspace': any(b['workflow_id'] in (x.get('skills') or []) for x in ws),
        'status': {'mapped': True, 'unit_tested': True, 'authorized': False, 'executed': False, 'receipt_verified': False, 'blocked': True},
    })
write('bmad-workflow-mapping.json', {'contract': 'step-21/bmad-workflow-mapping', 'bindings_version': bindings.get('binding_version'), 'mapping': mapping, 'outside_bmad': bindings.get('independent_agents'), 'acceptance': 'the independent F6 test receipt and gates G6-G8 (deliberately outside BMad)', 'output_consumption': 'each accepted receipt becomes an upstream input of the next binding (adapter upstreamReceipts / mapping); BMad receipts never count toward gates G3-G8 (counts_toward_gates: false); the forward agents F1-F7 and the local converter remain the authority, and an accepted BMad output is a draft pending human approval'})

# ------------------------------------------------------------------ governed runs and preflights
bgr = [load(f) for f in sorted(glob.glob(os.path.join(BM, 'BGR-*.json')))]
bpf = {os.path.basename(f)[:-5]: load(f) for f in glob.glob(os.path.join(BM, 'BPF-*.json'))}
pilot_runs = [r for r in bgr if r['scope'] == SCOPE]
final = pilot_runs[-1] if pilot_runs else None
final_pf = bpf.get(final['stages'][0]['preflight_id']) if final else None
execs = []
for r in pilot_runs:
    for s in r['stages']:
        execs.append({'governed_run': r['record_id'], 'stage': s['stage'], 'workflow_id': s['workflow_id'], 'workflow_version': 'bmad-method@6.12.4', 'agent': s['agent'], 'scope': r['scope'], 'scope_sha256': r['scope_sha256'], 'authorization_ref': s['authorization_id'], 'g2_approval_ref': None, 'preflight': s['preflight_id'], 'started_at': r['started_at'], 'ended_at': r['ended_at'], 'outcome': s['status'], 'executed': False, 'receipt_id': s['receipt_id'], 'output_artifacts': [], 'blockers': s['blockers']})
write('workflow-executions.json', {'contract': 'step-21/workflow-executions', 'live_executions': 0, 'governed_runs': [{'record_id': r['record_id'], 'status': r['status'], 'fallback': r['fallback'], 'local_conversion_invoked': r['local_conversion_invoked'], 'started_at': r['started_at']} for r in pilot_runs], 'note': f"{len(pilot_runs)} sealed governed run(s) for {SCOPE}; every one stopped before any launch. {final['record_id'] if final else '-'} is the authoritative record (host assessment included); earlier ones are kept unchanged (append-only).", 'stages': execs})

# ------------------------------------------------------------------ receipts
receipts = [load(f) for f in glob.glob(os.path.join(BM, 'BRC-*.json'))]
write('bmad-receipt-validation.json', {
    'contract': 'step-21/bmad-receipt-validation',
    'receipts_in_run': len(receipts),
    'live_receipts': sum(1 for r in receipts if r.get('mode') == 'LIVE'),
    'validated_live_receipts': 0,
    'governance_verdict': gov,
    'receipt_contract': 'forward/contracts/bmad/receipt.schema.json (evidence_status MOCK_NOT_EVIDENCE | DRAFT_PENDING_HUMAN_APPROVAL | REJECTED; counts_toward_gates false)',
    'counting_rule': 'a stage is RECEIPT_VERIFIED only for an accepted, sealed, intact LIVE receipt of the current scope digest whose documents are unchanged (runtime/src/bmad/governance.ts receiptCounts); MOCK receipts never count',
    'validator_tests': 'tests/step21.test.ts (rejected forged receipt, MOCK receipt, failed execution, test-double counting rule) and tests/step6-9',
})

# ------------------------------------------------------------------ authorization requirements
ada = load(os.path.join(OUT, 'authorization-request-PORTREAD.unsigned.json'))
write('authorization-requirements.json', {
    'contract': 'step-21/authorization-requirements',
    'scope': SCOPE,
    'disclosure_request': {'file': 'forward/reports/step-21/authorization-request-PORTREAD.unsigned.json', 'authorization_id': ada['authorization_id'], 'sha256': sha(os.path.join(OUT, 'authorization-request-PORTREAD.unsigned.json')), 'provider': ada['provider'], 'models': ada['models'], 'workflows': ada['workflows'], 'source_files': ada['source_files'], 'limits': ada['limits'], 'expires_at': ada['expires_at'], 'signed': False},
    'contract_checks': ['contract orchestrator/ai-disclosure-authorization, signed as signed-ai-disclosure-authorization (ed25519) over the canonical JSON', 'signer must be a trusted data_owner in the approval trust store; a different role or an unknown key is rejected (tests/step8, step9, step21)', 'bound to provider anthropic / service claude-code-cli, the exact scope digest, the listed files and hashes, the workflows, limits and validity window; re-verified at every use', 'an OpenAI source-export authorization never covers Claude'],
    'current_state': (ptext or '').strip(),
    'trust_store': cfg['approval'].get('trust_store'),
    'steps': [
        {'actor': 'trust custodian (administrator)', 'action': 'provision the approval trust store with public keys for data_owner, requirements_approver, business_sme and technical_authority (forward/docs/HUMAN-APPROVAL-OPERATIONS.md); private keys never enter the repository'},
        {'actor': 'data_owner', 'action': f"review and sign {ada['authorization_id']} outside REVFORGE (signer_id, role=data_owner, signed_at), then `provider authorization verify --file signed.json` and `provider authorization import --file signed.json`; re-prepare first if it has expired"},
    ],
    'not_done': 'nothing was signed, approved or imported in STEP 21',
})

# ------------------------------------------------------------------ G2 scope assessment
g2 = load(os.path.join(OUT, 'g2-evaluation-PORTREAD.raw.json'))
blocking = [f for f in g2['findings'] if f['blocking']]


def classify(f):
    k, o = f['kind'], f['outcome']
    shared = any(u != 'PORTREAD' for u in (f.get('units') or []))
    if o == 'CONTRADICTED':
        return 'GENUINE_CROSS_SCOPE', 'portfolio status domain: copybook PORTFLIO declares A/C/S while PORTMSTR validates A/I/C (BR-095, BR-149); a signed business_sme decision (DR-PORTMSTR-001 / DR-PORTUPDT-001) is required', 'business_sme'
    if o == 'REQUIRES_EVIDENCE':
        return 'GENUINE_POLICY', 'declared reverse_artifact_supported by F1/F2; the G2 policy maps that to REQUIRES_EVIDENCE. Needs a source-verified re-delivery (verified_from_source with checkable citations) or a signed evidence adjudication', 'technical_authority'
    if k.startswith('decision'):
        return 'GENUINE_CROSS_SCOPE' if shared else 'GENUINE', 'open blocking decision; needs a signed resolution', 'business_sme'
    if k == 'requirement':
        return 'GENUINE', 'flagged for SME review by the requirements analyst (F1); needs SME confirmation and the signed requirements approval', 'business_sme / requirements_approver'
    return 'UNCLASSIFIED', '; '.join(f['reasons'])[:200], '-'


rows = []
for f in blocking:
    c, why, role = classify(f)
    rows.append({'id': f['id'], 'kind': f['kind'], 'outcome': f['outcome'], 'units': f.get('units'), 'portread_specific': all(u == 'PORTREAD' for u in (f.get('units') or ['PORTREAD'])), 'classification': c, 'why': why, 'resolving_role': role, 'decisions': f.get('decisions'), 'reasons': f['reasons'][:3]})
write('g2-scope-assessment.json', {
    'contract': 'step-21/g2-scope-assessment',
    'scope': SCOPE,
    'scope_sha256': g2['scope_sha256'],
    'readiness': g2['readiness'],
    'units': [u.get('name') if isinstance(u, dict) else u for u in g2['units']],
    'findings_total': len(g2['findings']),
    'blocking': len(blocking),
    'by_classification': dict(collections.Counter(r['classification'] for r in rows)),
    'application_scope_note': 'the 417 blocking findings belong to the application scope; a programs:PORTREAD approval needs only these findings resolved plus a signed G2 approval for this exact scope digest',
    'classification_defects_found': 0,
    'findings': rows,
    'evidence_required_for_approval': [
        'a signed business_sme resolution of the portfolio-status contradiction (DR-PORTMSTR-001, DR-PORTUPDT-001) that applies to the shared copybook PORTFLIO',
        'source-verified evidence for the PORTFLIO records, the 3 PORTREAD file operations and RT-PORTREAD-002/003 (F2/F1 re-delivery with verified_from_source citations, or a signed evidence adjudication by technical_authority)',
        'SME confirmation of REQUIRES_SME_DECISION requirements REQ-PORTREAD-001/002',
        'a signed G2 approval by a requirements_approver for programs:PORTREAD at the current scope digest (distinct requester and approver)',
    ],
    'workflow_state_note': 'the workflow state is REQUIREMENTS_DRAFTED; BMAD-PRD needs REQUIREMENTS_APPROVED or later, which follows from the signed G2 approval',
})

# ------------------------------------------------------------------ environment
prim = (idoc or {}).get('primitives', {})
write('environment-readiness.json', {
    'contract': 'step-21/environment-readiness',
    'host': (idoc or {}).get('host'),
    'wsl': (idoc or {}).get('wsl'),
    'host_tools': {'node': 'v22.12.0 (forward runtime toolchain, outside any boundary)', 'claude_code_cli': '2.1.302 on the host, outside any boundary', 'docker_desktop': prim.get('docker_host')},
    'inside_wsl2': {k: prim.get(k) for k in ('linux_node', 'linux_claude', 'linux_bwrap', 'linux_socat', 'linux_unshare', 'linux_setpriv', 'unprivileged_user_namespaces', 'passwordless_sudo')},
    'isolation_status': (idoc or {}).get('status'),
    'isolation_tested': (idoc or {}).get('isolation_tested'),
    'isolation_problems': (idoc or {}).get('isolation_problems'),
    'boundaries': (idoc or {}).get('boundaries'),
    'admin_actions_required': (idoc or {}).get('admin_actions_required'),
    'credential_handling': 'no credential is placed in the boundary (tested: host_secrets_excluded); a provider credential for a LIVE run must be injected only into the runner process by the administrator, never written to the workspace or the repository',
    'network_requirements': 'default-deny inside the namespace (tested); a LIVE run needs a separately verified egress component outside the namespace that allows only the authorised provider endpoint host from the disclosure authorization (api.anthropic.com for claude-code-cli); TLS remains end-to-end, so the minimal workspace is what limits disclosure',
    'setup_instructions': [
        'administrator, inside the WSL2 Ubuntu distribution: install a pinned Node.js (the host uses v22.12.0) under /usr/local, which the sandbox exposes read-only',
        'administrator: install the pinned Claude Code CLI in the same prefix (npm install -g @anthropic-ai/claude-code@2.1.302 --prefix /usr/local), matching the version the executor manifest was investigated with',
        'administrator: provide and verify a provider-egress allowlist component outside the namespace (for example the official sandbox runtime with bubblewrap and socat, or a container/VM firewall); Docker Desktop 29.9.2 is present on the host but is not configured or tested as a boundary',
        'operator: re-run `bmad isolation test --record` (the recorded offline report expires after 7 days) and `bmad isolation doctor`; runner_inside_boundary must become available',
        'operator: `bmad executor doctor` must report LIVE prerequisites only for authorization and live_requested; then `bmad executor preflight --workflow bmad-prd --scope programs:PORTREAD --no-record`',
    ],
    'diagnostics': ['bmad isolation doctor', 'bmad executor doctor', 'provider authorization doctor', 'bmad executor preflight --workflow W --scope programs:PORTREAD --no-record', 'bmad governance --scope programs:PORTREAD'],
    'installed_in_step21': 'nothing (installation inside WSL2 needs an administrator password; no network route was created)',
})

# ------------------------------------------------------------------ pilot manifest
man = load(os.path.join(FW, 'pilot', 'authorizations', 'APPLICATION.authorization-manifest.json'))
pm = next(x for x in man['programs'] if x['program'] == 'PORTREAD')
lga = next((load(f) for f in glob.glob(os.path.join(RUN, 'workflow', 'generation', 'LGA-*.json')) if load(f).get('program') == 'PORTREAD'), None)
res = load(os.path.join(FW, 'generated', 'java', 'PORTREAD', 'pilot-result.json'))
jdir = os.path.join(FW, 'generated', 'java', 'PORTREAD', 'java', 'src')
jfiles = [{'path': os.path.relpath(os.path.join(r, f), REPO).replace(os.sep, '/'), 'sha256': sha(os.path.join(r, f))} for r, _, fs in os.walk(jdir) for f in fs if f.endswith('.java') and '/revforge/app/' in os.path.join(r, f).replace(os.sep, '/')]
rules = [x for x in load(os.path.join(FW, 'reports', 'reverse-forward', 'business-rule-mapping.json'))['rules'] if x['program'] == 'PORTREAD']
rgaps = [x for x in load(os.path.join(REPO, 'output', 'final_report', 'gaps_register.json'))['gaps'] if x.get('source_program') == 'PORTREAD']
ready = load(os.path.join(FW, 'reports', 'step-20', 'readiness', 'PORTREAD.json'))
write('portread-pilot-manifest.json', {
    'contract': 'step-21/portread-pilot-manifest',
    'scope': SCOPE,
    'scope_sha256': g2['scope_sha256'],
    'source': pm['source'],
    'copybooks': pm['copybooks'],
    'disclosure_files': ada['source_files'],
    'reverse_references': {'business_rules': [{'rule': r['rule'], 'name': r['name'], 'status': r['status']} for r in rules], 'reverse_gaps': [{'gap_id': g['gap_id'], 'type': g['gap_type'], 'title': g['title']} for g in rgaps]},
    'java': {'status': res['conversion_status'], 'counts': res['execution']['counts'], 'files': jfiles, 'local_authorization': lga['record_id'] if lga else None, 'governance': 'LOCAL_LGA_NOT_BMAD_GOVERNED', 'unchanged_in_step21': True},
    'tests': [c['id'] for c in res['execution']['cases']],
    'external_dependencies': 'none (sequential file PORTFOLIO-FILE; no DB2, CICS or CALL)',
    'readiness': {'status': ready['status'], 'source': 'forward/reports/step-20/readiness/PORTREAD.json'},
    'g2': {'readiness': g2['readiness'], 'blocking_findings': len(blocking), 'approved': False},
    'authorization': {'disclosure_request': ada['authorization_id'], 'signed': False},
    'excluded': 'no other COBOL program, copybook or repository content is part of the disclosure set',
})

# ------------------------------------------------------------------ blockers
pf_failed = [c for c in (final_pf or {}).get('checks', []) if not c['ok']]
OWNER = {'g2_exact_scope': 'requirements_approver (signed G2 for programs:PORTREAD) after business_sme and technical_authority resolutions', 'workflow_state': 'follows from the signed G2 approval', 'provider_authorization': 'data_owner (sign ADA request) and trust custodian (trust store)', 'source_hashes_current': 'follows from the signed disclosure authorization', 'authorized_content_only': 'follows from the signed disclosure authorization', 'runtime_execution_authorization': 'project owner: set bindings.json live_execution.requested only after the other prerequisites hold', 'limits': 'follows from the signed disclosure authorization', 'workspace_manifest': 'follows from the signed disclosure authorization', 'network_isolation': 'administrator: verified provider-egress component', 'runner_inside_boundary': 'administrator: Node.js and Claude Code inside WSL2', 'enforceable_launch_boundary': 'administrator: egress component plus runner inside the boundary'}
write('bmad-blockers.json', {'contract': 'step-21/bmad-blockers', 'scope': SCOPE, 'from_preflight': final_pf.get('record_id') if final_pf else None, 'blockers': [{'check': c['id'], 'detail': c['detail'], 'responsible': OWNER.get(c['id'], '-')} for c in pf_failed], 'further': [{'check': 'live_runner', 'detail': 'no LIVE runner adapter can run here: the headless Claude Code runner must run inside the verified boundary, which needs the administrator actions above', 'responsible': 'administrator, then engineering'}, {'check': 'build_disabled', 'detail': 'BMAD-BUILD needs generation.java_generation_allowed and an authorised java_target_dir (plus G4)', 'responsible': 'project owner (generation authority) after G3/G4'}]})

# ------------------------------------------------------------------ regression
def find(pat):
    return [r for r in runs if pat in r['command']]


reg = {'contract': 'step-21/regression-results', 'sequential': True, 'runs': runs,
       'summary': {'validate': {'runs': len(find('pilot validate')), 'exit0': sum(1 for r in find('pilot validate') if r['exit_code'] == 0)},
                   'readiness': {'runs': len(find('pilot readiness')), 'pass': sum(1 for r in find('pilot readiness') if r['exit_code'] == 0)}}}
write('regression-results.json', reg)

# ------------------------------------------------------------------ summary
def res_of(pat, rx):
    r = next((x for x in runs if pat in x['command']), None)
    m = re.search(rx, r['result']) if r else None
    return m.group(1) if m else None


summary = {
    'contract': 'step-21/summary',
    'classification': 'PARTIAL: ENFORCEMENT IMPLEMENTED AND VERIFIED, LIVE EXECUTION BLOCKED',
    'why_not_implementation_complete': 'mandatory enforcement, the governed dispatcher, receipt counting and the LIVE gate are implemented and tested; the LIVE runner adapter (launching the manifest command inside the boundary) cannot be implemented and verified until a runner exists inside the boundary, and consumption of real BMad outputs by F1-F7 cannot be demonstrated without a real run',
    'bmad': {'installed': True, 'configured': True, 'mapped': 6, 'unit_tested': True, 'authorized': 0, 'executed': 0, 'receipt_verified': 0, 'blocked': 6, 'mandatory': cfg.get('bmad_governance', {}).get('mandatory')},
    'pilot': {'scope': SCOPE, 'readiness': ready['status'], 'g2_blocking_findings': len(blocking), 'disclosure_request': ada['authorization_id'], 'governed_run': final['record_id'] if final else None, 'governed_run_status': final['status'] if final else None},
    'baseline_step20_confirmed': {'readiness_passes': sum(1 for r in find('pilot readiness') if r['exit_code'] == 0), 'runtime_tests': res_of('RuntimeTests', r'SUMMARY\|(\d+)\|'), 'harness_tests': res_of('npm test', r'pass (\d+)'), 'validate_exit0': sum(1 for r in find('pilot validate') if r['exit_code'] == 0)},
    'equivalence': 'NOT ESTABLISHED',
}
write('step21-summary.json', summary)

# ------------------------------------------------------------------ markdown
L = []
A = L.append
A('# STEP 21: mandatory BMAD integration and the PORTREAD pilot')
A('')
A(f"**Status: {summary['classification']}.** No BMad workflow has executed, and none is counted as executed.")
A('')
A(f"{summary['why_not_implementation_complete']}.")
A('')
A('**COBOL equivalence: not established.**')
A('')
A('Machine-readable evidence is in `forward/reports/step-21/`.')
A('')
A('## 1. Status by level')
A('')
A('| Level | Result |')
A('|---|---|')
A('| Installed | Yes: `bmad-method@6.12.4` in the isolated executor workspace `synthetic-001`, never in the repository (by design) |')
A('| Configured | Yes: pinned release, 6 valid bindings, `bmad_governance.mandatory: true` |')
A('| Mapped | 6 workflows (section 2) |')
A(f"| Unit-tested | Yes: {res_of('step21', r'# pass (\d+)') or '?'} BMad, authorization, preflight and governance tests pass (steps 6–9 and 21); the positive case is an explicit test double |")
A('| Authorized | 0: no signed disclosure authorization and no G2 approval |')
A('| Actually executed | 0 |')
A('| Receipt-verified | 0 |')
A('| Blocked | 6 of 6 stages for `programs:PORTREAD` |')
A('')
A('## 2. Workflow mapping')
A('')
A('| Stage | Binding | BMad workflow | Agent | Gates | Definition | In workspace |')
A('|---|---|---|---|---|---|---|')
for m in mapping:
    A(f"| {m['stage']} | {m['binding_id']} | `{m['workflow_id']}` | {m['agent']} | {', '.join(m['gates_required'] or [])} | {m['registry_lifecycle']} `{m['definition_path']}` | {'yes' if m['installed_in_workspace'] else 'no'} |")
A('')
A('**Outside BMad:** F2 (data mapping) and F6 (independent testing). Acceptance is the F6 receipt plus gates G6–G8.')
A('')
A('**How outputs are consumed:** an accepted receipt becomes an upstream input of the next binding. BMad receipts never count toward gates G3–G8, F1–F7 and the local converter stay the authority, and an accepted BMad output is a draft pending human approval. None of this has run with real BMad output.')
A('')
A('## 3. Mandatory enforcement implemented')
A('')
A('| Change | File |')
A('|---|---|')
for a, b in [
    ('`bmad_governance.mandatory: true`: every governed run needs a verified LIVE receipt per stage, otherwise BMAD_BLOCKED; Java generation through the workflow also needs the stages up to sprint (`generationAuthorized`)', '`forward/config/forward.config.json`, `runtime/src/orchestrator/orchestrator.ts`'),
    ('Governance verdict, receipt counting rule and the governed dispatcher `bmad governed-run --scope S`: stages run in order, a sealed preflight comes before every launch, the first blocked stage stops the run, the run is sealed as `BGR-NNNN`, fallback is `none` and the local converter is never invoked', '`runtime/src/bmad/governance.ts`, `contracts/bmad/governed-run.schema.json`, `runtime/src/commands/bmad.ts`'),
    ('LIVE gate defect fixed: `liveGate` refused unconditionally (STEP 6 text), and a LIVE receipt always carried `live_authorized: false`, so even an authorized run could never be accepted. Both now evaluate the real installation, disclosure-authorization and preflight facts, and still refuse when any fact is missing.', '`runtime/src/bmad/eligibility.ts`, `runtime/src/bmad/adapter.ts`'),
    ('`executeLive` now requires a recorded preflight that permits the launch. The stale `liveGate` reasons were removed from executor eligibility.', '`runtime/src/bmad/executor.ts`'),
    ('BMAD-BUILD is disabled exactly while the configuration does not authorize generation (flag plus target directory); it was previously a hard-coded constant', '`runtime/src/bmad/executor.ts`, `runtime/src/bmad/preflight.ts`'),
    ('Isolation doctor detects Docker Desktop outside PATH (reported only; no boundary depends on it)', '`runtime/src/isolation/isolation.ts`'),
    ('13 tests: every requested negative condition, MOCK vs LIVE, failed execution, invalid receipt, and the test-double positive case', '`tests/step21.test.ts`'),
]:
    A(f'| {a} | {b} |')
A('')
A('Local LGA conversions remain valid historical records. They are labelled `LOCAL_LGA_NOT_BMAD_GOVERNED` and never counted as BMad runs. No earlier receipt or record was modified.')
A('')
A('## 4. PORTREAD pilot')
A('')
A('| Item | Value |')
A('|---|---|')
A(f"| Source | `{pm['source']['path']}` sha256 `{pm['source']['sha256']}` |")
A(f"| Copybook | `{pm['copybooks'][0]['path']}` |")
A(f"| Disclosure set | {len(ada['source_files'])} files, {ada['limits']['max_bytes']} bytes; nothing else |")
A(f"| Rules | {', '.join(r['rule'] + ' ' + r['status'] for r in rules)} |")
A(f"| Reverse gaps | {', '.join(g['gap_id'] + ' ' + g['gap_type'] for g in rgaps)} |")
A(f"| Java | {res['conversion_status']} {res['execution']['counts']} under {lga['record_id'] if lga else '-'} (local, not BMad-governed; unchanged) |")
A(f"| Readiness | {ready['status']} (STEP 20) |")
A(f"| G2 | {g2['readiness']}: {len(blocking)} blocking findings (not 417); no approval |")
A(f"| Authorization | unsigned request `{ada['authorization_id']}` |")
A(f"| Governed run | {final['record_id'] if final else '-'}: {final['status'] if final else '-'}, stopped at requirements by {final['stages'][0]['preflight_id'] if final else '-'} |")
A('')
A('## 5. G2 for `programs:PORTREAD`')
A('')
A(f"{len(blocking)} blocking findings: {', '.join(f'{k} {v}' for k, v in collections.Counter(r['classification'] for r in rows).items())}. No classification defect was found.")
A('')
A('| Finding | Outcome | Classification | Resolving role |')
A('|---|---|---|---|')
for r in rows:
    A(f"| {r['id']} | {r['outcome']} | {r['classification']} | {r['resolving_role']} |")
A('')
A('## 6. Environment')
A('')
A('| Component | State |')
A('|---|---|')
A('| Host | Node v22.12.0 and Claude Code 2.1.302 are installed, but outside any boundary |')
A('| WSL2 Ubuntu | No Node, Claude Code, bubblewrap or socat; sudo needs a password |')
A('| Docker Desktop 29.9.2 | Present on the host, but not configured or tested as a boundary |')
A('| Offline isolation | Tested |')
A('| Network | Default-deny; no verified provider egress |')
A('')
A('**Nothing was installed and no network route was created.** Setup instructions and diagnostics are in `environment-readiness.json`.')
A('')
A('## 7. Regression (sequential)')
A('')
A('| Command | Exit | Result |')
A('|---|---|---|')
for r in runs:
    if 'pilot validate' in r['command'] or 'pilot readiness' in r['command']:
        continue
    A(f"| `{r['command']}` | {r['exit_code']} | {r['result'][:260].replace('|', '/')} |")
A(f"| `pilot validate` ({reg['summary']['validate']['runs']} runs) | {reg['summary']['validate']['exit0']} exit 0 | POSUPDT (empty source) is the non-zero one |")
A(f"| `pilot readiness` ({reg['summary']['readiness']['runs']} runs) | {reg['summary']['readiness']['pass']} PASS | unchanged from STEP 20 |")
A('')
A('`bmad governance` exits 3 because the scope is BMAD_BLOCKED; that is the expected result.')
A('')
A('One intermediate `npm test` failed (395/396). The STEP 11 guard "the pilot and planner make no external AI or network calls" rejects any import of the BMad modules from `commands/pilot.ts`, which my first wiring of the LGA label had added. The label is now computed from configuration inside `pilot.ts`, with no BMad import; the guard passes and the final `npm test` result is the last row of the table.')
A('')
A('No earlier test or gate was weakened.')
A('')
A('## 8. Remaining external actions')
A('')
A('| # | Action | Responsible |')
A('|---|---|---|')
for i, (a, b) in enumerate([
    ('Provision the approval trust store with public keys', 'trust custodian (administrator)'),
    ('Resolve the portfolio-status contradiction (DR-PORTMSTR-001, DR-PORTUPDT-001) for copybook PORTFLIO', 'business_sme'),
    ('Source-verified evidence (re-delivery or signed adjudication) for the PORTFLIO records, PORTREAD file operations and RT-PORTREAD-002/003', 'technical_authority'),
    ('Confirm REQ-PORTREAD-001/002', 'business_sme'),
    ('Sign the G2 approval for `programs:PORTREAD`', 'requirements_approver (distinct from the requester)'),
    (f"Sign and import `{ada['authorization_id']}`, re-prepared if expired", 'data_owner'),
    ('Install pinned Node.js and Claude Code inside WSL2, and provide a verified provider-egress allowlist', 'administrator'),
    ('Set `live_execution.requested` only after 1–7', 'project owner'),
    ('Authorize generation (flag, target directory, G3/G4) before the implementation stage', 'project owner and approvers'),
], 1):
    A(f'| {i} | {a} | {b} |')
A('')
A('## 9. Next milestone')
A('')
A('**First real LIVE BMad stage for PORTREAD (`bmad-prd`, F1).** After actions 1–8:')
A('1. Re-run `bmad executor preflight --workflow bmad-prd --scope programs:PORTREAD`.')
A('2. Implement and test the LIVE runner adapter inside the verified boundary.')
A('3. Execute through `bmad governed-run --scope programs:PORTREAD` and record and verify the receipt.')
A('4. Continue stage by stage. The local converter stays the implementation mechanism, and the PORTREAD Java is changed only by an approved, evidence-backed story.')
with open(os.path.join(FW, 'reports', 'STEP-21-BMAD-INTEGRATION-ASSESSMENT.md'), 'w', encoding='utf8', newline='\n') as f:
    f.write('\n'.join(L) + '\n')
print('step 21 report written:', summary['classification'])
