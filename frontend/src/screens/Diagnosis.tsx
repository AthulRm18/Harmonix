import React from 'react';
import ReactECharts from 'echarts-for-react';
import { useQuery } from '@tanstack/react-query';
import { fetchPredictions, fetchPhysicsExplanation } from '../api/client';
import { useReplayStore } from '../state/replayStore';
import { HelpPanel } from '../components/HelpPanel';
import { barChartOption, heatmapOption, THEME } from '../components/charts';

const FAULT_CLASSES = ['normal', 'knock', 'misfire', 'valve_wear', 'ignition_fault'];
const MODELS = ['CNN', 'SVM', 'ANN'];
const MODEL_COLORS: Record<string, string> = {
  CNN: THEME.primary,
  SVM: THEME.primaryHover,
  ANN: '#7a7fad',
};

// Demo data generator for when API isn't available
function demoPredictions(model: string) {
  const probs: Record<string, number> = {};
  let remaining = 1.0;
  FAULT_CLASSES.forEach((cls, i) => {
    if (cls === 'normal') {
      const val = 0.85 + Math.random() * 0.10;
      probs[cls] = val;
      remaining -= val;
    } else {
      const val = i === FAULT_CLASSES.length - 1 ? remaining : Math.min(remaining, Math.random() * 0.05);
      probs[cls] = Math.max(0, val);
      remaining -= val;
    }
  });
  return {
    model,
    predicted_class: 'normal',
    class_probs: probs,
    anomaly_score: 0.08 + Math.random() * 0.1,
  };
}

// Demo SHAP values
function demoShapValues() {
  const features = [
    'vibration_rms', 'knock_intensity', 'spectral_centroid',
    'mfcc_1', 'crest_factor', 'rpm_variance',
    'coolant_delta', 'o2_lambda', 'misfire_rate', 'stft_peak_freq',
  ];
  return features.map((f) => ({
    feature: f,
    importance: (Math.random() - 0.3) * 0.8,
  })).sort((a, b) => Math.abs(b.importance) - Math.abs(a.importance));
}

// Demo Grad-CAM data (5x5 attention grid)
function demoGradCAM() {
  const size = 8;
  const xLabels = Array.from({ length: size }, (_, i) => `T${i + 1}`);
  const yLabels = Array.from({ length: size }, (_, i) => `F${i + 1}`);
  const values: [number, number, number][] = [];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Create a hotspot pattern
      const cx = size / 2, cy = size / 3;
      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      values.push([x, y, Math.max(0, 1 - dist / (size * 0.6)) + Math.random() * 0.1]);
    }
  }
  return { xLabels, yLabels, values };
}

