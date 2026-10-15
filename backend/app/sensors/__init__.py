"""Sensor registry loader – reads registry.yaml and provides typed access."""

from __future__ import annotations

from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path

import yaml

_REGISTRY_PATH = Path(__file__).parent / "registry.yaml"


@dataclass(frozen=True)
class SensorSpec:
    """Immutable specification for a single sensor."""

    id: str
    name: str
    unit: str
    sample_rate: int
    physical_meaning: str
    normal_range: tuple[float, float]
    obd_pid: str | None
    provenance: str  # real | synthetic | hybrid
    description: str
    category: str  # high_rate | telemetry | derived

    @property
    def is_high_rate(self) -> bool:
        return self.category == "high_rate"

    @property
    def is_telemetry(self) -> bool:
        return self.category == "telemetry"


@dataclass(frozen=True)
class SensorRegistry:
    """Collection of all sensor specifications."""

    sensors: tuple[SensorSpec, ...] = field(default_factory=tuple)

    def __len__(self) -> int:
        return len(self.sensors)

    def __iter__(self):
        return iter(self.sensors)

    def get(self, sensor_id: str) -> SensorSpec:
        """Get sensor spec by ID; raises KeyError if not found."""
        for s in self.sensors:
            if s.id == sensor_id:
                return s
        raise KeyError(f"Sensor '{sensor_id}' not found in registry")

    def ids(self) -> list[str]:
        return [s.id for s in self.sensors]

    def high_rate(self) -> list[SensorSpec]:
        return [s for s in self.sensors if s.is_high_rate]

    def telemetry(self) -> list[SensorSpec]:
        return [s for s in self.sensors if s.is_telemetry]

    def by_category(self, cat: str) -> list[SensorSpec]:
        return [s for s in self.sensors if s.category == cat]


@lru_cache
def load_registry(path: Path = _REGISTRY_PATH) -> SensorRegistry:
    """Load the sensor registry from YAML."""
    with open(path) as f:
        data = yaml.safe_load(f)

    specs = []
    for entry in data.get("sensors", []):
        nr = entry.get("normal_range", [0, 1])
        specs.append(
            SensorSpec(
                id=entry["id"],
                name=entry["name"],
                unit=entry["unit"],
                sample_rate=entry["sample_rate"],
                physical_meaning=entry.get("physical_meaning", "").strip(),
                normal_range=(float(nr[0]), float(nr[1])),
                obd_pid=entry.get("obd_pid"),
                provenance=entry.get("provenance", "synthetic"),
                description=entry.get("description", "").strip(),
                category=entry.get("category", "telemetry"),
            )
        )

    return SensorRegistry(sensors=tuple(specs))
