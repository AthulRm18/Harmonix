# EngineSense – Assumptions Log

> Every assumption the team makes instead of asking is logged here with a rationale and the date.

| # | Date | Area | Assumption | Rationale |
|---|------|------|-----------|-----------|
| A1 | 2026-10-15 | Fonts | Use **Inter** (500/600/700) as Linear Display substitute, **Inter** (400) as Linear Text substitute, **JetBrains Mono** (400) as Linear Mono substitute | design.md §Note on Font Substitutes recommends Inter and JetBrains Mono as closest free substitutes |
| A2 | 2026-10-15 | Styling | Use vanilla CSS with CSS custom properties (no Tailwind, no CSS-in-JS) | design.md mandates specific tokens; vanilla CSS gives maximum control and avoids conflicts with UI kits |
| A3 | 2026-10-15 | Charts | ECharts theme will use design.md colours only; chart backgrounds use `surface-1`, gridlines use `hairline`, text uses `ink-muted` | design.md is silent on chart styling; we use the surface/ink hierarchy conservatively |
| A4 | 2026-10-15 | Semantic colours | Faults/anomalies will NOT use red/orange/yellow on the UI chrome. Instead: anomaly markers use `primary` (#5e6ad2) accent, severity shown via opacity or numeric badges. Inside charts and Grad-CAM overlays (which are "product UI screenshots"), richer colour palettes are acceptable per design.md Known Gaps §line 547 | design.md explicitly says "Don't introduce a second chromatic accent" for marketing; product-UI surfaces inside screenshot cards are exempt per §547 |
| A5 | 2026-10-15 | Database | Default `DATABASE_URL` points to SQLite for local dev; docker-compose overrides to PostgreSQL+TimescaleDB. SQLite mode disables hypertable features gracefully | Spec requires SQLite fallback via DATABASE_URL |
| A6 | 2026-10-15 | Auth | No authentication implemented; all endpoints public. A middleware seam (`backend/app/api/deps.py`) is left for future auth injection | Spec says "no multi-user auth (leave a clean seam for it)" |
| A7 | 2026-10-15 | Data provenance | Every data point is tagged `real`, `synthetic`, or `hybrid`. "hybrid" means real distributions + synthetic fault injection | Spec requires honest labelling |
| A8 | 2026-10-15 | Sensor sample rates | High-rate streams stored as chunked files (Parquet/NPZ), not in the DB time-series table | Spec §Tech Stack mandates BlobStore for large raw signals |
| A9 | 2026-10-15 | Drive cycles | EPA FTP-75 and WLTP speed-vs-time profiles will be hardcoded from published tables (public domain). If external CSV download fails, built-in arrays are used | These are published government standards, freely available |
| A10 | 2026-10-15 | C-MAPSS | NASA C-MAPSS is used ONLY to validate the prognosis architecture. The UI clearly states "turbofan benchmark, not IC engine" | Spec explicitly requires this disclaimer |
| A11 | 2026-10-15 | Model inference | All models run on CPU. No GPU required for demo | Spec says "target under 100ms on a laptop CPU" |
| A12 | 2026-10-15 | Replay speed | Default replay at 1× real-time; max 16× via client-side timer with server-side window fetching | Spec requires 0.5×–16× |
| A13 | 2026-10-15 | Chart data | Server-side LTTB downsampling caps at 2000 points per request for waveforms | Spec says "cap points per request" but doesn't specify a number; 2000 is a safe default for 60fps rendering |
| A14 | 2026-10-15 | MLflow | MLflow runs with a local file store (`./mlruns`) in dev; docker-compose provides an MLflow service with SQLite backend | Keeps `make demo` self-contained |
| A15 | 2026-10-15 | Cylinder count | Simulator defaults to 4-cylinder inline, firing order 1-3-4-2, 4-stroke | Spec specifies this exactly |
| A16 | 2026-10-15 | Motion/animation | Transitions limited to 150–200ms ease-out on hover/focus states. No atmospheric animations, no parallax, no spotlight effects | design.md: "No atmospheric gradients or spotlight cards"; conservative approach to motion |
