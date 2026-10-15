"""Fault injection module for the engine simulator.

Each fault function takes normal sensor data and modifies it in-place
to simulate a specific failure mode. Faults have configurable onset time,
severity (0–1), and affected cylinder.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np


@dataclass
class FaultConfig:
    """Fault injection parameters."""

    fault_type: str  # knock | misfire | valve_wear | coil_degradation
    onset_s: float = 60.0  # seconds into the run when fault begins
    severity: float = 0.5  # 0.0 (barely detectable) to 1.0 (catastrophic)
    cylinder: int = 1  # affected cylinder (1-indexed)
    ramp_s: float = 10.0  # time to reach full severity from onset


def _severity_envelope(t: np.ndarray, onset_s: float, severity: float, ramp_s: float) -> np.ndarray:
    """Progressive severity envelope: 0 before onset, ramps to severity."""
    env = np.zeros_like(t)
    active = t >= onset_s
    ramp_end = onset_s + ramp_s
    ramping = active & (t < ramp_end)
    full = t >= ramp_end
    env[ramping] = severity * (t[ramping] - onset_s) / ramp_s
    env[full] = severity
    return env


def inject_knock(
    telemetry: dict[str, np.ndarray],
    high_rate: dict[str, np.ndarray] | None,
    fault: FaultConfig,
    rng: np.random.Generator | None = None,
) -> dict:
    """Simulate engine knock.

    Effects:
    - High-frequency content (6–8 kHz) in acoustic and vibration signals
    - ECU retards ignition timing
    - Knock-induced RPM fluctuation
    - Cylinder pressure spikes visible in vibration
    """
    if rng is None:
        rng = np.random.default_rng()

    t_telem = telemetry["timestamps"]
    sev = _severity_envelope(t_telem, fault.onset_s, fault.severity, fault.ramp_s)

    # Retard ignition timing (ECU knock response)
    telemetry["ignition_timing_advance"] -= sev * 8.0  # up to 8° retard

    # RPM fluctuation from knock events
    telemetry["engine_rpm"] += sev * rng.normal(0, 15, len(t_telem))

    # Crank speed fluctuation increases
    telemetry["crank_speed_fluctuation"] += sev * rng.normal(0, 8, len(t_telem))

    # Coolant temp rises slightly from knock energy
    for i in range(1, len(t_telem)):
        telemetry["coolant_temp"][i] += sev[i] * 0.005

    if high_rate is not None:
        # Knock in acoustic signal: 6–8 kHz burst
        t_mic = high_rate["timestamps_mic"]
        sev_mic = _severity_envelope(t_mic, fault.onset_s, fault.severity, fault.ramp_s)
        firing_freq = telemetry["engine_rpm"].mean() / 60.0 * 4 / 2
        knock_freq = 7000.0  # Hz, knock resonance frequency
        knock_burst = sev_mic * 0.4 * np.sin(2 * np.pi * knock_freq * t_mic)
        # Modulate by firing period (knock occurs near TDC)
        firing_period = 1.0 / max(firing_freq, 1.0)
        phase = (t_mic % firing_period) / firing_period
        knock_window = np.exp(-((phase - 0.15) ** 2) / 0.005)
        high_rate["acoustic_mic"] += knock_burst * knock_window

        # Knock in vibration signal
        t_accel = high_rate["timestamps_accel"]
        sev_accel = _severity_envelope(t_accel, fault.onset_s, fault.severity, fault.ramp_s)
        knock_vib = sev_accel * 15.0 * np.sin(2 * np.pi * knock_freq * t_accel)
        phase_accel = (t_accel % firing_period) / firing_period
        knock_window_accel = np.exp(-((phase_accel - 0.15) ** 2) / 0.005)
        high_rate["accel_block"] = np.clip(
            high_rate["accel_block"] + knock_vib * knock_window_accel, -50, 50
        )

    return {"telemetry": telemetry, "high_rate": high_rate}


def inject_misfire(
    telemetry: dict[str, np.ndarray],
    high_rate: dict[str, np.ndarray] | None,
    fault: FaultConfig,
    rng: np.random.Generator | None = None,
) -> dict:
    """Simulate cylinder misfire.

    Effects:
    - Missing combustion events (dips in vibration & acoustic)
    - RPM dips at misfire events
    - Lambda spikes lean (unburnt O2)
    - Crank speed fluctuation increases dramatically
    """
    if rng is None:
        rng = np.random.default_rng()

    t = telemetry["timestamps"]
    sev = _severity_envelope(t, fault.onset_s, fault.severity, fault.ramp_s)

    # Misfire probability increases with severity
    misfire_prob = sev * 0.3  # up to 30% of firing events misfire
    misfire_events = rng.random(len(t)) < misfire_prob

    # RPM dips during misfire
    telemetry["engine_rpm"][misfire_events] -= fault.severity * 40

    # Lambda goes lean during misfire (unburnt charge)
    telemetry["lambda_o2"][misfire_events] += sev[misfire_events] * 0.15

    # STFT reacts to compensate
    telemetry["stft"][misfire_events] += sev[misfire_events] * 8.0

    # Large crank speed fluctuation
    telemetry["crank_speed_fluctuation"][misfire_events] += sev[misfire_events] * 25

    if high_rate is not None:
        # Acoustic: missing combustion pulse → dip
        t_mic = high_rate["timestamps_mic"]
        sev_mic = _severity_envelope(t_mic, fault.onset_s, fault.severity, fault.ramp_s)
        # Randomly zero-out combustion bursts
        misfire_mic = rng.random(len(t_mic)) < (sev_mic * 0.3)
        high_rate["acoustic_mic"][misfire_mic] *= 0.1

        # Vibration: reduced combustion force
        t_accel = high_rate["timestamps_accel"]
        sev_accel = _severity_envelope(t_accel, fault.onset_s, fault.severity, fault.ramp_s)
        misfire_accel = rng.random(len(t_accel)) < (sev_accel * 0.3)
        high_rate["accel_block"][misfire_accel] *= 0.15

    return {"telemetry": telemetry, "high_rate": high_rate}


def inject_valve_wear(
    telemetry: dict[str, np.ndarray],
    high_rate: dict[str, np.ndarray] | None,
    fault: FaultConfig,
    rng: np.random.Generator | None = None,
) -> dict:
    """Simulate valve-train wear (e.g. cam lobe wear, worn valve seats).

    Effects:
    - Reduced volumetric efficiency (lower MAP, MAF)
    - Increased high-frequency valve-train noise in vibration
    - Subtle loss of power (lower engine load for same throttle)
    - Oil temperature rise from friction
    """
    if rng is None:
        rng = np.random.default_rng()

    t = telemetry["timestamps"]
    sev = _severity_envelope(t, fault.onset_s, fault.severity, fault.ramp_s)

    # Reduced volumetric efficiency
    telemetry["map_kpa"] *= 1.0 - sev * 0.12
    telemetry["maf_gps"] *= 1.0 - sev * 0.10

    # Power loss
    telemetry["engine_load"] *= 1.0 - sev * 0.08

    # Oil temperature rise from increased friction
    for i in range(1, len(t)):
        telemetry["oil_temp"][i] += sev[i] * 0.02

    # LTFT drifts as ECU tries to compensate
    telemetry["ltft"] += sev * 3.0

    if high_rate is not None:
        # Valve-train noise: broadband 2–4 kHz
        t_accel = high_rate["timestamps_accel"]
        sev_accel = _severity_envelope(t_accel, fault.onset_s, fault.severity, fault.ramp_s)
        valve_noise = sev_accel * 3.0 * rng.normal(0, 1, len(t_accel))
        # Filter to 2–4 kHz range using simple bandpass approximation
        valve_freq = 3000.0
        valve_modulated = valve_noise * np.sin(2 * np.pi * valve_freq * t_accel)
        high_rate["accel_block"] = np.clip(high_rate["accel_block"] + valve_modulated, -50, 50)

    return {"telemetry": telemetry, "high_rate": high_rate}


def inject_coil_degradation(
    telemetry: dict[str, np.ndarray],
    high_rate: dict[str, np.ndarray] | None,
    fault: FaultConfig,
    rng: np.random.Generator | None = None,
) -> dict:
    """Simulate ignition coil / spark plug degradation.

    Effects:
    - Reduced coil charge current (dwell issues)
    - Weak spark → occasional misfire
    - Electrical noise in coil current signal
    - Module voltage dips under coil stress
    """
    if rng is None:
        rng = np.random.default_rng()

    t = telemetry["timestamps"]
    sev = _severity_envelope(t, fault.onset_s, fault.severity, fault.ramp_s)

    # Occasional weak-spark misfire
    misfire_prob = sev * 0.15
    weak_spark = rng.random(len(t)) < misfire_prob

    telemetry["engine_rpm"][weak_spark] -= fault.severity * 20
    telemetry["lambda_o2"][weak_spark] += sev[weak_spark] * 0.08
    telemetry["crank_speed_fluctuation"][weak_spark] += sev[weak_spark] * 12

    # Module voltage drops slightly
    telemetry["module_voltage"] -= sev * 0.3

    if high_rate is not None:
        # Coil current: reduced peak, noisy dwell
        t_coil = high_rate["timestamps_coil"]
        sev_coil = _severity_envelope(t_coil, fault.onset_s, fault.severity, fault.ramp_s)

        # Reduce peak current (weak coil)
        high_rate["ignition_coil_current"] *= 1.0 - sev_coil * 0.25

        # Add electrical noise (arcing / degraded insulation)
        elec_noise = sev_coil * 0.8 * rng.normal(0, 1, len(t_coil))
        high_rate["ignition_coil_current"] = np.clip(
            high_rate["ignition_coil_current"] + elec_noise, 0, 12
        )

    return {"telemetry": telemetry, "high_rate": high_rate}


# ── Fault dispatcher ──

FAULT_INJECTORS = {
    "knock": inject_knock,
    "misfire": inject_misfire,
    "valve_wear": inject_valve_wear,
    "coil_degradation": inject_coil_degradation,
}

FAULT_LABELS = ["normal", "knock", "misfire", "valve_wear", "coil_degradation"]


def inject_fault(
    telemetry: dict[str, np.ndarray],
    high_rate: dict[str, np.ndarray] | None,
    fault: FaultConfig,
    rng: np.random.Generator | None = None,
) -> dict:
    """Dispatch to the appropriate fault injector."""
    injector = FAULT_INJECTORS.get(fault.fault_type)
    if injector is None:
        raise ValueError(
            f"Unknown fault type: {fault.fault_type}. Choose from {list(FAULT_INJECTORS.keys())}"
        )
    return injector(telemetry, high_rate, fault, rng)
