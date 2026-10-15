import React, { useState } from 'react';
import ReactECharts from 'echarts-for-react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { fetchEPIGrid, startOptimization } from '../api/client';
import { HelpPanel } from '../components/HelpPanel';
import { heatmapOption, scatterChartOption, THEME } from '../components/charts';

export const Optimizer: React.FC = () => {
  const [optimResult, setOptimResult] = useState<any>(null);
  const [isRunning, setIsRunning] = useState(false);

  // Fetch EPI heatmap grid
  const { data: gridData, isLoading: gridLoading } = useQuery({
    queryKey: ['epi-grid'],
    queryFn: () => fetchEPIGrid(),
  });

  // Optimisation mutation
  const optimMutation = useMutation({
    mutationFn: () => startOptimization({ n_generations: 50, pop_size: 100 }),
    onMutate: () => setIsRunning(true),
    onSuccess: (data) => {
      setOptimResult(data);
      setIsRunning(false);
    },
    onError: () => setIsRunning(false),
  });

  // Build EPI heatmap
  const epiHeatmapOpt = gridData ? (() => {
    const rpmValues = gridData.rpm_values.map((v: number) => Math.round(v));
    const loadValues = gridData.load_values.map((v: number) => v.toFixed(0));
    const values: [number, number, number][] = [];

    gridData.grid.forEach((pt: any) => {
      const xi = rpmValues.indexOf(Math.round(pt.rpm));
      const yi = loadValues.indexOf(pt.load_pct.toFixed(0));
      if (xi >= 0 && yi >= 0) {
        values.push([xi, yi, pt.epi]);
      }
    });

    return heatmapOption(rpmValues, loadValues, values, {
      xName: 'RPM',
      yName: 'Load %',
      minVal: 0,
      maxVal: 1,
    });
  })() : null;

  // Build Pareto front chart
  const paretoOpt = optimResult?.pareto_front ? (() => {
    const data: [number, number][] = optimResult.pareto_front.map((p: any) => [p.epi, p.wear_rate]);

    // Find knee point (recommended)
    const rec = optimResult.recommended_region;
    const kneeIdx = data.findIndex(
      (d: [number, number]) => Math.abs(d[0] - rec.epi) < 0.01
    );

    return scatterChartOption(data, {
      xName: 'EPI (higher = better)',
      yName: 'Wear Rate (lower = better)',
      highlightIdx: kneeIdx >= 0 ? kneeIdx : 0,
    });
  })() : null;

  const rec = optimResult?.recommended_region;

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
        {gridLoading ? (
          <div className="skeleton" style={{ minHeight: 350 }} />
        ) : epiHeatmapOpt ? (
          <ReactECharts option={epiHeatmapOpt} style={{ height: 350 }} opts={{ renderer: 'canvas' }} />
        ) : (
          <div className="skeleton" style={{ minHeight: 350 }} />
        )}
      </div>

      <div className="grid-2 mb-lg">
        {/* Pareto Front */}
        <div className="card card-screenshot">
          <div className="type-eyebrow ink-subtle mb-xs">Pareto Front</div>
          {paretoOpt ? (
            <ReactECharts option={paretoOpt} style={{ height: 250 }} opts={{ renderer: 'canvas' }} />
          ) : (
            <div style={{ minHeight: 250, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span className="type-body-sm ink-subtle">
                {isRunning ? 'Computing Pareto front…' : 'Run optimisation to see the trade-off curve'}
              </span>
            </div>
          )}
        </div>

        {/* Recommended Region */}
        <div className="card">
          <div className="type-eyebrow ink-subtle mb-xs">Recommended Sweet Spot</div>
          {rec ? (
            <>
              <div className="type-body mb-sm">
                <div className="flex justify-between mb-xs">
                  <span className="ink-muted">RPM Range</span>
                  <span className="type-mono">{rec.rpm_range[0]} – {rec.rpm_range[1]} rpm</span>
                </div>
                <div className="flex justify-between mb-xs">
                  <span className="ink-muted">Load Range</span>
                  <span className="type-mono">{rec.load_range[0]} – {rec.load_range[1]}%</span>
                </div>
                <div className="flex justify-between mb-xs">
                  <span className="ink-muted">Ignition Advance</span>
                  <span className="type-mono">{rec.ignition_advance_range[0]} – {rec.ignition_advance_range[1]}° BTDC</span>
                </div>
                <div className="flex justify-between mb-xs">
                  <span className="ink-muted">Target Lambda</span>
                  <span className="type-mono">{rec.lambda_range[0]} – {rec.lambda_range[1]}</span>
                </div>
                <div className="flex justify-between mb-xs">
                  <span className="ink-muted">Knock Probability</span>
                  <span className="type-mono">{(rec.knock_prob * 100).toFixed(1)}%</span>
                </div>
                <div className="flex justify-between mb-xs">
                  <span className="ink-muted">EPI Score</span>
                  <span className="type-mono" style={{ color: THEME.success }}>{rec.epi.toFixed(3)}</span>
                </div>
              </div>
              <div className="type-body-sm ink-muted" style={{ borderTop: '1px solid var(--color-hairline)', paddingTop: 'var(--space-sm)' }}>
                {optimResult.rationale}
              </div>
            </>
          ) : (
            <div className="type-body mb-sm">
              <div className="flex justify-between mb-xs">
                <span className="ink-muted">RPM Range</span>
                <span className="type-mono ink-tertiary">—</span>
              </div>
              <div className="flex justify-between mb-xs">
                <span className="ink-muted">Load Range</span>
                <span className="type-mono ink-tertiary">—</span>
              </div>
              <div className="flex justify-between mb-xs">
                <span className="ink-muted">Ignition Advance</span>
                <span className="type-mono ink-tertiary">—</span>
              </div>
              <div className="flex justify-between mb-xs">
                <span className="ink-muted">Target Lambda</span>
                <span className="type-mono ink-tertiary">—</span>
              </div>
              <div className="type-body-sm ink-subtle" style={{ borderTop: '1px solid var(--color-hairline)', paddingTop: 'var(--space-sm)' }}>
                Click "Run Optimisation" to compute the sweet spot.
              </div>
            </div>
          )}
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
            <div className="type-display-md" style={{ color: 'var(--color-semantic-success)' }}>
              {rec ? `${Math.round(842 / (rec.wear_rate * 5 || 1))}h` : '1240h'}
            </div>
            <div className="type-caption ink-subtle">
              {rec ? `+${Math.round(((842 / (rec.wear_rate * 5 || 1)) / 842 - 1) * 100)}% improvement` : '+47% improvement'}
            </div>
          </div>
        </div>
      </div>

      <button
        className="btn btn-primary"
        onClick={() => optimMutation.mutate()}
        disabled={isRunning}
        style={{ opacity: isRunning ? 0.6 : 1 }}
      >
        {isRunning ? '⏳ Computing…' : '🚀 Run Optimisation'}
      </button>
    </div>
  );
};
