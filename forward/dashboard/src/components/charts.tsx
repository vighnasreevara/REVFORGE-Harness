// Horizontal bar distributions (Recharts). One value axis, thin rounded bars,
// a value label at each bar end, a hover tooltip, and a table view so no value
// is reachable only through colour or hover. Colour carries status (with the
// label beside it) or a single magnitude hue, never rank.
import { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useNavigate } from 'react-router-dom';
import { Table2, BarChart3 } from 'lucide-react';
import { TONE_FILL, type Tone } from '../lib/status';
import { int, pct } from '../lib/format';

export interface BarDatum {
  key: string;
  label: string;
  value: number;
  tone?: Tone;
  to?: string;
}

export function useDark(): boolean {
  const read = () => typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
  const [dark, setDark] = useState(read);
  useEffect(() => {
    const mo = new MutationObserver(() => setDark(read()));
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => mo.disconnect();
  }, []);
  return dark;
}

export function BarList({ data, label, tone = 'structural', total, height, labelWidth = 170 }: { data: BarDatum[]; label: string; tone?: Tone; total?: number; height?: number; labelWidth?: number }) {
  const [table, setTable] = useState(false);
  const dark = useDark();
  const navigate = useNavigate();
  const sum = total ?? data.reduce((t, d) => t + d.value, 0);
  const ink = dark ? '#c3c2b7' : '#52514e';
  const grid = dark ? '#2c2c2a' : '#e1e0d9';
  const fill = (d: BarDatum) => TONE_FILL[d.tone ?? tone][dark ? 1 : 0];
  const h = height ?? Math.max(90, data.length * 30 + 24);

  return (
    <figure aria-label={label} className="min-w-0">
      <div className="mb-1 flex justify-end">
        <button
          type="button"
          onClick={() => setTable((v) => !v)}
          aria-pressed={table}
          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 dark:text-slate-300 dark:ring-slate-700 dark:hover:bg-slate-800"
        >
          {table ? <BarChart3 aria-hidden className="h-3 w-3" /> : <Table2 aria-hidden className="h-3 w-3" />}
          {table ? 'Chart' : 'Table'}
        </button>
      </div>
      {table ? (
        <table className="w-full text-sm">
          <caption className="sr-only">{label}</caption>
          <thead>
            <tr className="text-left text-xs text-slate-500 dark:text-slate-400">
              <th className="py-1 font-semibold">Category</th>
              <th className="py-1 text-right font-semibold">Count</th>
              <th className="py-1 text-right font-semibold">Share</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.key} className="border-t border-slate-100 dark:border-slate-800">
                <td className="py-1 text-slate-800 dark:text-slate-100">
                  {d.to ? (
                    <button type="button" onClick={() => navigate(d.to!)} className="text-left text-blue-700 underline-offset-2 hover:underline dark:text-blue-300">
                      {d.label}
                    </button>
                  ) : (
                    d.label
                  )}
                </td>
                <td className="py-1 text-right tabular-nums">{int(d.value)}</td>
                <td className="py-1 text-right tabular-nums text-slate-500">{pct(d.value, sum)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div style={{ height: h }} className="w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ top: 0, right: 48, bottom: 0, left: 0 }} barCategoryGap={8}>
              <CartesianGrid horizontal={false} stroke={grid} strokeWidth={1} />
              <XAxis type="number" tick={{ fill: ink, fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <YAxis type="category" dataKey="label" width={labelWidth} tick={{ fill: ink, fontSize: 11 }} axisLine={false} tickLine={false} interval={0} />
              <Tooltip
                cursor={{ fill: dark ? 'rgba(255,255,255,0.06)' : 'rgba(11,11,11,0.05)' }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload as BarDatum;
                  return (
                    <div className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs shadow-md dark:border-slate-700 dark:bg-slate-900">
                      <div className="font-semibold text-slate-900 dark:text-white">{d.label}</div>
                      <div className="tabular-nums text-slate-600 dark:text-slate-300">
                        {int(d.value)} of {int(sum)} ({pct(d.value, sum)})
                      </div>
                      {d.to && <div className="text-slate-500">Click to open</div>}
                    </div>
                  );
                }}
              />
              <Bar
                dataKey="value"
                radius={[0, 4, 4, 0]}
                maxBarSize={16}
                isAnimationActive={false}
                cursor="pointer"
                onClick={(d: unknown) => {
                  const to = (d as { payload?: BarDatum }).payload?.to;
                  if (to) navigate(to);
                }}
              >
                {data.map((d) => (
                  <Cell key={d.key} fill={fill(d)} />
                ))}
                <LabelList dataKey="value" position="right" fill={ink} fontSize={11} formatter={(v: unknown) => int(Number(v))} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </figure>
  );
}

/** Segmented whole-of-total bar with a legend that names every segment and its count. */
export function Segmented({ data, label }: { data: BarDatum[]; label: string }) {
  const dark = useDark();
  const sum = data.reduce((t, d) => t + d.value, 0);
  return (
    <figure aria-label={label}>
      <div className="flex h-3 w-full gap-[2px] overflow-hidden rounded-full" role="img" aria-label={`${label}: ${data.map((d) => `${d.label} ${d.value}`).join(', ')}`}>
        {data.filter((d) => d.value > 0).map((d) => (
          <div key={d.key} title={`${d.label}: ${d.value}`} style={{ width: `${(d.value / (sum || 1)) * 100}%`, background: TONE_FILL[d.tone ?? 'structural'][dark ? 1 : 0] }} />
        ))}
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600 dark:text-slate-300">
        {data.map((d) => (
          <li key={d.key} className="inline-flex items-center gap-1.5">
            <span aria-hidden className="h-2.5 w-2.5 rounded-sm" style={{ background: TONE_FILL[d.tone ?? 'structural'][dark ? 1 : 0] }} />
            {d.label} <span className="font-semibold tabular-nums text-slate-800 dark:text-slate-100">{int(d.value)}</span>
          </li>
        ))}
      </ul>
    </figure>
  );
}
