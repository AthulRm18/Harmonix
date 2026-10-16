import React from 'react';
import { NavLink } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchRuns } from '../api/client';
import { useReplayStore } from '../state/replayStore';
import { THEME } from './charts';
import './Sidebar.css';

const NAV_ITEMS = [
  { to: '/', label: 'Replay Dashboard', icon: '▶' },
  { to: '/signatures', label: 'Signatures Lab', icon: '〜' },
  { to: '/sensors', label: 'Sensor Lab', icon: '⌬' },
  { to: '/diagnosis', label: 'Diagnosis', icon: '⊕' },
  { to: '/prognosis', label: 'Prognosis', icon: '↗' },
  { to: '/optimizer', label: 'Sweet Spot', icon: '◎' },
  { to: '/models', label: 'Models & Data', icon: '◈' },
];

export const Sidebar: React.FC = () => {
  const { runId, currentTime, duration, isPlaying, togglePlay } = useReplayStore();

  const { data: runsData } = useQuery({
    queryKey: ['runs'],
    queryFn: () => fetchRuns(),
  });

  const activeRun = runsData?.runs?.find((r: any) => r.id === runId);

  const formatTime = (t: number) => {
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <aside className="sidebar" role="navigation" aria-label="Main navigation">
      <div className="sidebar-header">
        <div className="sidebar-brand">
          <span className="sidebar-logo">⚙</span>
          <span className="sidebar-title type-card-title">Harmonix</span>
        </div>
        <p className="type-caption ink-subtle">Engine Diagnostics</p>
      </div>

      <nav className="sidebar-nav">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `sidebar-link${isActive ? ' active' : ''}`
            }
            end={item.to === '/'}
          >
            <span className="sidebar-link-icon">{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Live Replay Status Widget */}
      {activeRun && (
        <div
          style={{
            margin: 'var(--space-sm) var(--space-md)',
            padding: 'var(--space-sm)',
            borderRadius: 'var(--rounded-md)',
            background: 'var(--color-surface-2)',
            border: '1px solid var(--color-hairline)',
          }}
        >
          <div className="flex justify-between items-center mb-xs">
            <span className="type-caption ink-subtle" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Telemetry
            </span>
            <button
              onClick={togglePlay}
              className="badge"
              style={{
                cursor: 'pointer',
                fontSize: 10,
                color: isPlaying ? THEME.success : THEME.inkSubtle,
                border: 'none',
                background: 'transparent',
                padding: '0 4px',
              }}
              title="Click to play / pause"
            >
              {isPlaying ? '● LIVE' : '⏸ PAUSED'}
            </button>
          </div>
          <div
            className="type-body-sm ink"
            style={{
              fontWeight: 500,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              marginBottom: 4,
            }}
            title={activeRun.name}
          >
            {activeRun.name}
          </div>
          <div className="flex justify-between items-center type-mono" style={{ fontSize: 11, color: THEME.primaryHover }}>
            <span>{formatTime(currentTime)}</span>
            <span className="ink-subtle" style={{ fontSize: 10 }}>/ {formatTime(duration)}</span>
          </div>
        </div>
      )}

      <div className="sidebar-footer">
        <div className="badge">v0.1.0</div>
      </div>
    </aside>
  );
};

