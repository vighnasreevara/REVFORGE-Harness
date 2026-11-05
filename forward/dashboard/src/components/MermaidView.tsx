// Renders a committed reverse-engineering Mermaid source. Mermaid runs with
// securityLevel 'strict' (labels sanitised, no click handlers or scripts) and
// without HTML labels. Only manifest-listed, hash-verified sources are rendered
// or shown; anything else is refused with its reason.
import { useEffect, useRef, useState } from 'react';
import { useEvidence } from '../evidence/EvidenceContext';
import { loadText, type TextResult } from '../evidence/loader';
import { isJsdom } from './GraphCanvas';
import { useDark } from './charts';
import { Badge } from './ui';

let counter = 0;

export function MermaidView({ path }: { path: string }) {
  const { manifest } = useEvidence().model ?? {};
  const { fetcher } = useEvidence();
  const dark = useDark();
  const ref = useRef<HTMLDivElement>(null);
  const [text, setText] = useState<string | null>(null);
  const [integrity, setIntegrity] = useState<string>('');
  const [state, setState] = useState<'loading' | 'rendered' | 'source-only' | 'error' | 'refused'>('loading');
  const [error, setError] = useState('');
  const [showSource, setShowSource] = useState(false);

  useEffect(() => {
    let alive = true;
    setState('loading');
    setText(null);
    setIntegrity('');
    if (ref.current) ref.current.innerHTML = '';
    if (!manifest) return;
    loadText(fetcher, manifest, path)
      .catch((e: unknown): TextResult => ({ ok: false, reason: 'missing', message: e instanceof Error ? e.message : String(e) }))
      .then(async (res) => {
      if (!alive) return;
      // Fail closed: unlisted, missing, altered or unverifiable sources are neither rendered nor shown.
      if (!res.ok) {
        setError(res.message);
        setIntegrity(res.integrity ?? '');
        setState('refused');
        return;
      }
      setText(res.text);
      setIntegrity(res.integrity);
      if (isJsdom()) {
        setState('source-only');
        return;
      }
      try {
        const { default: mermaid } = await import('mermaid');
        mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: dark ? 'dark' : 'default', flowchart: { htmlLabels: false }, maxTextSize: 200000, maxEdges: 2000 });
        const { svg } = await mermaid.render(`revforge-mermaid-${++counter}`, res.text);
        if (!alive || !ref.current) return;
        ref.current.innerHTML = svg;
        setState('rendered');
      } catch (e) {
        if (!alive) return;
        setError(e instanceof Error ? e.message : String(e));
        setState('error');
      }
    });
    return () => {
      alive = false;
    };
  }, [path, manifest, fetcher, dark]);

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
        {integrity && <Badge tone={integrity === 'verified' ? 'verified' : 'blocked'}>source {integrity === 'verified' ? 'hash-verified' : integrity}</Badge>}
        {state === 'loading' && <span className="text-slate-500">Rendering…</span>}
        {state === 'error' && <span className="text-rose-700 dark:text-rose-300">Mermaid could not render this source: {error}</span>}
        {state === 'refused' && (
          <span role="alert" className="text-rose-700 dark:text-rose-300">
            Diagram unavailable: {error}. Nothing is rendered from unverified evidence.
          </span>
        )}
        {text && (
          <button type="button" onClick={() => setShowSource((v) => !v)} aria-pressed={showSource} className="ml-auto rounded-full px-2 py-0.5 font-semibold ring-1 ring-slate-200 hover:bg-slate-50 dark:ring-slate-700 dark:hover:bg-slate-800">
            {showSource ? 'Hide source' : 'Show Mermaid source'}
          </button>
        )}
      </div>
      <div ref={ref} className={`overflow-auto rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950 ${state === 'rendered' ? '' : 'hidden'}`} />
      {(showSource || state === 'source-only' || state === 'error') && text && (
        <pre className="mt-2 max-h-[480px] overflow-auto rounded-xl bg-slate-900 p-3 text-[11px] leading-relaxed text-slate-100">{text}</pre>
      )}
    </div>
  );
}
