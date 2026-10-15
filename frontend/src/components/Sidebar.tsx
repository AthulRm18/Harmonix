import React from 'react';
import { NavLink } from 'react-router-dom';
import './Sidebar.css';

const NAV_ITEMS = [
  { to: '/', label: 'Replay Dashboard', icon: '▶' },
  { to: '/signatures', label: 'Signatures Lab', icon: '〜' },
  { to: '/diagnosis', label: 'Diagnosis', icon: '⊕' },
  { to: '/prognosis', label: 'Prognosis', icon: '↗' },
  { to: '/optimizer', label: 'Sweet Spot', icon: '◎' },
  { to: '/models', label: 'Models & Data', icon: '◈' },
];

export const Sidebar: React.FC = () => {
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
      <div className="sidebar-footer">
        <div className="badge">v0.1.0</div>
      </div>
    </aside>
  );
};
