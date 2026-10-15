# EngineSense – Data Sources

> Exact URLs, licences, download dates, and usage notes for all external data sources.

## Real / Public Data Sources

### 1. Public OBD-II Driving Logs
- **Source**: Kaggle OBD-II datasets (various)
- **URL**: https://www.kaggle.com/datasets (search "OBD-II")
- **Licence**: Varies by dataset (CC0, CC-BY-4.0 typical)
- **Usage**: Fit realistic distributions, correlations, and noise profiles for telemetry streams (RPM, speed, throttle, coolant temp, etc.)
- **Status**: Used to derive statistical distributions; synthetic generator produces new data from these distributions
- **Download date**: Distributions extracted and hardcoded; no runtime download required

### 2. Standard Drive Cycles
- **EPA FTP-75**: https://www.epa.gov/vehicle-and-fuel-emissions-testing/dynamometer-drive-schedules
- **UDDS**: Same EPA source
- **HWFET**: Same EPA source
- **WLTP**: https://unece.org/transport/documents/2021/02/standards/wltp
- **Licence**: Public domain (US government) / UN open standard
- **Usage**: Realistic speed/RPM/load profiles that drive the simulator. Speed → RPM via gear model; load from acceleration + road load.
- **Status**: Profiles hardcoded from published tables (public domain)
- **Download date**: N/A (built-in)

### 3. NASA C-MAPSS (Commercial Modular Aero-Propulsion System Simulation)
- **URL**: https://data.nasa.gov/Aerospace/CMAPSS-Jet-Engine-Simulated-Data/xaut-bemq
- **Alternative**: https://ti.arc.nasa.gov/tech/dash/groups/pcoe/prognostic-data-repository/
- **Licence**: NASA Open Data (public domain)
- **Usage**: Validate the failure-prediction (prognosis) architecture on a genuinely real degradation benchmark
- **⚠️ DISCLAIMER**: This is **turbofan** data, NOT internal combustion engine data. Used ONLY for prognosis architecture validation. This is clearly stated in the UI.
- **Status**: Downloaded at runtime if available; graceful fallback to synthetic run-to-failure data
- **Download date**: Runtime (cached after first download)

### 4. CWRU Bearing Dataset (Optional)
- **URL**: https://engineering.case.edu/bearingdatacenter/download-data-file
- **Licence**: Academic use
- **Usage**: Optional vibration front-end robustness testing only
- **Status**: Not required for core demo; used if available

### 5. MIMII Dataset (Optional)
- **URL**: https://zenodo.org/record/3384388
- **Licence**: CC-BY-SA 4.0
- **Usage**: Optional acoustic anomaly detection robustness testing
- **Status**: Not required for core demo; used if available

## Synthetic Data

### Physics-Informed Engine Simulator
- **Location**: `backend/app/sim/`
- **Description**: Crank-angle-domain, 4-cylinder 4-stroke simulator with Wiebe heat-release model
- **Provenance**: All outputs tagged as `synthetic`
- **Ground truth**: Fault type, onset time, severity, and affected cylinder stored in DB
- **Reproducibility**: Seeded via scenario YAML; deterministic given seed

## Data Integrity Rules

1. Every data point has a `provenance` field: `real`, `synthetic`, or `hybrid`
2. `hybrid` means: real distributions + synthetic fault injection
3. Provenance is visible in the UI at all times (badge on run picker, tooltip on charts)
4. No real data is presented as synthetic or vice versa
5. C-MAPSS disclaimer shown wherever that data appears
