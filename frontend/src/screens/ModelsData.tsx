import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchSensors, fetchModels } from '../api/client';
import { HelpPanel } from '../components/HelpPanel';

export const ModelsData: React.FC = () => {
  const { data: sensorsData, isLoading: sensorsLoading } = useQuery({
    queryKey: ['sensors'],
    queryFn: fetchSensors,
  });

  const { data: modelsData, isLoading: modelsLoading } = useQuery({
    queryKey: ['models'],
    queryFn: fetchModels,
  });

  const sensors = sensorsData?.sensors || [];
  const models = modelsData?.models || [];

  return (
    <div>
      <div className="page-header">
        <h1>Models & Data</h1>
        <p className="ink-muted">Model comparison, sensor registry, and dataset documentation</p>
      </div>

      <HelpPanel>
        Compare the three classification models (SVM, ANN, CNN) side by side.
        The sensor registry shows all data streams with their provenance (real vs synthetic).
        Every claim about data origin is transparent and verifiable.
      </HelpPanel>

      {/* Model Comparison Table */}
      <div className="card card-screenshot mb-lg">
        <div className="type-eyebrow ink-subtle mb-sm">Model Comparison</div>
        {modelsLoading ? (
          <div className="skeleton" style={{ height: 200 }} />
        ) : models.length === 0 ? (
          <table className="data-table">
            <thead>
              <tr>
                <th>Model</th>
                <th>Type</th>
                <th>Accuracy</th>
                <th>Macro-F1</th>
                <th>Latency</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {[
                { name: 'CNN Spectrogram Classifier', type: 'CNN', acc: '—', f1: '—', lat: '—' },
                { name: 'SVM RBF Classifier', type: 'SVM', acc: '—', f1: '—', lat: '—' },
                { name: 'ANN Softmax Classifier', type: 'ANN', acc: '—', f1: '—', lat: '—' },
              ].map((m) => (
                <tr key={m.name}>
                  <td className="type-body-sm">{m.name}</td>
                  <td><span className="badge">{m.type}</span></td>
                  <td className="type-mono">{m.acc}</td>
                  <td className="type-mono">{m.f1}</td>
                  <td className="type-mono">{m.lat}</td>
                  <td><span className="badge">Not trained</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Model</th>
                <th>Type</th>
                <th>Accuracy</th>
                <th>Macro-F1</th>
                <th>Latency</th>
                <th>Version</th>
              </tr>
            </thead>
            <tbody>
              {models.map((m: any) => (
                <tr key={m.id}>
                  <td className="type-body-sm">{m.name}</td>
                  <td><span className="badge">{m.model_type}</span></td>
                  <td className="type-mono">{m.metrics?.accuracy?.toFixed(3) || '—'}</td>
                  <td className="type-mono">{m.metrics?.macro_f1?.toFixed(3) || '—'}</td>
                  <td className="type-mono">{m.metrics?.latency_ms ? `${m.metrics.latency_ms}ms` : '—'}</td>
                  <td className="type-caption ink-subtle">{m.version}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Confusion Matrices Placeholder */}
      <div className="grid-3 mb-lg">
        {['CNN', 'SVM', 'ANN'].map((model) => (
          <div key={model} className="card card-screenshot">
            <div className="type-eyebrow ink-subtle mb-xs">{model} Confusion Matrix</div>
            <div className="sensor-chart-placeholder" style={{ minHeight: 200 }}>
              <span className="type-body-sm ink-subtle">Confusion matrix heatmap</span>
            </div>
          </div>
        ))}
      </div>

      {/* Sensor Registry */}
      <div className="card card-screenshot mb-lg">
        <div className="type-eyebrow ink-subtle mb-sm">
          Sensor Registry ({sensors.length} streams)
        </div>
        {sensorsLoading ? (
          <div className="skeleton" style={{ height: 400 }} />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Name</th>
                  <th>Unit</th>
                  <th>Rate</th>
                  <th>Category</th>
                  <th>Provenance</th>
                  <th>OBD PID</th>
                </tr>
              </thead>
              <tbody>
                {sensors.map((s: any) => (
                  <tr key={s.id}>
                    <td className="type-mono">{s.id}</td>
                    <td className="type-body-sm">{s.name}</td>
                    <td className="type-mono">{s.unit}</td>
                    <td className="type-mono">{s.sample_rate >= 1000 ? `${s.sample_rate / 1000}k` : s.sample_rate} Hz</td>
                    <td><span className="badge">{s.category}</span></td>
                    <td>
                      <span className={`badge ${s.provenance === 'real' ? 'badge-success' : ''}`}>
                        {s.provenance}
                      </span>
                    </td>
                    <td className="type-mono ink-subtle">{s.obd_pid || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Dataset Documentation */}
      <div className="card">
        <div className="type-eyebrow ink-subtle mb-sm">Dataset Sources</div>
        <div className="type-body-sm ink-muted">
          <p className="mb-sm">
            <strong>Synthetic data</strong> is generated by a physics-informed engine simulator
            (4-cylinder, firing order 1-3-4-2, Wiebe combustion model). Fault scenarios are
            injected with known onset times and severities for ground-truth evaluation.
          </p>
          <p className="mb-sm">
            <strong>Hybrid data</strong> uses real OBD-II distributions from public driving logs
            combined with synthetic fault injection. The base distributions (RPM, speed, throttle,
            coolant temp) are derived from real-world data.
          </p>
          <p>
            <strong>NASA C-MAPSS</strong> is used solely to validate the prognosis architecture.
            ⚠️ This is turbofan data, not internal combustion engine data.
          </p>
        </div>
      </div>
    </div>
  );
};
