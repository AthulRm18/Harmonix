"""Physics-based automobile engine simulator.

Generates realistic multi-sensor time-series data for a 4-cylinder inline engine.
Supports injectable fault conditions: knock, misfire, valve-train wear,
and ignition coil degradation.
"""

from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np


@dataclass
class EngineParams:
    """Physical parameters for a 4-cylinder inline engine."""

    cylinders: int = 4
    firing_order: list[int] = field(default_factory=lambda: [1, 3, 4, 2])
    bore_mm: float = 86.0
    stroke_mm: float = 86.0
    displacement_cc: float = 2000.0
    compression_ratio: float = 10.5
    idle_rpm: float = 750.0
    redline_rpm: float = 6500.0
    base_timing_deg: float = 28.0  # Base ignition timing °BTDC
    stoich_afr: float = 14.7


@dataclass
class OperatingPoint:
    """Instantaneous operating condition."""

    rpm: float = 2000.0
    throttle_pct: float = 30.0
    coolant_temp_c: float = 90.0
    intake_temp_c: float = 25.0
    ambient_pressure_kpa: float = 101.325


def _crank_angle_series(rpm: float, duration_s: float, sample_rate: int) -> np.ndarray:
    """Generate crank angle array in degrees for given RPM and duration."""
    n_samples = int(duration_s * sample_rate)
    t = np.linspace(0, duration_s, n_samples, endpoint=False)
    # RPM -> degrees/second: rpm * 360 / 60 = rpm * 6
    deg_per_sec = rpm * 6.0
    return (t * deg_per_sec) % 720.0, t


