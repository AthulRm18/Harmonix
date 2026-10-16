/**
 * ECharts theme config aligned with DESIGN.md (Linear dark canvas).
 * Provides base options and reusable chart factories.
 */

import type { EChartsOption } from 'echarts';

// Design tokens (mirrors index.css)
export const THEME = {
  canvas: '#010102',
  surface1: '#0f1011',
  surface2: '#141516',
  surface3: '#18191a',
  hairline: '#23252a',
  hairlineStrong: '#34343a',
  ink: '#f7f8f8',
  inkMuted: '#d0d6e0',
  inkSubtle: '#8a8f98',
  inkTertiary: '#62666d',
  primary: '#5e6ad2',
  primaryHover: '#828fff',
  success: '#27a644',
  // Chart palette – single accent family (lavender), plus muted tones
  palette: ['#5e6ad2', '#828fff', '#a5aeff', '#27a644', '#7a7fad', '#d0d6e0'],
  // Scientific high-contrast spectrogram colormap (Inferno / Magma)
  spectrogram: [
    '#070714',
    '#1c1538',
    '#381c5a',
    '#6b1d6b',
    '#a52c60',
    '#d6483b',
    '#f57c20',
    '#fdbd38',
    '#fffbc8',
  ],
  // Performance / Efficiency colormap (Red -> Amber -> Blue -> Emerald Green)
  performance: ['#7f1d1d', '#b91c1c', '#d97706', '#2563eb', '#16a34a', '#22c55e'],
  fontFamily:
    "'Inter', 'SF Pro Display', -apple-system, system-ui, 'Segoe UI', Roboto, sans-serif",
  monoFamily: "'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace",
} as const;

/** Base echarts option with design.md dark theme */
export function baseOption(overrides: Partial<EChartsOption> = {}): EChartsOption {
  return {
    animation: false,
    backgroundColor: 'transparent',
    textStyle: {
      fontFamily: THEME.fontFamily,
      color: THEME.inkMuted,
      fontSize: 12,
    },
    grid: {
      top: 40,
      right: 24,
      bottom: 40,
      left: 56,
      containLabel: false,
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: THEME.surface2,
      borderColor: THEME.hairlineStrong,
      borderWidth: 1,
      textStyle: {
        color: THEME.ink,
        fontFamily: THEME.fontFamily,
        fontSize: 12,
      },
    },
    ...overrides,
  };
}

