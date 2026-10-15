import React from 'react';

interface HelpPanelProps {
  title?: string;
  children: React.ReactNode;
}

export const HelpPanel: React.FC<HelpPanelProps> = ({
  title = 'What am I looking at?',
  children,
}) => {
  const [open, setOpen] = React.useState(false);

  return (
    <div className="help-panel">
      <button
        className="btn btn-tertiary"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        style={{ width: '100%', justifyContent: 'space-between' }}
      >
        <span className="help-panel-title" style={{ margin: 0 }}>
          {title}
        </span>
        <span style={{ color: 'var(--color-ink-subtle)' }}>
          {open ? '▲' : '▼'}
        </span>
      </button>
      {open && <div className="help-panel-text" style={{ marginTop: 'var(--space-xs)' }}>{children}</div>}
    </div>
  );
};
