<div align="center">

# ⚙ Harmonix

**Predictive Engine Diagnostics & Powertrain Optimization Platform**

*Signature extraction, pattern recognition, and real-time fault diagnosis for internal combustion engines using multivariable sensor data.*

[![Python](https://img.shields.io/badge/Python-3.11+-3776AB?logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18+-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5+-3178C6?logo=typescript&logoColor=white)](https://typescriptlang.org)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

</div>

---

## 🔥 The Problem

Modern automotive diagnostics are **reactive, vague, and expensive**.

When something goes wrong inside an engine, the car turns on a generic **"Check Engine" light**. A mechanic plugs in a standard OBD-II scanner, reads a cryptic trouble code like `P0300: Random/Multiple Cylinder Misfire`, and starts replacing parts by trial-and-error. By the time the fault surfaces, irreversible component damage may have already occurred.

| Pain Point | Impact |
|:---|:---|
| **Late Detection** | Damage is done before the warning light triggers |
| **Vague Codes** | A single code maps to 10+ possible root causes |
| **No Prognosis** | No way to know: "How many miles do I have left?" |
| **Guesswork Repairs** | Mechanics replace parts blind — $500+ wasted per incident |

---

## 💡 How Harmonix Solves It

Harmonix is an **end-to-end predictive intelligence platform** that listens to the micro-vibrations, acoustic frequencies, and electrical pulses inside the engine — **thousands of times per second** — to catch faults before they become catastrophic.

```
┌─────────────────┐    ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐
│   1. SENSING     │───▶│  2. SIGNATURES   │───▶│  3. AI ENSEMBLE  │───▶│  4. PROGNOSIS &  │
│                  │    │                  │    │                  │    │   OPTIMIZATION   │
│ Vibration        │    │ FFT Spectrum     │    │ Isolation Forest │    │ Health Index     │
│ Acoustic Sound   │    │ STFT Spectrogram │    │ SVM Classifier   │    │ RUL Countdown    │
│ Spark Coil Pulse │    │ Hilbert Envelope │    │ ANN Classifier   │    │ NSGA-II Sweet    │
│ RPM / Temp / λ   │    │ Order Tracking   │    │ 1D/2D CNN        │    │ Spot Optimizer   │
└─────────────────┘    └──────────────────┘    └──────────────────┘    └──────────────────┘
```

### What Each Step Does

1. **Sensing** — Captures high-frequency vibration (up to 25.6 kHz), ignition coil current pulses, and standard OBD-II telemetry (RPM, coolant temperature, throttle, manifold pressure, lambda).
2. **Signature Extraction (DSP)** — Converts raw noise into precise frequency fingerprints using FFT, STFT spectrograms, Hilbert envelope analysis, and crankshaft-synchronous order tracking.
3. **AI Ensemble** — Three independent classifiers (CNN, SVM, ANN) diagnose the exact fault type (knock, misfire, valve wear, ignition fault) and the affected cylinder. An unsupervised Isolation Forest flags anomalies before conventional thresholds are breached.
4. **Prognosis & Optimization** — Tracks a Health Index (1.0 → 0.0), forecasts Remaining Useful Life (RUL) in hours with 95% confidence intervals, and uses an NSGA-II genetic algorithm to compute the optimal engine calibration "Sweet Spot."

---

## 🏗 System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React + Vite)                   │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────────┐  │
│  │  Replay   │ │Signatures│ │Diagnosis │ │  Prognosis    │  │
│  │Dashboard  │ │   Lab    │ │& Explain │ │  & RUL        │  │
│  ├──────────┤ ├──────────┤ ├──────────┤ ├───────────────┤  │
│  │Optimizer │ │Models &  │ │Sensor Lab│ │               │  │
│  │Sweet Spot│ │  Data    │ │(Intell.) │ │               │  │
│  └──────────┘ └──────────┘ └──────────┘ └───────────────┘  │
│  TanStack Query │ Zustand │ ECharts │ React Router          │
└──────────────────────┬──────────────────────────────────────┘
                       │ REST API
┌──────────────────────▼──────────────────────────────────────┐
│                  Backend (FastAPI + Uvicorn)                  │
│                                                              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────────┐  │
│  │  API     │ │ Pipeline │ │  Models  │ │   Explain     │  │
│  │ Routes   │ │ (DSP)    │ │ SVM/ANN/ │ │ SHAP/GradCAM  │  │
│  │          │ │          │ │ CNN/IF   │ │ /Physics      │  │
│  ├──────────┤ ├──────────┤ ├──────────┤ ├───────────────┤  │
│  │  Sim     │ │  Data    │ │Prognosis │ │  Optimize     │  │
│  │ Engine   │ │ Loaders  │ │ HI/RUL   │ │ NSGA-II       │  │
│  └──────────┘ └──────────┘ └──────────┘ └───────────────┘  │
└──────────────────────┬──────────────────────────────────────┘
                       │
         ┌─────────────┼─────────────┐
         ▼             ▼             ▼
    SQLite/         BlobStore     MLflow
    PostgreSQL     (Parquet/NPZ)  (Tracking)
    +TimescaleDB
```

---

## 🎯 What Makes Harmonix Different

| Feature | Standard OBD-II Scanners | Harmonix |
|:---|:---|:---|
| **Timing** | Reactive — alerts *after* failure | Predictive — detects micro-faults weeks ahead |
| **Detail** | Generic error codes (`P0300`) | Pinpoints exact cylinder + fault type + physics proof |
| **Models** | Zero ML | 3 independent classifiers (CNN, SVM, ANN) with Softmax |
| **Explainability** | None | SHAP values + crank-angle attribution heatmaps |
| **Prognosis** | No lifespan prediction | Health Index + RUL countdown + failure probability |
| **Optimization** | No tuning guidance | NSGA-II Pareto optimizer computes the ideal engine calibration |

---

## 📊 Dashboard Pages

| Page | Purpose |
|:---|:---|
| **Replay Dashboard** | Live timeline scrubbing with multi-sensor view (RPM, Coolant, Throttle, Load), anomaly markers, and playback controls (0.5×–16×) |
| **Signatures Lab** | Time-domain waveform, FFT spectrum, STFT spectrogram, Hilbert envelope, and order spectrum. Includes Healthy vs Current comparison toggle |
| **Diagnosis & Explain** | Softmax probability cards from CNN, SVM, and ANN. Confusion matrices. SHAP feature importance and cylinder-level attribution charts |
| **Sensor Lab** | Extreme condition inspector & Arbiter (sensor fault vs mechanical engine failure), real-time 10×10 cross-sensor correlation heatmap with anomaly decoupling, and cascading failure simulator detailing ECU limp-home fallbacks and virtual sensor surrogates (e.g., Speed-Density for MAF, Thermal Coupling for ECT) |
| **Prognosis & RUL** | Health Index gauge (1.0→0.0), RUL prediction with 95% confidence fan chart, failure probability within 100h, and component wear bars |
| **Sweet Spot Optimizer** | EPI heatmap (RPM × Load), Pareto front scatter, recommended calibration (RPM, Load, Ignition Advance °BTDC, Lambda), before/after RUL comparison |
| **Models & Data** | Training metrics, per-class precision/recall/F1, confusion matrices for all 3 classifiers, and dataset provenance |

---

## 🛠 Tech Stack

### Backend
| Component | Technology |
|:---|:---|
| API Framework | **FastAPI** + Uvicorn (async) |
| Database | **SQLite** (dev) / **PostgreSQL + TimescaleDB** (prod) |
| ORM | **SQLAlchemy** 2.0 (async) |
| Migrations | **Alembic** |
| Signal Processing | **SciPy** (FFT, STFT, Hilbert) + **NumPy** |
| ML Models | **Scikit-learn** (SVM, Isolation Forest) + **PyTorch** (ANN, CNN) |
| Optimization | Custom **NSGA-II** implementation |
| Experiment Tracking | **MLflow** |

### Frontend
| Component | Technology |
|:---|:---|
| Framework | **React 18** + **TypeScript 5** |
| Build Tool | **Vite 8** |
| State Management | **Zustand** (replay state) + **TanStack Query** (server data) |
| Charts | **Apache ECharts** (canvas renderer) |
| Routing | **React Router v6** |
| Design System | Vanilla CSS with custom properties (Linear-inspired dark theme) |

### DevOps
| Component | Technology |
|:---|:---|
| Containerization | **Docker Compose** (4 services: API, Frontend, PostgreSQL+TimescaleDB, MLflow) |
| Testing | **pytest** (38 backend tests) |
| Linting | **Ruff** (Python) |

---

## 📚 Data Sources

### Primary: Physics-Informed Engine Simulator
All sensor data is generated by our **4-cylinder, 4-stroke engine simulator** (`backend/app/sim/`) using the Wiebe heat-release combustion model. The simulator produces 13 distinct driving scenarios with seeded faults (knock, misfire, valve wear, ignition failure) and precise ground-truth annotations. Every data point is tagged with provenance: `synthetic`, `real`, or `hybrid`.

### Calibration & Benchmark Datasets

| Dataset | Source | Usage |
|:---|:---|:---|
| **OBD-II Driving Logs** | [Kaggle (various)](https://www.kaggle.com/datasets?search=OBD-II) — CC0/CC-BY-4.0 | Calibrate realistic sensor ranges, noise profiles, and thermal dynamics |
| **EPA FTP-75 / WLTP** | [EPA](https://www.epa.gov/vehicle-and-fuel-emissions-testing/dynamometer-drive-schedules) / [UNECE](https://unece.org/transport/documents/2021/02/standards/wltp) — Public Domain | Standard drive cycle speed/RPM/load profiles |
| **NASA C-MAPSS** | [NASA Open Data](https://data.nasa.gov/Aerospace/CMAPSS-Jet-Engine-Simulated-Data/xaut-bemq) — Public Domain | Validate prognosis architecture (RUL degradation curves). ⚠️ Turbofan benchmark only — clearly disclosed in UI |
| **CWRU Bearing** | [Case Western Reserve](https://engineering.case.edu/bearingdatacenter) — Academic | Optional vibration diagnostics robustness testing |
| **MIMII** | [Zenodo](https://zenodo.org/record/3384388) — CC-BY-SA 4.0 | Optional acoustic anomaly detection validation |

---

## 🚀 Quick Start

### Prerequisites
- Python 3.11+
- Node.js 18+
- pip / npm

### 1. Install Dependencies
```bash
# Backend
cd backend && pip install -e ".[dev]"

# Frontend
cd frontend && npm install
```

### 2. Seed the Database
```bash
cd backend && python -m app.seed
```
This generates 13 driving scenarios, 1,434 feature windows, and trains the SVM (99.2% acc), ANN (94.4%), and CNN (96.3%) classifiers.

### 3. Start the Servers
```bash
# Terminal 1 — Backend API (http://localhost:8000)
cd backend && uvicorn app.main:app --host 0.0.0.0 --port 8000

# Terminal 2 — Frontend (http://localhost:3000)
cd frontend && npm run dev
```

### Docker (Alternative)
```bash
docker compose up -d --build
docker compose exec api python -m app.seed
# Frontend: http://localhost:5173  |  API: http://localhost:8000/docs
```

---

## 🧪 Testing

```bash
cd backend && python -m pytest tests/ -v
```
38 tests covering simulator physics, DSP pipeline, ML model accuracy, sensor registry, cross-sensor correlations and extreme inspectors, API endpoints, LTTB downsampling, and NSGA-II optimizer correctness.

---

## 📁 Project Structure

```
Harmonix/
├── backend/
│   ├── app/
│   │   ├── api/            # FastAPI route handlers (DSP, models, runs, sensors, optimizer)
│   │   ├── db/             # SQLAlchemy models & migrations
│   │   ├── explain/        # SHAP & GradCAM explainability
│   │   ├── models/         # SVM, ANN, CNN, Isolation Forest, Prognosis
│   │   ├── optimize/       # NSGA-II optimizer & EPI engine
│   │   ├── pipeline/       # DSP: FFT, STFT, envelope, order tracking
│   │   ├── sensors/        # Sensor registry, failure modes & validation
│   │   └── sim/            # Physics-informed engine simulator
│   ├── alembic/            # Database migrations
│   └── tests/              # pytest test suite (38 tests)
├── frontend/
│   ├── src/
│   │   ├── api/            # API client (TanStack Query)
│   │   ├── components/     # Sidebar, HelpPanel, ECharts theme
│   │   ├── screens/        # 7 dashboard pages (incl. Sensor Lab)
│   │   └── state/          # Zustand replay store
│   └── vite.config.ts      # Vite 8 + code-splitting
├── docs/                   # Architecture, Models, Data, Assumptions
├── docker-compose.yml      # 4-service containerized deployment
├── Makefile                # make install | seed | test | demo
└── DESIGN.md               # Design system tokens (Linear-inspired dark theme)
```

---

## 🔮 Real-World Deployment Path

Harmonix is designed for **edge-native deployment** in production vehicles:

1. **Sensing** — Reads from existing CAN-bus / OBD-II sensors and piezoelectric knock sensors already in every modern car.
2. **Edge Processing** — FFT + model inference runs in <50ms on automotive ARM ECUs (NXP S32G, TI Jacinto). No GPU required.
3. **Lightweight Uplink** — Only a 100-byte diagnostic JSON is transmitted over cellular — no raw audio streaming.
4. **Cloud Analytics** — NSGA-II optimization and fleet-wide trend analysis run on the depot/cloud server.

**Target users:** Commercial fleet operators (logistics, mining), automotive OEMs (warranty reduction), and heavy industrial machinery operators.

---

## 📜 Key Acronyms

| Acronym | Full Form |
|:---|:---|
| **FFT** | Fast Fourier Transform |
| **STFT** | Short-Time Fourier Transform |
| **CNN** | Convolutional Neural Network |
| **SVM** | Support Vector Machine |
| **ANN** | Artificial Neural Network |
| **RUL** | Remaining Useful Life |
| **HI** | Health Index |
| **EPI** | Engine Performance Index |
| **NSGA-II** | Non-Dominated Sorting Genetic Algorithm II |
| **BTDC** | Before Top Dead Center |
| **λ (Lambda)** | Air-to-Fuel Ratio (stoichiometric = 1.0) |
| **SHAP** | SHapley Additive exPlanations |
| **LTTB** | Largest-Triangle-Three-Buckets (downsampling) |
| **CAN** | Controller Area Network |
| **OBD-II** | On-Board Diagnostics (version 2) |
| **ECU** | Engine Control Unit |
| **TCU** | Telematics Control Unit |

---

## 👥 Team

Built for the **Honeywell Technologies** industrial assessment — *"Operation with multivariable data: Automobile engine data — Signature extraction and Pattern recognition."*

---

<div align="center">
<sub>Made with ⚙ by the Harmonix team</sub>
</div>
