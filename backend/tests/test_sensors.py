"""Tests for the sensor registry loader."""
import pytest
from app.sensors import load_registry


def test_registry_loads():
    """The registry YAML loads without errors."""
    reg = load_registry()
    assert len(reg) >= 10, f"Expected at least 10 sensors, got {len(reg)}"


def test_registry_ids_unique():
    """All sensor IDs are unique."""
    reg = load_registry()
    ids = reg.ids()
    assert len(ids) == len(set(ids)), "Duplicate sensor IDs found"


def test_high_rate_sensors_exist():
    """At least 3 high-rate sensors are registered."""
    reg = load_registry()
    hr = reg.high_rate()
    assert len(hr) >= 3


def test_sensor_lookup():
    """Can look up a sensor by ID."""
    reg = load_registry()
    rpm = reg.get("engine_rpm")
    assert rpm.name == "Engine RPM"
    assert rpm.unit == "rpm"
    assert rpm.sample_rate == 20


def test_sensor_lookup_missing():
    """Looking up a non-existent sensor raises KeyError."""
    reg = load_registry()
    with pytest.raises(KeyError):
        reg.get("nonexistent_sensor_xyz")


def test_all_sensors_have_required_fields():
    """Every sensor has non-empty required fields."""
    reg = load_registry()
    for s in reg:
        assert s.id, "Sensor missing ID"
        assert s.name, f"Sensor {s.id} missing name"
        assert s.unit, f"Sensor {s.id} missing unit"
        assert s.sample_rate > 0, f"Sensor {s.id} has invalid sample_rate"
        assert s.provenance in ("real", "synthetic", "hybrid"), (
            f"Sensor {s.id} has invalid provenance: {s.provenance}"
        )
        assert s.category in ("high_rate", "telemetry", "derived"), (
            f"Sensor {s.id} has invalid category: {s.category}"
        )
