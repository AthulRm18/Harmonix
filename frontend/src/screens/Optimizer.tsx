import React from 'react';
import { HelpPanel } from '../components/HelpPanel';

export const Optimizer: React.FC = () => {
  return (
    <div>
      <div className="page-header">
        <h1>Sweet Spot Optimizer</h1>
        <p className="ink-muted">Find the operating region that maximises performance while minimising wear</p>
      </div>

      <HelpPanel>
        The optimizer searches for the engine's "sweet spot" — the RPM and load combination
        that gives the best balance of power, efficiency, and longevity. The <strong>heatmap</strong> shows
        the Engine Performance Index (EPI) across operating conditions. The <strong>Pareto front</strong> shows
        the trade-off between performance and wear rate. The recommended region is highlighted
        with a before/after comparison of predicted remaining useful life.
      </HelpPanel>

      {/* Operating Map */}
      <div className="card card-screenshot mb-lg">
        <div className="type-eyebrow ink-subtle mb-xs">Operating Map — EPI Heatmap (RPM × Load)</div>
        <div className="sensor-chart-placeholder" style={{ minHeight: 350 }}>
          <span className="type-body-sm ink-subtle">RPM × Load heatmap with constraint boundaries</span>
        </div>
      </div>

      <div className="grid-2 mb-lg">
        {/* Pareto Front */}
        <div className="card card-screenshot">
          <div className="type-eyebrow ink-subtle mb-xs">Pareto Front</div>
          <div className="sensor-chart-placeholder" style={{ minHeight: 250 }}>
            <span className="type-body-sm ink-subtle">EPI vs Wear Rate trade-off</span>
          </div>
        </div>

        {/* Recommended Region */}
        <div className="card">
          <div className="type-eyebrow ink-subtle mb-xs">Recommended Sweet Spot</div>
          <div className="type-body mb-sm">
            <div className="flex justify-between mb-xs">
              <span className="ink-muted">RPM Range</span>
              <span className="type-mono">2200 – 3400 rpm</span>
            </div>
            <div className="flex justify-between mb-xs">
              <span className="ink-muted">Load Range</span>
              <span className="type-mono">40 – 65%</span>
            </div>
            <div className="flex justify-between mb-xs">
              <span className="ink-muted">Ignition Advance</span>
              <span className="type-mono">28 – 32° BTDC</span>
            </div>
            <div className="flex justify-between mb-xs">
              <span className="ink-muted">Target Lambda</span>
              <span className="type-mono">0.98 – 1.02</span>
            </div>
            <div className="flex justify-between mb-xs">
              <span className="ink-muted">Knock Probability</span>
              <span className="type-mono">{"< 3%"}</span>
            </div>
          </div>
          <div className="type-body-sm ink-muted" style={{ borderTop: '1px solid var(--color-hairline)', paddingTop: 'var(--space-sm)' }}>
            Operating in this region provides the best trade-off between efficiency (EPI: 0.82)
            and component longevity (wear rate: 0.02/1000h). The knock margin remains above 4 dB,
            and thermal stress stays within the optimal band.
          </div>
        </div>
      </div>

      {/* Before/After RUL Comparison */}
      <div className="card mb-lg">
        <div className="type-eyebrow ink-subtle mb-xs">Impact on Remaining Useful Life</div>
        <div className="grid-2" style={{ marginTop: 'var(--space-sm)' }}>
          <div style={{ textAlign: 'center', padding: 'var(--space-lg)' }}>
            <div className="type-caption ink-subtle mb-xs">Current Operating Point</div>
            <div className="type-display-md">842h</div>
            <div className="type-caption ink-subtle">Predicted RUL</div>
          </div>
          <div style={{ textAlign: 'center', padding: 'var(--space-lg)', borderLeft: '1px solid var(--color-hairline)' }}>
            <div className="type-caption ink-subtle mb-xs">At Recommended Sweet Spot</div>
            <div className="type-display-md" style={{ color: 'var(--color-semantic-success)' }}>1240h</div>
            <div className="type-caption ink-subtle">+47% improvement</div>
          </div>
        </div>
      </div>

      <button className="btn btn-primary">
        Run Optimisation
      </button>
    </div>
  );
};
