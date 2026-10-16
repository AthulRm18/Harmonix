"""Tests for engine simulator and fault injection."""

import numpy as np
import pytest

from app.sim.engine import OperatingPoint, generate_high_rate, generate_telemetry
from app.sim.faults import FaultConfig, inject_fault
from app.sim.scenarios import SCENARIOS, get_scenario_by_name


def test_generate_telemetry_shapes_and_ranges():
    op = OperatingPoint(rpm=3000, throttle_pct=40)
    rng = np.random.default_rng(42)
    telem = generate_telemetry(op, duration_s=10.0, sample_rate=20, rng=rng)

    assert "timestamps" in telem
    assert "engine_rpm" in telem
    assert "coolant_temp" in telem
    assert "lambda_o2" in telem
    assert len(telem["timestamps"]) == 200
    assert len(telem["engine_rpm"]) == 200

    # Sanity check ranges
    assert np.all(telem["engine_rpm"] >= 750)
    assert np.all(telem["engine_rpm"] <= 6500)
    assert np.all(telem["coolant_temp"] >= 60)


def test_generate_high_rate():
    op = OperatingPoint(rpm=2400)
    rng = np.random.default_rng(42)
    hr = generate_high_rate(op, duration_s=0.1, rng=rng)

    assert "acoustic_mic" in hr
    assert "accel_block" in hr
    assert "ignition_coil_current" in hr
    assert len(hr["acoustic_mic"]) == 1600  # 16000 * 0.1
    assert len(hr["accel_block"]) == 2560  # 25600 * 0.1
    assert len(hr["ignition_coil_current"]) == 1000  # 10000 * 0.1


@pytest.mark.parametrize("fault_type", ["knock", "misfire", "valve_wear", "coil_degradation"])
def test_fault_injection(fault_type):
    op = OperatingPoint(rpm=2500, throttle_pct=30)
    rng = np.random.default_rng(42)
    telem = generate_telemetry(op, duration_s=10.0, sample_rate=20, rng=rng)

    fault = FaultConfig(fault_type=fault_type, onset_s=2.0, severity=0.8, cylinder=1)
    res = inject_fault(telem, None, fault, rng)
    assert "telemetry" in res
    assert len(res["telemetry"]["timestamps"]) == 200


def test_scenarios_registry():
    assert len(SCENARIOS) >= 10
    sc = get_scenario_by_name("Normal – Highway Cruise")
    assert sc is not None
    assert sc["op"].rpm == 2800
