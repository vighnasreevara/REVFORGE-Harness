import { HashRouter, Route, Routes, useLocation } from 'react-router-dom';
import { useEffect, type ReactNode } from 'react';
import { EvidenceProvider, useEvidence } from './evidence/EvidenceContext';
import type { Fetcher } from './evidence/loader';
import type { Model } from './evidence/types';
import { Layout } from './components/Layout';
import { Card, Unavailable } from './components/ui';
import Overview from './pages/Overview';
import Comparison from './pages/Comparison';
import { ProgramDetail, ProgramList } from './pages/Programs';
import { RuleDetail, RuleList } from './pages/Rules';
import { GapRegister } from './pages/Gaps';
import Dependencies from './pages/Dependencies';
import Roadmap from './pages/Roadmap';
import { DiagramDetail, DiagramList } from './pages/Diagrams';
import Bmad from './pages/Bmad';
import Testing from './pages/Testing';
import Handover from './pages/Handover';
import EvidencePage from './pages/EvidencePage';

function Gate({ children }: { children: ReactNode }) {
  const { status, model, error } = useEvidence();
  if (status === 'loading')
    return (
      <Card>
        <p role="status" className="text-sm text-slate-600 dark:text-slate-300">Loading committed evidence…</p>
      </Card>
    );
  if (status === 'error' || !model) return <Unavailable what={`evidence could not be loaded (${error ?? 'unknown error'})`} paths={['forward/dashboard/public/evidence/manifest.json']} />;
  if (!model.manifest) return <Unavailable what="evidence manifest" paths={['forward/dashboard/public/evidence/manifest.json (run npm run evidence)']} />;
  return <>{children}</>;
}

/** Moves focus to the page and resets scroll on navigation, for keyboard and screen-reader users. */
function RouteFocus() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo?.(0, 0);
    document.getElementById('main')?.focus({ preventScroll: true });
  }, [pathname]);
  return null;
}

export function AppRoutes() {
  return (
    <Layout>
      <RouteFocus />
      <Gate>
        <Routes>
          <Route path="/" element={<Overview />} />
          <Route path="/comparison" element={<Comparison />} />
          <Route path="/programs" element={<ProgramList />} />
          <Route path="/programs/:id" element={<ProgramDetail />} />
          <Route path="/rules" element={<RuleList />} />
          <Route path="/rules/:id" element={<RuleDetail />} />
          <Route path="/gaps" element={<GapRegister />} />
          <Route path="/gaps/:id" element={<GapRegister />} />
          <Route path="/dependencies" element={<Dependencies />} />
          <Route path="/roadmap" element={<Roadmap />} />
          <Route path="/diagrams" element={<DiagramList />} />
          <Route path="/diagrams/:id" element={<DiagramDetail />} />
          <Route path="/bmad" element={<Bmad />} />
          <Route path="/testing" element={<Testing />} />
          <Route path="/handover" element={<Handover />} />
          <Route path="/evidence" element={<EvidencePage />} />
          <Route path="*" element={<Card><p className="text-sm">This page does not exist.</p></Card>} />
        </Routes>
      </Gate>
    </Layout>
  );
}

export default function App({ fetcher, model }: { fetcher?: Fetcher; model?: Model }) {
  return (
    <EvidenceProvider fetcher={fetcher} model={model}>
      <HashRouter>
        <AppRoutes />
      </HashRouter>
    </EvidenceProvider>
  );
}
