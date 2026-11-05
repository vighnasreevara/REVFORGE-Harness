import { Link } from 'react-router-dom';
import { useModel } from '../evidence/EvidenceContext';
import { Badge, Card, Notice, PageHeader, Source, StatusBadge } from '../components/ui';
import { useHashScroll } from '../lib/hooks';
import { int, shortSha } from '../lib/format';

// Committed artifact paths for the handover index (documentation links, not metrics).
const REVERSE = [
  ['output/inventory/inventory_artifact.json', 'Agent 1 inventory: files, programs, call graph'],
  ['output/parser/parser_artifact.json', 'Agent 2 structure: divisions, paragraphs, statements'],
  ['output/data/data_artifact.json', 'Agent 3 data dictionary and record layouts'],
  ['output/logic/logic_artifact.json', 'Agent 4 control flow and pseudocode'],
  ['output/rules/rules_artifact.json', 'Agent 5 business rules (154)'],
  ['output/diagram/diagrams_artifact.json', 'Agent 6 diagrams (65 Mermaid sources)'],
  ['output/final_report/brd.md', 'Agent 7 business requirements document'],
  ['output/final_report/gaps_register.json', 'Reverse gaps and assumptions register (217 historical)'],
];
const FORWARD = [
  ['forward/reports/STEP-22-FINAL-RECONCILIATION.md', 'STEP-22 final reverse-forward reconciliation'],
  ['forward/reports/STEP-23-MASTER-GAP-REGISTER.md', 'STEP-23 master gap register report'],
  ['forward/reports/step-23/master-gap-register.csv', 'Register as CSV (569 records)'],
  ['forward/reports/BMAD-END-TO-END-INTEGRATION-ASSESSMENT.md', 'BMad end-to-end integration assessment'],
  ['forward/reports/GIT-REGRESSION-STABILIZATION.md', 'Git tracking policy and recovery'],
  ['forward/README.md', 'Forward engineering harness: runtime, contracts, agents'],
  ['forward/docs/BMAD-INTEGRATION-OPERATIONS.md', 'BMad integration operations'],
];

