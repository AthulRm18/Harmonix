"""Explain API – physics-based explanations for predictions."""

from __future__ import annotations

from fastapi import APIRouter, Query

from app.explain.physics import get_physics_explanation

router = APIRouter()


@router.get("/explain")
async def explain_fault(
    fault_type: str = Query("normal", description="Fault type"),
    severity: float = Query(0.5, description="Fault severity 0-1"),
):
    """Get physics-based plain-language explanation for a fault type."""
    return get_physics_explanation(fault_type, severity)
