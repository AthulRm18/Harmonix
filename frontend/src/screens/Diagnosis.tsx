import React from 'react';
import { HelpPanel } from '../components/HelpPanel';

export const Diagnosis: React.FC = () => {
  return (
    <div>
      <div className="page-header">
        <h1>Diagnosis & Explainability</h1>
        <p className="ink-muted">Multi-model classification with transparent explanations</p>
      </div>

      <HelpPanel>
        Three different AI models (CNN, SVM, ANN) independently classify the engine's condition.
        Below each classification, you can see <strong>why</strong> the model made its decision:
        which signal features mattered most, which time-frequency regions were important,
        and a plain-language summary of the finding.
      </HelpPanel>

      {/* Model Comparison */}
      <div className="grid-3 mb-lg">
        {['CNN', 'SVM', 'ANN'].map((model) => (
          <div key={model} className="card">
            <div className="type-eyebrow ink-subtle mb-xs">{model} Classifier</div>
            <div className="type-headline mb-xs">Normal</div>
            <div className="type-caption ink-subtle mb-sm">Confidence: 0.92</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xxs)' }}>
              {['normal', 'knock', 'misfire', 'valve_wear', 'ignition_fault'].map((cls) => (
                <div key={cls} className="flex items-center gap-sm">
                  <span className="type-caption ink-subtle" style={{ width: 100 }}>{cls}</span>
                  <div style={{
                    flex: 1, height: 6, background: 'var(--color-hairline-strong)',
                    borderRadius: 'var(--rounded-pill)', overflow: 'hidden'
                  }}>
                    <div style={{
                      height: '100%',
                      width: cls === 'normal' ? '92%' : `${Math.random() * 5}%`,
                      background: 'var(--color-primary)',
                      borderRadius: 'var(--rounded-pill)',
                      transition: 'width 300ms ease-out',
                    }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Explainability */}
      <div className="grid-2 mb-lg">
        <div className="card card-screenshot">
          <div className="type-eyebrow ink-subtle mb-xs">Grad-CAM Overlay (CNN)</div>
          <div className="sensor-chart-placeholder" style={{ minHeight: 250 }}>
            <span className="type-body-sm ink-subtle">Spectrogram with attention heatmap</span>
          </div>
        </div>
        <div className="card card-screenshot">
          <div className="type-eyebrow ink-subtle mb-xs">SHAP Feature Importance</div>
          <div className="sensor-chart-placeholder" style={{ minHeight: 250 }}>
            <span className="type-body-sm ink-subtle">Feature attribution waterfall</span>
          </div>
        </div>
      </div>

      {/* Physics Explanation */}
      <div className="card mb-lg">
        <div className="type-eyebrow ink-subtle mb-xs">Physics-Based Explanation</div>
        <div className="type-body ink-muted">
          All monitored parameters are within normal operating ranges.
          No anomalous frequency content detected in the knock band (6–8 kHz).
          Fuel trims are stable. No cylinder-specific deviations observed.
        </div>
      </div>

      {/* Plain Language Summary */}
      <div className="card" style={{ borderLeft: '2px solid var(--color-primary)' }}>
        <div className="type-eyebrow ink-subtle mb-xs">Plain-Language Summary</div>
        <div className="type-body-lg">
          ✓ Engine is operating normally. All three models agree with high confidence (&gt;90%).
          No faults detected. Combustion is stable across all four cylinders.
        </div>
      </div>
    </div>
  );
};