/** Slices and interpolates timeseries data up to currentTime for realistic real-time streaming */
export function sliceStreamData(
  timestamps: number[],
  values: number[],
  currentTime?: number,
  opts: {
    realtime?: boolean;
    viewMode?: 'full' | 'rolling';
    rollingWindowS?: number;
    duration?: number;
  } = {},
): {
  data: [number, number][];
  latestPoint: [number, number] | null;
  xMin?: number;
  xMax?: number;
} {
  if (!timestamps || timestamps.length === 0) {
    return { data: [], latestPoint: null };
  }

  const realtime = opts.realtime ?? (currentTime !== undefined);
  if (!realtime || currentTime === undefined) {
    return {
      data: timestamps.map((t, i) => [t, values[i]]),
      latestPoint: timestamps.length > 0 ? [timestamps[timestamps.length - 1], values[values.length - 1]] : null,
      xMin: 0,
      xMax: opts.duration && opts.duration > 0 ? opts.duration : timestamps[timestamps.length - 1],
    };
  }

  const effectiveCurrent = Math.max(0, currentTime);
  const totalDuration = opts.duration && opts.duration > 0 ? opts.duration : Math.max(timestamps[timestamps.length - 1], 10);
  const viewMode = opts.viewMode || 'full';
  const rollingWindow = opts.rollingWindowS || 30;

  let xMin = 0;
  let xMax = totalDuration;

  if (viewMode === 'rolling') {
    xMin = Math.max(0, effectiveCurrent - rollingWindow);
    xMax = Math.max(rollingWindow, effectiveCurrent);
  }

  // Binary search for last index with timestamp <= effectiveCurrent
  let low = 0;
  let high = timestamps.length - 1;
  let lastIdx = -1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (timestamps[mid] <= effectiveCurrent) {
      lastIdx = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  const data: [number, number][] = [];
  let latestPoint: [number, number] | null = null;

  if (lastIdx < 0) {
    // Before first sample
    if (timestamps.length > 0) {
      data.push([timestamps[0], values[0]]);
      latestPoint = [timestamps[0], values[0]];
    }
  } else {
    // Collect points within window
    const minTimestamp = viewMode === 'rolling' ? xMin : 0;
    for (let i = 0; i <= lastIdx; i++) {
      if (timestamps[i] >= minTimestamp) {
        data.push([timestamps[i], values[i]]);
      }
    }

    // Sub-sample linear interpolation for leading edge at exact currentTime
    if (lastIdx < timestamps.length - 1) {
      const t1 = timestamps[lastIdx];
      const t2 = timestamps[lastIdx + 1];
      const v1 = values[lastIdx];
      const v2 = values[lastIdx + 1];

      if (t2 > t1 && effectiveCurrent > t1) {
        const ratio = Math.min(1, Math.max(0, (effectiveCurrent - t1) / (t2 - t1)));
        const interpVal = v1 + ratio * (v2 - v1);
        data.push([effectiveCurrent, interpVal]);
        latestPoint = [effectiveCurrent, interpVal];
      } else {
        latestPoint = [t1, v1];
      }
    } else {
      latestPoint = [timestamps[lastIdx], values[lastIdx]];
    }
  }

  return { data, latestPoint, xMin, xMax };
}

/** Line / area chart for time-series signals with real-time stream plotting */
export function lineChartOption(
  timestamps: number[],
  values: number[],
  label: string,
  opts: {
    color?: string;
    area?: boolean;
    yAxisName?: string;
    xAxisName?: string;
    scale?: boolean;
    xAxisMin?: number | string;
    xAxisMax?: number | string;
    markLine?: number;
    currentTime?: number;
    duration?: number;
    realtime?: boolean;
    viewMode?: 'full' | 'rolling';
    rollingWindowS?: number;
    tooltipFormatter?: (params: any) => string;
  } = {},
): EChartsOption {
  const color = opts.color || THEME.primary;
  const stream = sliceStreamData(timestamps, values, opts.currentTime, {
    realtime: opts.realtime,
    viewMode: opts.viewMode,
    rollingWindowS: opts.rollingWindowS,
    duration: opts.duration,
  });

  const seriesList: any[] = [
    {
      name: label,
      type: 'line',
      data: stream.data,
      smooth: false,
      showSymbol: false,
      lineStyle: { color, width: 1.5 },
      areaStyle: opts.area
        ? {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: color + '30' },
                { offset: 1, color: color + '05' },
              ],
            },
          }
        : undefined,
      markLine:
        opts.currentTime !== undefined
          ? {
              symbol: ['none', 'none'],
              silent: true,
              animation: false,
              lineStyle: { color: THEME.primaryHover, width: 2, type: 'solid' },
              label: {
                show: true,
                formatter: `${opts.currentTime.toFixed(1)}s`,
                position: 'insideEndTop',
                color: THEME.ink,
                fontSize: 10,
              },
              data: [{ xAxis: opts.currentTime }],
            }
          : opts.markLine !== undefined
            ? { data: [{ yAxis: opts.markLine, lineStyle: { color: THEME.success, type: 'dashed' } }], silent: true }
            : undefined,
    },
  ];

  // Live probe point
  if (stream.latestPoint && opts.currentTime !== undefined && (opts.realtime ?? true)) {
    seriesList.push({
      name: `${label} (Live)`,
      type: 'effectScatter' as const,
      data: [stream.latestPoint],
      symbolSize: 6,
      showEffectOn: 'render' as const,
      rippleEffect: {
        brushType: 'stroke' as const,
        scale: 2.5,
        period: 2,
      },
      itemStyle: {
        color,
        shadowBlur: 6,
        shadowColor: color,
      },
      silent: true,
      tooltip: { show: false },
    });
  }

  return baseOption({
    tooltip: opts.tooltipFormatter
      ? {
          trigger: 'axis',
          backgroundColor: THEME.surface2,
          borderColor: THEME.hairlineStrong,
          borderWidth: 1,
          formatter: opts.tooltipFormatter,
          textStyle: {
            color: THEME.ink,
            fontFamily: THEME.fontFamily,
            fontSize: 12,
          },
        }
      : undefined,
    xAxis: {
      type: 'value',
      name: opts.xAxisName || 'Time (s)',
      nameTextStyle: { color: THEME.inkSubtle, fontSize: 11 },
      axisLine: { lineStyle: { color: THEME.hairline } },
      axisTick: { show: false },
      axisLabel: { color: THEME.inkSubtle, fontSize: 11 },
      splitLine: { lineStyle: { color: THEME.hairline, type: 'dashed' as const } },
      scale: opts.scale ?? true,
      min: opts.xAxisMin ?? stream.xMin,
      max: opts.xAxisMax ?? stream.xMax,
    },
    yAxis: {
      type: 'value',
      name: opts.yAxisName,
      nameTextStyle: { color: THEME.inkSubtle, fontSize: 11 },
      axisLine: { lineStyle: { color: THEME.hairline } },
      axisTick: { show: false },
      axisLabel: { color: THEME.inkSubtle, fontSize: 11 },
      splitLine: { lineStyle: { color: THEME.hairline, type: 'dashed' as const } },
    },
    series: seriesList,
  });
}

