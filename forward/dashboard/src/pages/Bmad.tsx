import { useModel } from '../evidence/EvidenceContext';
import { Badge, Card, Code, IdLink, KeyValue, Kpi, Notice, PageHeader, Sources, StatusBadge, Unavailable } from '../components/ui';
import { STAGE_STATUS, statusOf } from '../lib/status';
import { int } from '../lib/format';

const SRC = ['forward/reports/step-22/bmad-governance-status.json', 'forward/reports/step-23/bmad-governance-blockers.json', 'forward/reports/bmad-end-to-end/portread-governed-run.json', 'forward/integrations/bmad/bindings.json'];

export const WORKFLOW_NAME: Record<string, string> = {
  'BMAD-PRD': 'PRD',
  'BMAD-ARCH': 'Architecture',
  'BMAD-EPICS': 'Epics and Stories',
  'BMAD-SPRINT': 'Sprint Planning',
  'BMAD-BUILD': 'Build',
  'BMAD-REVIEW': 'Code Review',
};

const BLOCKER_GROUP: Record<string, string> = {
  g2_exact_scope: 'Approval and disclosure',
  workflow_state: 'Approval and disclosure',
  provider_authorization: 'Approval and disclosure',
  source_hashes_current: 'Approval and disclosure',
  authorized_content_only: 'Approval and disclosure',
  limits: 'Approval and disclosure',
  workspace_manifest: 'Approval and disclosure',
  runtime_execution_authorization: 'Isolation and runtime',
  network_isolation: 'Isolation and runtime',
  runner_inside_boundary: 'Isolation and runtime',
  enforceable_launch_boundary: 'Isolation and runtime',
  f6_independent_evidence: 'Independent evidence',
};

