# EngineSense – Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (React + Vite)              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────────┐  │
│  │  Replay   │ │Signatures│ │Diagnosis │ │  Prognosis    │  │
│  │Dashboard  │ │   Lab    │ │& Explain │ │               │  │
│  ├──────────┤ ├──────────┤ ├──────────┤ ├───────────────┤  │
│  │Optimizer │ │Models &  │ │          │ │               │  │
│  │Sweet Spot│ │  Data    │ │          │ │               │  │
│  └──────────┘ └──────────┘ └──────────┘ └───────────────┘  │
│  TanStack Query │ Zustand │ ECharts │ React Router          │
└──────────────────────┬──────────────────────────────────────┘
                       │ REST + WebSocket
┌──────────────────────▼──────────────────────────────────────┐
│                    Backend (FastAPI + Uvicorn)               │
│                                                              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────────┐  │
│  │  API     │ │ Pipeline │ │  Models  │ │   Explain     │  │
│  │ Routes   │ │ (DSP)    │ │ SVM/ANN/ │ │ SHAP/GradCAM  │  │
│  │          │ │          │ │ CNN/IF   │ │ /Physics      │  │
│  ├──────────┤ ├──────────┤ ├──────────┤ ├───────────────┤  │
│  │  Sim     │ │  Data    │ │Prognosis │ │  Optimize     │  │
│  │ Engine   │ │ Loaders  │ │ HI/RUL   │ │ NSGA-II       │  │
│  ├──────────┤ ├──────────┤ ├──────────┤ ├───────────────┤  │
│  │ Sensors  │ │   DB     │ │  Jobs    │ │  BlobStore    │  │
│  │ Registry │ │SQLAlchemy│ │ (async)  │ │ (Parquet/NPZ) │  │
│  └──────────┘ └──────────┘ └──────────┘ └───────────────┘  │
└──────────────────────┬──────────────────────────────────────┘
                       │
        ┌──────────────┼──────────────┐
        ▼              ▼              ▼
   PostgreSQL      BlobStore       MLflow
   +TimescaleDB    (disk/S3)     (tracking)
   (or SQLite)
```

## Key Design Decisions

### Data Flow
1. **Simulator** generates physics-based multi-sensor data per scenario YAML
2. **Ingest** validates against sensor registry, stores telemetry in DB hypertable, high-rate in BlobStore
3. **Pipeline** windows → preprocesses → extracts signatures → normalises by operating condition
4. **Models** consume features: anomaly detection → fault classification → onset detection → prognosis
5. **Explanations** generated per prediction and stored for instant replay
6. **API** serves downsampled data, predictions, explanations; WebSocket for live mode

### Database Strategy
- **Telemetry (10-20 Hz)**: `sensor_readings` hypertable, compressed, indexed on `(run_id, ts)`
- **High-rate (10-25.6 kHz)**: chunked Parquet/NPZ files in BlobStore, indexed via `signal_chunks` table
- **Features**: JSONB in `windows` table for flexibility
- **Predictions/explanations**: normalised tables with JSON payloads

### Frontend Architecture
- **State**: Zustand for replay state (current time, speed, playing), TanStack Query for server data
- **Routing**: React Router with URL-encoded state (run ID, time cursor, active screen)
- **Charts**: ECharts with design.md theme; server-side LTTB downsampling
- **Performance**: virtualised lists, memoised chart configs, requestAnimationFrame replay loop

### Leakage Prevention
- Train/val/test split by **run** (scenario seed), never by random windows
- Enforced in `backend/app/models/splits.py` with a deterministic hash-based splitter
- Tested: `backend/tests/test_splits.py` verifies no run appears in multiple splits