/** Bar chart (horizontal or vertical) for feature importance / SHAP */
export function barChartOption(
  labels: string[],
  values: number[],
  opts: {
    horizontal?: boolean;
    color?: string;
    title?: string;
  } = {},
): EChartsOption {
  const color = opts.color || THEME.primary;
  const isHoriz = opts.horizontal ?? true;
  return baseOption({
    grid: { top: 32, right: 24, bottom: 32, left: isHoriz ? 120 : 56 },
    [isHoriz ? 'yAxis' : 'xAxis']: {
      type: 'category',
      data: labels,
      axisLine: { lineStyle: { color: THEME.hairline } },
      axisTick: { show: false },
      axisLabel: { color: THEME.inkMuted, fontSize: 12 },
    },
    [isHoriz ? 'xAxis' : 'yAxis']: {
      type: 'value',
      axisLine: { lineStyle: { color: THEME.hairline } },
      axisTick: { show: false },
      axisLabel: { color: THEME.inkSubtle, fontSize: 11 },
      splitLine: { lineStyle: { color: THEME.hairline, type: 'dashed' } },
    },
    series: [
      {
        type: 'bar',
        data: values.map((v) => ({
          value: v,
          itemStyle: { color: v >= 0 ? color : '#e5534b', borderRadius: [0, 4, 4, 0] },
        })),
        barWidth: '60%',
      },
    ],
  });
}