export default function Bmad() {
  const m = useModel();
  const b = m.bmad;
  if (!b) return <Unavailable what="BMad governance" paths={SRC.slice(0, 2)} />;
  const groups = [...new Set(b.blockers.map((x) => BLOCKER_GROUP[x.check] ?? 'Other'))];
  const expires = b.disclosure?.expiresAt ? new Date(b.disclosure.expiresAt) : null;
  const expired = expires ? expires.getTime() < Date.now() : null;
  return (
    <div className="space-y-4">
      <PageHeader title="BMad governance" subtitle="BMad lifecycle governance is mandatory for governed runs. This page reports its recorded state; it has no control that changes an approval, authorization or execution state." />
      <Notice tone="blocked">
        <strong>{b.status}</strong>. {int(b.metrics.configured_workflows)} workflows are configured; {int(b.metrics.authorized_workflows)} are authorized, {int(b.metrics.executed_live)} have executed live and {int(b.metrics.verified_receipts)} verified live receipts exist. BMad has not executed any workflow.
      </Notice>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Configured" value={int(b.metrics.configured_workflows)} hint={b.bindingsValid ? 'bindings valid' : 'bindings invalid'} />
        <Kpi label="Authorized" value={int(b.metrics.authorized_workflows)} />
        <Kpi label="Live executions" value={int(b.metrics.executed_live)} />
        <Kpi label="Verified live receipts" value={int(b.metrics.verified_receipts)} />
        <Kpi label="Blocked" value={int(b.metrics.blocked_workflows)} />
        <Kpi label="Governed runs / preflights" value={`${int(b.metrics.governed_runs)} / ${int(b.metrics.preflights)}`} hint="none compliant, none permitted" />
      </div>

      <Card title="Workflows">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <caption className="sr-only">BMad workflows and their governance state</caption>
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-slate-500">
                <th scope="col" className="py-1.5 pr-2 font-semibold">#</th>
                <th scope="col" className="py-1.5 pr-2 font-semibold">Workflow</th>
                <th scope="col" className="py-1.5 pr-2 font-semibold">Forward agent</th>
                <th scope="col" className="py-1.5 pr-2 font-semibold">Configured</th>
                <th scope="col" className="py-1.5 pr-2 font-semibold">Authorization</th>
                <th scope="col" className="py-1.5 pr-2 font-semibold">Execution</th>
                <th scope="col" className="py-1.5 pr-2 font-semibold">Verified receipt</th>
                <th scope="col" className="py-1.5 font-semibold">Gates required</th>
              </tr>
            </thead>
            <tbody>
              {b.workflows.map((w) => (
                <tr key={w.bindingId} className="border-t border-slate-100 align-top dark:border-slate-800">
                  <td className="py-2 pr-2 tabular-nums">{w.order}</td>
                  <td className="py-2 pr-2">
                    <div className="font-semibold">{WORKFLOW_NAME[w.bindingId] ?? w.bindingId}</div>
                    <div className="font-mono text-[11px] text-slate-500">{w.bindingId} · {w.workflowId}</div>
                    <div className="mt-1 max-w-md text-xs text-slate-600 dark:text-slate-300">{w.purpose}</div>
                  </td>
                  <td className="py-2 pr-2 font-mono text-xs">{w.agent}</td>
                  <td className="py-2 pr-2"><StatusBadge info={{ tone: 'structural', label: 'Configured' }} /></td>
                  <td className="py-2 pr-2"><StatusBadge info={w.authorizationId ? { tone: 'verified', label: w.authorizationId } : { tone: 'blocked', label: 'Not authorized' }} /></td>
                  <td className="py-2 pr-2">
                    <StatusBadge info={w.executed ? { tone: 'verified', label: 'Executed' } : statusOf(STAGE_STATUS, w.stageStatus)} />
                    {w.preflightId && <div className="mt-1 font-mono text-[11px] text-slate-500">preflight {w.preflightId}</div>}
                    {w.blockers.length > 0 && (
                      <details className="mt-1 text-xs">
                        <summary className="cursor-pointer text-blue-700 dark:text-blue-300">{w.blockers.length} blocker(s)</summary>
                        <ul className="mt-1 max-w-md list-disc space-y-1 pl-4 text-slate-600 dark:text-slate-300">
                          {w.blockers.map((x, i) => (
                            <li key={i} className="break-words">{x}</li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </td>
                  <td className="py-2 pr-2"><StatusBadge info={w.receiptId ? { tone: 'verified', label: w.receiptId } : { tone: 'neutral', label: 'None' }} /></td>
                  <td className="py-2 text-xs">{w.requiresGates.join(', ')}{w.mayWriteCode && <div className="text-slate-500">may write code</div>}<div className="text-slate-500">may approve: {w.mayApprove ? 'yes' : 'no'}</div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="Governance requirements">
          <KeyValue
            items={[
              ['Mandatory governance', <StatusBadge info={b.mandatory ? { tone: 'structural', label: 'Enabled' } : { tone: 'blocked', label: 'Not enabled' }} />],
              ['BMad release', <Code>{b.release}</Code>],
              ['Live execution requested', b.liveRequested ? 'yes' : 'no (bindings.json live_execution.requested is false)'],
              ['F2 independent mapping', <span><StatusBadge info={b.portread.f2.status === 'ACCEPTED' ? { tone: 'verified', label: 'Accepted' } : { tone: 'blocked', label: b.portread.f2.status }} /> <span className="text-xs">units {b.portread.f2.units.join(', ')}</span></span>],
              ['F6 independent testing', <StatusBadge info={b.portread.f6.status === 'ACCEPTED' ? { tone: 'verified', label: 'Accepted' } : { tone: 'blocked', label: `${b.portread.f6.status}: no accepted receipt` }} />],
              ['Historical local Java', <span><Badge tone="partial">{b.localJava.classification}</Badge> <span className="text-xs">{int(b.localJava.programs)} programs</span></span>],
            ]}
          />
          <ul className="mt-3 space-y-1 text-xs text-slate-600 dark:text-slate-300">
            {b.independentAgents.map((a) => (
              <li key={a.agent}>
                <span className="font-mono font-semibold">{a.agent}</span> stays outside BMad: {a.reason}
              </li>
            ))}
          </ul>
        </Card>
        <Card title="PORTREAD governed run">
          {b.governedRun ? (
            <KeyValue
              items={[
                ['Record', <Code>{b.governedRun.id}</Code>],
                ['Scope', <Code>{b.governedRun.scope}</Code>],
                ['Verdict', <StatusBadge info={{ tone: 'blocked', label: b.governedRun.status }} />],
                ['Mode requested', b.governedRun.mode],
                ['Exit code', b.portread.exitCode === null ? null : String(b.portread.exitCode)],
                ['Latest preflight', b.preflight ? <Code>{b.preflight}</Code> : null],
                ['Started / ended', `${b.governedRun.startedAt} → ${b.governedRun.endedAt}`],
                ['Fallback', `${b.governedRun.fallback}; local conversion invoked: ${b.governedRun.localConversionInvoked ? 'yes' : 'no'}`],
                ['Note', b.governedRun.note],
              ]}
            />
          ) : (
            <Unavailable what="PORTREAD governed run" paths={[SRC[2]]} />
          )}
        </Card>
      </div>

      <Card title={`Recorded blockers (${b.blockers.length}, preflight ${b.preflight ?? '—'})`}>
        <div className="grid gap-4 lg:grid-cols-3">
          {groups.map((g) => (
            <div key={g}>
              <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">{g}</h3>
              <ul className="mt-1 space-y-2">
                {b.blockers
                  .filter((x) => (BLOCKER_GROUP[x.check] ?? 'Other') === g)
                  .map((x) => (
                    <li key={x.check} className="text-xs">
                      <Badge tone="blocked">{x.check}</Badge>
                      <p className="mt-0.5 break-words text-slate-600 dark:text-slate-300">{x.detail}</p>
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </div>
        {b.disclosure && (
          <div className="mt-4 rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-800/60">
            Disclosure request <Code>{b.disclosure.authorizationId}</Code> is <strong>{b.disclosure.signed ? 'signed' : 'unsigned'}</strong>; recorded expiry {b.disclosure.expiresAt}
            {expired !== null && <> ({expired ? 'expired' : 'not yet expired'} by this viewer’s clock)</>}. {b.disclosure.note}.
          </div>
        )}
        <p className="mt-3 text-xs text-slate-500">
          Register records for these prerequisites: {b.registerRecords.map((r) => <span key={r} className="mr-2"><IdLink to={`/gaps/${r}`}>{r}</IdLink></span>)}
        </p>
      </Card>
      <Sources paths={SRC} />
    </div>
  );
}