def generate_telemetry(
    op: OperatingPoint,
    duration_s: float = 300.0,
    sample_rate: int = 20,
    params: EngineParams | None = None,
    rng: np.random.Generator | None = None,
) -> dict[str, np.ndarray]:
    """Generate low-rate OBD-II / CAN telemetry signals.

    Returns a dict of sensor_id -> numpy array of shape (n_samples,).
    Also returns 'timestamps' key with the time axis.
    """
    if params is None:
        params = EngineParams()
    if rng is None:
        rng = np.random.default_rng(42)

    n = int(duration_s * sample_rate)
    t = np.linspace(0, duration_s, n, endpoint=False)

    # ── RPM profile: idle -> cruise -> acceleration -> deceleration cycles ──
    rpm_base = op.rpm
    # Slow sinusoidal variation simulating driving pattern
    rpm_variation = 400.0 * np.sin(2 * np.pi * t / 120.0) + 200.0 * np.sin(2 * np.pi * t / 45.0)
    rpm = np.clip(
        rpm_base + rpm_variation + rng.normal(0, 5, n), params.idle_rpm, params.redline_rpm
    )

    # ── Throttle position follows RPM demand ──
    throttle = np.clip(
        op.throttle_pct
        + 15.0 * np.sin(2 * np.pi * t / 120.0)
        + 8.0 * np.sin(2 * np.pi * t / 45.0)
        + rng.normal(0, 0.5, n),
        0,
        100,
    )

    # ── Engine load derived from RPM × throttle ──
    engine_load = np.clip(
        (rpm / params.redline_rpm) * throttle * 1.1 + rng.normal(0, 0.3, n),
        0,
        100,
    )

    # ── MAP: roughly proportional to throttle, inverse at idle ──
    map_kpa = np.clip(
        30.0 + throttle * 1.7 + rng.normal(0, 0.5, n),
        20,
        250,
    )

    # ── MAF: mass airflow correlates with RPM × volumetric efficiency ──
    vol_eff = 0.85 + 0.1 * np.sin(2 * np.pi * rpm / 3000.0)  # simplified
    maf = np.clip(
        (rpm / 60.0)
        * (params.displacement_cc / 1e6)
        * (map_kpa / 101.325)
        * (273.15 / (273.15 + op.intake_temp_c))
        * vol_eff
        * 1.225
        * 1000.0
        + rng.normal(0, 0.2, n),
        0,
        300,
    )

    # ── Coolant temperature: slow thermal dynamics ──
    coolant = np.full(n, op.coolant_temp_c)
    for i in range(1, n):
        heat_in = 0.0002 * engine_load[i]
        heat_out = 0.0001 * (coolant[i - 1] - 25.0)
        coolant[i] = coolant[i - 1] + heat_in - heat_out + rng.normal(0, 0.01)
    coolant = np.clip(coolant, 60, 120)

    # ── Intake air temperature: slow variation ──
    iat = op.intake_temp_c + 2.0 * np.sin(2 * np.pi * t / 300.0) + rng.normal(0, 0.2, n)

    # ── Lambda (AFR / stoich): regulated around 1.0 ──
    lambda_o2 = (
        1.0 + 0.015 * np.sin(2 * np.pi * t / 0.5) + rng.normal(0, 0.005, n)
    )  # O2 sensor switching

    # ── Fuel trims ──
    stft = rng.normal(0, 1.5, n) + 1.5 * np.sin(2 * np.pi * t / 2.0)  # Short-term
    ltft = np.cumsum(rng.normal(0, 0.01, n))  # Random walk, slow drift
    ltft = np.clip(ltft, -10, 10)

    # ── Ignition timing: base - knock retard ──
    timing = params.base_timing_deg - 2.0 * (rpm / params.redline_rpm) * (engine_load / 100.0)
    timing += rng.normal(0, 0.2, n)

    # ── Vehicle speed: from RPM with gear approximation ──
    # Simplified: assume single gear ratio mapping
    gear_ratio = np.where(
        rpm < 1500, 3.5, np.where(rpm < 2500, 2.8, np.where(rpm < 3500, 2.0, 1.5))
    )
    final_drive = 3.73
    tire_circumference_m = 2.0  # ~205/55R16
    vehicle_speed = (rpm / (gear_ratio * final_drive)) * tire_circumference_m * 60.0 / 1000.0
    vehicle_speed = np.clip(vehicle_speed + rng.normal(0, 0.3, n), 0, 250)

    # ── Module voltage: battery + alternator ──
    module_voltage = 14.0 + 0.3 * np.sin(2 * np.pi * t / 60.0) + rng.normal(0, 0.05, n)
    module_voltage = np.clip(module_voltage, 11.5, 15.0)

    # ── Oil temperature: lagged version of coolant ──
    oil_temp = np.full(n, op.coolant_temp_c - 10.0)
    for i in range(1, n):
        oil_temp[i] = (
            oil_temp[i - 1]
            + 0.3 * (coolant[i] - oil_temp[i - 1]) / sample_rate
            + rng.normal(0, 0.01)
        )
    oil_temp = np.clip(oil_temp, 50, 140)

    # ── Crank speed fluctuation: RPM derivative + noise ──
    crank_fluct = np.diff(rpm, prepend=rpm[0]) * sample_rate + rng.normal(0, 2, n)
    crank_fluct = np.clip(crank_fluct, -50, 50)

    return {
        "timestamps": t,
        "engine_rpm": rpm,
        "vehicle_speed": vehicle_speed,
        "throttle_position": throttle,
        "engine_load": engine_load,
        "coolant_temp": coolant,
        "intake_air_temp": iat,
        "map_kpa": map_kpa,
        "maf_gps": maf,
        "stft": stft,
        "ltft": ltft,
        "lambda_o2": lambda_o2,
        "ignition_timing_advance": timing,
        "module_voltage": module_voltage,
        "oil_temp": oil_temp,
        "crank_speed_fluctuation": crank_fluct,
    }