export default function Handover() {
  const m = useModel();
  useHashScroll();
  const group = (id: string) => m.groups?.find((g) => g.id === id)?.memberCount;
  const n = (v: number | undefined) => (v === undefined ? 'unavailable' : int(v));
  const limits: [string, string, string][] = [
    ['Legacy runtime equivalence unavailable', `No COBOL compiler or captured legacy execution: equivalence is ${m.summary.cobolEquivalence ?? 'not recorded'} for every program and rule.`, '/gaps?group=RCG-20'],
    ['Missing source and copybooks', `${n(group('RCG-03'))} records for missing COPY/INCLUDE members, ${n(group('RCG-04'))} for PERFORMed paragraphs missing from the source, ${n(group('RCG-05'))} for undeclared names, and POSUPDT's empty source (${n(group('RCG-19'))}).`, '/gaps?category=SOURCE_MISSING'],
    ['DB2 and CICS dependencies', `${n(group('RCG-01'))} records need a DB2 runtime and precompiler; ${n(group('RCG-02'))} need a CICS environment.`, '/gaps?category=EXTERNAL_DEPENDENCY'],
    ['External platform services', `${n(group('RCG-08'))} records for legacy environment definitions and ${n(group('RCG-09'))} for platform services and utilities.`, '/gaps?owner=Platform%20engineering'],
    ['Business SME decisions', `${n(m.gaps?.filter((g) => g.category === 'BUSINESS_DECISION_REQUIRED').length)} records need a signed business decision.`, '/gaps?category=BUSINESS_DECISION_REQUIRED'],
    ['BMad authorization and live execution', `${m.bmad?.status ?? 'not recorded'}: G2 approval, a signed disclosure authorization, an egress component and a runner inside the isolation boundary are all missing.`, '/bmad'],
    ['Unverified data and runtime semantics', `${n(group('RCG-07'))} record layouts not determinable, ${n(group('RCG-18'))} unsupported constructs; byte-level data and file runtime behaviour are unverified without legacy runs.`, '/gaps?category=DATA_LAYOUT_GAP'],
  ];
  return (
    <div className="space-y-4">
      <PageHeader title="Handover and evidence" subtitle="A read-only index of what exists, where its evidence lives, what is still blocked and what has to happen next. Intended as the starting point for the STEP-25 handover." />
      <Notice tone="unestablished">
        <strong>COBOL-to-Java behavioral equivalence has not been established.</strong> All statements below describe recorded engineering evidence at commit <span className="font-mono">{shortSha(m.baselineCommit)}</span>.
      </Notice>

      <Card title="Project architecture">
        <ol className="grid gap-3 text-sm md:grid-cols-4">
          {[
            ['Reverse engineering', 'Seven agents (inventory, parser, data, logic, rules, diagram, synthesis) read the restricted COBOL source and write the committed artifacts in output/, with permanent IDs from the Neo4j registry.'],
            ['Forward engineering harness', 'TypeScript runtime in forward/runtime with contracts, gates G0-G8 and agents F1-F7. Local Java generation is under historical local authorizations (LGA) and git-ignored.'],
            ['Reconciliation and register', 'STEP-22 reconciles every reverse element with the Java; STEP-23 consolidates every open gap into one register with root causes, owners and a roadmap.'],
            ['Governance', 'BMad lifecycle governance is mandatory; F2 mapping and F6 testing stay independent of BMad. No BMad workflow has executed.'],
          ].map(([t, d], i) => (
            <li key={t} className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
              <div className="text-xs font-bold text-slate-500">{i + 1}</div>
              <div className="font-semibold">{t}</div>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{d}</p>
            </li>
          ))}
        </ol>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="Reverse engineering artifacts">
          <ul className="space-y-1.5 text-sm">
            {REVERSE.map(([p, d]) => (
              <li key={p}><Source path={p} /><div className="text-xs text-slate-600 dark:text-slate-300">{d}</div></li>
            ))}
          </ul>
        </Card>
        <Card title="Forward engineering artifacts">
          <ul className="space-y-1.5 text-sm">
            {FORWARD.map(([p, d]) => (
              <li key={p}><Source path={p} /><div className="text-xs text-slate-600 dark:text-slate-300">{d}</div></li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card title="Source provenance">
          <ul className="list-disc space-y-1 pl-5 text-sm">
            <li>COBOL source: restricted reference checkout (<code>references/</code>), never committed or sent to external services. Each program carries its SHA-256 and permanent file ID.</li>
            <li>Generated Java: <code>forward/generated/</code>, git-ignored; only the hand-written runtime library is tracked.</li>
            <li>Every dashboard value comes from a committed file listed on the <Link to="/evidence" className="text-blue-700 underline dark:text-blue-300">evidence validation</Link> page, hash-verified at load.</li>
          </ul>
        </Card>
        <Card title="Final reconciliation">
          <ul className="space-y-1 text-sm">
            {m.summary.acceptance.map((a) => (
              <li key={a.criterion} className="flex items-start gap-2">
                <StatusBadge info={a.met ? { tone: 'verified', label: 'met' } : { tone: 'blocked', label: 'not met' }} />
                <span>{a.criterion}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-slate-500">Acceptance of the STEP-22 reconciliation itself, as recorded; it is not acceptance of the modernization.</p>
        </Card>
        <Card title="Register, governance and tests">
          <ul className="space-y-1.5 text-sm">
            <li><Link to="/gaps" className="font-semibold text-blue-700 hover:underline dark:text-blue-300">{n(m.gaps?.length)} open gap records</Link> in {n(m.groups?.length)} root-cause groups</li>
            <li><Link to="/bmad" className="font-semibold text-blue-700 hover:underline dark:text-blue-300">BMad</Link>: <Badge tone="blocked">{m.bmad?.status ?? 'not recorded'}</Badge></li>
            <li><Link to="/testing" className="font-semibold text-blue-700 hover:underline dark:text-blue-300">Recorded tests</Link>: npm test {String(m.testing?.summary.npm_test ?? '—').replace(/ℹ /g, '').trim()} · runtime {String(m.testing?.summary.runtime_tests ?? '—')}</li>
            <li>Readiness {m.summary.ratios.readiness_pass ? `${m.summary.ratios.readiness_pass.numerator}/${m.summary.ratios.readiness_pass.denominator}` : '—'} · validation {m.summary.ratios.validation_pass ? `${m.summary.ratios.validation_pass.numerator}/${m.summary.ratios.validation_pass.denominator}` : '—'}</li>
          </ul>
        </Card>
      </div>

      <Card title="Remaining blockers and recommended next actions">
        {m.roadmap ? (
          <ol className="space-y-2 text-sm">
            {m.roadmap.phases.map((p) => (
              <li key={p.phase} className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                <div className="font-semibold">
                  Phase {p.phase} · {p.title} <span className="font-normal text-slate-500">({int(p.gaps)} memberships; {p.roles.join(', ')})</span>
                </div>
                <div className="text-xs text-slate-600 dark:text-slate-300"><strong>Needs:</strong> {p.requiredEvidence}. <strong>Done when:</strong> {p.exitCriteria}.</div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm italic text-slate-500">Roadmap unavailable.</p>
        )}
        <Link to="/roadmap" className="mt-2 inline-block text-xs font-semibold text-blue-700 hover:underline dark:text-blue-300">Root causes and roadmap →</Link>
      </Card>

      <Card title="Limitations" id="limitations">
        <ul className="space-y-2 text-sm">
          {limits.map(([t, d, to]) => (
            <li key={t} className="flex flex-col gap-0.5 border-b border-slate-100 pb-2 dark:border-slate-800">
              <span className="font-semibold">{t}</span>
              <span className="text-slate-600 dark:text-slate-300">{d}</span>
              <Link to={to} className="text-xs font-semibold text-blue-700 hover:underline dark:text-blue-300">Related records →</Link>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
