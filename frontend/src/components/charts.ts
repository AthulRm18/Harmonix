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

/** Line / area chart for time-series signals */
export function lineChartOption(
  timestamps: number[],
  values: number[],
  label: string,
  opts: {
    color?: string;
    area?: boolean;
    yAxisName?: string;
    markLine?: number;
    currentTime?: number;
  } = {},
): EChartsOption {
  const color = opts.color || THEME.primary;
  return baseOption({
    xAxis: {
      type: 'value',
      name: 'Time (s)',
      nameTextStyle: { color: THEME.inkSubtle, fontSize: 11 },
      axisLine: { lineStyle: { color: THEME.hairline } },
      axisTick: { show: false },
      axisLabel: { color: THEME.inkSubtle, fontSize: 11 },
      splitLine: { lineStyle: { color: THEME.hairline, type: 'dashed' } },
    },
    yAxis: {
      type: 'value',
      name: opts.yAxisName,
      nameTextStyle: { color: THEME.inkSubtle, fontSize: 11 },
      axisLine: { lineStyle: { color: THEME.hairline } },
      axisTick: { show: false },
      axisLabel: { color: THEME.inkSubtle, fontSize: 11 },
      splitLine: { lineStyle: { color: THEME.hairline, type: 'dashed' } },
    },
    series: [
      {
        name: label,
        type: 'line',
        data: timestamps.map((t, i) => [t, values[i]]),
        smooth: false,
        showSymbol: false,
        lineStyle: { color, width: 1.5 },
        areaStyle: opts.area
          ? { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: color + '30' }, { offset: 1, color: color + '05' }] } }
          : undefined,
        markLine:
          opts.currentTime !== undefined
            ? {
                symbol: ['none', 'none'],
                silent: true,
                animation: false,
                lineStyle: { color: THEME.primaryHover, width: 2, type: 'solid' },
                data: [{ xAxis: opts.currentTime }],
              }
            : opts.markLine !== undefined
              ? { data: [{ yAxis: opts.markLine, lineStyle: { color: THEME.success, type: 'dashed' } }], silent: true }
              : undefined,
      },
    ],
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
    minVal?: number;
    maxVal?: number;
    colorRange?: [string, string];
  } = {},
): EChartsOption {
  const [lowColor, highColor] = opts.colorRange || [THEME.surface2, THEME.primary];
  return baseOption({
    grid: { top: 40, right: 80, bottom: 60, left: 80 },
    tooltip: {
      trigger: 'item',
      formatter: (params: any) => {
        const x = xData[params.data?.[0]];
        const y = yData[params.data?.[1]];
        const val = typeof params.data?.[2] === 'number' ? params.data[2].toFixed(2) : params.data?.[2];
        return `<div style="padding: 2px 4px;">
          <div><span style="color: ${THEME.inkSubtle}">${opts.xName || 'Time'}:</span> <strong>${x}</strong></div>
          <div><span style="color: ${THEME.inkSubtle}">${opts.yName || 'Freq'}:</span> <strong>${y}</strong></div>
          <div><span style="color: ${THEME.primaryHover}">Energy:</span> <strong>${val} dB</strong></div>
        </div>`;
      },
    },
    xAxis: {
      type: 'category',
      data: xData,
      name: opts.xName,
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
      inRange: { color: [lowColor, THEME.primaryHover, highColor] },
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

/** Multi-line chart for multiple sensor signals overlaid */
export function multiLineOption(
  series: { name: string; timestamps: number[]; values: number[]; color?: string }[],
  opts: {
    yAxisName?: string;
    currentTime?: number;
    anomalyOnset?: number;
  } = {},
): EChartsOption {
  return baseOption({
    legend: {
      show: true,
      data: series.map((s) => s.name),
      top: 4,
      textStyle: { color: THEME.inkMuted, fontSize: 11 },
    },
    xAxis: {
      type: 'value',
      name: 'Time (s)',
      nameTextStyle: { color: THEME.inkSubtle, fontSize: 11 },
      axisLine: { lineStyle: { color: THEME.hairline } },
      axisTick: { show: false },
      axisLabel: { color: THEME.inkSubtle, fontSize: 11 },
      splitLine: { lineStyle: { color: THEME.hairline, type: 'dashed' } },
    },
    yAxis: {
      type: 'value',
      name: opts.yAxisName,
      nameTextStyle: { color: THEME.inkSubtle, fontSize: 11 },
      axisLine: { lineStyle: { color: THEME.hairline } },
      axisTick: { show: false },
      axisLabel: { color: THEME.inkSubtle, fontSize: 11 },
      splitLine: { lineStyle: { color: THEME.hairline, type: 'dashed' } },
    },
    series: [
      ...series.map((s, i) => ({
        name: s.name,
        type: 'line' as const,
        data: s.timestamps.map((t, j) => [t, s.values[j]]),
        smooth: false,
        showSymbol: false,
        lineStyle: { color: s.color || THEME.palette[i % THEME.palette.length], width: 1.5 },
      })),
      // Dedicated background overlay series for scrubber markLine and anomaly markArea
      // so toggling individual sensor series in the legend never hides them
      {
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
          opts.anomalyOnset !== undefined
            ? {
                silent: true,
                itemStyle: { color: 'rgba(229, 83, 75, 0.12)' },
                data: [[{ xAxis: opts.anomalyOnset }, { xAxis: 99999 }]],
              }
            : undefined,
      },
    ],
  });
}


/** Gauge chart for health index / probability */
export function gaugeOption(
  value: number,
  opts: {
    label?: string;
    max?: number;
    color?: string;
    thresholds?: { value: number; color: string }[];
  } = {},
): EChartsOption {
  const max = opts.max ?? 1;
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
          fontSize: 28,
          fontFamily: THEME.fontFamily,
          fontWeight: 600,
          color: THEME.ink,
          offsetCenter: [0, '10%'],
          formatter: (val: number) => (max <= 1 ? val.toFixed(2) : `${Math.round(val)}h`),
        },
        data: [{ value, name: opts.label || '' }],
      },
    ],
  };
}
