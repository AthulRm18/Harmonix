import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import ReactECharts from 'echarts-for-react';
import { useReplayStore } from '../state/replayStore';
import { fetchRunCorrelations, fetchRunExtremes, fetchFailureModes, fetchRuns } from '../api/client';
import { baseOption, THEME, heatmapOption } from '../components/charts';

type FilterMode = 'all' | 'extremes' | 'correlations' | 'redundancy';

export const SensorIntelligence: React.FC = () => {
  const { runId, currentTime } = useReplayStore();
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [selectedSensorId, setSelectedSensorId] = useState<string>('maf_gps');
  const [selectedPair, setSelectedPair] = useState<[string, string]>(['engine_rpm', 'engine_load']);

  // Fetch runs list for fallback runId
  const { data: runsData } = useQuery({
    queryKey: ['runs'],
    queryFn: () => fetchRuns(),
  });

  const activeRunId = runId || runsData?.runs?.[0]?.id;

  // 1. Fetch Failure Modes & Virtual Surrogates Catalog
  const { data: failureCatalogData } = useQuery({
    queryKey: ['failure-modes'],
    queryFn: () => fetchFailureModes(),
  });

  // 2. Fetch Dynamic Run Correlations
  const { data: corrData, isLoading: corrLoading } = useQuery({
    queryKey: ['run-correlations', activeRunId],
    queryFn: () => fetchRunCorrelations(activeRunId!),
    enabled: !!activeRunId,
  });

  // 3. Fetch Sensor Extremes & Downsampled Series once per run (zero network flicker)
  const { data: extremesData, isLoading: extremesLoading } = useQuery({
    queryKey: ['run-extremes', activeRunId],
    queryFn: () => fetchRunExtremes(activeRunId!),
    enabled: !!activeRunId,
    staleTime: Infinity,
  });

  const catalog = failureCatalogData?.catalog || [];
  const selectedFailureInfo =
    catalog.find((c: any) => c.sensor_id === selectedSensorId) || catalog[0];

  // Dynamically compute live values, operating zones, and Arbiter in memory (smooth 60 FPS, zero flicker)
  const { liveSensors, liveArbiter } = React.useMemo(() => {
    if (!extremesData?.sensors || extremesData.sensors.length === 0) {
      return { liveSensors: [], liveArbiter: extremesData?.arbiter };
    }

    const sensors = extremesData.sensors.map((s: any) => {
      let currentVal = s.current_value;
      if (s.timestamps && s.timestamps.length > 0 && s.values && s.values.length > 0) {
        // Nearest index lookup in downsampled grid
        let bestIdx = 0;
        let minDiff = Math.abs(s.timestamps[0] - currentTime);
        for (let i = 1; i < s.timestamps.length; i++) {
          const diff = Math.abs(s.timestamps[i] - currentTime);
          if (diff < minDiff) {
            minDiff = diff;
            bestIdx = i;
          }
        }
        currentVal = s.values[bestIdx];
      }

      const [normalMin, normalMax] = s.normal_range;
      const range = Math.max(1e-3, normalMax - normalMin);

      let status = 'NOMINAL';
      let status_color = 'var(--color-semantic-success)';
      let physical_note = 'Operating safely within factory design tolerances.';

      if (currentVal > normalMax + 0.3 * range) {
        status = 'PHYSICAL_DAMAGE_THREAT';
        status_color = '#e5534b';
        physical_note = `Exceeded certified maximum of ${normalMax} ${s.unit}. Active risk of mechanical or thermal failure.`;
      } else if (currentVal > normalMax || currentVal < normalMin) {
        status = 'OPERATIONAL_EXTREME';
        status_color = '#e09b24';
        physical_note = `Operating in high-stress envelope outside nominal range (${normalMin}–${normalMax} ${s.unit}).`;
      }

      return {
        ...s,
        current_value: Number(currentVal.toFixed(2)),
        status,
        status_color,
        physical_note,
      };
    });

    // Real-time Arbiter cross-validation
    const currDict = Object.fromEntries(sensors.map((s: any) => [s.sensor_id, s.current_value]));
    const coolant = currDict.coolant_temp ?? 90;
    const oil = currDict.oil_temp ?? 95;
    const mapP = currDict.map_kpa ?? 50;
    const maf = currDict.maf_gps ?? 20;
    const crankFluc = Math.abs(currDict.crank_speed_fluctuation ?? 0);

    let arbiter = extremesData.arbiter;
    if (coolant > 105 && oil < 90) {
      arbiter = {
        verdict: 'SENSOR_ELECTRICAL_FAULT',
        confidence_pct: 91,
        primary_culprit: 'ECT (Coolant Temperature) Sensor',
        title: 'Probable Sensor Electrical Circuit Fault',
        summary:
          'Coolant temperature reads boiling (>105°C) while Engine Oil temperature is completely normal (<90°C). Thermodynamically impossible in a running block without oil heat transfer. High probability of ECT open-circuit or wiring ground short.',
      };
    } else if (coolant > 106 && oil > 115) {
      arbiter = {
        verdict: 'PHYSICAL_ENGINE_FAULT',
        confidence_pct: 97,
        primary_culprit: 'Cooling System / Engine Block Overheating',
        title: 'Verified Physical Engine Thermal Distress',
        summary:
          'Both Coolant and Oil temperatures simultaneously register critical thermal levels (>105°C and >115°C). Dual-sensor physical consistency confirms authentic engine overheating risk.',
      };
    } else if (mapP > 85 && maf < 10) {
      arbiter = {
        verdict: 'SENSOR_ELECTRICAL_FAULT',
        confidence_pct: 89,
        primary_culprit: 'Mass Airflow (MAF) Sensor',
        title: 'Air Induction Discrepancy',
        summary:
          'High intake manifold pressure (MAP) indicates high throttle opening, but MAF airflow is flatlined near zero. High probability of contaminated MAF sensor element or disconnected harness.',
      };
    } else if (crankFluc > 30) {
      arbiter = {
        verdict: 'PHYSICAL_ENGINE_FAULT',
        confidence_pct: 94,
        primary_culprit: 'Cylinder Combustion Instability (Misfire)',
        title: 'Physical Crankshaft Torque Deficit',
        summary: `Crankshaft micro-speed fluctuation is elevated at ±${crankFluc.toFixed(1)} RPM. Physical torque deficit indicates active cylinder misfire or ignition spark collapse.`,
      };
    } else {
      arbiter = {
        verdict: 'NOMINAL',
        confidence_pct: 99,
        primary_culprit: 'None · All Systems Consistent',
        title: 'Multi-Sensor Cross-Validation Passed',
        summary:
          'Cross-sensor physical consistency verified. Sensor readings corroborate one another across thermal, mechanical, and air-induction domains.',
      };
    }

    return { liveSensors: sensors, liveArbiter: arbiter };
  }, [extremesData, currentTime]);

  const sensorsList = liveSensors;
  const arbiter = liveArbiter;

  // Selected sensor for the Extreme Inspector
  const inspectSensor =
    sensorsList.find((s: any) => s.sensor_id === selectedSensorId) || sensorsList[0];


  // Build Correlation Heatmap Option
  const heatmapOpt = React.useMemo(() => {
    if (!corrData || !corrData.matrix || corrData.matrix.length === 0) return null;
    const sensors = corrData.sensors || [];
    const labels = corrData.sensor_labels || sensors;
    const matrix = corrData.matrix;
    const values: [number, number, number][] = [];

    for (let i = 0; i < matrix.length; i++) {
      for (let j = 0; j < matrix[i].length; j++) {
        values.push([j, i, matrix[i][j]]);
      }
    }

    return heatmapOption(labels, labels, values, {
      xName: '',
      yName: '',
      valueName: 'Pearson Correlation (r)',
      minVal: -1.0,
      maxVal: 1.0,
      colorPalette: ['#e5534b', '#b91c1c', '#23252a', '#5e6ad2', '#27a644'],
    });
  }, [corrData]);

  // Handle heatmap click to inspect pair
  const onChartClick = (params: any) => {
    if (params.componentType === 'series' && params.seriesType === 'heatmap' && corrData?.sensors) {
      const xIdx = params.value[0];
      const yIdx = params.value[1];
      const sA = corrData.sensors[yIdx];
      const sB = corrData.sensors[xIdx];
      if (sA && sB) {
        setSelectedPair([sA, sB]);
      }
    }
  };

  // Find correlation for selected pair
  const selectedPairR = React.useMemo(() => {
    if (!corrData?.matrix || !corrData?.sensors) return 1.0;
    const idxA = corrData.sensors.indexOf(selectedPair[0]);
    const idxB = corrData.sensors.indexOf(selectedPair[1]);
    if (idxA >= 0 && idxB >= 0) {
      return corrData.matrix[idxA][idxB];
    }
    return 1.0;
  }, [corrData, selectedPair]);

  return (
    <div className="sensor-intelligence-screen">
      {/* Page Header */}
      <div className="page-header flex items-center justify-between flex-wrap gap-sm">
        <div>
          <h1>Sensor Intelligence Lab</h1>
          <p className="ink-muted">
            Extreme boundary inference, cross-sensor correlations, and cascading failure redundancy
          </p>
        </div>

        {/* View Mode Filter Tabs */}
        <div
          style={{
            display: 'inline-flex',
            backgroundColor: 'var(--color-surface-2)',
            padding: '3px',
            borderRadius: 'var(--rounded-md)',
            border: '1px solid var(--color-hairline)',
            gap: '2px',
          }}
        >
          {(
            [
              { id: 'all', label: 'All Modules' },
              { id: 'extremes', label: '1. Extreme Inspector' },
              { id: 'correlations', label: '2. Correlation Matrix' },
              { id: 'redundancy', label: '3. Failure & Surrogates' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterMode(tab.id)}
              style={{
                background: filterMode === tab.id ? 'var(--color-surface-3)' : 'transparent',
                color: filterMode === tab.id ? 'var(--color-ink)' : 'var(--color-ink-muted)',
                border: filterMode === tab.id ? '1px solid var(--color-hairline-strong)' : '1px solid transparent',
                borderRadius: 'var(--rounded-sm)',
                padding: '5px 12px',
                fontSize: '12px',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 150ms ease',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Sensor vs Engine Fault Arbiter Hero Card */}
      {arbiter && (
        <div
          className="card mb-lg"
          style={{
            backgroundColor:
              arbiter.verdict === 'PHYSICAL_ENGINE_FAULT'
                ? 'rgba(229, 83, 75, 0.08)'
                : arbiter.verdict === 'SENSOR_ELECTRICAL_FAULT'
                ? 'rgba(224, 155, 36, 0.08)'
                : 'rgba(39, 166, 68, 0.08)',
            border: `1px solid ${
              arbiter.verdict === 'PHYSICAL_ENGINE_FAULT'
                ? 'rgba(229, 83, 75, 0.35)'
                : arbiter.verdict === 'SENSOR_ELECTRICAL_FAULT'
                ? 'rgba(224, 155, 36, 0.35)'
                : 'rgba(39, 166, 68, 0.25)'
            }`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 'var(--space-md)',
          }}
        >
          <div style={{ flex: '1 1 500px' }}>
            <div className="flex items-center gap-xs mb-xxs">
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  backgroundColor:
                    arbiter.verdict === 'PHYSICAL_ENGINE_FAULT'
                      ? '#e5534b'
                      : arbiter.verdict === 'SENSOR_ELECTRICAL_FAULT'
                      ? '#e09b24'
                      : 'var(--color-semantic-success)',
                  boxShadow: `0 0 8px ${
                    arbiter.verdict === 'PHYSICAL_ENGINE_FAULT'
                      ? 'rgba(229, 83, 75, 0.8)'
                      : arbiter.verdict === 'SENSOR_ELECTRICAL_FAULT'
                      ? 'rgba(224, 155, 36, 0.8)'
                      : 'rgba(39, 166, 68, 0.8)'
                  }`,
                }}
              />
              <span className="type-eyebrow" style={{ color: 'var(--color-ink)' }}>
                Sensor vs. Engine Arbiter · {arbiter.title}
              </span>
            </div>
            <p className="type-body-sm ink-muted" style={{ margin: 0, lineHeight: 1.5 }}>
              {arbiter.summary}
            </p>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-md)',
              borderLeft: '1px solid var(--color-hairline)',
              paddingLeft: 'var(--space-md)',
            }}
          >
            <div>
              <div className="type-caption ink-subtle mb-xxs">Diagnostic Confidence</div>
              <div className="type-headline ink" style={{ fontSize: 22, fontVariantNumeric: 'tabular-nums' }}>
                {arbiter.confidence_pct}%
              </div>
            </div>
            <div>
              <div className="type-caption ink-subtle mb-xxs">Primary Source</div>
              <div className="type-mono" style={{ fontSize: 12, color: 'var(--color-ink)' }}>
                {arbiter.primary_culprit}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODULE 1: SENSOR EXTREME INSPECTOR ─────────────────────────────────── */}
      {(filterMode === 'all' || filterMode === 'extremes') && (
        <div className="card mb-lg">
          <div className="flex items-center justify-between mb-sm flex-wrap gap-xs">
            <div>
              <div className="type-eyebrow ink-subtle mb-xxs">Module 1 · Threshold Inference</div>
              <div className="type-card-title ink" style={{ margin: 0, fontSize: 16 }}>
                Sensor Extreme Inspector
              </div>
            </div>
            <div className="type-mono ink-subtle" style={{ fontSize: 11 }}>
              Live Playhead: {currentTime.toFixed(1)}s
            </div>
          </div>

          {/* Real-Time Sensor Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
              gap: 'var(--space-sm)',
              marginBottom: 'var(--space-md)',
            }}
          >
            {sensorsList.map((sensor: any) => {
              const isSelected = sensor.sensor_id === selectedSensorId;
              const isDanger = sensor.status === 'PHYSICAL_DAMAGE_THREAT';
              const isExtreme = sensor.status === 'OPERATIONAL_EXTREME';

              return (
                <div
                  key={sensor.sensor_id}
                  onClick={() => setSelectedSensorId(sensor.sensor_id)}
                  style={{
                    padding: 'var(--space-sm) var(--space-md)',
                    backgroundColor: isSelected ? 'var(--color-surface-3)' : 'var(--color-surface-2)',
                    border: `1px solid ${
                      isSelected
                        ? 'var(--color-primary)'
                        : isDanger
                        ? 'rgba(229, 83, 75, 0.4)'
                        : 'var(--color-hairline)'
                    }`,
                    borderRadius: 'var(--rounded-md)',
                    cursor: 'pointer',
                    transition: 'all 120ms ease',
                  }}
                >
                  <div className="flex items-center justify-between mb-xxs">
                    <span className="type-caption ink-subtle" style={{ fontSize: 11, fontWeight: 500 }}>
                      {sensor.name}
                    </span>
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        backgroundColor: sensor.status_color,
                      }}
                    />
                  </div>

                  <div className="flex items-baseline gap-xs">
                    <span className="type-headline ink" style={{ fontSize: 20, fontVariantNumeric: 'tabular-nums' }}>
                      {sensor.current_value}
                    </span>
                    <span className="type-caption ink-subtle">{sensor.unit}</span>
                  </div>

                  <div className="flex items-center justify-between mt-xxs" style={{ fontSize: 10 }}>
                    <span className="ink-subtle">
                      Safe: {sensor.normal_range[0]}–{sensor.normal_range[1]}
                    </span>
                    <span
                      style={{
                        color: sensor.status_color,
                        fontWeight: 600,
                        textTransform: 'uppercase',
                      }}
                    >
                      {isDanger ? 'Threat' : isExtreme ? 'Extreme' : 'Nominal'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Selected Sensor Physical Chamber Explanation Banner */}
          {inspectSensor && (
            <div
              style={{
                padding: 'var(--space-sm) var(--space-md)',
                backgroundColor: 'var(--color-surface-2)',
                border: '1px solid var(--color-hairline)',
                borderRadius: 'var(--rounded-md)',
              }}
            >
              <div className="flex items-center justify-between mb-xxs flex-wrap gap-xs">
                <span className="type-caption ink-subtle" style={{ fontWeight: 600, textTransform: 'uppercase' }}>
                  Physical In-Cylinder Inference · {inspectSensor.name} ({inspectSensor.current_value} {inspectSensor.unit})
                </span>
                <span className="badge" style={{ color: inspectSensor.status_color, fontSize: 11 }}>
                  ● {inspectSensor.status.replace(/_/g, ' ')}
                </span>
              </div>
              <p className="type-body-sm ink-muted" style={{ margin: 0, lineHeight: 1.5 }}>
                {inspectSensor.physical_note} Recorded envelope in this run: min <strong>{inspectSensor.min_recorded}</strong> {inspectSensor.unit} · max <strong>{inspectSensor.max_recorded}</strong> {inspectSensor.unit}.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── MODULE 2: CROSS-SENSOR CORRELATION HEATMAP ────────────────────────── */}
      {(filterMode === 'all' || filterMode === 'correlations') && (
        <div className="card mb-lg">
          <div className="flex items-center justify-between mb-sm flex-wrap gap-xs">
            <div>
              <div className="type-eyebrow ink-subtle mb-xxs">Module 2 · Multivariable Interdependence</div>
              <div className="type-card-title ink" style={{ margin: 0, fontSize: 16 }}>
                Dynamic Cross-Sensor Correlation Heatmap
              </div>
            </div>
            <span className="type-caption ink-subtle">
              Derived from {corrData?.sensors?.length || 0} Telemetry Time-Series Channels
            </span>
          </div>

          {/* Decoupled Anomaly Alert (if detected) */}
          {corrData?.decoupled_alerts?.length > 0 && (
            <div
              style={{
                padding: '10px 14px',
                backgroundColor: 'rgba(229, 83, 75, 0.08)',
                border: '1px solid rgba(229, 83, 75, 0.3)',
                borderRadius: 'var(--rounded-md)',
                marginBottom: 'var(--space-md)',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
              }}
            >
              {corrData.decoupled_alerts.map((alert: any, idx: number) => (
                <div key={idx} className="type-body-sm" style={{ color: '#fca5a5' }}>
                  ⚠️ <strong>{alert.explanation}</strong>
                </div>
              ))}
            </div>
          )}

          {/* Heatmap Grid */}
          {corrLoading ? (
            <div className="skeleton" style={{ height: 340 }} />
          ) : heatmapOpt ? (
            <ReactECharts
              option={heatmapOpt}
              style={{ height: 340 }}
              opts={{ renderer: 'canvas' }}
              onEvents={{ click: onChartClick }}
            />
          ) : (
            <div className="empty-state" style={{ height: 340, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <p className="ink-muted">No correlation data available for this run</p>
            </div>
          )}

          {/* Interactive Pair Inspection Card */}
          <div
            style={{
              marginTop: 'var(--space-md)',
              padding: 'var(--space-sm) var(--space-md)',
              backgroundColor: 'var(--color-surface-2)',
              borderRadius: 'var(--rounded-md)',
              border: '1px solid var(--color-hairline)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 'var(--space-sm)',
            }}
          >
            <div>
              <div className="type-caption ink-subtle mb-xxs" style={{ textTransform: 'uppercase' }}>
                Selected Parameter Pair
              </div>
              <div className="type-body ink" style={{ fontWeight: 600 }}>
                {selectedPair[0].replace(/_/g, ' ').toUpperCase()} ⟷ {selectedPair[1].replace(/_/g, ' ').toUpperCase()}
              </div>
            </div>

            <div>
              <div className="type-caption ink-subtle mb-xxs">Pearson Correlation (r)</div>
              <div
                className="type-headline"
                style={{
                  fontSize: 22,
                  fontVariantNumeric: 'tabular-nums',
                  color: selectedPairR > 0.6 ? 'var(--color-semantic-success)' : selectedPairR < 0 ? '#e5534b' : 'var(--color-ink)',
                }}
              >
                {selectedPairR > 0 ? `+${selectedPairR.toFixed(3)}` : selectedPairR.toFixed(3)}
              </div>
            </div>

            <div style={{ maxWidth: 440 }}>
              <div className="type-caption ink-subtle mb-xxs">Coupling State</div>
              <div className="type-caption ink-muted" style={{ lineHeight: 1.4 }}>
                {selectedPairR >= 0.7
                  ? 'Strong Positive Coupling: Signals co-vary synchronously in accordance with thermodynamic expansion.'
                  : selectedPairR <= -0.5
                  ? 'Inverse Coupling: Closed-loop regulation active (e.g. Lambda trim compensation).'
                  : 'Independent / Decoupled: Parameters operate in distinct thermal or electrical domains.'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODULE 3: CASCADING FAILURE SIMULATOR & SURROGATE REDUNDANCY ────────── */}
      {(filterMode === 'all' || filterMode === 'redundancy') && (
        <div className="card mb-lg">
          <div className="flex items-center justify-between mb-sm flex-wrap gap-xs">
            <div>
              <div className="type-eyebrow ink-subtle mb-xxs">Module 3 · Fault Impact & Virtual Sensing</div>
              <div className="type-card-title ink" style={{ margin: 0, fontSize: 16 }}>
                Cascading Failure Simulator &amp; Virtual Surrogate
              </div>
            </div>
            <span className="type-caption ink-subtle">Select Sensor to Simulate Failure</span>
          </div>

          {/* Sensor Selector Pills */}
          <div
            style={{
              display: 'flex',
              gap: 'var(--space-xs)',
              overflowX: 'auto',
              paddingBottom: 'var(--space-xs)',
              marginBottom: 'var(--space-md)',
            }}
          >
            {catalog.map((catItem: any) => {
              const active = catItem.sensor_id === selectedSensorId;
              return (
                <button
                  key={catItem.sensor_id}
                  onClick={() => setSelectedSensorId(catItem.sensor_id)}
                  style={{
                    backgroundColor: active ? 'var(--color-surface-3)' : 'var(--color-surface-2)',
                    color: active ? 'var(--color-ink)' : 'var(--color-ink-muted)',
                    border: `1px solid ${active ? 'var(--color-primary)' : 'var(--color-hairline)'}`,
                    borderRadius: 'var(--rounded-md)',
                    padding: '6px 14px',
                    fontSize: '12px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    transition: 'all 120ms ease',
                  }}
                >
                  {catItem.name}
                </button>
              );
            })}
          </div>

          {/* 3-Column Structured Breakdown per Linear Standard */}
          {selectedFailureInfo && (
            <div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                  gap: 'var(--space-md)',
                  marginBottom: 'var(--space-md)',
                }}
              >
                {/* Column 1: Failure Mode & ECU Reaction */}
                <div
                  style={{
                    padding: 'var(--space-md)',
                    backgroundColor: 'var(--color-surface-2)',
                    borderRadius: 'var(--rounded-md)',
                    border: '1px solid var(--color-hairline)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <div className="flex items-center justify-between mb-xs">
                      <span className="type-caption ink-subtle" style={{ textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                        Failure Mode &amp; ECU Failsafe
                      </span>
                      <span
                        className="badge"
                        style={{
                          backgroundColor: 'rgba(229, 83, 75, 0.15)',
                          color: '#e5534b',
                          fontSize: 10,
                          fontWeight: 600,
                          padding: '2px 6px',
                        }}
                      >
                        {selectedFailureInfo.criticality}
                      </span>
                    </div>

                    <div className="type-body-sm ink" style={{ fontWeight: 600, marginBottom: '4px' }}>
                      {selectedFailureInfo.failure_mode}
                    </div>

                    <div className="type-caption ink-muted" style={{ lineHeight: 1.45, marginTop: 'var(--space-xs)' }}>
                      <strong>ECU Fallback:</strong> {selectedFailureInfo.ecu_fallback}
                    </div>
                  </div>

                  <div style={{ marginTop: 'var(--space-md)', paddingTop: 'var(--space-xs)', borderTop: '1px solid var(--color-hairline)' }}>
                    <span className="type-caption ink-subtle">Engine Impact: </span>
                    <span className="type-caption ink-muted">{selectedFailureInfo.engine_impact}</span>
                  </div>
                </div>

                {/* Column 2: The Surrogate Virtual Sensor (User Priority Request) */}
                <div
                  style={{
                    padding: 'var(--space-md)',
                    backgroundColor: 'rgba(94, 106, 210, 0.06)',
                    borderRadius: 'var(--rounded-md)',
                    border: '1px solid rgba(94, 106, 210, 0.3)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <div className="flex items-center justify-between mb-xs">
                      <span className="type-caption" style={{ color: 'var(--color-primary-hover)', textTransform: 'uppercase', letterSpacing: '0.4px', fontWeight: 600 }}>
                        Surrogate Virtual Replacement
                      </span>
                      <span
                        className="badge"
                        style={{
                          backgroundColor: 'rgba(39, 166, 68, 0.15)',
                          color: 'var(--color-semantic-success)',
                          fontSize: 10,
                          fontWeight: 600,
                          padding: '2px 6px',
                        }}
                      >
                        {selectedFailureInfo.redundancy_retention_pct}% CAPABILITY
                      </span>
                    </div>

                    <div className="type-headline ink" style={{ fontSize: 16, fontWeight: 600, margin: '2px 0 6px 0' }}>
                      {selectedFailureInfo.surrogate_sensor}
                    </div>

                    <div className="type-caption ink-muted" style={{ lineHeight: 1.45 }}>
                      <strong>Virtual Sensing Physics:</strong> {selectedFailureInfo.surrogate_method}
                    </div>
                  </div>

                  <div style={{ marginTop: 'var(--space-md)', paddingTop: 'var(--space-xs)', borderTop: '1px solid var(--color-hairline)' }}>
                    <span className="type-caption" style={{ color: 'var(--color-primary-hover)', fontWeight: 500 }}>
                      ✓ Retains vehicle mobility and limp-home safety without engine shutdown
                    </span>
                  </div>
                </div>

                {/* Column 3: Workshop Diagnostic Fix Playbook */}
                <div
                  style={{
                    padding: 'var(--space-md)',
                    backgroundColor: 'var(--color-surface-2)',
                    borderRadius: 'var(--rounded-md)',
                    border: '1px solid var(--color-hairline)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <div className="flex items-center justify-between mb-xs">
                      <span className="type-caption ink-subtle" style={{ textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                        Diagnostic Test &amp; Fix
                      </span>
                      <span className="type-caption ink-subtle" style={{ fontSize: 11 }}>
                        Est. Part: {selectedFailureInfo.estimated_part_cost}
                      </span>
                    </div>

                    <div className="type-body-sm ink" style={{ fontWeight: 600, marginBottom: '4px' }}>
                      Workshop Verification Procedure
                    </div>

                    <div className="type-caption ink-muted" style={{ lineHeight: 1.45, marginTop: 'var(--space-xs)' }}>
                      {selectedFailureInfo.diagnostic_test}
                    </div>
                  </div>

                  <div style={{ marginTop: 'var(--space-md)', paddingTop: 'var(--space-xs)', borderTop: '1px solid var(--color-hairline)' }}>
                    <span className="type-caption ink-subtle">Recommended Action: </span>
                    <span className="type-caption ink-muted">Pinout resistance test prior to sensor component replacement.</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
