"""Sensor registry API."""

from __future__ import annotations

from fastapi import APIRouter

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
