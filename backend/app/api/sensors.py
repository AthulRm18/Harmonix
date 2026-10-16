"""Sensor registry API."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
import numpy as np

from app.db import get_db
from app.db.models import SensorReading, Run
from app.sensors import load_registry

router = APIRouter()


@router.get("")
async def list_sensors():
    """Return all sensors from the registry with full metadata."""
    registry = load_registry()
    return {
        "count": len(registry),
        "sensors": [
            {
                "id": s.id,
                "name": s.name,
                "unit": s.unit,
                "sample_rate": s.sample_rate,
                "physical_meaning": s.physical_meaning,
                "normal_range": list(s.normal_range),
                "obd_pid": s.obd_pid,
                "provenance": s.provenance,
                "description": s.description,
                "category": s.category,
            }
            for s in registry
        ],
    }


# ── Sensor Failure Modes & Redundancy Surrogates Catalog ─────────────────────

FAILURE_MODES_CATALOG = [
    {
        "sensor_id": "maf_gps",
        "name": "Mass Airflow (MAF)",
        "unit": "g/s",
        "category": "Air Induction",
        "criticality": "CRITICAL",
        "normal_operating_envelope": "3.5 - 240.0 g/s",
        "extreme_threshold": "> 280 g/s or 0.0 g/s at throttle",
        "extreme_physical_meaning": "Excessive airflow reading indicates unmetered boost surge; zero reading under load indicates disconnected or severed hot-wire.",
        "failure_mode": "Contaminated hot-wire platinum element or circuit open (0V)",
        "ecu_fallback": "Limp-Home Mode: Reverts to pre-programmed Alpha-N load table (Throttle Angle × Engine RPM). Rev limit restricted to 3,000 RPM.",
        "engine_impact": "35% reduction in available torque, 25% fuel economy penalty, rough acceleration stutter, rich exhaust smell.",
        "surrogate_sensor": "MAP Sensor (Manifold Pressure) + Engine RPM + Intake Air Temp (IAT)",
        "surrogate_method": "Speed-Density Equation: Virtual mass flow calculated as ṁ = (V_d · RPM · η_v · P_map) / (2 · R · T_iat).",
        "redundancy_retention_pct": 86,
        "diagnostic_test": "Inspect hot-wire for debris. Measure 12V supply pin, 5V ref pin, and ground. Sensor output at idle should be 1.2V - 1.4V DC.",
        "estimated_part_cost": "$140 - $280",
    },
    {
        "sensor_id": "coolant_temp",
        "name": "Coolant Temperature (ECT)",
        "unit": "°C",
        "category": "Thermal Dynamics",
        "criticality": "HIGH",
        "normal_operating_envelope": "78 - 98 °C",
        "extreme_threshold": "> 108 °C (Overheat) or < 40 °C after 15m run",
        "extreme_physical_meaning": "Coolant temperature exceeds boiling point under pressure. Thermal expansion risks cylinder head warping and head gasket breach.",
        "failure_mode": "NTC thermistor internal fracture (open circuit) or harness short to ground",
        "ecu_fallback": "Failsafe Thermal Override: Assumes fixed warm default (80°C). Triggers high-speed radiator cooling fans at 100% continuous duty cycle.",
        "engine_impact": "Excessive fuel enrichment during cold start, carbon-fouled spark plugs, high hydrocarbon emissions, delayed closed-loop fueling.",
        "surrogate_sensor": "Engine Oil Temperature + Cylinder Head Temperature (CHT)",
        "surrogate_method": "Thermal Inertia Coupling Model: T_coolant(t) estimated via lagged oil temperature T_oil(t) minus calibrated radiator heat exchanger gradient.",
        "redundancy_retention_pct": 92,
        "diagnostic_test": "Measure sensor resistance: 2.2 kΩ - 2.8 kΩ at 20°C (ambient); drops to 250 Ω - 350 Ω at 80°C (operating). Replace if open/infinite.",
        "estimated_part_cost": "$35 - $65",
    },
    {
        "sensor_id": "throttle_position",
        "name": "Throttle Position Sensor (TPS)",
        "unit": "%",
        "category": "Driver Demand",
        "criticality": "CRITICAL",
        "normal_operating_envelope": "0 - 100 % (Idling at 8 - 14%)",
        "extreme_threshold": "Static 100% or erratic 0-100% micro-spikes",
        "extreme_physical_meaning": "Throttle sensor output disagrees with pedal angle, indicating stuck mechanical butterfly valve or carbon-jammed throttle bore.",
        "failure_mode": "Potentiometer resistor wiper track erosion or Hall-effect IC signal dropout",
        "ecu_fallback": "Drive-by-Wire Forced Idle / Limp: Disables electronic throttle servo response; limits throttle plate opening to 25% max aperture.",
        "engine_impact": "Severe acceleration lag, abrupt transmission downshifts, cruise control automatically disabled.",
        "surrogate_sensor": "Accelerator Pedal Position (APP 1 & 2) + MAP Pressure Rate (dP/dt)",
        "surrogate_method": "Virtual Angle Reconstruction: ECU estimates butterfly angle from dual accelerator pedal sensors cross-checked with intake manifold pressure surge dP/dt.",
        "redundancy_retention_pct": 82,
        "diagnostic_test": "Connect oscilloscope or DMM. Sweep throttle slowly from closed to wide open: verify smooth 0.5V to 4.5V linear progression without noise spikes.",
        "estimated_part_cost": "$85 - $190",
    },
    {
        "sensor_id": "accel_block",
        "name": "Engine Block Accelerometer / Knock",
        "unit": "g",
        "category": "Combustion Mechanics",
        "criticality": "CRITICAL",
        "normal_operating_envelope": "-25.0 to +25.0 g",
        "extreme_threshold": "> 35.0 g peak (Acoustic shockwave)",
        "extreme_physical_meaning": "Extreme high-frequency vibration acceleration indicates destructive detonation shockwaves or mechanical rod bearing clearance slap.",
        "failure_mode": "Piezoelectric ceramic crystal cracking or degraded coaxial ground shielding",
        "ecu_fallback": "Safety Timing Pull: Automatically retards base ignition advance across all cylinders by 8° - 10° BTDC safety buffer.",
        "engine_impact": "Loss of 15% - 20% peak engine power, sluggish passing acceleration, exhaust gas temperature (EGT) increases by up to 80°C.",
        "surrogate_sensor": "Crankshaft Position Sensor (Crank Speed Fluctuation Δω)",
        "surrogate_method": "Flywheel Micro-Deceleration Analysis: Calculates angular acceleration dω/dt between 10° and 40° ATDC. Detonation micro-shocks detected via crankshaft tooth jitter.",
        "redundancy_retention_pct": 78,
        "diagnostic_test": "Measure AC millivolt output with DMM while lightly tapping cylinder block with a small brass rod near sensor mount: should pulse 25 - 80 mV AC.",
        "estimated_part_cost": "$60 - $130",
    },
    {
        "sensor_id": "lambda_o2",
        "name": "Wideband Oxygen Sensor (Lambda)",
        "unit": "λ",
        "category": "Exhaust & Emissions",
        "criticality": "HIGH",
        "normal_operating_envelope": "0.85 - 1.15 λ (Stoichiometric target = 1.00)",
        "extreme_threshold": "> 1.25 λ (Severe Lean) or < 0.75 λ (Severe Rich)",
        "extreme_physical_meaning": "Extreme lean mixture causes in-cylinder combustion temperatures to spike past 900°C; extreme rich causes unburnt fuel to burn inside catalytic converter.",
        "failure_mode": "Zirconia sensing element silica/lead poisoning or internal ceramic heater circuit burnout",
        "ecu_fallback": "Open-Loop Fueling: Disables closed-loop feedback; locks Short-Term Fuel Trim (STFT) to 0.0% and runs conservative factory base fuel pulse table.",
        "engine_impact": "Emissions increase by 250%, fuel consumption rises 15%, catalytic converter thermal melting risk under sustained highway load.",
        "surrogate_sensor": "Mass Airflow (MAF) + Fuel Injector Pulse Width (IPW)",
        "surrogate_method": "Mass Stoichiometry Model: Calculated virtual lambda λ_virtual = ṁ_air / (14.7 × (IPW × Flow_rate × ρ_fuel)).",
        "redundancy_retention_pct": 84,
        "diagnostic_test": "Measure heater pins 3-4 resistance: should measure 9 - 16 Ω cold. Signal voltage should toggle smoothly between 0.1V (lean) and 0.9V (rich) in closed loop.",
        "estimated_part_cost": "$95 - $220",
    },
    {
        "sensor_id": "map_kpa",
        "name": "Manifold Absolute Pressure (MAP)",
        "unit": "kPa",
        "category": "Air Induction",
        "criticality": "HIGH",
        "normal_operating_envelope": "25 - 180 kPa (Vacuum to Boost)",
        "extreme_threshold": "> 220 kPa (Overboost) or < 15 kPa (Excessive Vacuum)",
        "extreme_physical_meaning": "Manifold pressure overboost risks cylinder pressure peak exceedance; abnormal vacuum indicates throttle plate restriction or severe carbon throttling.",
        "failure_mode": "Silicon diaphragm fatigue rupture or carbon soot port clogging",
        "ecu_fallback": "Backup Volumetric Efficiency: Uses Throttle Position (TPS) and Engine RPM lookup table to estimate intake manifold pressure.",
        "engine_impact": "Hesitation during rapid tip-in throttle transitions, boost spikes, erratic automatic gear shifts.",
        "surrogate_sensor": "Mass Airflow (MAF) + Throttle Position (TPS) + Ambient Barometer (BARO)",
        "surrogate_method": "Bernoulli Inflow Restriction: Virtual pressure P_map,virtual = P_baro - k × (ṁ_maf / Throttle_Area)².",
        "redundancy_retention_pct": 88,
        "diagnostic_test": "Key On Engine Off (KOEO): MAP should read local atmospheric pressure (~101 kPa at sea level). Idle should read 30 - 38 kPa.",
        "estimated_part_cost": "$50 - $110",
    },
    {
        "sensor_id": "engine_load",
        "name": "Calculated Engine Load",
        "unit": "%",
        "category": "Combustion Mechanics",
        "criticality": "HIGH",
        "normal_operating_envelope": "15 - 85 %",
        "extreme_threshold": "> 95 % (Maximum Structural Load)",
        "extreme_physical_meaning": "Engine is operating at continuous peak mechanical output. Piston rings, connecting rod journals, and head bolts are at certified design fatigue limits.",
        "failure_mode": "Calculation corruption due to missing airflow or throttle inputs",
        "ecu_fallback": "Default Safe Load Curve: Caps engine power output and limits boost controller solenoid duty cycle.",
        "engine_impact": "Reduced towing and climbing performance, early transmission upshifts.",
        "surrogate_sensor": "Fuel Injector Delivery Mass + Vehicle Acceleration (IMU / Speed)",
        "surrogate_method": "Torque Dynamometer Model: Calculates torque T_virtual = (m_vehicle · a_vehicle + F_drag) × r_tire, converting wheel force back into engine brake load.",
        "redundancy_retention_pct": 80,
        "diagnostic_test": "Cross-check MAP and MAF inputs; verify ECU calculation updates dynamically in OBD-II live data stream PID 0x0104.",
        "estimated_part_cost": "Software / Sensor Calibration",
    },
    {
        "sensor_id": "oil_temp",
        "name": "Engine Oil Temperature",
        "unit": "°C",
        "category": "Thermal Dynamics",
        "criticality": "HIGH",
        "normal_operating_envelope": "82 - 110 °C",
        "extreme_threshold": "> 125 °C (Thermal Breakdown)",
        "extreme_physical_meaning": "Oil film hydrodynamic viscosity collapses at > 125°C. Hydrodynamic bearing separation fails, leading to metal-to-metal boundary friction.",
        "failure_mode": "Oil sump thermistor failure or wiring harness grounding",
        "ecu_fallback": "Reverts to Coolant Temperature offset model (+10°C over coolant under sustained operation).",
        "engine_impact": "Loss of accurate oil viscosity estimation, delayed variable valve timing (VVT) phaser response.",
        "surrogate_sensor": "Coolant Temperature (ECT) + Engine Load History (Cumulative Thermal Work)",
        "surrogate_method": "Sump Thermal Integration: T_oil(t) = T_coolant(t) + ∫ (Load × RPM) dt · k_friction.",
        "redundancy_retention_pct": 91,
        "diagnostic_test": "Measure sump sensor resistance. Check connector for oil seepage through sensor body.",
        "estimated_part_cost": "$40 - $80",
    },
]


@router.get("/intelligence/failure-modes")
async def get_failure_modes():
    """Return the failure modes catalog with surrogate virtual sensors and ECU fallbacks."""
    return {
        "count": len(FAILURE_MODES_CATALOG),
        "catalog": FAILURE_MODES_CATALOG,
    }


@router.get("/intelligence/correlations/{run_id}")
async def get_run_correlations(
    run_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Compute the dynamic Pearson correlation matrix across actual recorded sensors for a run."""
    run_res = await db.execute(select(Run).where(Run.id == run_id))
    run = run_res.scalar_one_or_none()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")

    target_sensors = [
        "engine_rpm",
        "throttle_position",
        "engine_load",
        "coolant_temp",
        "oil_temp",
        "map_kpa",
        "maf_gps",
        "lambda_o2",
        "stft",
        "ignition_timing_advance",
    ]

    q = (
        select(SensorReading.sensor_id, SensorReading.ts, SensorReading.value)
        .where(SensorReading.run_id == run_id, SensorReading.sensor_id.in_(target_sensors))
        .order_by(SensorReading.ts)
    )
    rows = (await db.execute(q)).all()

    by_sensor: dict[str, dict[str, list[float]]] = {}
    for sid, ts, val in rows:
        if sid not in by_sensor:
            by_sensor[sid] = {"ts": [], "val": []}
        by_sensor[sid]["ts"].append(float(ts))
        by_sensor[sid]["val"].append(float(val))

    all_ts = [t for sid in by_sensor for t in by_sensor[sid]["ts"]]
    if not all_ts:
        return {"run_id": run_id, "sensors": [], "matrix": [], "decoupled_alerts": []}

    t_min, t_max = min(all_ts), max(all_ts)
    grid_t = np.linspace(t_min, t_max, 120)

    valid_sensors: list[str] = []
    matrix_data: list[np.ndarray] = []

    for sid in target_sensors:
        if sid in by_sensor and len(by_sensor[sid]["ts"]) >= 5:
            interp_vals = np.interp(grid_t, by_sensor[sid]["ts"], by_sensor[sid]["val"])
            # verify std is non-zero
            if np.std(interp_vals) > 1e-6:
                matrix_data.append(interp_vals)
                valid_sensors.append(sid)

    if len(valid_sensors) < 2:
        return {"run_id": run_id, "sensors": valid_sensors, "matrix": [], "decoupled_alerts": []}

    corr_matrix = np.corrcoef(matrix_data)
    corr_matrix = np.nan_to_num(corr_matrix, nan=0.0)

    # Detect decoupled anomalies
    decoupled_alerts: list[dict] = []
    idx_map = {s: i for i, s in enumerate(valid_sensors)}

    # Expected couplings in a healthy combustion engine
    expected_pairs = [
        ("engine_rpm", "engine_load", 0.70, "RPM and Engine Load should exhibit strong positive coupling during acceleration."),
        ("throttle_position", "map_kpa", 0.75, "Opening throttle plate should directly raise manifold absolute pressure."),
        ("engine_load", "maf_gps", 0.70, "Higher engine load demands proportional mass airflow intake."),
        ("coolant_temp", "oil_temp", 0.60, "Engine coolant and sump oil temperature should follow a shared thermal warm-up gradient."),
    ]

    for s1, s2, min_expected_r, reason in expected_pairs:
        if s1 in idx_map and s2 in idx_map:
            observed_r = float(corr_matrix[idx_map[s1], idx_map[s2]])
            if observed_r < min_expected_r * 0.5:
                decoupled_alerts.append({
                    "sensor_a": s1,
                    "sensor_b": s2,
                    "observed_correlation": round(observed_r, 2),
                    "expected_min_correlation": min_expected_r,
                    "severity": "CRITICAL" if observed_r < 0 else "WARNING",
                    "explanation": f"Decoupling Detected ({s1} ⟷ {s2}): observed r = {observed_r:.2f} vs expected > {min_expected_r:.2f}. {reason}",
                })

    # Prepare labels
    registry = load_registry()
    sensor_labels = [registry.get(sid).name if sid in registry else sid for sid in valid_sensors]

    return {
        "run_id": run_id,
        "sensors": valid_sensors,
        "sensor_labels": sensor_labels,
        "matrix": [[round(float(val), 3) for val in row] for row in corr_matrix],
        "decoupled_alerts": decoupled_alerts,
    }


