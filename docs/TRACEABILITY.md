# EngineSense – Traceability Matrix

> Maps every Problem Statement (PS) requirement to a module, API endpoint, and UI screen.

## PS Core Requirements

| # | PS Requirement | Backend Module | API Endpoint(s) | UI Screen | Status |
|---|---------------|----------------|-----------------|-----------|--------|
| R1 | Read multiple sensor streams (acoustic, vibration, current/electrical) | `backend/app/sensors/`, `backend/app/sim/` | `GET /sensors`, `GET /runs/{id}/signals` | Replay Dashboard – multi-sensor panels | 🔲 |
| R2 | Read ECU/OBD-II/CAN telemetry (RPM, coolant temp, throttle, fuel trims) | `backend/app/sensors/`, `backend/app/sim/engine.py` | `GET /sensors`, `GET /runs/{id}/signals` | Replay Dashboard – telemetry panels | 🔲 |
| R3 | Isolate signatures: FFT | `backend/app/pipeline/signatures.py` | `GET /runs/{id}/spectrum` | Signatures Lab – FFT spectrum | 🔲 |
| R4 | Isolate signatures: STFT | `backend/app/pipeline/signatures.py` | `GET /runs/{id}/spectrogram` | Signatures Lab – STFT spectrogram | 🔲 |
| R5 | Isolate signatures: electrical patterns | `backend/app/pipeline/signatures.py` | `GET /runs/{id}/signals?sensor=ignition_coil_current` | Signatures Lab – electrical waveform | 🔲 |
| R6 | Diagnose knock | `backend/app/models/classifier.py`, `backend/app/sim/faults.py` | `GET /runs/{id}/predictions` | Diagnosis & Explainability | 🔲 |
| R7 | Diagnose misfire | `backend/app/models/classifier.py`, `backend/app/sim/faults.py` | `GET /runs/{id}/predictions` | Diagnosis & Explainability | 🔲 |
| R8 | Diagnose valve-train wear | `backend/app/models/classifier.py`, `backend/app/sim/faults.py` | `GET /runs/{id}/predictions` | Diagnosis & Explainability | 🔲 |
| R9 | Diagnose ignition-coil/spark degradation (electrical) | `backend/app/models/classifier.py`, `backend/app/sim/faults.py` | `GET /runs/{id}/predictions` | Diagnosis & Explainability | 🔲 |
| R10 | Spot normal operating baselines | `backend/app/models/anomaly.py` | `GET /runs/{id}/predictions` | Replay Dashboard – status card | 🔲 |
| R11 | Predict component wear | `backend/app/models/prognosis.py` | `GET /runs/{id}/prognosis` | Prognosis screen | 🔲 |
| R12 | Identify real-time faults | `backend/app/pipeline/`, WebSocket handler | `WS /ws/live/{run_id}` | Replay Dashboard – live mode | 🔲 |
| R13 | Dashboard: multivariable sensor data | `backend/app/api/runs.py` | `GET /runs/{id}/signals` | Replay Dashboard | 🔲 |
| R14 | Dashboard: time-domain signatures | `backend/app/pipeline/signatures.py` | `GET /runs/{id}/signals` | Signatures Lab | 🔲 |
| R15 | Dashboard: frequency-domain signatures | `backend/app/pipeline/signatures.py` | `GET /runs/{id}/spectrum`, `/spectrogram` | Signatures Lab | 🔲 |
| R16 | Dashboard: recognised patterns using CNN | `backend/app/models/cnn.py` | `GET /runs/{id}/predictions`, `GET /models` | Diagnosis & Explainability, Models & Data | 🔲 |
| R17 | Dashboard: recognised patterns using SVM | `backend/app/models/svm.py` | `GET /runs/{id}/predictions`, `GET /models` | Diagnosis & Explainability, Models & Data | 🔲 |
| R18 | Dashboard: recognised patterns using ANN with Softmax | `backend/app/models/ann.py` | `GET /runs/{id}/predictions`, `GET /models` | Diagnosis & Explainability, Models & Data | 🔲 |
| R19 | Compare all three models | `backend/app/models/evaluation.py` | `GET /models/{id}/metrics` | Models & Data – comparison table | 🔲 |

## Additional Team Requirements

| # | Requirement | Backend Module | API Endpoint(s) | UI Screen | Status |
|---|------------|----------------|-----------------|-----------|--------|
| T1 | ≥10 open-source/reproducible sensor streams | `backend/app/sensors/registry.yaml` | `GET /sensors` | Models & Data – sensor registry | 🔲 |
| T2 | Real + synthetic data, clearly labelled | `backend/app/data/`, provenance field | `GET /runs` (provenance badge) | Replay Dashboard – run picker badge | 🔲 |
| T3 | Fault detection + future failure prediction | `backend/app/models/prognosis.py` | `GET /runs/{id}/prognosis` | Prognosis screen | 🔲 |
| T4 | Health index, RUL, failure probability | `backend/app/models/prognosis.py` | `GET /runs/{id}/prognosis` | Prognosis screen – HI chart, RUL fan, P(fail) gauge | 🔲 |
| T5 | Performance features + optimisation module | `backend/app/optimize/` | `POST /optimize`, `GET /optimize/{id}` | Optimizer / Sweet Spot | 🔲 |
| T6 | Explainability for every diagnosis | `backend/app/explain/` | `GET /predictions/{id}/explanation` | Diagnosis & Explainability | 🔲 |
| T7 | Replay UI with anomaly onset markers | `frontend/src/screens/ReplayDashboard.tsx` | `GET /runs/{id}/events` | Replay Dashboard – markers + "Jump to anomaly" | 🔲 |
| T8 | Persistent database | `backend/app/db/`, Alembic migrations | All endpoints | All screens (data persists across restarts) | 🔲 |
| T9 | Comprehensible to non-expert judges | Frontend glossary tooltips, help panels | — | All screens – "What am I looking at?" panel | 🔲 |

## Status Legend
- 🔲 Not started
- 🔨 In progress
- ✅ Complete
- ⏭️ Deferred
