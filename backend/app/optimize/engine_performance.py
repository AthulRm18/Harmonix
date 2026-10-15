"""Engine Performance Index (EPI) computation.

EPI fuses four sub-metrics into a single 0-1 score that represents
the overall "goodness" of a given operating point (RPM × load):

    EPI = w_bsfc · f(BSFC) + w_knock · (1 - P(knock)) + w_thermal · g(T_cyl) + w_emis · h(λ)

Higher is better.  The optimizer maximises EPI while minimising wear rate.
"""

from __future__ import annotations

import math
from dataclasses import dataclass


@dataclass
class EPIWeights:
    """Relative weights for the four EPI sub-metrics."""

    bsfc: float = 0.30
    knock: float = 0.25
    thermal: float = 0.20
    emissions: float = 0.25


@dataclass
class OperatingPoint:
    """A single engine operating point."""

    rpm: float
    load_pct: float
    ignition_advance_deg: float = 30.0
    lambda_ratio: float = 1.0
    coolant_temp_c: float = 90.0

    # Derived (filled by compute)
    bsfc: float = 0.0
    knock_prob: float = 0.0
    cyl_temp_c: float = 0.0
    epi: float = 0.0
    wear_rate: float = 0.0


def _bsfc_score(rpm: float, load: float) -> tuple[float, float]:
    """Return (estimated BSFC in g/kWh, normalised 0-1 score).

    Uses a simplified Willans-line model.  Best BSFC ≈ 240 g/kWh
    around 2500 rpm, 60% load.
    """
    rpm_opt, load_opt = 2500.0, 60.0
    bsfc = 240.0 + 0.008 * (rpm - rpm_opt) ** 2 / 1000.0 + 1.5 * (load - load_opt) ** 2 / 100.0
    # Normalise: 240 best → 1.0, 400 worst → 0.0
    score = max(0.0, min(1.0, 1.0 - (bsfc - 240.0) / 160.0))
    return bsfc, score


def _knock_probability(rpm: float, load: float, ign_adv: float) -> float:
    """Estimate knock probability (0-1).

    Higher RPM + load + advance = higher knock risk.
    """
    risk = (rpm / 6000.0) * (load / 100.0) * (ign_adv / 45.0)
    return min(1.0, max(0.0, 1.0 / (1.0 + math.exp(-8.0 * (risk - 0.5)))))


def _thermal_score(rpm: float, load: float, coolant: float) -> tuple[float, float]:
    """Estimate cylinder peak temperature and normalised thermal score.

    Optimal cylinder temp band: 800-950 °C.
    """
    cyl_temp = 400.0 + 5.0 * load + 0.08 * rpm + 1.5 * coolant
    if 800.0 <= cyl_temp <= 950.0:
        score = 1.0
    elif cyl_temp < 800.0:
        score = max(0.0, 1.0 - (800.0 - cyl_temp) / 200.0)
    else:
        score = max(0.0, 1.0 - (cyl_temp - 950.0) / 200.0)
    return cyl_temp, score


def _emissions_score(lambda_ratio: float) -> float:
    """Score based on air-fuel ratio closeness to stoichiometric (λ=1.0)."""
    deviation = abs(lambda_ratio - 1.0)
    return max(0.0, 1.0 - deviation / 0.15)


def _wear_rate(rpm: float, load: float, knock_prob: float, cyl_temp: float) -> float:
    """Estimate component wear rate (arbitrary units / 1000h).

    Higher RPM, load, knock, and temperature accelerate wear.
    """
    base = 0.001 * (rpm / 1000.0) ** 1.5 + 0.0005 * load
    knock_factor = 1.0 + 3.0 * knock_prob
    thermal_factor = 1.0 + max(0.0, (cyl_temp - 950.0) / 200.0)
    return base * knock_factor * thermal_factor


def compute_epi(
    point: OperatingPoint,
    weights: EPIWeights | None = None,
) -> OperatingPoint:
    """Compute EPI and fill derived fields on an OperatingPoint."""
    w = weights or EPIWeights()

    bsfc, bsfc_s = _bsfc_score(point.rpm, point.load_pct)
    knock_p = _knock_probability(point.rpm, point.load_pct, point.ignition_advance_deg)
    cyl_temp, therm_s = _thermal_score(point.rpm, point.load_pct, point.coolant_temp_c)
    emis_s = _emissions_score(point.lambda_ratio)

    epi = w.bsfc * bsfc_s + w.knock * (1.0 - knock_p) + w.thermal * therm_s + w.emissions * emis_s
    wear = _wear_rate(point.rpm, point.load_pct, knock_p, cyl_temp)

    point.bsfc = round(bsfc, 1)
    point.knock_prob = round(knock_p, 4)
    point.cyl_temp_c = round(cyl_temp, 1)
    point.epi = round(epi, 4)
    point.wear_rate = round(wear, 4)
    return point


def compute_epi_grid(
    rpm_range: tuple[float, float] = (1000, 5000),
    load_range: tuple[float, float] = (10, 90),
    rpm_steps: int = 20,
    load_steps: int = 20,
    weights: EPIWeights | None = None,
) -> list[OperatingPoint]:
    """Compute an EPI grid across RPM × Load for the heatmap."""
    points: list[OperatingPoint] = []
    rpm_step = (rpm_range[1] - rpm_range[0]) / max(1, rpm_steps - 1)
    load_step = (load_range[1] - load_range[0]) / max(1, load_steps - 1)

    for i in range(rpm_steps):
        rpm = rpm_range[0] + i * rpm_step
        for j in range(load_steps):
            load = load_range[0] + j * load_step
            pt = OperatingPoint(rpm=round(rpm), load_pct=round(load, 1))
            compute_epi(pt, weights)
            points.append(pt)

    return points
