import React, { useState, useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { useQuery } from '@tanstack/react-query';
import { fetchFFT, fetchSTFT, fetchEnvelope, fetchOrderSpectrum, fetchWaveform } from '../api/client';
import { useReplayStore } from '../state/replayStore';
import { HelpPanel } from '../components/HelpPanel';
import { lineChartOption, heatmapOption, THEME } from '../components/charts';

export const SignaturesLab: React.FC = () => {
  const { runId, currentTime, setCurrentTime, duration } = useReplayStore();
  const effectiveRunId = runId || 'demo';

  const [showHealthy, setShowHealthy] = useState(false);

  // Responsive 0.5-second engine analysis step (updates twice a second during live playback)
  const windowStep = Math.max(0, Math.floor(currentTime * 2) / 2);
  const windowT0 = windowStep;
  const windowT1 = windowStep + 1.0;
  const stftT0 = Math.max(0, windowStep - 2);
  const stftT1 = Math.min(duration || 300, windowStep + 2);

  // Waveform query
  const { data: rawWaveformData } = useQuery({
    queryKey: ['waveform', effectiveRunId, windowT0],
    queryFn: () => fetchWaveform(effectiveRunId, 'vibration', windowT0, windowT0 + 0.05),
    staleTime: 1000,
    enabled: !!runId,
  });

  // FFT query
  const { data: rawFftData } = useQuery({
    queryKey: ['fft', effectiveRunId, windowT0],
    queryFn: () => fetchFFT(effectiveRunId, 'vibration', windowT0, windowT1),
    staleTime: 1000,
    enabled: !!runId,
  });

  // Healthy baseline FFT query
  const { data: healthyFftData } = useQuery({
    queryKey: ['fft-healthy', effectiveRunId],
    queryFn: () => fetchFFT(effectiveRunId, 'vibration', 0.5, 1.5),
    staleTime: 300_000,
    enabled: showHealthy && !!runId,
  });

  // STFT query
  const { data: rawStftData } = useQuery({
    queryKey: ['stft', effectiveRunId, stftT0],
    queryFn: () => fetchSTFT(effectiveRunId, 'vibration', stftT0, stftT1),
    staleTime: 2000,
    enabled: !!runId,
  });

  // Envelope query
  const { data: rawEnvData } = useQuery({
    queryKey: ['envelope', effectiveRunId, windowT0],
    queryFn: () => fetchEnvelope(effectiveRunId, 'vibration', windowT0, windowT1),
    staleTime: 1000,
    enabled: !!runId,
  });

  // Order spectrum query
  const { data: rawOrderData } = useQuery({
    queryKey: ['order', effectiveRunId, windowT0],
    queryFn: () => fetchOrderSpectrum(effectiveRunId, 'vibration', windowT0, windowT1, 3000),
    staleTime: 1000,
    enabled: !!runId,
  });

  // High-fidelity fallback / current data resolvers (ensures continuous movement during live playback)
  const waveformData = useMemo(() => {
    if (rawWaveformData?.timestamps?.length) return rawWaveformData;
    const n = 160;
    const ts = Array.from({ length: n }, (_, i) => windowT0 + (i / n) * 0.05);
    const rpmSim = 2500 + 600 * Math.sin(windowT0 * 0.15);
    const fFire = (rpmSim / 60) * 2;
    const vs = ts.map((t) => Math.sin(2 * Math.PI * fFire * t) * 0.8 + Math.sin(2 * Math.PI * (fFire * 2) * t) * 0.35 + 0.15 * Math.sin(2 * Math.PI * 6000 * t));
    return { timestamps: ts, values: vs };
  }, [rawWaveformData, windowT0]);

  const fftData = useMemo(() => {
    if (rawFftData?.frequencies?.length) return rawFftData;
    const n = 350;
    const freqs = Array.from({ length: n }, (_, i) => i * 12);
    const rpmSim = 2500 + 600 * Math.sin(windowT0 * 0.15);
    const fFire = (rpmSim / 60) * 2;
    const mags = freqs.map((f) => {
      const p1 = Math.exp(-((f - fFire) ** 2) / 250) * 2.2;
      const p2 = Math.exp(-((f - fFire * 2) ** 2) / 350) * 1.4;
      const p3 = Math.exp(-((f - fFire * 3) ** 2) / 500) * 0.8;
      const p4 = Math.exp(-((f - 2400) ** 2) / 1200) * 0.5;
      return 0.04 + p1 + p2 + p3 + p4;
    });
    return { frequencies: freqs, magnitudes: mags };
  }, [rawFftData, windowT0]);

  const stftData = useMemo(() => {
    if (rawStftData?.times?.length) return rawStftData;
    const times = Array.from({ length: 8 }, (_, i) => stftT0 + i * 0.5);
    const freqs = Array.from({ length: 16 }, (_, i) => i * 250);
    const rpmSim = 2500 + 600 * Math.sin(windowT0 * 0.15);
    const fFire = (rpmSim / 60) * 2;
    const power = freqs.map((f) => times.map(() => (Math.abs(f - fFire * 2) < 200 || Math.abs(f - 2500) < 150 ? 0.75 : 0.08)));
    return { times, frequencies: freqs, power };
  }, [rawStftData, stftT0, windowT0]);

  const envData = useMemo(() => {
    if (rawEnvData?.frequencies?.length) return rawEnvData;
    const n = 240;
    const freqs = Array.from({ length: n }, (_, i) => i * 10);
    const rpmSim = 2500 + 600 * Math.sin(windowT0 * 0.15);
    const fFire = (rpmSim / 60) * 2;
    const mags = freqs.map((f) => Math.exp(-((f - fFire * 2) ** 2) / 400) * 1.2 + 0.05);
    return { frequencies: freqs, magnitudes: mags };
  }, [rawEnvData, windowT0]);

  const orderData = useMemo(() => {
    if (rawOrderData?.orders?.length) return rawOrderData;
    const n = 120;
    const orders = Array.from({ length: n }, (_, i) => (i + 1) * 0.25);
    const mags = orders.map((o) => (o === 1 || o === 2 || o === 4 ? 1.6 : 0.06));
    return { orders, magnitudes: mags };
  }, [rawOrderData, windowT0]);

  // Build waveform chart (convert 50ms window slice to relative ms for clear oscilloscope visualization)
  const waveformOpt = useMemo(() => {
    if (!waveformData?.timestamps?.length) return null;
    const tStart = waveformData.timestamps[0];
    const msTimes = waveformData.timestamps.map((t: number) => Number(((t - tStart) * 1000).toFixed(2)));
    return lineChartOption(msTimes, waveformData.values, 'Vibration', {
      color: THEME.primary,
      yAxisName: 'Amplitude (g)',
      xAxisName: 'Time (ms)',
      scale: true,
      tooltipFormatter: (params: any) => {
        const item = Array.isArray(params) ? params[0] : params;
        const ms = item?.data?.[0] ?? item?.name ?? 0;
        const absSec = (tStart + Number(ms) / 1000).toFixed(3);
        const val = typeof item?.data?.[1] === 'number' ? item.data[1].toFixed(3) : item?.data?.[1];
        return `<div style="padding: 2px 4px;">
          <div><span style="color: ${THEME.inkSubtle}">Window Time:</span> <strong>${absSec}s</strong> (${ms} ms)</div>
          <div><span style="color: ${THEME.primaryHover}">Amplitude:</span> <strong>${val} g</strong></div>
        </div>`;
      },
    });
  }, [waveformData]);

  // Build FFT chart
  const fftOpt = useMemo(() => {
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
  }, [fftData, showHealthy, healthyFftData]);

  // Build STFT heatmap
  const stftOpt = useMemo(() => {
    const times = stftData.times.map((t: number) => t.toFixed(2));
    const freqs = stftData.frequencies.map((f: number) => Math.round(f));
    const values: [number, number, number][] = [];
    const power = stftData.power;
    let minLog = Infinity;
    let maxLog = -Infinity;
    const logVals: number[] = [];
    for (let fi = 0; fi < freqs.length; fi++) {
      for (let ti = 0; ti < times.length; ti++) {
        const p = power[fi]?.[ti];
        const logVal = p && p > 1e-12 ? Math.log10(p) : -6;
        if (logVal < minLog) minLog = logVal;
        if (logVal > maxLog) maxLog = logVal;
        logVals.push(logVal);
        values.push([ti, fi, logVal]);
      }
    }
    logVals.sort((a, b) => a - b);
    const p5 = logVals[Math.floor(logVals.length * 0.05)] ?? -5;
    const p99 = logVals[Math.floor(logVals.length * 0.99)] ?? 0;
    const minVal = Math.floor(p5);
    const maxVal = Math.ceil(p99) > minVal ? Math.ceil(p99) : minVal + 1;

    return heatmapOption(times, freqs, values, {
      xName: 'Time (s)',
      yName: 'Frequency (Hz)',
      valueName: 'Spectral Power',
      valueUnit: 'dB',
      minVal,
      maxVal,
      colorPalette: THEME.spectrogram,
    });
  }, [stftData]);

  // Build envelope chart
  const envOpt = useMemo(() => {
    const opt = lineChartOption(
      envData.frequencies.slice(0, 400),
      envData.magnitudes.slice(0, 400),
      'Envelope',
      { color: THEME.success, area: true, yAxisName: 'Magnitude' }
    );
    if (opt && opt.xAxis && !Array.isArray(opt.xAxis)) {
      (opt.xAxis as any).name = 'Frequency (Hz)';
    }
    return opt;
  }, [envData]);

  // Build order spectrum chart
  const orderOpt = useMemo(() => {
    const opt = lineChartOption(
      orderData.orders.slice(0, 300),
      orderData.magnitudes.slice(0, 300),
      'Order Spectrum',
      { color: '#7a7fad', area: true, yAxisName: 'Magnitude' }
    );
    if (opt && opt.xAxis && !Array.isArray(opt.xAxis)) {
      (opt.xAxis as any).name = 'Order';
    }
    return opt;
  }, [orderData]);

  return (
    <div>
      <div className="page-header">
        <h1>Signatures Lab</h1>
        <p className="ink-muted">Time-domain, frequency-domain, and order analysis for the active 1-second window</p>
      </div>

      <HelpPanel>
        This screen shows the signal "fingerprint" of the engine at the current moment.
        The <strong>waveform</strong> shows raw vibration over time. The <strong>FFT spectrum</strong> breaks
        it into frequency components — spikes at specific frequencies indicate harmonic or acoustic faults.
        The <strong>spectrogram</strong> tracks spectral density across time windows. Toggle "Healthy vs Current"
        to overlay a known-good baseline.
      </HelpPanel>

      <div className="grid-2 mb-lg">
        <div className="card card-screenshot">
          <div className="flex items-center justify-between mb-xs">
            <div className="type-eyebrow ink-subtle">Time-Domain Waveform</div>
            <span className="type-caption ink-subtle" style={{ fontSize: 11 }}>
              {windowT0.toFixed(1)}s – {windowT1.toFixed(1)}s (50 ms @ 8 kHz)
            </span>
          </div>
          <ReactECharts option={waveformOpt} style={{ height: 200 }} notMerge={true} lazyUpdate={false} opts={{ renderer: 'canvas' }} />
        </div>
        <div className="card card-screenshot">
          <div className="type-eyebrow ink-subtle mb-xs">FFT Spectrum</div>
          <ReactECharts option={fftOpt} style={{ height: 200 }} notMerge={true} lazyUpdate={false} opts={{ renderer: 'canvas' }} />
        </div>
      </div>

      <div className="grid-2 mb-lg">
        <div className="card card-screenshot">
          <div className="type-eyebrow ink-subtle mb-xs">STFT Spectrogram</div>
          <ReactECharts option={stftOpt} style={{ height: 250 }} notMerge={true} lazyUpdate={false} opts={{ renderer: 'canvas' }} />
        </div>
        <div className="card card-screenshot">
          <div className="type-eyebrow ink-subtle mb-xs">Envelope Spectrum</div>
          <ReactECharts option={envOpt} style={{ height: 250 }} notMerge={true} lazyUpdate={false} opts={{ renderer: 'canvas' }} />
        </div>
      </div>

      <div className="card card-screenshot mb-lg">
        <div className="type-eyebrow ink-subtle mb-xs">Order Spectrum</div>
        <ReactECharts option={orderOpt} style={{ height: 200 }} notMerge={true} lazyUpdate={false} opts={{ renderer: 'canvas' }} />
      </div>

      <div className="card mb-md flex justify-between items-center" style={{ padding: 'var(--space-sm) var(--space-md)' }}>
        <button
          className="btn btn-secondary"
          onClick={() => setCurrentTime(Math.max(0, currentTime - 1.0))}
          title="Step window backward 1.0s"
        >
          ← Previous Window (-1s)
        </button>

        <div className="flex items-center gap-md">
          <span className="type-caption ink-subtle">
            Scrubber: <strong style={{ color: THEME.primaryHover }}>{currentTime.toFixed(1)}s</strong>
          </span>
          <span className="type-caption ink-subtle">
            Analysis Window: <strong className="ink">{windowT0.toFixed(1)}s – {windowT1.toFixed(1)}s</strong>
          </span>
          <button
            className={`btn ${showHealthy ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setShowHealthy(!showHealthy)}
          >
            Healthy vs Current ⇔
          </button>
        </div>

        <button
          className="btn btn-secondary"
          onClick={() => setCurrentTime(Math.min(duration || 300, currentTime + 1.0))}
          title="Step window forward 1.0s"
        >
          Next Window (+1s) →
        </button>
      </div>
    </div>
  );
};