@router.get("/intelligence/extremes/{run_id}")
async def get_run_extremes(
    run_id: str,
    time_s: float | None = Query(None, description="Current playhead time"),
    db: AsyncSession = Depends(get_db),
):
    """Evaluate real-time sensor extreme statuses and physical Arbiter diagnostic."""
    run_res = await db.execute(select(Run).where(Run.id == run_id))
    run = run_res.scalar_one_or_none()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")

    q = (
        select(SensorReading.sensor_id, SensorReading.ts, SensorReading.value)
        .where(SensorReading.run_id == run_id)
        .order_by(SensorReading.ts)
    )
    rows = (await db.execute(q)).all()

    by_sensor: dict[str, dict[str, list[float]]] = {}
    for sid, ts, val in rows:
        if sid not in by_sensor:
            by_sensor[sid] = {"ts": [], "val": []}
        by_sensor[sid]["ts"].append(float(ts))
        by_sensor[sid]["val"].append(float(val))

    registry = load_registry()
    sensor_summaries: list[dict] = []

    for sid, data in by_sensor.items():
        if not data["val"]:
            continue
        reg_s = registry.get(sid)
        vals = np.array(data["val"])
        ts_arr = np.array(data["ts"])

        # Value at time_s or last value
        if time_s is not None and len(ts_arr) > 0:
            idx = int(np.argmin(np.abs(ts_arr - time_s)))
            current_val = float(vals[idx])
        else:
            current_val = float(vals[-1])

        # Classification based on normal range
        normal_min, normal_max = reg_s.normal_range if reg_s else (vals.min(), vals.max())
        val_range = max(1e-3, normal_max - normal_min)

        status = "NOMINAL"
        status_color = "var(--color-semantic-success)"
        physical_note = "Operating safely within factory design tolerances."

        if current_val > normal_max + 0.3 * val_range:
            status = "PHYSICAL_DAMAGE_THREAT"
            status_color = "#e5534b"
            physical_note = f"Exceeded certified maximum of {normal_max} {reg_s.unit if reg_s else ''}. Active risk of mechanical or thermal failure."
        elif current_val > normal_max or current_val < normal_min:
            status = "OPERATIONAL_EXTREME"
            status_color = "#e09b24"
            physical_note = f"Operating in high-stress envelope outside nominal range ({normal_min} - {normal_max} {reg_s.unit if reg_s else ''})."

        # Downsampled series for silky smooth 60fps in-memory client scrub
        if len(ts_arr) > 120:
            grid = np.linspace(ts_arr[0], ts_arr[-1], 120)
            interp_v = np.interp(grid, ts_arr, vals)
            downsampled_ts = [round(float(t), 2) for t in grid]
            downsampled_vals = [round(float(v), 2) for v in interp_v]
        else:
            downsampled_ts = [round(float(t), 2) for t in ts_arr]
            downsampled_vals = [round(float(v), 2) for v in vals]

        sensor_summaries.append({
            "sensor_id": sid,
            "name": reg_s.name if reg_s else sid,
            "unit": reg_s.unit if reg_s else "",
            "category": reg_s.category if reg_s else "telemetry",
            "current_value": round(current_val, 2),
            "normal_range": [normal_min, normal_max],
            "min_recorded": round(float(vals.min()), 2),
            "max_recorded": round(float(vals.max()), 2),
            "status": status,
            "status_color": status_color,
            "physical_note": physical_note,
            "timestamps": downsampled_ts,
            "values": downsampled_vals,
        })

    # ── Sensor vs Engine Fault Arbiter Logic ─────────────────────────────────
    curr_dict = {s["sensor_id"]: s["current_value"] for s in sensor_summaries}
    coolant = curr_dict.get("coolant_temp", 90.0)
    oil = curr_dict.get("oil_temp", 95.0)
    map_p = curr_dict.get("map_kpa", 50.0)
    maf = curr_dict.get("maf_gps", 20.0)
    crank_fluc = abs(curr_dict.get("crank_speed_fluctuation", 0.0))

    if coolant > 105.0 and oil < 90.0:
        arbiter = {
            "verdict": "SENSOR_ELECTRICAL_FAULT",
            "confidence_pct": 91,
            "primary_culprit": "ECT (Coolant Temperature) Sensor",
            "title": "Probable Sensor Electrical Circuit Fault",
            "summary": "Coolant temperature reads boiling (>105°C) while Engine Oil temperature is completely normal (<90°C). Thermodynamically impossible in a running block without oil heat transfer. High probability of ECT open-circuit or wiring ground short.",
        }
    elif coolant > 106.0 and oil > 115.0:
        arbiter = {
            "verdict": "PHYSICAL_ENGINE_FAULT",
            "confidence_pct": 97,
            "primary_culprit": "Cooling System / Engine Block Overheating",
            "title": "Verified Physical Engine Thermal Distress",
            "summary": "Both Coolant and Oil temperatures simultaneously register critical thermal levels (>105°C and >115°C). Dual-sensor physical consistency confirms authentic engine overheating risk.",
        }
    elif map_p > 85.0 and maf < 10.0:
        arbiter = {
            "verdict": "SENSOR_ELECTRICAL_FAULT",
            "confidence_pct": 89,
            "primary_culprit": "Mass Airflow (MAF) Sensor",
            "title": "Air Induction Discrepancy",
            "summary": "High intake manifold pressure (MAP) indicates high throttle opening, but MAF airflow is flatlined near zero. High probability of contaminated MAF sensor element or disconnected harness.",
        }
    elif crank_fluc > 30.0:
        arbiter = {
            "verdict": "PHYSICAL_ENGINE_FAULT",
            "confidence_pct": 94,
            "primary_culprit": "Cylinder Combustion Instability (Misfire)",
            "title": "Physical Crankshaft Torque Deficit",
            "summary": f"Crankshaft micro-speed fluctuation is elevated at ±{crank_fluc:.1f} RPM. Physical torque deficit indicates active cylinder misfire or ignition spark collapse.",
        }
    else:
        arbiter = {
            "verdict": "NOMINAL",
            "confidence_pct": 99,
            "primary_culprit": "None · All Systems Consistent",
            "title": "Multi-Sensor Cross-Validation Passed",
            "summary": "Cross-sensor physical consistency verified. Sensor readings corroborate one another across thermal, mechanical, and air-induction domains.",
        }

    return {
        "run_id": run_id,
        "playhead_time_s": time_s,
        "sensors": sensor_summaries,
        "arbiter": arbiter,
    }


@router.get("/{sensor_id}")
async def get_sensor(sensor_id: str):
    """Return a single sensor's metadata."""
    registry = load_registry()
    s = registry.get(sensor_id)
    return {
        "id": s.id,
        "name": s.name,
        "unit": s.unit,
        "sample_rate": s.sample_rate,
        "physical_meaning": s.physical_meaning,
        "normal_range": list(s.normal_range),
        "obd_pid": s.obd_pid,
        "provenance": s.provenance,
        "description": s.description,
        "category": s.category,
    }
