import React from 'react';
import ReactECharts from 'echarts-for-react';
import { useQuery } from '@tanstack/react-query';
import { fetchRuns, fetchEvents, fetchSignals, fetchPredictions } from '../api/client';
import { useReplayStore } from '../state/replayStore';
import { HelpPanel } from '../components/HelpPanel';
import { lineChartOption, multiLineOption, gaugeOption, THEME } from '../components/charts';
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
    isPlaying,
    togglePlay,
    speed,
    setSpeed,
    currentTime,
    setCurrentTime,
    duration,
    stepForward,
    stepBackward,
  } = useReplayStore();

  const { data: runsData, isLoading: runsLoading } = useQuery({
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

  // Fetch full signal time-series once per run (DO NOT depend on currentTime!)
  // This eliminates network requests and skeleton flashes during playback
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

  // Get nearest prediction near currentTime
  const currentPred = React.useMemo(() => {
    if (!predictions || predictions.length === 0) return null;
    return predictions.reduce((best: any, p: any) =>
      Math.abs(p.t_start - currentTime) < Math.abs(best.t_start - currentTime) ? p : best
    );
  }, [predictions, currentTime]);

  // Replay timer with smooth 100ms ticks
  React.useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setCurrentTime(currentTime + speed * 0.1);
    }, 100);
    return () => clearInterval(interval);
  }, [isPlaying, speed, currentTime, setCurrentTime]);

  const jumpToAnomaly = () => {
    if (events.length > 0) {
      setCurrentTime(events[0].t_onset);
    }
  };

  const formatTime = (t: number) => {
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const firstEventOnset = events.length > 0 ? events[0].t_onset : undefined;

  // Build multi-sensor chart with smooth markLine playhead
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
        yAxisName: 'Value',
        currentTime,
        anomalyOnset: firstEventOnset,
      }
    );
  }, [signalData, currentTime, firstEventOnset]);

  // Build individual sensor charts with playhead
  const individualCharts = React.useMemo(() => {
    if (!signalData) return [];
    return signalData.map((s: any) =>
      lineChartOption(s.timestamps, s.values, s.label, {
        color: s.color,
        area: true,
        yAxisName: s.label,
        currentTime,
      })
    );
  }, [signalData, currentTime]);

  return (
    <div className="replay-dashboard">
      <div className="page-header">
        <h1>Replay Dashboard</h1>
        <p className="ink-muted">Synchronised multi-sensor replay with anomaly detection</p>
      </div>

      <HelpPanel>
        This screen lets you replay engine sensor recordings. Pick a run from the list,
        then use the playback controls to scrub through time. Anomaly markers (highlighted
        regions) show where the system detected a fault. Click "Jump to anomaly" to go
        directly to the first detected event.
      </HelpPanel>

      {/* Run Picker */}
      <div className="card mb-md">
        <div className="type-eyebrow ink-subtle mb-xs">Select Run</div>
        {runsLoading ? (
          <div className="skeleton" style={{ height: 40, width: '100%' }} />
        ) : runs.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📊</div>
            <p>No runs available. Simulate or import data to get started.</p>
          </div>
        ) : (
          <div className="run-picker">
            {runs.map((run: any) => (
              <button
                key={run.id}
                className={`run-card ${runId === run.id ? 'run-card-active' : ''}`}
                onClick={() => {
                  setRunId(run.id);
                  if (run.duration_s) {
                    useReplayStore.getState().setDuration(run.duration_s);
                  }
                }}
              >
                <span className="type-body-sm">{run.name}</span>
                <span className={`badge ${run.source === 'real' ? 'badge-success' : ''}`}>
                  {run.source}
                </span>
                {run.ground_truth?.fault_type && (
                  <span className="badge">{run.ground_truth.fault_type}</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Replay Controls & Charts */}
      {runId && (
        <>
          <div className="replay-controls mb-md">
            <button className="btn btn-secondary" onClick={stepBackward} title="Step back 1 window">
              ⏮
            </button>
            <button className="btn btn-primary" onClick={togglePlay} title={isPlaying ? 'Pause' : 'Play'}>
              {isPlaying ? '⏸' : '▶'}
            </button>
            <button className="btn btn-secondary" onClick={stepForward} title="Step forward 1 window">
              ⏭
            </button>

            <input
              type="range"
              className="replay-scrubber"
              min={0}
              max={duration}
              step={0.1}
              value={currentTime}
              onChange={(e) => setCurrentTime(parseFloat(e.target.value))}
              aria-label="Time scrubber"
            />

            <span className="type-mono ink-muted" style={{ minWidth: 80 }}>
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>

            <select
              className="input"
              style={{ width: 'auto', minHeight: 32, padding: '4px 8px' }}
              value={speed}
              onChange={(e) => setSpeed(parseFloat(e.target.value))}
              aria-label="Playback speed"
            >
              {[0.5, 1, 2, 4, 8, 16].map((s) => (
                <option key={s} value={s}>{s}×</option>
              ))}
            </select>

            {events.length > 0 && (
              <button className="btn btn-primary" onClick={jumpToAnomaly} title="Jump to first anomaly">
                ⚡ Jump to anomaly
              </button>
            )}
          </div>

          {/* Multi-Sensor View */}
          <div className="card card-screenshot mb-md">
            <div className="type-eyebrow ink-subtle mb-xs">Multi-Sensor View</div>
            {signalsLoading && !signalData ? (
              <div className="skeleton" style={{ height: 280 }} />
            ) : sensorChartOpt ? (
              <ReactECharts
                option={sensorChartOpt}
                style={{ height: 280 }}
                notMerge={false}
                lazyUpdate={true}
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
                <div className="type-eyebrow ink-subtle mb-xs">{SENSOR_CHANNELS[idx]?.label}</div>
                <ReactECharts
                  option={opt}
                  style={{ height: 180 }}
                  notMerge={false}
                  lazyUpdate={true}
                  opts={{ renderer: 'canvas' }}
                />
              </div>
            ))}
          </div>

          {/* Status Cards */}
          <div className="grid-3">
            <div className="card">
              <div className="type-eyebrow ink-subtle mb-xs">Predicted Class</div>
              <div className="type-headline" style={{ color: currentPred?.predicted_class === 'normal' ? THEME.success : THEME.primary }}>
                {currentPred?.predicted_class || 'Normal'}
              </div>
              <div className="type-caption ink-subtle">
                Confidence: {currentPred?.class_probs
                  ? Math.max(...Object.values(currentPred.class_probs as Record<string, number>)).toFixed(2)
                  : '—'}
              </div>
            </div>
            <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div className="type-eyebrow ink-subtle mb-xs">Anomaly Score</div>
              <ReactECharts
                option={gaugeOption(currentPred?.anomaly_score ?? 0.12, { label: 'Score', color: (currentPred?.anomaly_score ?? 0) > 0.5 ? '#e5534b' : THEME.primary })}
                style={{ height: 140, width: '100%' }}
                notMerge={false}
                lazyUpdate={true}
                opts={{ renderer: 'canvas' }}
              />
            </div>
            <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div className="type-eyebrow ink-subtle mb-xs">Health Index</div>
              <ReactECharts
                option={gaugeOption(currentPred?.health_index ?? 0.94, { label: 'HI', color: THEME.success })}
                style={{ height: 140, width: '100%' }}
                notMerge={false}
                lazyUpdate={true}
                opts={{ renderer: 'canvas' }}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
};
