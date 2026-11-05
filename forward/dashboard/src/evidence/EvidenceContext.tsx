import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { browserFetcher, loadBundle, type Fetcher } from './loader';
import { buildModel } from './model';
import type { Model } from './types';

interface EvidenceState {
  status: 'loading' | 'ready' | 'error';
  model: Model | null;
  fetcher: Fetcher;
  error?: string;
}

const Ctx = createContext<EvidenceState>({ status: 'loading', model: null, fetcher: browserFetcher });

export function EvidenceProvider({ children, fetcher = browserFetcher, model: preset }: { children: ReactNode; fetcher?: Fetcher; model?: Model }) {
  const [state, setState] = useState<EvidenceState>(preset ? { status: 'ready', model: preset, fetcher } : { status: 'loading', model: null, fetcher });
  useEffect(() => {
    if (preset) return;
    let live = true;
    loadBundle(fetcher)
      .then((bundle) => live && setState({ status: 'ready', model: buildModel(bundle), fetcher }))
      .catch((e: unknown) => live && setState({ status: 'error', model: null, fetcher, error: e instanceof Error ? e.message : String(e) }));
    return () => {
      live = false;
    };
  }, [fetcher, preset]);
  return <Ctx.Provider value={state}>{children}</Ctx.Provider>;
}

export const useEvidence = () => useContext(Ctx);

/** For pages, which render only once the model is ready. */
export function useModel(): Model {
  const { model } = useContext(Ctx);
  if (!model) throw new Error('evidence model not loaded');
  return model;
}

export function sourcePath(model: Model, key: string): string {
  return model.manifest?.sources.find((s) => s.key === key)?.path ?? key;
}
