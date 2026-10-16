import React, { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchRuns, fetchEvents } from '../api/client';
import { useReplayStore } from '../state/replayStore';
import { THEME } from './charts';

const SPEED_OPTIONS = [0.5, 1, 2, 4, 8, 16];

export const GlobalTelemetryBar: React.FC = () => {
  const {
    runId,
    setRunId,
    isPlaying,
    togglePlay,
    play,
    speed,
    setSpeed,
    currentTime,
    setCurrentTime,
    duration,
    setDuration,
    stepForward,
    stepBackward,
  } = useReplayStore();

  const { data: runsData } = useQuery({
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
  const activeRun = runs.find((r: any) => r.id === runId);

  // High-performance continuous playback ticker (no stutter, supports 0.5x up to 16x)
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      useReplayStore.setState((state) => {
        const next = state.currentTime + 0.1 * state.speed;
        return {
          currentTime: next >= state.duration ? 0 : next,
        };
      });
    }, 100);
    return () => clearInterval(interval);
  }, [isPlaying, speed]);

  // Key demo scenarios
  const nominalRun = useMemo(
    () => runs.find((r: any) => r.name.toLowerCase().includes('highway') || r.ground_truth?.fault_type === 'normal'),
    [runs]
  );
  const knockRun = useMemo(
    () => runs.find((r: any) => r.name.toLowerCase().includes('knock') && r.name.toLowerCase().includes('cyl 2')) ||
          runs.find((r: any) => r.name.toLowerCase().includes('knock')),
    [runs]
  );
  const misfireRun = useMemo(
    () => runs.find((r: any) => r.name.toLowerCase().includes('misfire') && r.name.toLowerCase().includes('cyl 4')) ||
          runs.find((r: any) => r.name.toLowerCase().includes('misfire')),
    [runs]
  );

  const selectScenario = (run: any, startTime: number = 0, autoPlay: boolean = false) => {
    if (!run) return;
    setRunId(run.id);
    if (run.duration_s) {
      setDuration(run.duration_s);
    }
    setCurrentTime(startTime);
    if (autoPlay) {
      play();
    }
  };

  const formatTime = (t: number) => {
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const onsetTime = events.length > 0 ? events[0].t_onset : activeRun?.ground_truth?.onset_s;
  const isFaultActive = onsetTime !== undefined && onsetTime !== null && currentTime >= onsetTime;

  return (
    <header
      style={{
        height: 56,
        backgroundColor: 'var(--color-canvas)',
        borderBottom: '1px solid var(--color-hairline)',
        padding: '0 var(--space-lg)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 'var(--space-md)',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}
    >
      {/* Left: Stream badge, scenario segmented controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', minWidth: 0 }}>
        {/* Linear status pill */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 7,
            padding: '3px 10px',
            borderRadius: 'var(--rounded-pill)',
            backgroundColor: 'var(--color-surface-2)',
            border: '1px solid var(--color-hairline)',
            fontSize: 11,
            fontWeight: 500,
            color: 'var(--color-ink-muted)',
            letterSpacing: '0.02em',
            whiteSpace: 'nowrap',
          }}
          title="25.6 kHz CAN bus ingestion stream"
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              backgroundColor: isFaultActive ? '#e5534b' : 'var(--color-semantic-success)',
              boxShadow: isFaultActive
                ? '0 0 6px rgba(229, 83, 75, 0.4)'
                : '0 0 6px rgba(39, 166, 68, 0.4)',
            }}
          />
          <span>{isFaultActive ? 'Fault Ingestion' : 'CAN Stream · 25.6 kHz'}</span>
        </div>

        {/* Linear clean preset buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button
            type="button"
            onClick={() => selectScenario(nominalRun, 0, false)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              height: 28,
              padding: '0 10px',
              fontSize: 12,
              borderRadius: 'var(--rounded-sm)',
              border: `1px solid ${runId === nominalRun?.id ? 'var(--color-hairline-strong)' : 'var(--color-hairline)'}`,
              backgroundColor: runId === nominalRun?.id ? 'var(--color-surface-3)' : 'var(--color-surface-1)',
              color: runId === nominalRun?.id ? 'var(--color-ink)' : 'var(--color-ink-subtle)',
              cursor: 'pointer',
              fontWeight: 500,
              whiteSpace: 'nowrap',
              transition: 'all 150ms ease-out',
            }}
            title="Nominal highway cruise scenario"
          >
            <span style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: 'var(--color-semantic-success)' }} />
            <span>Nominal</span>
          </button>

          <button
            type="button"
            onClick={() => selectScenario(knockRun, 55, true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              height: 28,
              padding: '0 10px',
              fontSize: 12,
              borderRadius: 'var(--rounded-sm)',
              border: `1px solid ${runId === knockRun?.id ? 'var(--color-hairline-strong)' : 'var(--color-hairline)'}`,
              backgroundColor: runId === knockRun?.id ? 'var(--color-surface-3)' : 'var(--color-surface-1)',
              color: runId === knockRun?.id ? 'var(--color-ink)' : 'var(--color-ink-subtle)',
              cursor: 'pointer',
              fontWeight: 500,
              whiteSpace: 'nowrap',
              transition: 'all 150ms ease-out',
            }}
            title="Inject Cylinder 2 Knock scenario at t=55s and auto-play"
          >
            <span style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: '#d97706' }} />
            <span>Knock (Cyl 2)</span>
          </button>

          <button
            type="button"
            onClick={() => selectScenario(misfireRun, 45, true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              height: 28,
              padding: '0 10px',
              fontSize: 12,
              borderRadius: 'var(--rounded-sm)',
              border: `1px solid ${runId === misfireRun?.id ? 'var(--color-hairline-strong)' : 'var(--color-hairline)'}`,
              backgroundColor: runId === misfireRun?.id ? 'var(--color-surface-3)' : 'var(--color-surface-1)',
              color: runId === misfireRun?.id ? 'var(--color-ink)' : 'var(--color-ink-subtle)',
              cursor: 'pointer',
              fontWeight: 500,
              whiteSpace: 'nowrap',
              transition: 'all 150ms ease-out',
            }}
            title="Inject Cylinder 4 Misfire scenario at t=45s and auto-play"
          >
            <span style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: '#e5534b' }} />
            <span>Misfire (Cyl 4)</span>
          </button>
        </div>

        {/* Dropdown for All 13 Scenarios */}
        <select
          value={runId || ''}
          onChange={(e) => {
            const found = runs.find((r: any) => r.id === e.target.value);
            if (found) selectScenario(found, 0, false);
          }}
          aria-label="Active run scenario"
          style={{
            maxWidth: 190,
            height: 28,
            padding: '0 8px',
            fontSize: 11,
            backgroundColor: 'var(--color-surface-1)',
            color: 'var(--color-ink-muted)',
            border: '1px solid var(--color-hairline)',
            borderRadius: 'var(--rounded-sm)',
            cursor: 'pointer',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
          }}
        >
          {runs.map((r: any) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </div>

      {/* Right: Master Playhead & 0.5x - 16x Speed Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
        {/* Step Backward */}
        <button
          type="button"
          onClick={stepBackward}
          className="btn btn-secondary"
          style={{
            width: 30,
            height: 30,
            padding: 0,
            fontSize: 12,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 'var(--rounded-sm)',
          }}
          title="Step back 1 window"
        >
          ⏮
        </button>

        {/* Play / Pause Primary CTA */}
        <button
          type="button"
          onClick={togglePlay}
          className="btn btn-primary"
          style={{
            height: 30,
            padding: '0 12px',
            fontSize: 12,
            fontWeight: 500,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            borderRadius: 'var(--rounded-sm)',
          }}
          title={isPlaying ? 'Pause replay' : 'Play replay'}
        >
          <span>{isPlaying ? '⏸' : '▶'}</span>
          <span>{isPlaying ? 'Pause' : 'Play'}</span>
        </button>

        {/* Step Forward */}
        <button
          type="button"
          onClick={stepForward}
          className="btn btn-secondary"
          style={{
            width: 30,
            height: 30,
            padding: 0,
            fontSize: 12,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 'var(--rounded-sm)',
          }}
          title="Step forward 1 window"
        >
          ⏭
        </button>

        {/* Scrubber slider */}
        <input
          type="range"
          min={0}
          max={duration}
          step={0.5}
          value={currentTime}
          onChange={(e) => setCurrentTime(parseFloat(e.target.value))}
          aria-label="Master timeline scrubber"
          style={{
            width: 120,
            accentColor: 'var(--color-primary)',
            cursor: 'pointer',
          }}
        />

        {/* Timestamp readout in JetBrains Mono */}
        <span
          className="type-mono"
          style={{
            fontSize: 12,
            minWidth: 86,
            textAlign: 'right',
            letterSpacing: '0.02em',
          }}
        >
          <strong style={{ color: 'var(--color-ink)' }}>{formatTime(currentTime)}</strong>
          <span style={{ color: 'var(--color-ink-subtle)' }}> / {formatTime(duration)}</span>
        </span>

        {/* Linear Segmented Speed Pill Toggle (0.5x, 1x, 2x, 4x, 8x, 16x) */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            backgroundColor: 'var(--color-surface-1)',
            border: '1px solid var(--color-hairline)',
            borderRadius: 'var(--rounded-pill)',
            padding: 2,
            gap: 1,
          }}
          title="Playback speed"
        >
          {SPEED_OPTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSpeed(s)}
              style={{
                border: 'none',
                padding: '2px 7px',
                fontSize: 11,
                borderRadius: 'var(--rounded-pill)',
                backgroundColor: speed === s ? 'var(--color-surface-3)' : 'transparent',
                color: speed === s ? 'var(--color-ink)' : 'var(--color-ink-subtle)',
                cursor: 'pointer',
                fontWeight: speed === s ? 600 : 400,
                transition: 'all 150ms ease-out',
                lineHeight: '16px',
              }}
            >
              {s}x
            </button>
          ))}
        </div>

        {/* Fault Onset Shortcut */}
        {onsetTime !== undefined && onsetTime !== null && (
          <button
            type="button"
            onClick={() => setCurrentTime(Math.max(0, onsetTime - 2))}
            style={{
              height: 28,
              padding: '0 8px',
              fontSize: 11,
              borderRadius: 'var(--rounded-sm)',
              border: '1px solid rgba(229, 83, 75, 0.25)',
              backgroundColor: 'rgba(229, 83, 75, 0.08)',
              color: '#e5534b',
              cursor: 'pointer',
              fontWeight: 500,
              whiteSpace: 'nowrap',
              transition: 'all 150ms ease-out',
            }}
            title={`Jump to fault onset at ${onsetTime}s`}
          >
            Onset · {onsetTime}s
          </button>
        )}
      </div>
    </header>
  );
};
