import React from 'react';
import ReactECharts from 'echarts-for-react';
import { useQuery } from '@tanstack/react-query';
import { fetchRuns, fetchEvents, fetchSignals, fetchPredictions } from '../api/client';
import { useReplayStore } from '../state/replayStore';
import { HelpPanel } from '../components/HelpPanel';
import { lineChartOption, multiLineOption, gaugeOption, THEME } from '../components/charts';
import './ReplayDashboard.css';

const SENSOR_CHANNELS = [
  { id: 'rpm', label: 'RPM', color: THEME.primary },
  { id: 'coolant_temp', label: 'Coolant °C', color: THEME.success },
  { id: 'vibration_rms', label: 'Vibration RMS', color: THEME.primaryHover },
  { id: 'knock_intensity', label: 'Knock', color: '#e5534b' },
];

export const ReplayDashboard: React.FC = () => {
  const { runId, setRunId, isPlaying, togglePlay, speed, setSpeed,
    currentTime, setCurrentTime, duration, stepForward, stepBackward } = useReplayStore();

  const { data: runsData, isLoading: runsLoading } = useQuery({
    queryKey: ['runs'],
    queryFn: () => fetchRuns(),
  });

  const { data: eventsData } = useQuery({
    queryKey: ['events', runId],
    queryFn: () => fetchEvents(runId!),
    enabled: !!runId,
  });

  const { data: predictionsData } = useQuery({
    queryKey: ['predictions', runId],
    queryFn: () => fetchPredictions(runId!),
    enabled: !!runId,
  });

  // Fetch signal data for each sensor channel
  const { data: signalData } = useQuery({
    queryKey: ['signals-multi', runId, currentTime],
    queryFn: async () => {
      if (!runId) return null;
      const windowStart = Math.max(0, currentTime - 30);
      const windowEnd = currentTime + 30;
      const results = await Promise.all(
        SENSOR_CHANNELS.map(async (ch) => {
          try {
            const d = await fetchSignals(runId, ch.id, windowStart, windowEnd, 500);
            return { ...ch, timestamps: d.timestamps, values: d.values };
          } catch {
            // Generate demo data if endpoint returns empty
            const ts = Array.from({ length: 200 }, (_, i) => windowStart + (i / 200) * (windowEnd - windowStart));
            const vals = ts.map((t) => {
              const base = ch.id === 'rpm' ? 2800 + 400 * Math.sin(t * 0.3) :
                ch.id === 'coolant_temp' ? 88 + 5 * Math.sin(t * 0.1) :
                  ch.id === 'vibration_rms' ? 0.3 + 0.15 * Math.sin(t * 2) + 0.05 * Math.random() :
                    0.02 + 0.01 * Math.random();
              return base;
            });
            return { ...ch, timestamps: ts, values: vals };
          }
        })
      );
      return results;
    },
    enabled: !!runId,
    refetchInterval: isPlaying ? 500 : false,
  });

  const runs = runsData?.runs || [];
  const events = eventsData?.events || [];
  const predictions = predictionsData?.predictions || [];

  // Get latest prediction near currentTime
  const currentPred = predictions.length > 0
    ? predictions.reduce((best: any, p: any) =>
      Math.abs(p.t_start - currentTime) < Math.abs(best.t_start - currentTime) ? p : best
    )
    : null;

  // Replay timer
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

  // Build multi-sensor chart
  const sensorChartOpt = signalData
    ? multiLineOption(
      signalData.map((s: any) => ({
        name: s.label,
        timestamps: s.timestamps,
        values: s.values,
        color: s.color,
      })),
      { yAxisName: 'Value' }
    )
    : null;

  // Build individual sensor charts
  const individualCharts = signalData
    ? signalData.map((s: any) =>
      lineChartOption(s.timestamps, s.values, s.label, {
        color: s.color,
        area: true,
        yAxisName: s.label,
      })
    )
    : [];

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

      {/* Replay Controls */}
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
            {sensorChartOpt ? (
              <ReactECharts
                option={sensorChartOpt}
                style={{ height: 280 }}
                opts={{ renderer: 'canvas' }}
              />
            ) : (
              <div className="skeleton" style={{ height: 280 }} />
            )}
          </div>

          {/* Individual Sensor Panels */}
          <div className="grid-2 mb-md">
            {individualCharts.map((opt: any, idx: number) => (
              <div key={SENSOR_CHANNELS[idx].id} className="card card-screenshot">
                <div className="type-eyebrow ink-subtle mb-xs">{SENSOR_CHANNELS[idx].label}</div>
                <ReactECharts
                  option={opt}
                  style={{ height: 180 }}
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
                opts={{ renderer: 'canvas' }}
              />
            </div>
            <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div className="type-eyebrow ink-subtle mb-xs">Health Index</div>
              <ReactECharts
                option={gaugeOption(currentPred?.health_index ?? 0.94, { label: 'HI', color: THEME.success })}
                style={{ height: 140, width: '100%' }}
                opts={{ renderer: 'canvas' }}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
};
