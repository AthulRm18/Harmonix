"""Scenario definitions for the engine simulator.

Each scenario specifies operating conditions, faults, and duration.
Used by the seed script to generate a diverse dataset.
"""

from __future__ import annotations

from app.sim.engine import OperatingPoint
from app.sim.faults import FaultConfig

# ── Scenario definitions ──

SCENARIOS: list[dict] = [
    # ── Normal operating scenarios ──
    {
        "name": "Normal – Highway Cruise",
        "op": OperatingPoint(rpm=2800, throttle_pct=35, coolant_temp_c=90, intake_temp_c=30),
        "duration_s": 300,
        "faults": [],
        "description": "Steady highway cruising at moderate RPM with no faults.",
    },
    {
        "name": "Normal – City Driving",
        "op": OperatingPoint(rpm=1800, throttle_pct=20, coolant_temp_c=88, intake_temp_c=28),
        "duration_s": 300,
        "faults": [],
        "description": "Stop-and-go city driving pattern.",
    },
    {
        "name": "Normal – Aggressive Driving",
        "op": OperatingPoint(rpm=4500, throttle_pct=70, coolant_temp_c=95, intake_temp_c=35),
        "duration_s": 200,
        "faults": [],
        "description": "Spirited driving with high RPM and load.",
    },
    {
        "name": "Normal – Cold Start",
        "op": OperatingPoint(rpm=1200, throttle_pct=15, coolant_temp_c=30, intake_temp_c=5),
        "duration_s": 300,
        "faults": [],
        "description": "Cold engine start and warm-up cycle.",
    },
    # ── Knock scenarios ──
    {
        "name": "Knock – Mild, Cyl 2",
        "op": OperatingPoint(rpm=3200, throttle_pct=55, coolant_temp_c=95, intake_temp_c=40),
        "duration_s": 300,
        "faults": [FaultConfig("knock", onset_s=60, severity=0.3, cylinder=2)],
        "description": "Mild detonation knock developing in cylinder 2 under load.",
    },
    {
        "name": "Knock – Severe, Cyl 1",
        "op": OperatingPoint(rpm=4000, throttle_pct=75, coolant_temp_c=100, intake_temp_c=45),
        "duration_s": 250,
        "faults": [FaultConfig("knock", onset_s=40, severity=0.8, cylinder=1)],
        "description": "Severe knock under high-load, high-temperature conditions.",
    },
    # ── Misfire scenarios ──
    {
        "name": "Misfire – Intermittent, Cyl 3",
        "op": OperatingPoint(rpm=2000, throttle_pct=25, coolant_temp_c=88, intake_temp_c=25),
        "duration_s": 300,
        "faults": [FaultConfig("misfire", onset_s=80, severity=0.4, cylinder=3)],
        "description": "Intermittent misfire developing in cylinder 3.",
    },
    {
        "name": "Misfire – Persistent, Cyl 4",
        "op": OperatingPoint(rpm=2500, throttle_pct=40, coolant_temp_c=90, intake_temp_c=30),
        "duration_s": 300,
        "faults": [FaultConfig("misfire", onset_s=50, severity=0.7, cylinder=4, ramp_s=20)],
        "description": "Persistent misfire with increasing frequency.",
    },
    # ── Valve-train wear scenarios ──
    {
        "name": "Valve Wear – Gradual, Cyl 1",
        "op": OperatingPoint(rpm=2200, throttle_pct=30, coolant_temp_c=92, intake_temp_c=28),
        "duration_s": 300,
        "faults": [FaultConfig("valve_wear", onset_s=30, severity=0.5, cylinder=1, ramp_s=60)],
        "description": "Slow-developing valve-train wear with gradual power loss.",
    },
    {
        "name": "Valve Wear – Advanced, Cyl 2",
        "op": OperatingPoint(rpm=3000, throttle_pct=50, coolant_temp_c=95, intake_temp_c=32),
        "duration_s": 250,
        "faults": [FaultConfig("valve_wear", onset_s=20, severity=0.9, cylinder=2, ramp_s=30)],
        "description": "Advanced cam lobe wear causing significant volumetric loss.",
    },
    # ── Ignition coil degradation scenarios ──
    {
        "name": "Coil Degradation – Early, Cyl 4",
        "op": OperatingPoint(rpm=2000, throttle_pct=25, coolant_temp_c=88, intake_temp_c=25),
        "duration_s": 300,
        "faults": [FaultConfig("coil_degradation", onset_s=90, severity=0.35, cylinder=4)],
        "description": "Early-stage ignition coil degradation with occasional weak spark.",
    },
    {
        "name": "Coil Degradation – Severe, Cyl 1",
        "op": OperatingPoint(rpm=3500, throttle_pct=60, coolant_temp_c=92, intake_temp_c=30),
        "duration_s": 250,
        "faults": [
            FaultConfig("coil_degradation", onset_s=40, severity=0.8, cylinder=1, ramp_s=15)
        ],
        "description": "Severe coil degradation causing frequent misfires.",
    },
    # ── Compound fault scenario ──
    {
        "name": "Compound – Knock + Coil Degradation",
        "op": OperatingPoint(rpm=3800, throttle_pct=65, coolant_temp_c=98, intake_temp_c=38),
        "duration_s": 300,
        "faults": [
            FaultConfig("knock", onset_s=50, severity=0.4, cylinder=1),
            FaultConfig("coil_degradation", onset_s=120, severity=0.5, cylinder=3),
        ],
        "description": "Multi-fault scenario: knock develops first, then coil issues.",
    },
]


def get_scenario_by_name(name: str) -> dict | None:
    """Look up a scenario by its name."""
    for s in SCENARIOS:
        if s["name"] == name:
            return s
    return None