/** Heatmap chart for EPI grid, confusion matrix, spectrogram */
export function heatmapOption(
  xData: (number | string)[],
  yData: (number | string)[],
  values: [number, number, number][],
  opts: {
    xName?: string;
    yName?: string;
    valueName?: string;
    valueUnit?: string;
    minVal?: number;
    maxVal?: number;
    colorRange?: [string, string];
    colorPalette?: readonly string[] | string[];
  } = {},
): EChartsOption {
  const inRangeColors = opts.colorPalette
    ? [...opts.colorPalette]
    : opts.colorRange
      ? [opts.colorRange[0], THEME.primaryHover, opts.colorRange[1]]
      : [THEME.surface2, THEME.primaryHover, THEME.primary];
  const valLabel = opts.valueName || 'Value';
  const valUnit = opts.valueUnit !== undefined ? opts.valueUnit : '';

  return baseOption({
    grid: { top: 40, right: 80, bottom: 60, left: 80 },
    tooltip: {
      trigger: 'item',
      formatter: (params: any) => {
        const x = xData[params.data?.[0]];
        const y = yData[params.data?.[1]];
        const rawVal = params.data?.[2];
        const val = typeof rawVal === 'number' ? rawVal.toFixed(2) : rawVal;
        return `<div style="padding: 2px 4px;">
          <div><span style="color: ${THEME.inkSubtle}">${opts.xName || 'X'}:</span> <strong>${x}</strong></div>
          <div><span style="color: ${THEME.inkSubtle}">${opts.yName || 'Y'}:</span> <strong>${y}</strong></div>
          <div><span style="color: ${THEME.primaryHover}">${valLabel}:</span> <strong>${val}${valUnit ? ' ' + valUnit : ''}</strong></div>
        </div>`;
      },
    },
    xAxis: {
      type: 'category',
      data: xData,
      name: opts.xName,
      nameLocation: 'center',
      nameGap: 28,
      nameTextStyle: { color: THEME.inkSubtle, fontSize: 11 },
      axisLine: { lineStyle: { color: THEME.hairline } },
      axisTick: { show: false },
      axisLabel: { color: THEME.inkSubtle, fontSize: 10 },
      splitArea: { show: false },
    },
    yAxis: {
      type: 'category',
      data: yData,
      name: opts.yName,
      nameTextStyle: { color: THEME.inkSubtle, fontSize: 11 },
      axisLine: { lineStyle: { color: THEME.hairline } },
      axisTick: { show: false },
      axisLabel: { color: THEME.inkSubtle, fontSize: 10 },
      splitArea: { show: false },
    },
    visualMap: {
      min: opts.minVal ?? 0,
      max: opts.maxVal ?? 1,
      calculable: true,
      orient: 'vertical',
      right: 0,
      top: 'center',
      inRange: { color: inRangeColors },
      textStyle: { color: THEME.inkSubtle, fontSize: 10 },
    },
    series: [
      {
        type: 'heatmap',
        data: values,
        label: { show: false },
        emphasis: {
          itemStyle: { shadowBlur: 10, shadowColor: 'rgba(94, 106, 210, 0.5)' },
        },
      },
    ],
  });
}

/** Scatter chart for Pareto front */
export function scatterChartOption(
  data: [number, number][],
  opts: {
    xName?: string;
    yName?: string;
    color?: string;
    highlightIdx?: number;
  } = {},
): EChartsOption {
  const color = opts.color || THEME.primary;
  return baseOption({
    xAxis: {
      type: 'value',
      name: opts.xName,
      nameTextStyle: { color: THEME.inkSubtle, fontSize: 11 },
      axisLine: { lineStyle: { color: THEME.hairline } },
      axisTick: { show: false },
      axisLabel: { color: THEME.inkSubtle, fontSize: 11 },
      splitLine: { lineStyle: { color: THEME.hairline, type: 'dashed' } },
    },
    yAxis: {
      type: 'value',
      name: opts.yName,
      nameTextStyle: { color: THEME.inkSubtle, fontSize: 11 },
      axisLine: { lineStyle: { color: THEME.hairline } },
      axisTick: { show: false },
      axisLabel: { color: THEME.inkSubtle, fontSize: 11 },
      splitLine: { lineStyle: { color: THEME.hairline, type: 'dashed' } },
    },
    series: [
      {
        type: 'scatter',
        data: data,
        symbolSize: 8,
        itemStyle: { color },
      },
      ...(opts.highlightIdx !== undefined
        ? [
            {
              type: 'scatter' as const,
              data: [data[opts.highlightIdx]],
              symbolSize: 16,
              itemStyle: { color: THEME.success, borderColor: THEME.ink, borderWidth: 2 },
              z: 10,
            },
          ]
        : []),
    ],
  });
}

