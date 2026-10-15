import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Sidebar } from './components/Sidebar';
import { ReplayDashboard } from './screens/ReplayDashboard';
import { SignaturesLab } from './screens/SignaturesLab';
import { Diagnosis } from './screens/Diagnosis';
import { Prognosis } from './screens/Prognosis';
import { Optimizer } from './screens/Optimizer';
import { ModelsData } from './screens/ModelsData';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <div style={{ display: 'flex', width: '100%', minHeight: '100vh' }}>
          <Sidebar />
          <main className="main-content" id="main-content" role="main">
            <Routes>
              <Route path="/" element={<ReplayDashboard />} />
              <Route path="/signatures" element={<SignaturesLab />} />
              <Route path="/diagnosis" element={<Diagnosis />} />
              <Route path="/prognosis" element={<Prognosis />} />
              <Route path="/optimizer" element={<Optimizer />} />
              <Route path="/models" element={<ModelsData />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

export default App;