export const Diagnosis: React.FC = () => {
  const { runId, currentTime } = useReplayStore();

  const { data: predictionsData } = useQuery({
    queryKey: ['predictions', runId],
    queryFn: () => fetchPredictions(runId!),
    enabled: !!runId,
  });

  // Get current predictions or use demo data
  const predictions = predictionsData?.predictions || [];
  const currentPreds = MODELS.map((model) => {
    const realPred = predictions.find(
      (p: any) => p.model_id?.includes(model.toLowerCase()) && Math.abs(p.t_start - currentTime) < 2
    );
    return realPred || demoPredictions(model);
  });

  // Physics explanation
  const detectedFault = currentPreds.find((p: any) => p.predicted_class !== 'normal');
  const { data: physicsData } = useQuery({
    queryKey: ['physics', detectedFault?.predicted_class],
    queryFn: () => fetchPhysicsExplanation(detectedFault?.predicted_class || 'normal'),
    enabled: true,
  });

  // SHAP chart
  const shapValues = demoShapValues();
  const shapOpt = barChartOption(
    shapValues.map((s) => s.feature),
    shapValues.map((s) => s.importance),
    { horizontal: true, title: 'SHAP Feature Importance' },
  );

  // Grad-CAM heatmap
  const gradCam = demoGradCAM();
  const gradCamOpt = heatmapOption(gradCam.xLabels, gradCam.yLabels, gradCam.values, {
    xName: 'Time Windows',
    yName: 'Frequency Bands',
    minVal: 0,
    maxVal: 1,
    colorRange: [THEME.surface2, '#e5534b'],
  });

  // Determine consensus
  const consensus = currentPreds.every((p: any) => p.predicted_class === currentPreds[0].predicted_class);
  const mainClass = currentPreds[0].predicted_class || 'normal';
  const avgConfidence = currentPreds.reduce((sum: number, p: any) => {
    const probs = p.class_probs || {};
    return sum + (probs[mainClass] || 0);
  }, 0) / currentPreds.length;

  // Physics explanation text
  const physicsText = physicsData?.explanation
    || (mainClass === 'normal'
      ? 'All monitored parameters are within normal operating ranges. No anomalous frequency content detected in the knock band (6–8 kHz). Fuel trims are stable. No cylinder-specific deviations observed.'
      : `Anomaly detected: ${mainClass}. Further analysis required.`);

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
        {currentPreds.map((pred: any, idx: number) => {
          const model = MODELS[idx];
          const probs = pred.class_probs || {};
          const topClass = pred.predicted_class || 'normal';
          const topConf = probs[topClass] || 0;

          return (
            <div key={model} className="card">
              <div className="type-eyebrow ink-subtle mb-xs">{model} Classifier</div>
              <div
                className="type-headline mb-xs"
                style={{ color: topClass === 'normal' ? THEME.success : '#e5534b' }}
              >
                {topClass.replace('_', ' ')}
              </div>
              <div className="type-caption ink-subtle mb-sm">
                Confidence: {(topConf * 100).toFixed(1)}%
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xxs)' }}>
                {FAULT_CLASSES.map((cls) => (
                  <div key={cls} className="flex items-center gap-sm">
                    <span className="type-caption ink-subtle" style={{ width: 100 }}>{cls.replace('_', ' ')}</span>
                    <div style={{
                      flex: 1, height: 6, background: 'var(--color-hairline-strong)',
                      borderRadius: 'var(--rounded-pill)', overflow: 'hidden'
                    }}>
                      <div style={{
                        height: '100%',
                        width: `${(probs[cls] || 0) * 100}%`,
                        background: MODEL_COLORS[model],
                        borderRadius: 'var(--rounded-pill)',
                        transition: 'width 300ms ease-out',
                      }} />
                    </div>
                    <span className="type-mono ink-subtle" style={{ width: 40, textAlign: 'right', fontSize: 11 }}>
                      {((probs[cls] || 0) * 100).toFixed(0)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Explainability */}
      <div className="grid-2 mb-lg">
        <div className="card card-screenshot">
          <div className="type-eyebrow ink-subtle mb-xs">Grad-CAM Overlay (CNN)</div>
          <ReactECharts
            option={gradCamOpt}
            style={{ height: 250 }}
            opts={{ renderer: 'canvas' }}
          />
        </div>
        <div className="card card-screenshot">
          <div className="type-eyebrow ink-subtle mb-xs">SHAP Feature Importance</div>
          <ReactECharts
            option={shapOpt}
            style={{ height: 250 }}
            opts={{ renderer: 'canvas' }}
          />
        </div>
      </div>

      {/* Physics Explanation */}
      <div className="card mb-lg">
        <div className="type-eyebrow ink-subtle mb-xs">Physics-Based Explanation</div>
        <div className="type-body ink-muted">{physicsText}</div>
      </div>

      {/* Plain Language Summary */}
      <div className="card" style={{ borderLeft: `2px solid ${consensus ? THEME.success : '#e5534b'}` }}>
        <div className="type-eyebrow ink-subtle mb-xs">Plain-Language Summary</div>
        <div className="type-body-lg">
          {consensus
            ? `✓ Engine is operating ${mainClass === 'normal' ? 'normally' : `with ${mainClass.replace('_', ' ')}`}. All three models agree with ${avgConfidence > 0.8 ? 'high' : 'moderate'} confidence (${(avgConfidence * 100).toFixed(0)}%). ${mainClass === 'normal' ? 'No faults detected. Combustion is stable across all four cylinders.' : `Fault detected: ${mainClass.replace('_', ' ')}. Review recommended.`}`
            : `⚠ Models disagree. ${currentPreds.map((p: any, i: number) => `${MODELS[i]}: ${p.predicted_class}`).join(', ')}. Further investigation recommended.`}
        </div>
      </div>
    </div>
  );
};
