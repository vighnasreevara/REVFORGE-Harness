import { Link } from 'react-router-dom';
import { scrollToId, useHashScroll } from '../lib/hooks';
import { useModel } from '../evidence/EvidenceContext';
import { Badge, Card, IdLink, Kpi, LinkList, Notice, PageHeader, Sources, Unavailable } from '../components/ui';
import { BarList, Segmented } from '../components/charts';
import { categoryLabel, SEVERITY } from '../lib/status';
import { int } from '../lib/format';

const SRC = ['forward/reports/step-23/root-cause-groups.json', 'forward/reports/step-23/remediation-roadmap.json', 'forward/reports/step-23/ownership-matrix.json'];

export default function Roadmap() {
  const m = useModel();
  useHashScroll((h) => `group-${h}`);
  if (!m.groups) return <Unavailable what="root-cause groups" paths={[SRC[0]]} />;
  const groups = m.groups;
  const rm = m.roadmap;
  const phaseOf = new Map<string, string[]>();
  for (const p of rm?.phases ?? []) for (const g of p.groups) phaseOf.set(g, [...(phaseOf.get(g) ?? []), p.phase]);
  const unique = rm?.uniqueMembers ?? 0;

  return (
    <div className="space-y-4">
      <PageHeader title="Root cause and remediation roadmap" subtitle="The 569 open records grouped by shared root cause, and the five remediation phases that close them. No dates, budgets or named people are assumed: owners are roles." />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="Root-cause groups" value={int(groups.length)} />
        <Kpi label="Grouped records" value={int(groups.reduce((t, g) => t + g.memberCount, 0))} hint="each record in exactly one group" />
        <Kpi label="Phase memberships" value={rm ? int(rm.memberships) : 'unavailable'} hint={rm ? `${int(unique)} unique gap records` : undefined} />
        <Kpi label="Owner review required" value={m.owners ? int(m.owners.ownerReviewRequired) : 'unavailable'} hint="records whose root cause has no clear owner" to="/gaps?owner=OWNER_REVIEW_REQUIRED" />
      </div>

      {rm ? (
        <>
          <Notice tone="structural">
            {int(rm.memberships)} phase memberships represent {int(rm.uniqueMembers)} unique gap records, not {int(rm.memberships)} separate gaps.{' '}
            {rm.multiPhase.map((x) => (
              <span key={x.id}>
                <IdLink to={`/gaps/${x.id}`}>{x.id}</IdLink> (legacy equivalence) belongs to phases {x.phases.join(' and ')}.{' '}
              </span>
            ))}
          </Notice>
          <div className="grid gap-4 lg:grid-cols-5">
            {rm.phases.map((p) => (
              <Card key={p.phase} title={`Phase ${p.phase} · ${p.title}`} className="lg:col-span-1">
                <div className="text-2xl font-bold tabular-nums">{int(p.gaps)}</div>
                <div className="text-xs text-slate-500">gap memberships{p.recountedMembers !== p.gaps ? ` (recount ${p.recountedMembers}: mismatch)` : ''}</div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {p.groups.map((g) => (
                    <button key={g} type="button" onClick={() => scrollToId(`group-${g}`)} className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200">
                      {g}
                    </button>
                  ))}
                </div>
                <dl className="mt-3 space-y-2 text-xs">
                  <div><dt className="font-semibold text-slate-500">Roles</dt><dd>{p.roles.join(', ')}</dd></div>
                  <div><dt className="font-semibold text-slate-500">Prerequisites</dt><dd>{p.prerequisites}</dd></div>
                  <div><dt className="font-semibold text-slate-500">Required evidence</dt><dd>{p.requiredEvidence}</dd></div>
                  <div><dt className="font-semibold text-slate-500">Exit criteria</dt><dd>{p.exitCriteria}</dd></div>
                </dl>
              </Card>
            ))}
          </div>
        </>
      ) : (
        <Unavailable what="remediation roadmap" paths={[SRC[1]]} />
      )}

      <Card title="Group sizes">
        <BarList label="Gap records per root-cause group" labelWidth={330} data={[...groups].sort((a, b) => b.memberCount - a.memberCount).map((g) => ({ key: g.id, label: `${g.id} ${g.title}`, value: g.memberCount, to: `/gaps?group=${g.id}` }))} />
      </Card>

      <div className="space-y-3">
        {groups.map((g) => (
          <Card key={g.id} id={`group-${g.id}`} title={`${g.id} · ${g.title}`} right={<span className="flex flex-wrap gap-1.5">{(phaseOf.get(g.id) ?? []).map((p) => <Badge key={p} tone="structural">Phase {p}</Badge>)}<Badge>{categoryLabel(g.category)}</Badge></span>}>
            <div className="grid gap-4 lg:grid-cols-[16rem_minmax(0,1fr)]">
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-2xl font-bold tabular-nums">{int(g.memberCount)}</span> <span className="text-xs text-slate-500">records</span>
                </div>
                <Segmented label={`${g.id} severity mix`} data={['critical', 'high', 'medium', 'low'].filter((s) => g.severityMix[s]).map((s) => ({ key: s, label: SEVERITY[s].label, value: g.severityMix[s], tone: SEVERITY[s].tone }))} />
                <div className="text-xs">
                  <span className="font-semibold text-slate-500">Owner role</span> {g.owner}
                  {g.externalOwner && g.externalOwner !== g.owner && <> · external owner {g.externalOwner}</>}
                </div>
                <Link to={`/gaps?group=${g.id}`} className="text-xs font-semibold text-blue-700 hover:underline dark:text-blue-300">
                  Open {int(g.memberCount)} records →
                </Link>
              </div>
              <dl className="grid gap-2 text-xs sm:grid-cols-2">
                <div><dt className="font-semibold text-slate-500">Programs affected ({g.programs.length})</dt><dd className="mt-0.5"><LinkList ids={g.programs} to={(p) => `/programs/${p}`} limit={20} /></dd></div>
                <div><dt className="font-semibold text-slate-500">Business rules ({g.rules.length})</dt><dd className="mt-0.5"><LinkList ids={g.rules} to={(r) => `/rules/${r}`} limit={20} /></dd></div>
                <div><dt className="font-semibold text-slate-500">Dependencies</dt><dd className="mt-0.5">{g.dependencies.length ? <LinkList ids={g.dependencies} to={(d) => `/dependencies?focus=${d}`} /> : 'none recorded'}</dd></div>
                <div><dt className="font-semibold text-slate-500">Required resolution</dt><dd className="mt-0.5">{g.resolutionRequirements}</dd></div>
                <div className="sm:col-span-2"><dt className="font-semibold text-slate-500">Closure evidence</dt><dd className="mt-0.5">{g.validationEvidence}</dd></div>
              </dl>
            </div>
          </Card>
        ))}
      </div>

      {m.owners && (
        <Card title="Ownership matrix">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <caption className="sr-only">Owner roles, their groups and approvers</caption>
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-slate-500">
                  <th scope="col" className="py-1 font-semibold">Role</th>
                  <th scope="col" className="py-1 text-right font-semibold">Records</th>
                  <th scope="col" className="py-1 pl-3 font-semibold">Groups</th>
                  <th scope="col" className="py-1 font-semibold">Approvers</th>
                </tr>
              </thead>
              <tbody>
                {m.owners.roles.map((r) => (
                  <tr key={r.role} className="border-t border-slate-100 align-top dark:border-slate-800">
                    <td className="py-1.5">{r.role === 'OWNER_REVIEW_REQUIRED' ? <Badge tone="partial">{r.role}</Badge> : r.role}</td>
                    <td className="py-1.5 text-right tabular-nums">{int(r.gaps)}</td>
                    <td className="py-1.5 pl-3 font-mono text-xs">{r.groups.join(', ')}</td>
                    <td className="py-1.5 text-xs">{r.approvers.join('; ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-slate-500">{m.owners.names}</p>
        </Card>
      )}
      <Sources paths={SRC} />
    </div>
  );
}
