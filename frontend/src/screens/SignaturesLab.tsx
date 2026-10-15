import React from 'react';
import { HelpPanel } from '../components/HelpPanel';

export const SignaturesLab: React.FC = () => {
  return (
    <div>
      <div className="page-header">
        <h1>Signatures Lab</h1>
        <p className="ink-muted">Time-domain, frequency-domain, and order analysis for the selected window</p>
      </div>

      <HelpPanel>
        This screen shows the signal "fingerprint" of the engine at the current moment.
        The <strong>waveform</strong> shows the raw vibration/sound over time. The <strong>FFT spectrum</strong> breaks
        it into frequency components — spikes at certain frequencies indicate specific mechanical events.
        The <strong>spectrogram</strong> shows how frequencies change over time. Toggle "Healthy vs Current"
        to compare against a known-good baseline.
      </HelpPanel>

      <div className="grid-2 mb-lg">
        <div className="card card-screenshot">
          <div className="type-eyebrow ink-subtle mb-xs">Time-Domain Waveform</div>
          <div className="sensor-chart-placeholder" style={{ minHeight: 200 }}>
            <span className="type-body-sm ink-subtle">Waveform chart</span>
          </div>
        </div>
        <div className="card card-screenshot">
          <div className="type-eyebrow ink-subtle mb-xs">FFT Spectrum</div>
          <div className="sensor-chart-placeholder" style={{ minHeight: 200 }}>
            <span className="type-body-sm ink-subtle">Frequency spectrum</span>
          </div>
        </div>
      </div>

      <div className="grid-2 mb-lg">
        <div className="card card-screenshot">
          <div className="type-eyebrow ink-subtle mb-xs">STFT Spectrogram</div>
          <div className="sensor-chart-placeholder" style={{ minHeight: 250 }}>
            <span className="type-body-sm ink-subtle">Time-frequency spectrogram</span>
          </div>
        </div>
        <div className="card card-screenshot">
          <div className="type-eyebrow ink-subtle mb-xs">Envelope Spectrum</div>
          <div className="sensor-chart-placeholder" style={{ minHeight: 250 }}>
            <span className="type-body-sm ink-subtle">Hilbert envelope spectrum</span>
          </div>
        </div>
      </div>

      <div className="card card-screenshot mb-lg">
        <div className="type-eyebrow ink-subtle mb-xs">Order Spectrum</div>
        <div className="sensor-chart-placeholder" style={{ minHeight: 200 }}>
          <span className="type-body-sm ink-subtle">Order analysis (angular domain)</span>
        </div>
      </div>

      <div className="flex justify-between items-center mb-md">
        <button className="btn btn-secondary">← Previous Window</button>
        <button className="btn btn-primary">Healthy vs Current ⇔</button>
        <button className="btn btn-secondary">Next Window →</button>
      </div>
    </div>
  );
};