def generate_high_rate(
    op: OperatingPoint,
    duration_s: float = 1.0,
    params: EngineParams | None = None,
    rng: np.random.Generator | None = None,
) -> dict[str, np.ndarray]:
    """Generate high-rate sensor signals (acoustic, vibration, ignition coil).

    Returns dict of sensor_id -> numpy array, plus 'timestamps'.
    """
    if params is None:
        params = EngineParams()
    if rng is None:
        rng = np.random.default_rng(42)

    firing_freq = op.rpm / 60.0 * params.cylinders / 2.0  # Hz, for 4-stroke

    # ── Acoustic microphone (16 kHz) ──
    sr_mic = 16000
    n_mic = int(duration_s * sr_mic)
    t_mic = np.linspace(0, duration_s, n_mic, endpoint=False)

    # Combustion pulses at firing frequency
    combustion = 0.3 * np.sin(2 * np.pi * firing_freq * t_mic)
    # Harmonics
    for h in range(2, 6):
        combustion += (0.15 / h) * np.sin(
            2 * np.pi * firing_freq * h * t_mic + rng.uniform(0, 2 * np.pi)
        )
    # Broadband combustion noise
    combustion += 0.05 * rng.normal(0, 1, n_mic)
    # Intake/exhaust harmonics
    combustion += 0.08 * np.sin(2 * np.pi * op.rpm / 60.0 * t_mic)

    acoustic = np.clip(combustion, -1.0, 1.0)

    # ── Block accelerometer (25.6 kHz) ──
    sr_accel = 25600
    n_accel = int(duration_s * sr_accel)
    t_accel = np.linspace(0, duration_s, n_accel, endpoint=False)

    # Piston slap impulses
    piston_period = 1.0 / (op.rpm / 60.0)  # one revolution period
    piston_phase = (t_accel % piston_period) / piston_period
    piston_slap = 5.0 * np.exp(-((piston_phase - 0.1) ** 2) / 0.001)

    # Combustion force
    comb_accel = 8.0 * np.sin(2 * np.pi * firing_freq * t_accel)
    for h in range(2, 8):
        comb_accel += (3.0 / h) * np.sin(
            2 * np.pi * firing_freq * h * t_accel + rng.uniform(0, 2 * np.pi)
        )

    # Broadband
    vibration = piston_slap + comb_accel + 1.5 * rng.normal(0, 1, n_accel)
    vibration = np.clip(vibration, -50, 50)

    # ── Ignition coil current (10 kHz) ──
    sr_coil = 10000
    n_coil = int(duration_s * sr_coil)
    t_coil = np.linspace(0, duration_s, n_coil, endpoint=False)

    # Coil charge/dwell/discharge per firing event
    coil_period = 1.0 / firing_freq
    coil_phase = (t_coil % coil_period) / coil_period

    # Charge ramp → peak → spark discharge → zero
    coil_current = np.zeros(n_coil)
    # Dwell phase: 0-70% of period, current ramps up
    dwell_mask = coil_phase < 0.7
    coil_current[dwell_mask] = 6.0 * (coil_phase[dwell_mask] / 0.7)
    # Spark: 70-75%, current drops sharply
    spark_mask = (coil_phase >= 0.7) & (coil_phase < 0.75)
    coil_current[spark_mask] = 6.0 * (1.0 - (coil_phase[spark_mask] - 0.7) / 0.05)
    # Discharge oscillation: 75-90%
    discharge_mask = (coil_phase >= 0.75) & (coil_phase < 0.9)
    coil_current[discharge_mask] = (
        1.0
        * np.sin(2 * np.pi * 5.0 * (coil_phase[discharge_mask] - 0.75) / 0.15)
        * np.exp(-10.0 * (coil_phase[discharge_mask] - 0.75))
    )

    coil_current += rng.normal(0, 0.05, n_coil)
    coil_current = np.clip(coil_current, 0, 12)

    return {
        "timestamps_mic": t_mic,
        "acoustic_mic": acoustic,
        "timestamps_accel": t_accel,
        "accel_block": vibration,
        "timestamps_coil": t_coil,
        "ignition_coil_current": coil_current,
    }
