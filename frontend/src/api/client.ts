import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ── Sensor API ───────────────────────────────────────────────────
export const fetchSensors = () => api.get('/sensors').then(r => r.data);
export const fetchSensor = (id: string) => api.get(`/sensors/${id}`).then(r => r.data);
export const fetchFailureModes = () =>
  api.get('/sensors/intelligence/failure-modes').then(r => r.data);
export const fetchRunCorrelations = (runId: string) =>
  api.get(`/sensors/intelligence/correlations/${runId}`).then(r => r.data);
export const fetchRunExtremes = (runId: string, time_s?: number) =>
  api.get(`/sensors/intelligence/extremes/${runId}`, { params: { time_s } }).then(r => r.data);


// ── Run API ──────────────────────────────────────────────────────
export const fetchRuns = (offset = 0, limit = 50) =>
  api.get('/runs', { params: { offset, limit } }).then(r => r.data);

export const fetchRun = (id: string) => api.get(`/runs/${id}`).then(r => r.data);

export const simulateRun = (params: {
  name: string;
  scenario?: Record<string, unknown>;
  duration_s?: number;
  seed?: number;
}) => api.post('/runs/simulate', params).then(r => r.data);

export const fetchSignals = (
  runId: string,
  sensor: string,
  t0 = 0,
  t1?: number,
  maxPoints = 2000,
) =>
  api.get(`/runs/${runId}/signals`, {
    params: { sensor, t0, t1, max_points: maxPoints },
  }).then(r => r.data);

export const fetchPredictions = (runId: string) =>
  api.get(`/runs/${runId}/predictions`).then(r => r.data);

export const fetchEvents = (runId: string) =>
  api.get(`/runs/${runId}/events`).then(r => r.data);

export const fetchPrognosis = (runId: string) =>
  api.get(`/runs/${runId}/prognosis`).then(r => r.data);

export const fetchPerformance = (runId: string) =>
  api.get(`/runs/${runId}/performance`).then(r => r.data);

// ── Model API ────────────────────────────────────────────────────
export const fetchModels = () => api.get('/models').then(r => r.data);
export const fetchModelMetrics = (id: string) =>
  api.get(`/models/${id}/metrics`).then(r => r.data);

// ── Explanation API ──────────────────────────────────────────────
export const fetchExplanation = (predictionId: number) =>
  api.get(`/models/predictions/${predictionId}/explanation`).then(r => r.data);

export const fetchPhysicsExplanation = (faultType: string, severity = 0.5) =>
  api.get('/explain', { params: { fault_type: faultType, severity } }).then(r => r.data);

// ── Signatures API ───────────────────────────────────────────────
export const fetchFFT = (runId: string, sensor = 'vibration', t0 = 0, t1 = 1) =>
  api.get(`/signatures/${runId}/fft`, { params: { sensor, t0, t1 } }).then(r => r.data);

export const fetchSTFT = (runId: string, sensor = 'vibration', t0 = 0, t1 = 2, nperseg = 256) =>
  api.get(`/signatures/${runId}/stft`, { params: { sensor, t0, t1, nperseg } }).then(r => r.data);

export const fetchEnvelope = (runId: string, sensor = 'vibration', t0 = 0, t1 = 1) =>
  api.get(`/signatures/${runId}/envelope`, { params: { sensor, t0, t1 } }).then(r => r.data);

export const fetchOrderSpectrum = (runId: string, sensor = 'vibration', t0 = 0, t1 = 1, rpm?: number) =>
  api.get(`/signatures/${runId}/order`, { params: { sensor, t0, t1, ...(rpm ? { rpm } : {}) } }).then(r => r.data);

export const fetchWaveform = (runId: string, sensor = 'vibration', t0 = 0, t1 = 0.05, maxPoints = 2000) =>
  api.get(`/signatures/${runId}/waveform`, { params: { sensor, t0, t1, max_points: maxPoints } }).then(r => r.data);

// ── Optimizer API ────────────────────────────────────────────────
export const startOptimization = (params: Record<string, unknown>) =>
  api.post('/optimize', params).then(r => r.data);
export const fetchOptimization = (id: number) =>
  api.get(`/optimize/${id}`).then(r => r.data);
export const fetchEPIGrid = (rpmMin = 1000, rpmMax = 5000, loadMin = 10, loadMax = 90, steps = 20) =>
  api.get('/optimize/grid/epi', {
    params: { rpm_min: rpmMin, rpm_max: rpmMax, load_min: loadMin, load_max: loadMax, steps },
  }).then(r => r.data);

// ── Health ───────────────────────────────────────────────────────
export const fetchHealth = () => api.get('/health').then(r => r.data);