/** Multi-line chart for multiple sensor signals overlaid with dual Y-axis scaling and real-time stream plotting */
export function multiLineOption(
  series: { name: string; timestamps: number[]; values: number[]; color?: string; yAxisIndex?: number }[],
  opts: {
    yAxisName?: string;
    secondaryYAxisName?: string;
    currentTime?: number;
    duration?: number;
    anomalyOnset?: number;
    dualAxis?: boolean;
    realtime?: boolean;
    viewMode?: 'full' | 'rolling';
    rollingWindowS?: number;
  } = {},
): EChartsOption {
  const isDualAxis = opts.dualAxis !== false;

  let commonXMin: number | undefined;
  let commonXMax: number | undefined;

  const processedSeries = series.map((s, i) => {
    const stream = sliceStreamData(s.timestamps, s.values, opts.currentTime, {
      realtime: opts.realtime,
      viewMode: opts.viewMode,
      rollingWindowS: opts.rollingWindowS,
      duration: opts.duration,
    });
    if (commonXMin === undefined && stream.xMin !== undefined) commonXMin = stream.xMin;
    if (commonXMax === undefined && stream.xMax !== undefined) commonXMax = stream.xMax;

    const yIndex =
      s.yAxisIndex !== undefined
        ? s.yAxisIndex
        : isDualAxis && !s.name.toLowerCase().includes('rpm')
          ? 1
          : 0;

    return {
      spec: s,
      yIndex,
      data: stream.data,
      latestPoint: stream.latestPoint,
      color: s.color || THEME.palette[i % THEME.palette.length],
    };
  });

  const yAxisConfig = isDualAxis
    ? [
        {
          type: 'value' as const,
          name: opts.yAxisName || 'Engine RPM',
          nameTextStyle: { color: THEME.inkSubtle, fontSize: 11 },
          axisLine: { lineStyle: { color: THEME.hairline } },
          axisTick: { show: false },
          axisLabel: { color: THEME.inkSubtle, fontSize: 11 },
          splitLine: { lineStyle: { color: THEME.hairline, type: 'dashed' as const } },
        },
        {
          type: 'value' as const,
          name: opts.secondaryYAxisName || 'Sensor Scale (% / °C)',
          nameTextStyle: { color: THEME.inkSubtle, fontSize: 11 },
          axisLine: { lineStyle: { color: THEME.hairline } },
          axisTick: { show: false },
          axisLabel: { color: THEME.inkSubtle, fontSize: 11 },
          splitLine: { show: false },
        },
      ]
    : {
        type: 'value' as const,
        name: opts.yAxisName,
        nameTextStyle: { color: THEME.inkSubtle, fontSize: 11 },
        axisLine: { lineStyle: { color: THEME.hairline } },
        axisTick: { show: false },
        axisLabel: { color: THEME.inkSubtle, fontSize: 11 },
        splitLine: { lineStyle: { color: THEME.hairline, type: 'dashed' as const } },
      };

  const lineSeries = processedSeries.map((p) => ({
    name: p.spec.name,
    type: 'line' as const,
    yAxisIndex: p.yIndex,
    data: p.data,
    smooth: false,
    showSymbol: false,
    lineStyle: { color: p.color, width: 1.5 },
  }));

  // Add live leading edge ripple points for each sensor when in real-time mode
  const probeSeries: any[] =
    opts.currentTime !== undefined && (opts.realtime ?? true)
      ? processedSeries
          .filter((p) => p.latestPoint !== null)
          .map((p) => ({
            name: `${p.spec.name} (Live)`,
            type: 'effectScatter' as const,
            yAxisIndex: p.yIndex,
            data: [p.latestPoint!],
            symbolSize: 6,
            showEffectOn: 'render' as const,
            rippleEffect: {
              brushType: 'stroke' as const,
              scale: 2.5,
              period: 2,
            },
            itemStyle: {
              color: p.color,
              shadowBlur: 6,
              shadowColor: p.color,
            },
            silent: true,
            tooltip: { show: false },
          }))
      : [];

  const overlaySeries = {
    name: '_overlay',
    type: 'line' as const,
    data: [],
    silent: true,
    showSymbol: false,
    markLine:
      opts.currentTime !== undefined
        ? {
            symbol: ['none', 'none'],
            silent: true,
            animation: false,
            lineStyle: { color: THEME.primaryHover, width: 2, type: 'solid' },
            label: {
              show: true,
              formatter: `${opts.currentTime.toFixed(1)}s`,
              position: 'insideEndTop',
              color: THEME.ink,
              fontSize: 10,
            },
            data: [{ xAxis: opts.currentTime }],
          }
        : undefined,
    markArea:
      opts.anomalyOnset !== undefined &&
      (opts.currentTime === undefined || opts.currentTime >= opts.anomalyOnset)
        ? {
            silent: true,
            itemStyle: { color: 'rgba(229, 83, 75, 0.12)' },
            data: [
              [
                { xAxis: opts.anomalyOnset },
                { xAxis: opts.currentTime !== undefined ? opts.currentTime : 99999 },
              ],
            ],
          }
        : undefined,
  };

  return baseOption({
    grid: { top: 40, right: isDualAxis ? 65 : 24, bottom: 40, left: 60 },
    legend: {
      show: true,
      data: series.map((s) => s.name),
      top: 4,
      textStyle: { color: THEME.inkMuted, fontSize: 11 },
    },
    xAxis: {
      type: 'value',
      name: 'Time (s)',
      min: commonXMin,
      max: commonXMax,
      nameTextStyle: { color: THEME.inkSubtle, fontSize: 11 },
      axisLine: { lineStyle: { color: THEME.hairline } },
      axisTick: { show: false },
      axisLabel: { color: THEME.inkSubtle, fontSize: 11 },
      splitLine: { lineStyle: { color: THEME.hairline, type: 'dashed' as const } },
    },
    yAxis: yAxisConfig,
    series: [...lineSeries, ...probeSeries, overlaySeries],
  });
}


