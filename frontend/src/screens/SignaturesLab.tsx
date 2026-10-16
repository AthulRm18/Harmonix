import React, { useState } from 'react';
import ReactECharts from 'echarts-for-react';
import { useQuery } from '@tanstack/react-query';
import { fetchFFT, fetchSTFT, fetchEnvelope, fetchOrderSpectrum, fetchWaveform } from '../api/client';
import { useReplayStore } from '../state/replayStore';
import { HelpPanel } from '../components/HelpPanel';
import { lineChartOption, heatmapOption, THEME } from '../components/charts';

export const SignaturesLab: React.FC = () => {
  const { runId, currentTime } = useReplayStore();
  const effectiveRunId = runId || 'demo';
  const t0 = Math.max(0, currentTime - 0.5);
  const t1 = currentTime + 0.5;
  const stftT0 = Math.max(0, currentTime - 2);
  const stftT1 = currentTime + 2;

  const [showHealthy, setShowHealthy] = useState(false);
  const [windowIdx, setWindowIdx] = useState(0);

  const windowT0 = t0 + windowIdx * 1.0;
  const windowT1 = t1 + windowIdx * 1.0;

  // Waveform query
  const { data: waveformData, isLoading: wfLoading } = useQuery({
    queryKey: ['waveform', effectiveRunId, windowT0, windowT1],
    queryFn: () => fetchWaveform(effectiveRunId, 'vibration', windowT0, windowT0 + 0.05),
  });

  // FFT query
  const { data: fftData, isLoading: fftLoading } = useQuery({
    queryKey: ['fft', effectiveRunId, windowT0, windowT1],
    queryFn: () => fetchFFT(effectiveRunId, 'vibration', windowT0, windowT1),
  });

  // Healthy baseline FFT query (early run before fault onset)
  const { data: healthyFftData } = useQuery({
    queryKey: ['fft-healthy', effectiveRunId],
    queryFn: () => fetchFFT(effectiveRunId, 'vibration', 0.5, 1.5),
    enabled: showHealthy,
  });

  // STFT query
  const { data: stftData, isLoading: stftLoading } = useQuery({
    queryKey: ['stft', effectiveRunId, stftT0, stftT1],
    queryFn: () => fetchSTFT(effectiveRunId, 'vibration', stftT0, stftT1),
  });

  // Envelope query
  const { data: envData, isLoading: envLoading } = useQuery({
    queryKey: ['envelope', effectiveRunId, windowT0, windowT1],
    queryFn: () => fetchEnvelope(effectiveRunId, 'vibration', windowT0, windowT1),
  });

  // Order spectrum query
  const { data: orderData, isLoading: orderLoading } = useQuery({
    queryKey: ['order', effectiveRunId, windowT0, windowT1],
    queryFn: () => fetchOrderSpectrum(effectiveRunId, 'vibration', windowT0, windowT1, 3000),
  });

  // Build waveform chart
  const waveformOpt = waveformData
    ? lineChartOption(waveformData.timestamps, waveformData.values, 'Vibration', {
      color: THEME.primary,
      yAxisName: 'Amplitude',
    })
    : null;

  // Build FFT chart
  const fftOpt = fftData
    ? (() => {
        const nPts = Math.min(fftData.frequencies.length, 500);
        const freqs = fftData.frequencies.slice(0, nPts);
        const mags = fftData.magnitudes.slice(0, nPts);
        const base = lineChartOption(
          freqs,
          mags,
          showHealthy ? 'Current Window' : 'FFT Magnitude',
          { color: THEME.primaryHover, area: !showHealthy, yAxisName: 'Magnitude' }
        );
        if (showHealthy && healthyFftData) {
          const healthyMags = healthyFftData.magnitudes.slice(0, nPts);
          (base as any).legend = {
            show: true,
            top: 4,
            textStyle: { color: THEME.inkMuted, fontSize: 11 },
          };
          (base as any).series = [
            {
              name: 'Current Window',
              type: 'line',
              data: freqs.map((f: number, i: number) => [f, mags[i]]),
              lineStyle: { color: THEME.primaryHover, width: 1.5 },
              showSymbol: false,
            },
            {
              name: 'Healthy Baseline',
              type: 'line',
              data: freqs.map((f: number, i: number) => [f, healthyMags[i]]),
              lineStyle: { color: THEME.success, width: 1.5, type: 'dashed' },
              showSymbol: false,
            },
          ];
        }
        if (base && base.xAxis && !Array.isArray(base.xAxis)) {
          (base.xAxis as any).name = 'Frequency (Hz)';
        }
        return base;
      })()
    : null;

  // Build STFT heatmap
  const stftOpt = stftData ? (() => {
    const times = stftData.times.map((t: number) => t.toFixed(2));
    const freqs = stftData.frequencies.map((f: number) => Math.round(f));
    const values: [number, number, number][] = [];
    const power = stftData.power;
    // Find max for normalisation
    let maxPow = 0;
    for (let fi = 0; fi < power.length; fi++) {
      for (let ti = 0; ti < power[fi].length; ti++) {
        if (power[fi][ti] > maxPow) maxPow = power[fi][ti];
      }
    }
    for (let fi = 0; fi < freqs.length; fi++) {
      for (let ti = 0; ti < times.length; ti++) {
        values.push([ti, fi, power[fi]?.[ti] ? Math.log10(power[fi][ti] + 1e-10) : 0]);
      }
    }
    const logMax = Math.log10(maxPow + 1e-10);
    return heatmapOption(times, freqs, values, {
      xName: 'Time (s)',
      yName: 'Frequency (Hz)',
      minVal: -10,
      maxVal: logMax,
      colorRange: [THEME.surface2, '#a5aeff'],
    });
  })() : null;

  // Build envelope chart
  const envOpt = envData
    ? lineChartOption(
      envData.frequencies.slice(0, 400),
      envData.magnitudes.slice(0, 400),
      'Envelope',
      { color: THEME.success, area: true, yAxisName: 'Magnitude' }
    )
    : null;
  if (envOpt && envOpt.xAxis && !Array.isArray(envOpt.xAxis)) {
    (envOpt.xAxis as any).name = 'Frequency (Hz)';
  }

  // Build order spectrum chart
  const orderOpt = orderData
    ? lineChartOption(
      orderData.orders.slice(0, 300),
      orderData.magnitudes.slice(0, 300),
      'Order Spectrum',
      { color: '#7a7fad', area: true, yAxisName: 'Magnitude' }
    )
    : null;
  if (orderOpt && orderOpt.xAxis && !Array.isArray(orderOpt.xAxis)) {
    (orderOpt.xAxis as any).name = 'Order';
  }

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
          {wfLoading ? (
            <div className="skeleton" style={{ minHeight: 200 }} />
          ) : waveformOpt ? (
            <ReactECharts option={waveformOpt} style={{ height: 200 }} opts={{ renderer: 'canvas' }} />
          ) : (
            <div className="skeleton" style={{ minHeight: 200 }} />
          )}
        </div>
        <div className="card card-screenshot">
          <div className="type-eyebrow ink-subtle mb-xs">FFT Spectrum</div>
          {fftLoading ? (
            <div className="skeleton" style={{ minHeight: 200 }} />
          ) : fftOpt ? (
            <ReactECharts option={fftOpt} style={{ height: 200 }} opts={{ renderer: 'canvas' }} />
          ) : (
            <div className="skeleton" style={{ minHeight: 200 }} />
          )}
        </div>
      </div>

      <div className="grid-2 mb-lg">
        <div className="card card-screenshot">
          <div className="type-eyebrow ink-subtle mb-xs">STFT Spectrogram</div>
          {stftLoading ? (
            <div className="skeleton" style={{ minHeight: 250 }} />
          ) : stftOpt ? (
            <ReactECharts option={stftOpt} style={{ height: 250 }} opts={{ renderer: 'canvas' }} />
          ) : (
            <div className="skeleton" style={{ minHeight: 250 }} />
          )}
        </div>
        <div className="card card-screenshot">
          <div className="type-eyebrow ink-subtle mb-xs">Envelope Spectrum</div>
          {envLoading ? (
            <div className="skeleton" style={{ minHeight: 250 }} />
          ) : envOpt ? (
            <ReactECharts option={envOpt} style={{ height: 250 }} opts={{ renderer: 'canvas' }} />
          ) : (
            <div className="skeleton" style={{ minHeight: 250 }} />
          )}
        </div>
      </div>

      <div className="card card-screenshot mb-lg">
        <div className="type-eyebrow ink-subtle mb-xs">Order Spectrum</div>
        {orderLoading ? (
          <div className="skeleton" style={{ minHeight: 200 }} />
        ) : orderOpt ? (
          <ReactECharts option={orderOpt} style={{ height: 200 }} opts={{ renderer: 'canvas' }} />
        ) : (
          <div className="skeleton" style={{ minHeight: 200 }} />
        )}
      </div>

      <div className="flex justify-between items-center mb-md">
        <button className="btn btn-secondary" onClick={() => setWindowIdx(Math.max(0, windowIdx - 1))}>
          ← Previous Window
        </button>
        <button
          className={`btn ${showHealthy ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setShowHealthy(!showHealthy)}
        >
          Healthy vs Current ⇔
        </button>
        <button className="btn btn-secondary" onClick={() => setWindowIdx(windowIdx + 1)}>
          Next Window →
        </button>
      </div>
    </div>
  );
};
