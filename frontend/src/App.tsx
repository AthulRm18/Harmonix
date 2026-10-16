import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { Sidebar } from './components/Sidebar';
import { ReplayDashboard } from './screens/ReplayDashboard';
import { SignaturesLab } from './screens/SignaturesLab';
import { Diagnosis } from './screens/Diagnosis';
import { Prognosis } from './screens/Prognosis';
import { Optimizer } from './screens/Optimizer';
import { ModelsData } from './screens/ModelsData';
import { SensorIntelligence } from './screens/SensorIntelligence';
import { GlobalTelemetryBar } from './components/GlobalTelemetryBar';
import { fetchRuns } from './api/client';
import { useReplayStore } from './state/replayStore';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const AppContent: React.FC = () => {
  const { runId, setRunId, setDuration } = useReplayStore();

  const { data: runsData } = useQuery({
    queryKey: ['runs'],
    queryFn: () => fetchRuns(),
  });

  useEffect(() => {
    if (!runId && runsData?.runs?.length > 0) {
      const defaultRun = runsData.runs[0];
      setRunId(defaultRun.id);
      if (defaultRun.duration_s) {
        setDuration(defaultRun.duration_s);
      }
    }
  }, [runId, runsData, setRunId, setDuration]);

  return (
    <BrowserRouter>
      <div style={{ display: 'flex', width: '100%', minHeight: '100vh' }}>
        <Sidebar />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <GlobalTelemetryBar />
          <main className="main-content" id="main-content" role="main">
            <Routes>
              <Route path="/" element={<ReplayDashboard />} />
              <Route path="/signatures" element={<SignaturesLab />} />
              <Route path="/sensors" element={<SensorIntelligence />} />
              <Route path="/diagnosis" element={<Diagnosis />} />
              <Route path="/prognosis" element={<Prognosis />} />
              <Route path="/optimizer" element={<Optimizer />} />
              <Route path="/models" element={<ModelsData />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
      </div>
    </BrowserRouter>
  );
};

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  );
};

export default App;

