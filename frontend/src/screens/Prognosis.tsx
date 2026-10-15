import React from 'react';
import { HelpPanel } from '../components/HelpPanel';

export const Prognosis: React.FC = () => {
  return (
    <div>
      <div className="page-header">
        <h1>Prognosis</h1>
        <p className="ink-muted">Health index trend, remaining useful life, and failure probability</p>
      </div>

      <HelpPanel>
        This screen predicts the engine's future health. The <strong>Health Index</strong> (0–1)
        tracks overall condition over time. <strong>RUL</strong> (Remaining Useful Life) estimates
        how long until maintenance is needed, with a confidence band showing uncertainty.
        The <strong>failure probability gauge</strong> shows the chance of failure within the next
        prediction horizon.
      </HelpPanel>

      {/* Health Index Chart */}
      <div className="card card-screenshot mb-lg">
        <div className="type-eyebrow ink-subtle mb-xs">Health Index Over Time</div>
        <div className="sensor-chart-placeholder" style={{ minHeight: 250 }}>
          <span className="type-body-sm ink-subtle">HI(t) trend with degradation curve</span>
        </div>
      </div>

      <div className="grid-3 mb-lg">
        {/* RUL */}
        <div className="card">
          <div className="type-eyebrow ink-subtle mb-xs">Remaining Useful Life</div>
          <div className="type-display-md" style={{ color: 'var(--color-semantic-success)' }}>
            842h
          </div>
          <div className="type-caption ink-subtle">95% CI: [720h, 980h]</div>
        </div>

        {/* Failure Probability */}
        <div className="card">
          <div className="type-eyebrow ink-subtle mb-xs">P(Failure within 100h)</div>
          <div className="type-display-md">2.1%</div>
          <div className="type-caption ink-subtle">Very low risk</div>
        </div>

        {/* Current Health */}
        <div className="card">
          <div className="type-eyebrow ink-subtle mb-xs">Current Health Index</div>
          <div className="type-display-md">0.94</div>
          <div className="type-caption ink-subtle">Good condition</div>
        </div>
      </div>

      {/* RUL Fan Chart */}
      <div className="card card-screenshot mb-lg">
        <div className="type-eyebrow ink-subtle mb-xs">RUL Prediction with Confidence Fan</div>
        <div className="sensor-chart-placeholder" style={{ minHeight: 250 }}>
          <span className="type-body-sm ink-subtle">RUL extrapolation with uncertainty bands</span>
        </div>
      </div>

      {/* Component Wear Trends */}
      <div className="card mb-lg">
        <div className="type-eyebrow ink-subtle mb-xs">Component Wear Trends</div>
        <div className="grid-2" style={{ marginTop: 'var(--space-sm)' }}>
          {['Valve Train', 'Ignition System', 'Combustion Quality', 'Bearings'].map((comp) => (
            <div key={comp} className="flex items-center gap-sm" style={{ padding: 'var(--space-xs) 0' }}>
              <span className="type-body-sm" style={{ width: 140 }}>{comp}</span>
              <div style={{
                flex: 1, height: 6, background: 'var(--color-hairline-strong)',
                borderRadius: 'var(--rounded-pill)', overflow: 'hidden'
              }}>
                <div style={{
                  height: '100%',
                  width: `${85 + Math.random() * 15}%`,
                  background: 'var(--color-primary)',
                  borderRadius: 'var(--rounded-pill)',
                }} />
              </div>
              <span className="type-mono ink-subtle" style={{ width: 40, textAlign: 'right' }}>
                {(0.85 + Math.random() * 0.15).toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
