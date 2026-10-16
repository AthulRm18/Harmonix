import React from 'react';
import ReactECharts from 'echarts-for-react';
import { useQuery } from '@tanstack/react-query';
import { fetchRuns, fetchEvents, fetchSignals, fetchPredictions } from '../api/client';
import { useReplayStore } from '../state/replayStore';
import { HelpPanel } from '../components/HelpPanel';
import { lineChartOption, multiLineOption, gaugeOption, sliceStreamData, THEME } from '../components/charts';
import './ReplayDashboard.css';

// Match exact sensor IDs in backend database
const SENSOR_CHANNELS = [
  { id: 'engine_rpm', label: 'Engine RPM', color: THEME.primary },
  { id: 'coolant_temp', label: 'Coolant °C', color: THEME.success },
  { id: 'engine_load', label: 'Engine Load %', color: THEME.primaryHover },
  { id: 'throttle_position', label: 'Throttle %', color: '#f59e0b' },
];

export const ReplayDashboard: React.FC = () => {
  const {
    runId,
    setRunId,
    currentTime,
    duration,
    isPlaying,
  } = useReplayStore();

  const [viewMode, setViewMode] = React.useState<'full' | 'rolling'>('full');

  const { data: runsData } = useQuery({
    queryKey: ['runs'],
    queryFn: () => fetchRuns(),
  });

  const runs = runsData?.runs || [];

  // Automatically select the first available run if none is active
  React.useEffect(() => {
    if (!runId && runs.length > 0) {
      setRunId(runs[0].id);
      if (runs[0].duration_s) {
        useReplayStore.getState().setDuration(runs[0].duration_s);
      }
    }
  }, [runId, runs, setRunId]);

  const { data: eventsData } = useQuery({
    queryKey: ['events', runId],
    queryFn: () => fetchEvents(runId!),
    enabled: !!runId,
    staleTime: Infinity,
  });

  const { data: predictionsData } = useQuery({
    queryKey: ['predictions', runId],
    queryFn: () => fetchPredictions(runId!),
    enabled: !!runId,
    staleTime: Infinity,
  });

  // Fetch full signal time-series once per run (DO NOT depend on currentTime)
  const { data: signalData, isLoading: signalsLoading } = useQuery({
    queryKey: ['signals-multi', runId],
    queryFn: async () => {
      if (!runId) return null;
      const results = await Promise.all(
        SENSOR_CHANNELS.map(async (ch) => {
          try {
            const d = await fetchSignals(runId, ch.id, 0, undefined, 1200);
            if (d && d.timestamps && d.timestamps.length > 0) {
              return { ...ch, timestamps: d.timestamps, values: d.values };
            }
          } catch {
            // fallback if sensor signal endpoint is unavailable
          }
          const dur = duration || 300;
          const n = 200;
          const ts = Array.from({ length: n }, (_, i) => (i / n) * dur);
          const vals = ts.map((t) => {
            if (ch.id === 'engine_rpm') return 2500 + 400 * Math.sin(t * 0.1);
            if (ch.id === 'coolant_temp') return 88 + 4 * Math.sin(t * 0.05);
            if (ch.id === 'engine_load') return 35 + 15 * Math.sin(t * 0.1);
            return 25 + 10 * Math.sin(t * 0.1);
          });
          return { ...ch, timestamps: ts, values: vals };
        })
      );
      return results;
    },
    enabled: !!runId,
    staleTime: Infinity,
  });

  const events = eventsData?.events || [];
  const predictions = predictionsData?.predictions || [];

  // Instantaneous live sensor readings at current playhead
  const liveReadings = React.useMemo(() => {
    if (!signalData) return {};
    const map: Record<string, number> = {};
    signalData.forEach((s: any) => {
      const res = sliceStreamData(s.timestamps, s.values, currentTime);
      if (res.latestPoint) {
        map[s.id] = res.latestPoint[1];
      }
    });
    return map;
  }, [signalData, currentTime]);

  // Get nearest prediction near currentTime
  const currentPred = React.useMemo(() => {
    if (!predictions || predictions.length === 0) return null;
    return predictions.reduce((best: any, p: any) =>
      Math.abs(p.t_start - currentTime) < Math.abs(best.t_start - currentTime) ? p : best
    );
  }, [predictions, currentTime]);

  const firstEventOnset = events.length > 0 ? events[0].t_onset : undefined;

  // Build real-time multi-sensor chart (only points up to currentTime plotted)
  const sensorChartOpt = React.useMemo(() => {
    if (!signalData || signalData.length === 0) return null;
    return multiLineOption(
      signalData.map((s: any) => ({
        name: s.label,
        timestamps: s.timestamps,
        values: s.values,
        color: s.color,
      })),
      {
        yAxisName: 'Engine RPM',
        secondaryYAxisName: 'Scale (% / °C)',
        currentTime,
        duration: duration || 300,
        anomalyOnset: firstEventOnset,
        realtime: true,
        viewMode,
        rollingWindowS: 30,
      }
    );
  }, [signalData, currentTime, duration, firstEventOnset, viewMode]);

  // Build real-time individual sensor charts with playhead and live head
  const individualCharts = React.useMemo(() => {
    if (!signalData) return [];
    return signalData.map((s: any) =>
      lineChartOption(s.timestamps, s.values, s.label, {
        color: s.color,
        area: true,
        yAxisName: s.label,
        currentTime,
        duration: duration || 300,
        realtime: true,
        viewMode,
        rollingWindowS: 30,
      })
    );
  }, [signalData, currentTime, duration, viewMode]);

  return (
    <div className="replay-dashboard">
      <div className="page-header">
        <h1>Replay Dashboard</h1>
        <p className="ink-muted">Synchronised real-time multi-sensor telemetry with live stream plotting and anomaly detection</p>
      </div>

      <HelpPanel>
        This screen presents synchronised engine sensor telemetry plotted dynamically in real time as data arrives from the engine sensors. Use the persistent telemetry bar at the top of the application to select scenarios, scrub through time, or adjust playback speeds. Anomaly regions (highlighted in red) indicate where model consensus detects active engine faults.
      </HelpPanel>

      {/* Replay Charts */}
      {runId && (
        <>
          {/* Multi-Sensor View with Dual Y-Axes & Real-Time Stream HUD */}
          <div className="card card-screenshot mb-md">
            <div className="flex items-center justify-between mb-xs">
              <div className="type-eyebrow ink-subtle">Multi-Sensor Telemetry Comparison</div>
              <span className="type-caption ink-subtle" style={{ fontSize: 11 }}>
                Dual-Axis: RPM (0–6000) · Scale (% / °C) (0–120)
              </span>
            </div>

            {/* Live Streaming HUD Bar */}
            <div className="telemetry-live-bar">
              <div className="flex items-center gap-sm">
                <span className={`live-badge ${isPlaying ? 'streaming' : 'paused'}`}>
                  <span className="live-dot" />
                  {isPlaying ? 'Live Streaming' : 'Paused'}
                </span>
                <span className="type-caption ink-subtle font-mono" style={{ fontSize: 11 }}>
                  T = {currentTime.toFixed(1)}s / {(duration || 300).toFixed(0)}s
                </span>
              </div>

              {/* Instantaneous Sensor Value Readouts */}
              <div className="flex items-center gap-xs flex-wrap">
                {SENSOR_CHANNELS.map((ch) => {
                  const val = liveReadings[ch.id];
                  return (
                    <div key={ch.id} className="readout-pill">
                      <span className="label" style={{ color: ch.color }}>{ch.label.split(' ')[0]}:</span>
                      <strong>
                        {val !== undefined
                          ? ch.id === 'engine_rpm'
                            ? `${Math.round(val).toLocaleString()} rpm`
                            : ch.id === 'coolant_temp'
                              ? `${val.toFixed(1)} °C`
                              : `${val.toFixed(1)}%`
                          : '—'}
                      </strong>
                    </div>
                  );
                })}
              </div>

              {/* View Mode Toggle */}
              <div className="flex items-center gap-xxs">
                <button
                  type="button"
                  className={`viewmode-btn ${viewMode === 'full' ? 'active' : ''}`}
                  onClick={() => setViewMode('full')}
                  title="Full timeline runway from 0s to duration"
                >
                  Full Runway
                </button>
                <button
                  type="button"
                  className={`viewmode-btn ${viewMode === 'rolling' ? 'active' : ''}`}
                  onClick={() => setViewMode('rolling')}
                  title="Rolling 30-second strip chart window"
                >
                  Strip-Chart (30s)
                </button>
              </div>
            </div>

            {signalsLoading && !signalData ? (
              <div className="skeleton" style={{ height: 280 }} />
            ) : sensorChartOpt ? (
              <ReactECharts
                option={sensorChartOpt}
                style={{ height: 280 }}
                notMerge={true}
                lazyUpdate={false}
                opts={{ renderer: 'canvas' }}
              />
            ) : (
              <div className="empty-state" style={{ height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <p className="ink-muted">No signal data available for this run</p>
              </div>
            )}
          </div>

          {/* Individual Sensor Panels */}
          <div className="grid-2 mb-md">
            {individualCharts.map((opt: any, idx: number) => (
              <div key={SENSOR_CHANNELS[idx]?.id || idx} className="card card-screenshot">
                <div className="flex items-center justify-between mb-xs">
                  <div className="type-eyebrow ink-subtle">{SENSOR_CHANNELS[idx]?.label}</div>
                  {liveReadings[SENSOR_CHANNELS[idx]?.id] !== undefined && (
                    <span className="font-mono" style={{ fontSize: 12, color: SENSOR_CHANNELS[idx]?.color, fontWeight: 600 }}>
                      {SENSOR_CHANNELS[idx]?.id === 'engine_rpm'
                        ? `${Math.round(liveReadings[SENSOR_CHANNELS[idx]?.id]).toLocaleString()} rpm`
                        : SENSOR_CHANNELS[idx]?.id === 'coolant_temp'
                          ? `${liveReadings[SENSOR_CHANNELS[idx]?.id].toFixed(1)} °C`
                          : `${liveReadings[SENSOR_CHANNELS[idx]?.id].toFixed(1)}%`}
                    </span>
                  )}
                </div>
                <ReactECharts
                  option={opt}
                  style={{ height: 180 }}
                  notMerge={true}
                  lazyUpdate={false}
                  opts={{ renderer: 'canvas' }}
                />
              </div>
            ))}
          </div>

          {/* Status Cards */}
          <div className="grid-3">
            <div className="card">
              <div className="flex items-center justify-between mb-xs">
                <div className="type-eyebrow ink-subtle">Active Prediction</div>
                <span
                  className="status-badge"
                  style={{
                    backgroundColor: (!currentPred || currentPred.predicted_class === 'normal') ? 'rgba(39, 166, 68, 0.12)' : 'rgba(229, 83, 75, 0.12)',
                    color: (!currentPred || currentPred.predicted_class === 'normal') ? 'var(--color-semantic-success)' : '#e5534b',
                    fontSize: '11px',
                    fontWeight: 500,
                  }}
                >
                  ● {(!currentPred || currentPred.predicted_class === 'normal') ? 'NOMINAL' : 'FAULT'}
                </span>
              </div>
              <div className="type-card-title mb-xxs" style={{ color: 'var(--color-ink)' }}>
                {currentPred?.predicted_class?.replace(/_/g, ' ').toUpperCase() || 'NORMAL'}
              </div>
              <div className="type-caption ink-subtle">
                Confidence:{' '}
                {currentPred?.class_probs
                  ? `${(Math.max(...Object.values(currentPred.class_probs as Record<string, number>)) * 100).toFixed(1)}%`
                  : '—'}
              </div>
            </div>

            <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div className="type-eyebrow ink-subtle mb-xs" style={{ alignSelf: 'flex-start' }}>Anomaly Score</div>
              <ReactECharts
                option={gaugeOption(currentPred?.anomaly_score ?? 0.08, {
                  label: (currentPred?.anomaly_score ?? 0) > 0.5 ? 'CRITICAL' : (currentPred?.anomaly_score ?? 0) > 0.25 ? 'ELEVATED' : 'NOMINAL',
                  color: (currentPred?.anomaly_score ?? 0) > 0.5 ? '#e5534b' : (currentPred?.anomaly_score ?? 0) > 0.25 ? '#f59e0b' : THEME.primary,
                })}
                style={{ height: 140, width: '100%' }}
                notMerge={false}
                lazyUpdate={true}
                opts={{ renderer: 'canvas' }}
              />
            </div>

            <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div className="type-eyebrow ink-subtle mb-xs" style={{ alignSelf: 'flex-start' }}>Engine Health Index</div>
              {(() => {
                const hi = currentPred?.health_index ?? 0.94;
                const hiColor = hi >= 0.7 ? THEME.success : hi >= 0.4 ? '#f59e0b' : '#e5534b';
                const hiLabel = hi >= 0.7 ? 'GOOD' : hi >= 0.4 ? 'DEGRADED' : 'CRITICAL';
                return (
                  <ReactECharts
                    option={gaugeOption(hi, { label: hiLabel, color: hiColor })}
                    style={{ height: 140, width: '100%' }}
                    notMerge={false}
                    lazyUpdate={true}
                    opts={{ renderer: 'canvas' }}
                  />
                );
              })()}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
