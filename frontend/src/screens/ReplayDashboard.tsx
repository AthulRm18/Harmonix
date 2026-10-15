import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchRuns, fetchEvents } from '../api/client';
import { useReplayStore } from '../state/replayStore';
import { HelpPanel } from '../components/HelpPanel';
import './ReplayDashboard.css';

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

  const runs = runsData?.runs || [];
  const events = eventsData?.events || [];

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

          {/* Sensor Panels */}
          <div className="sensor-panels">
            <div className="card card-screenshot mb-md">
              <div className="type-eyebrow ink-subtle mb-xs">Multi-Sensor View</div>
              <div className="sensor-chart-placeholder">
                <div className="type-body ink-muted" style={{ textAlign: 'center', padding: 'var(--space-xxl)' }}>
                  Synchronised waveform and telemetry panels will render here.
                  <br />
                  <span className="type-caption ink-subtle">
                    Time cursor at {formatTime(currentTime)} — {events.length} anomaly event(s) detected
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Status Card */}
          <div className="grid-3">
            <div className="card">
              <div className="type-eyebrow ink-subtle mb-xs">Predicted Class</div>
              <div className="type-headline">Normal</div>
              <div className="type-caption ink-subtle">Confidence: 0.95</div>
            </div>
            <div className="card">
              <div className="type-eyebrow ink-subtle mb-xs">Anomaly Score</div>
              <div className="type-headline">0.12</div>
              <div className="type-caption ink-subtle">Below threshold (0.50)</div>
            </div>
            <div className="card">
              <div className="type-eyebrow ink-subtle mb-xs">Health Index</div>
              <div className="type-headline">0.94</div>
              <div className="type-caption ink-subtle">Good condition</div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
