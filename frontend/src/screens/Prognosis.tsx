import React from 'react';
import ReactECharts from 'echarts-for-react';
import { useQuery } from '@tanstack/react-query';
import { fetchPrognosis } from '../api/client';
import { useReplayStore } from '../state/replayStore';
import { HelpPanel } from '../components/HelpPanel';
import { baseOption, gaugeOption, THEME } from '../components/charts';

// Generate demo prognosis data
function demoPrognosisData(nPoints = 50) {
  const data = [];
  for (let i = 0; i < nPoints; i++) {
    const t = i * 6; // every 6 seconds
    const hi = Math.max(0.3, 1.0 - 0.001 * i - 0.003 * Math.random());
    const rul = Math.max(100, 1200 - 8 * i + 20 * (Math.random() - 0.5));
    data.push({
      t,
      health_index: hi,
      rul_mean: rul,
      rul_ci_lower: rul * 0.85,
      rul_ci_upper: rul * 1.15,
      p_fail_horizon: Math.min(0.95, 0.01 + 0.0008 * i),
    });
  }
  return data;
}

export const Prognosis: React.FC = () => {
  const { runId } = useReplayStore();

  const { data: prognosisData } = useQuery({
    queryKey: ['prognosis', runId],
    queryFn: () => fetchPrognosis(runId!),
    enabled: !!runId,
  });

  const progData = prognosisData?.prognosis?.length > 0
    ? prognosisData.prognosis
    : demoPrognosisData();

  const latest = progData[progData.length - 1];
  const currentHI = latest?.health_index ?? 0.94;
  const currentRUL = latest?.rul_mean ?? 842;
  const rulLower = latest?.rul_ci_lower ?? 720;
  const rulUpper = latest?.rul_ci_upper ?? 980;
  const pFail = latest?.p_fail_horizon ?? 0.021;

  // Health Index trend chart
  const hiChartOpt = baseOption({
    grid: { top: 32, right: 24, bottom: 40, left: 56 },
    xAxis: {
      type: 'value',
      name: 'Time (s)',
      nameTextStyle: { color: THEME.inkSubtle, fontSize: 11 },
      axisLine: { lineStyle: { color: THEME.hairline } },
      axisTick: { show: false },
      axisLabel: { color: THEME.inkSubtle, fontSize: 11 },
      splitLine: { lineStyle: { color: THEME.hairline, type: 'dashed' } },
    },
    yAxis: {
      type: 'value',
      name: 'Health Index',
      min: 0,
      max: 1,
      nameTextStyle: { color: THEME.inkSubtle, fontSize: 11 },
      axisLine: { lineStyle: { color: THEME.hairline } },
      axisTick: { show: false },
      axisLabel: { color: THEME.inkSubtle, fontSize: 11 },
      splitLine: { lineStyle: { color: THEME.hairline, type: 'dashed' } },
    },
    series: [
      {
        name: 'Health Index',
        type: 'line',
        data: progData.map((d: any) => [d.t, d.health_index]),
        smooth: true,
        showSymbol: false,
        lineStyle: { color: THEME.success, width: 2 },
        areaStyle: {
          color: {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: THEME.success + '40' },
              { offset: 1, color: THEME.success + '05' },
            ],
          },
        },
        markLine: {
          data: [
            { yAxis: 0.5, lineStyle: { color: '#e5534b', type: 'dashed', width: 1 } },
          ],
          label: { formatter: 'Failure Threshold', color: THEME.inkSubtle, fontSize: 10 },
          silent: true,
        },
      },
    ],
  });

  // RUL fan chart
  const rulChartOpt = baseOption({
    grid: { top: 32, right: 24, bottom: 40, left: 56 },
    legend: {
      show: true,
      top: 4,
      textStyle: { color: THEME.inkMuted, fontSize: 11 },
    },
    xAxis: {
      type: 'value',
      name: 'Time (s)',
      nameTextStyle: { color: THEME.inkSubtle, fontSize: 11 },
      axisLine: { lineStyle: { color: THEME.hairline } },
      axisTick: { show: false },
      axisLabel: { color: THEME.inkSubtle, fontSize: 11 },
      splitLine: { lineStyle: { color: THEME.hairline, type: 'dashed' } },
    },
    yAxis: {
      type: 'value',
      name: 'RUL (hours)',
      nameTextStyle: { color: THEME.inkSubtle, fontSize: 11 },
      axisLine: { lineStyle: { color: THEME.hairline } },
      axisTick: { show: false },
      axisLabel: { color: THEME.inkSubtle, fontSize: 11 },
      splitLine: { lineStyle: { color: THEME.hairline, type: 'dashed' } },
    },
    series: [
      // Upper CI bound (area)
      {
        name: '95% CI Upper',
        type: 'line',
        data: progData.map((d: any) => [d.t, d.rul_ci_upper]),
        smooth: true,
        showSymbol: false,
        lineStyle: { opacity: 0 },
        stack: 'ci',
        areaStyle: { color: THEME.primary + '20' },
      },
      // Lower CI bound
      {
        name: '95% CI Lower',
        type: 'line',
        data: progData.map((d: any) => [d.t, d.rul_ci_lower]),
        smooth: true,
        showSymbol: false,
        lineStyle: { opacity: 0 },
        stack: 'ci',
        areaStyle: { color: 'transparent' },
      },
      // Mean RUL
      {
        name: 'RUL (mean)',
        type: 'line',
        data: progData.map((d: any) => [d.t, d.rul_mean]),
        smooth: true,
        showSymbol: false,
        lineStyle: { color: THEME.primary, width: 2 },
      },
    ],
  });

  // Determine HI color
  const hiColor = currentHI >= 0.7 ? THEME.success : currentHI >= 0.4 ? '#e09b24' : '#e5534b';
  const hiLabel = currentHI >= 0.7 ? 'Good condition' : currentHI >= 0.4 ? 'Degraded' : 'Critical';
  const pFailColor = pFail < 0.1 ? THEME.success : pFail < 0.5 ? '#e09b24' : '#e5534b';
  const pFailLabel = pFail < 0.1 ? 'Very low risk' : pFail < 0.5 ? 'Moderate risk' : 'High risk';

  // Component wear data
  const components = [
    { name: 'Valve Train', wear: 0.88 + Math.random() * 0.1 },
    { name: 'Ignition System', wear: 0.92 + Math.random() * 0.05 },
    { name: 'Combustion Quality', wear: 0.85 + Math.random() * 0.12 },
    { name: 'Bearings', wear: 0.90 + Math.random() * 0.08 },
  ];

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
        <ReactECharts option={hiChartOpt} style={{ height: 250 }} opts={{ renderer: 'canvas' }} />
      </div>

      <div className="grid-3 mb-lg">
        {/* RUL Gauge */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div className="type-eyebrow ink-subtle mb-xs">Remaining Useful Life</div>
          <ReactECharts
            option={gaugeOption(currentRUL, { label: 'RUL', max: 1500, color: THEME.primary })}
            style={{ height: 160, width: '100%' }}
            opts={{ renderer: 'canvas' }}
          />
          <div className="type-caption ink-subtle">
            95% CI: [{Math.round(rulLower)}h, {Math.round(rulUpper)}h]
          </div>
        </div>

        {/* Failure Probability Gauge */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div className="type-eyebrow ink-subtle mb-xs">P(Failure within 100h)</div>
          <ReactECharts
            option={gaugeOption(pFail, { label: pFailLabel, color: pFailColor })}
            style={{ height: 160, width: '100%' }}
            opts={{ renderer: 'canvas' }}
          />
        </div>

        {/* Current Health Gauge */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div className="type-eyebrow ink-subtle mb-xs">Current Health Index</div>
          <ReactECharts
            option={gaugeOption(currentHI, { label: hiLabel, color: hiColor })}
            style={{ height: 160, width: '100%' }}
            opts={{ renderer: 'canvas' }}
          />
        </div>
      </div>

      {/* RUL Fan Chart */}
      <div className="card card-screenshot mb-lg">
        <div className="type-eyebrow ink-subtle mb-xs">RUL Prediction with Confidence Fan</div>
        <ReactECharts option={rulChartOpt} style={{ height: 250 }} opts={{ renderer: 'canvas' }} />
      </div>

      {/* Component Wear Trends */}
      <div className="card mb-lg">
        <div className="type-eyebrow ink-subtle mb-xs">Component Wear Trends</div>
        <div className="grid-2" style={{ marginTop: 'var(--space-sm)' }}>
          {components.map((comp) => {
            const wearColor = comp.wear >= 0.8 ? THEME.success : comp.wear >= 0.5 ? '#e09b24' : '#e5534b';
            return (
              <div key={comp.name} className="flex items-center gap-sm" style={{ padding: 'var(--space-xs) 0' }}>
                <span className="type-body-sm" style={{ width: 140 }}>{comp.name}</span>
                <div style={{
                  flex: 1, height: 6, background: 'var(--color-hairline-strong)',
                  borderRadius: 'var(--rounded-pill)', overflow: 'hidden'
                }}>
                  <div style={{
                    height: '100%',
                    width: `${comp.wear * 100}%`,
                    background: wearColor,
                    borderRadius: 'var(--rounded-pill)',
                    transition: 'width 400ms ease-out',
                  }} />
                </div>
                <span className="type-mono ink-subtle" style={{ width: 40, textAlign: 'right' }}>
                  {comp.wear.toFixed(2)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
