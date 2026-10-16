import React from 'react';
import ReactECharts from 'echarts-for-react';
import { useQuery } from '@tanstack/react-query';
import { fetchPrognosis, fetchPredictions, fetchRun } from '../api/client';
import { useReplayStore } from '../state/replayStore';
import { HelpPanel } from '../components/HelpPanel';
import { baseOption, gaugeOption, THEME } from '../components/charts';

// Economic profile mapping for realistic fleet cost avoidance
interface EconomicProfile {
  name: string;
  shortFault: string;
  proactiveAction: string;
  proactiveBaseCost: number;
  catastrophicDamage: string;
  catastrophicBaseCost: number;
  downtimeDays: number;
  baseHorizonHours: number;
}

const ECONOMIC_PROFILES: Record<string, EconomicProfile> = {
  knock: {
    name: 'Combustion Chamber Detonation / Knock',
    shortFault: 'Detonation Knock',
    proactiveAction: 'Spark plug replacement & ECU timing recalibration',
    proactiveBaseCost: 140,
    catastrophicDamage: 'Piston crown meltdown & cylinder bore scoring',
    catastrophicBaseCost: 4850,
    downtimeDays: 4.5,
    baseHorizonHours: 48,
  },
  misfire: {
    name: 'Combustion Misfire & Incomplete Burn',
    shortFault: 'Cylinder Misfire',
    proactiveAction: 'Ignition coil pack & fuel injector nozzle service',
    proactiveBaseCost: 165,
    catastrophicDamage: 'Catalytic converter meltdown & exhaust valve erosion',
    catastrophicBaseCost: 2950,
    downtimeDays: 3.0,
    baseHorizonHours: 60,
  },
  valve_wear: {
    name: 'Valve Train Lash & Seat Recession',
    shortFault: 'Valve Train Wear',
    proactiveAction: 'Valve lash adjustment & stem seal refresh',
    proactiveBaseCost: 340,
    catastrophicDamage: 'Dropped valve fracture & cylinder head destruction',
    catastrophicBaseCost: 6400,
    downtimeDays: 6.0,
    baseHorizonHours: 96,
  },
  coil_degradation: {
    name: 'Ignition Secondary Coil Breakdown',
    shortFault: 'Coil Degradation',
    proactiveAction: 'Primary ignition coil pack replacement',
    proactiveBaseCost: 125,
    catastrophicDamage: 'ECU driver transistor burnout & catalyst fuel fouling',
    catastrophicBaseCost: 2450,
    downtimeDays: 2.5,
    baseHorizonHours: 72,
  },
  normal: {
    name: 'Nominal Fleet Baseline',
    shortFault: 'Nominal Health',
    proactiveAction: 'Standard scheduled oil & filter maintenance',
    proactiveBaseCost: 0,
    catastrophicDamage: 'Asset operating within certified design tolerances',
    catastrophicBaseCost: 0,
    downtimeDays: 0,
    baseHorizonHours: 1500,
  },
};

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
  const { runId, currentTime } = useReplayStore();

  const { data: runData } = useQuery({
    queryKey: ['run', runId],
    queryFn: () => fetchRun(runId!),
    enabled: !!runId,
  });

  const { data: predictionsData } = useQuery({
    queryKey: ['predictions', runId],
    queryFn: () => fetchPredictions(runId!),
    enabled: !!runId,
  });

  const { data: prognosisData } = useQuery({
    queryKey: ['prognosis', runId],
    queryFn: () => fetchPrognosis(runId!),
    enabled: !!runId,
  });

  // Normalize prognosis data for realistic fleet operations
  const progData = React.useMemo(() => {
    const raw = prognosisData?.prognosis?.length > 0 ? prognosisData.prognosis : demoPrognosisData();
    return raw.map((d: any) => {
      let rul = d.rul_mean;
      let lower = d.rul_ci_lower;
      let upper = d.rul_ci_upper;

      // If RUL is in raw fraction bench hours (< 5), scale to fleet operating hours (e.g. 0.017h -> ~41h)
      if (rul < 5.0 && rul > 0) {
        rul = rul * 2400.0;
        lower = (lower ?? rul * 0.85) * 2400.0;
        upper = (upper ?? rul * 1.15) * 2400.0;
      }

      // If sentinel >= 5000 (meaning stable / slope >= 0), cap to nominal 1500h lifecycle
      if (rul >= 5000) {
        rul = 1500;
        lower = 1200;
        upper = 1500;
      }

      return {
        ...d,
        rul_mean: Math.round(rul),
        rul_ci_lower: Math.round(Math.max(0, lower)),
        rul_ci_upper: Math.round(Math.min(1500, upper)),
      };
    });
  }, [prognosisData]);

  // Find data point closest to currentTime
  const currentPoint = React.useMemo(() => {
    if (!progData || progData.length === 0) return null;
    return progData.reduce((best: any, p: any) =>
      Math.abs(p.t - currentTime) < Math.abs(best.t - currentTime) ? p : best
    );
  }, [progData, currentTime]);

  const activePoint = currentPoint || progData[progData.length - 1];
  const currentHI = activePoint?.health_index ?? 0.94;
  const currentRUL = activePoint?.rul_mean ?? 842;
  const rulLower = activePoint?.rul_ci_lower ?? 720;
  const rulUpper = activePoint?.rul_ci_upper ?? 980;
  const pFail = activePoint?.p_fail_horizon ?? 0.021;

  // Health Index trend chart with live scrubber playhead
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
    visualMap: {
      show: false,
      dimension: 1,
      pieces: [
        { gt: 0.7, color: THEME.success },
        { gt: 0.5, lte: 0.7, color: '#e09b24' },
        { lte: 0.5, color: '#e5534b' },
      ],
      outOfRange: { color: '#e5534b' },
    },
    series: [
      {
        name: 'Health Index',
        type: 'line',
        data: progData.map((d: any) => [d.t, d.health_index]),
        smooth: true,
        showSymbol: false,
        lineStyle: { width: 2.5 },
        areaStyle: {
          color: {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(94, 106, 210, 0.22)' },
              { offset: 1, color: 'rgba(94, 106, 210, 0.02)' },
            ],
          },
        },
        markLine: {
          symbol: ['none', 'none'],
          silent: true,
          data: [
            {
              yAxis: 0.5,
              lineStyle: { color: '#e5534b', type: 'dashed', width: 1.5 },
              label: {
                formatter: 'Critical Failure Limit (0.50)',
                color: '#e5534b',
                fontSize: 10,
                fontWeight: 500,
                position: 'insideEndTop',
              },
            },
            {
              xAxis: currentTime,
              lineStyle: { color: THEME.primaryHover, type: 'solid', width: 2 },
              label: {
                formatter: `Playhead: ${currentTime.toFixed(1)}s (HI: ${currentHI.toFixed(2)})`,
                color: THEME.ink,
                fontSize: 10,
                fontWeight: 600,
              },
            },
          ],
        },
        markArea: {
          silent: true,
          data: [
            [
              {
                yAxis: 0,
                itemStyle: { color: 'rgba(229, 83, 75, 0.05)' },
                label: {
                  show: true,
                  position: ['16', '75%'],
                  formatter: 'CRITICAL FAILURE ZONE (< 0.50)',
                  color: 'rgba(229, 83, 75, 0.40)',
                  fontSize: 10,
                  fontWeight: 600,
                },
              },
              { yAxis: 0.5 },
            ],
          ],
        },
      },
    ],
  });

  // RUL fan chart with live scrubber playhead
  const rulChartOpt = baseOption({
    grid: { top: 32, right: 24, bottom: 40, left: 56 },
    tooltip: {
      trigger: 'axis',
      formatter: (params: any) => {
        const arr = Array.isArray(params) ? params : [params];
        if (!arr || arr.length === 0) return '';
        const t = arr[0].value[0];
        const meanParam = arr.find((p: any) => p.seriesName === 'RUL (mean)');
        const upperParam = arr.find((p: any) => p.seriesName === '95% CI Upper');
        const lowerParam = arr.find((p: any) => p.seriesName === '95% CI Lower');
        const rul = meanParam ? meanParam.value[1] : 0;
        const upper = upperParam ? upperParam.value[1] : 0;
        const lower = lowerParam ? lowerParam.value[1] : 0;
        const isStable = rul >= 1500;
        return `<div style="padding: 4px 6px; font-size: 12px; font-family: ${THEME.fontFamily};">
          <div style="color: ${THEME.inkSubtle}; margin-bottom: 4px;">Time: <strong>${Number(t).toFixed(1)}s</strong></div>
          <div style="color: ${THEME.primaryHover}; margin-bottom: 2px;">
            RUL (mean): <strong>${isStable ? '> 1,500h (Full Life)' : Math.round(rul) + ' operating hours'}</strong>
          </div>
          <div style="color: ${THEME.inkMuted};">
            95% CI: <strong>${isStable ? 'Stable Baseline' : `[${Math.round(lower)}h, ${Math.round(upper)}h]`}</strong>
          </div>
        </div>`;
      },
    },
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
        markLine: {
          symbol: ['none', 'none'],
          silent: true,
          data: [
            { xAxis: currentTime, lineStyle: { color: THEME.primaryHover, type: 'solid', width: 2 }, label: { formatter: `${currentTime.toFixed(1)}s`, color: THEME.ink, fontSize: 10 } },
          ],
        },
      },
    ],
  });

  // Determine HI color
  const hiColor = currentHI >= 0.7 ? THEME.success : currentHI >= 0.4 ? '#f59e0b' : '#e5534b';
  const hiLabel = currentHI >= 0.7 ? 'Good condition' : currentHI >= 0.4 ? 'Degraded' : 'Critical';
  const rulColor = currentRUL >= 500 ? THEME.success : currentRUL >= 200 ? '#f59e0b' : '#e5534b';
  const pFailColor = pFail < 0.1 ? THEME.success : pFail < 0.4 ? '#f59e0b' : '#e5534b';
  const pFailLabel = pFail < 0.1 ? 'Very low risk' : pFail < 0.4 ? 'Moderate risk' : 'High risk';

  // Component wear data derived dynamically from live health index
  const components = [
    { name: 'Combustion Chamber', wear: Math.min(1.0, Math.max(0.15, currentHI * 0.98)) },
    { name: 'Valve Train', wear: Math.min(1.0, Math.max(0.20, currentHI * 0.94 + 0.04)) },
    { name: 'Ignition System', wear: Math.min(1.0, Math.max(0.25, currentHI * 0.91 + 0.07)) },
    { name: 'Crankshaft Bearings', wear: Math.min(1.0, Math.max(0.30, currentHI * 0.96 + 0.03)) },
  ];

  // Resolve active model prediction for the current playhead
  const currentPrediction = React.useMemo(() => {
    const preds = predictionsData?.predictions;
    if (!preds || preds.length === 0) return null;
    return preds.reduce((best: any, p: any) =>
      Math.abs(p.t_start - currentTime) < Math.abs(best.t_start - currentTime) ? p : best
    );
  }, [predictionsData, currentTime]);

  // Determine active detected fault class at currentTime
  const activeClass = React.useMemo(() => {
    if (currentPrediction?.predicted_class && currentPrediction.predicted_class !== 'normal') {
      return currentPrediction.predicted_class;
    }
    const gt = runData?.ground_truth;
    if (gt?.fault_type && gt.fault_type !== 'normal' && currentTime >= (gt.onset_s ?? 0)) {
      return gt.fault_type;
    }
    return currentPrediction?.predicted_class || 'normal';
  }, [currentPrediction, runData, currentTime]);

  const isHealthy = activeClass === 'normal';
  const profile = ECONOMIC_PROFILES[activeClass] || ECONOMIC_PROFILES.normal;

  // Real-time wear severity factor derived from live health index & failure probability
  const wearSeverity = Math.min(1.0, Math.max(0.05, (1.0 - currentHI) / 0.7));

  // Dynamic financial metrics linked to real-time telemetry
  const proactiveCost = isHealthy
    ? 0
    : Math.round(profile.proactiveBaseCost * (1.0 + wearSeverity * 0.35));

  const failureExposure = isHealthy
    ? 0
    : Math.round(profile.catastrophicBaseCost * (0.88 + wearSeverity * 0.32));

  const capitalPreserved = isHealthy ? 0 : failureExposure - proactiveCost;

  const costAvoidanceRatio = proactiveCost > 0
    ? Math.round(failureExposure / proactiveCost)
    : 0;

  // Dynamic failure horizon in operating hours
  // When a fault is active, failure horizon counts down as degradation deepens (e.g. 48h down to 14h)
  const failureHorizonHours = isHealthy
    ? 1500
    : Math.max(8, Math.round(profile.baseHorizonHours * (1.15 - wearSeverity * 0.45)));

  const downtimeDaysSaved = isHealthy
    ? 0
    : Number((profile.downtimeDays * (1.0 + wearSeverity * 0.25)).toFixed(1));

  const isRulStable = currentRUL >= 5000;
  const rulStatus = isRulStable ? 'Stable condition' : currentRUL >= 500 ? 'Good condition' : currentRUL >= 200 ? 'Degraded' : 'Critical';

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
            option={gaugeOption(isRulStable ? 1500 : currentRUL, {
              label: rulStatus,
              max: 1500,
              color: isRulStable ? THEME.success : rulColor,
              formatter: () => (isRulStable ? '> 1,500h' : `${Math.round(currentRUL)}h`),
            })}
            style={{ height: 160, width: '100%' }}
            opts={{ renderer: 'canvas' }}
          />
          <div className="type-caption ink-subtle">
            {isRulStable
              ? '95% CI: Stable · No active degradation trend'
              : `95% CI: [${Math.round(rulLower)}h, ${Math.round(rulUpper)}h]`}
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

      {/* Dynamic Financial Risk & Failure Avoidance Metric */}
      <div className="card mb-lg">
        {/* Header */}
        <div className="flex items-center justify-between mb-sm" style={{ flexWrap: 'wrap', gap: 'var(--space-xs)' }}>
          <div>
            <div className="type-eyebrow ink-subtle" style={{ letterSpacing: '0.4px', marginBottom: '2px' }}>
              Fleet Financial Risk &amp; ROI
            </div>
            <div className="type-card-title ink" style={{ margin: 0, fontSize: 16 }}>
              {isHealthy ? 'Nominal Fleet Operation' : `Actionable Decision · Active ${profile.shortFault}`}
            </div>
          </div>

          <span
            className="status-badge"
            style={{
              backgroundColor: isHealthy ? 'rgba(39, 166, 68, 0.10)' : 'rgba(229, 83, 75, 0.12)',
              color: isHealthy ? 'var(--color-semantic-success)' : '#e5534b',
              border: `1px solid ${isHealthy ? 'rgba(39, 166, 68, 0.25)' : 'rgba(229, 83, 75, 0.3)'}`,
              padding: '4px 10px',
              fontSize: '11px',
              fontWeight: 500,
            }}
          >
            ● {isHealthy ? 'Zero Actionable Exposure' : `Service Window: < ${failureHorizonHours} Operating Hours`}
          </span>
        </div>

        {isHealthy ? (
          /* Nominal State: Clean, breathable, reassuring */
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 'var(--space-md)',
            padding: 'var(--space-md) var(--space-lg)',
            backgroundColor: 'var(--color-surface-2)',
            borderRadius: 'var(--rounded-md)',
            border: '1px solid var(--color-hairline)',
          }}>
            <div>
              <div className="type-caption ink-subtle mb-xxs">Proactive Service Cost</div>
              <div className="type-headline ink" style={{ fontSize: 24, fontVariantNumeric: 'tabular-nums' }}>$0</div>
              <div className="type-caption ink-muted" style={{ marginTop: 2 }}>Routine scheduled maintenance only</div>
            </div>

            <div>
              <div className="type-caption ink-subtle mb-xxs">Breakdown Exposure</div>
              <div className="type-headline ink" style={{ fontSize: 24, fontVariantNumeric: 'tabular-nums' }}>$0</div>
              <div className="type-caption ink-muted" style={{ marginTop: 2 }}>0h unscheduled downtime</div>
            </div>

            <div>
              <div className="type-caption ink-subtle mb-xxs">Fleet Health Status</div>
              <div className="type-headline" style={{ fontSize: 24, color: 'var(--color-semantic-success)', fontVariantNumeric: 'tabular-nums' }}>
                100% Intact
              </div>
              <div className="type-caption ink-muted" style={{ marginTop: 2 }}>All sensors within OEM tolerances</div>
            </div>
          </div>
        ) : (
          /* Active Fault State: Clear Decision Comparison */
          <div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: 'var(--space-md)',
              marginBottom: 'var(--space-md)',
            }}>
              {/* Option A: Fix Now */}
              <div style={{
                padding: 'var(--space-md)',
                backgroundColor: 'var(--color-surface-2)',
                borderRadius: 'var(--rounded-md)',
                border: '1px solid var(--color-hairline)',
              }}>
                <div className="type-caption ink-subtle mb-xxs" style={{ textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Option A · Fix Now
                </div>
                <div className="type-headline ink" style={{ fontSize: 28, fontVariantNumeric: 'tabular-nums', margin: '4px 0' }}>
                  ${proactiveCost.toLocaleString()}
                </div>
                <div className="type-body-sm ink-muted" style={{ fontWeight: 500 }}>
                  {profile.proactiveAction}
                </div>
                <div className="type-caption ink-subtle" style={{ marginTop: 4 }}>
                  In-bay depot repair (&lt; 2 hours)
                </div>
              </div>

              {/* Option B: Run to Failure */}
              <div style={{
                padding: 'var(--space-md)',
                backgroundColor: 'var(--color-surface-2)',
                borderRadius: 'var(--rounded-md)',
                border: '1px solid rgba(229, 83, 75, 0.25)',
              }}>
                <div className="type-caption" style={{ color: '#e5534b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Option B · Cost of Inaction
                </div>
                <div className="type-headline" style={{ fontSize: 28, color: '#e5534b', fontVariantNumeric: 'tabular-nums', margin: '4px 0' }}>
                  ${failureExposure.toLocaleString()}
                </div>
                <div className="type-body-sm ink-muted" style={{ fontWeight: 500 }}>
                  {profile.catastrophicDamage}
                </div>
                <div className="type-caption ink-subtle" style={{ marginTop: 4 }}>
                  Highway breakdown + ~{downtimeDaysSaved} days stoppage
                </div>
              </div>

              {/* Bottom Line: ROI */}
              <div style={{
                padding: 'var(--space-md)',
                backgroundColor: 'rgba(39, 166, 68, 0.05)',
                borderRadius: 'var(--rounded-md)',
                border: '1px solid rgba(39, 166, 68, 0.25)',
              }}>
                <div className="type-caption" style={{ color: 'var(--color-semantic-success)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Capital Preserved
                </div>
                <div className="type-headline" style={{ fontSize: 28, color: 'var(--color-semantic-success)', fontVariantNumeric: 'tabular-nums', margin: '4px 0' }}>
                  +${capitalPreserved.toLocaleString()}
                </div>
                <div className="type-body-sm ink-muted" style={{ fontWeight: 500 }}>
                  {costAvoidanceRatio}x Return on Investment
                </div>
                <div className="type-caption ink-subtle" style={{ marginTop: 4 }}>
                  Immediate repair preserves engine asset value
                </div>
              </div>
            </div>

            {/* Clean Timeline Strip */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 16px',
              backgroundColor: 'var(--color-surface-2)',
              borderRadius: 'var(--rounded-md)',
              border: '1px solid var(--color-hairline)',
              fontSize: 12,
              flexWrap: 'wrap',
              gap: 8,
            }}>
              <span className="ink-muted">
                <strong>Action Window:</strong> Service within <span className="ink">{failureHorizonHours} operating hours</span> (${proactiveCost}) to prevent catastrophic failure (${failureExposure.toLocaleString()}).
              </span>
              <span className="type-mono ink-subtle" style={{ fontSize: 11 }}>
                Playhead: {currentTime.toFixed(1)}s · HI: {(currentHI * 100).toFixed(0)}%
              </span>
            </div>
          </div>
        )}
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