/** Gauge chart for health index / probability / RUL */
export function gaugeOption(
  value: number,
  opts: {
    label?: string;
    max?: number;
    color?: string;
    thresholds?: { value: number; color: string }[];
    formatter?: (val: number) => string;
  } = {},
): EChartsOption {
  const max = opts.max ?? 1;
  const clampedVal = Math.min(Math.max(0, value), max);
  return {
    backgroundColor: 'transparent',
    series: [
      {
        type: 'gauge',
        startAngle: 200,
        endAngle: -20,
        min: 0,
        max,
        radius: '90%',
        progress: {
          show: true,
          width: 12,
          itemStyle: { color: opts.color || THEME.primary },
        },
        axisLine: {
          lineStyle: {
            width: 12,
            color: [[1, THEME.hairlineStrong]],
          },
        },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: { show: false },
        pointer: { show: false },
        title: {
          show: !!opts.label,
          offsetCenter: [0, '70%'],
          fontSize: 12,
          color: THEME.inkSubtle,
        },
        detail: {
          valueAnimation: true,
          fontSize: 26,
          fontFamily: THEME.fontFamily,
          fontWeight: 600,
          color: THEME.ink,
          offsetCenter: [0, '10%'],
          formatter: (val: number) => {
            if (opts.formatter) return opts.formatter(value);
            if (max <= 1) return val.toFixed(2);
            if (value >= 5000) return '> 1,500h';
            return `${Math.round(val)}h`;
          },
        },
        data: [{ value: clampedVal, name: opts.label || '' }],
      },
    ],
  };
}
