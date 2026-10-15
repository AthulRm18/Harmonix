"""Tests for performance index and NSGA-II sweet-spot optimizer."""

from app.optimize.engine_performance import OperatingPoint, compute_epi, compute_epi_grid
from app.optimize.nsga2 import run_nsga2


def test_compute_epi():
    pt = OperatingPoint(rpm=2500, load_pct=40, coolant_temp_c=90)
    res = compute_epi(pt)

    assert 0 <= res.epi <= 1.0
    assert res.bsfc > 0
    assert 0 <= res.knock_prob <= 1.0
    assert res.cyl_temp_c > 0


def test_compute_epi_grid():
    grid = compute_epi_grid(rpm_range=(1500, 3500), load_range=(20, 60), rpm_steps=5, load_steps=5)

    assert len(grid) == 25
    assert grid[0].rpm >= 1500
    assert 0 <= grid[0].epi <= 1.0


def test_nsga2_optimize():
    res = run_nsga2(
        pop_size=20,
        n_generations=10,
        seed=42,
    )

    assert "pareto_front" in res
    assert len(res["pareto_front"]) > 0
    assert "recommended_region" in res
    assert "rpm_range" in res["recommended_region"]
    assert "load_range" in res["recommended_region"]
    assert "rationale" in res
