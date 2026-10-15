"""Physics-based plain-language explanations for engine faults."""

from __future__ import annotations

FAULT_EXPLANATIONS: dict[str, dict] = {
    "normal": {
        "summary": "Engine is operating normally. All monitored parameters are within expected ranges.",
        "physics": (
            "Combustion pressure, vibration spectra, and electrical waveforms are consistent "
            "with a healthy engine. No anomalous frequency content detected in the knock band "
            "(6–8 kHz). Fuel trims are stable. No cylinder-specific deviations observed."
        ),
        "recommendation": "Continue normal operation. No action required.",
    },
    "knock": {
        "summary": "Detonation knock detected. Abnormal combustion is occurring after the spark event.",
        "physics": (
            "Knock is caused by auto-ignition of the unburnt end-gas ahead of the flame front. "
            "This produces a characteristic pressure oscillation at the knock resonance frequency "
            "(typically 6–8 kHz for this bore size). The ECU has retarded ignition timing as a "
            "protective response. Contributing factors include high cylinder temperature, "
            "advanced timing, low-octane fuel, or excessive carbon deposits."
        ),
        "recommendation": (
            "Reduce load, check fuel octane rating, inspect for carbon buildup, "
            "and verify cooling system operation. If persistent, investigate EGR and knock sensor."
        ),
    },
    "misfire": {
        "summary": "Cylinder misfire detected. One or more combustion events are failing.",
        "physics": (
            "Misfire occurs when the air-fuel mixture fails to ignite or burns incompletely. "
            "This causes a momentary dip in crankshaft speed, a lean excursion in the lambda "
            "sensor (unburnt oxygen), and increased fuel trim correction. The absence of the "
            "combustion force pulse is visible in the vibration signal."
        ),
        "recommendation": (
            "Check spark plugs and ignition coils in the affected cylinder. "
            "Inspect fuel injector operation. Verify compression. Check for vacuum leaks."
        ),
    },
    "valve_wear": {
        "summary": "Valve-train wear detected. Gradual mechanical degradation is reducing engine efficiency.",
        "physics": (
            "Worn camshaft lobes or valve seats reduce valve lift and duration, causing loss of "
            "volumetric efficiency. This appears as reduced manifold pressure (MAP), lower mass "
            "airflow (MAF), and decreased power output for the same throttle position. "
            "Increased friction raises oil temperature and produces broadband noise in the "
            "2–4 kHz range. Long-term fuel trim drift indicates the ECU is compensating."
        ),
        "recommendation": (
            "Schedule valve adjustment or replacement. Check oil condition and pressure. "
            "Monitor power loss trend. Consider compression test."
        ),
    },
    "coil_degradation": {
        "summary": "Ignition coil degradation detected. Spark energy is insufficient for reliable ignition.",
        "physics": (
            "A degrading ignition coil shows reduced peak charge current during the dwell period, "
            "increased electrical noise from arcing or insulation breakdown, and occasional "
            "weak-spark misfires. The coil current waveform deviates from the normal "
            "charge–dwell–discharge pattern. System voltage may drop under coil stress."
        ),
        "recommendation": (
            "Replace the ignition coil in the affected cylinder. Inspect spark plug gap and condition. "
            "Check coil connector and wiring harness for damage."
        ),
    },
}


def get_physics_explanation(fault_type: str, severity: float = 0.5) -> dict:
    """Get physics-based explanation for a fault type."""
    base = FAULT_EXPLANATIONS.get(fault_type, FAULT_EXPLANATIONS["normal"])

    severity_desc = "Mild" if severity < 0.3 else "Moderate" if severity < 0.6 else "Severe"

    return {
        "fault_type": fault_type,
        "severity": severity,
        "severity_description": severity_desc,
        "summary": base["summary"],
        "physics": base["physics"],
        "recommendation": base["recommendation"],
    }
