"""Optimizer API – sweet-spot optimisation endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.db.models import OptimizationResult
from app.optimize.engine_performance import (
    compute_epi_grid,
)
from app.optimize.nsga2 import SearchBounds, run_nsga2

router = APIRouter()


class OptimizeRequest(BaseModel):
    """Parameters for launching an optimisation run."""

    run_id: str | None = None
    rpm_range: tuple[float, float] = (1000, 5000)
    load_range: tuple[float, float] = (10, 90)
    knock_threshold: float = 0.1
    max_coolant_temp: float = 105.0
    n_generations: int = 50
    pop_size: int = 100


@router.post("")
async def start_optimization(
    req: OptimizeRequest,
    db: AsyncSession = Depends(get_db),
):
    """Launch a multi-objective optimisation run using NSGA-II."""
    bounds = SearchBounds(
        rpm=req.rpm_range,
        load=req.load_range,
        knock_threshold=req.knock_threshold,
        max_coolant_temp=req.max_coolant_temp,
    )

    results = run_nsga2(
        bounds=bounds,
        pop_size=req.pop_size,
        n_generations=req.n_generations,
        seed=42,
    )

    opt = OptimizationResult(
        run_id=req.run_id,
        pareto_front=results["pareto_front"],
        recommended_region=results["recommended_region"],
        rationale=results["rationale"],
    )
    db.add(opt)
    await db.commit()
    await db.refresh(opt)

    return {
        "id": opt.id,
        "status": "completed",
        "pareto_front": results["pareto_front"],
        "recommended_region": results["recommended_region"],
        "rationale": results["rationale"],
    }


@router.get("/{opt_id}")
async def get_optimization(opt_id: int, db: AsyncSession = Depends(get_db)):
    """Get optimisation results."""
    result = await db.execute(select(OptimizationResult).where(OptimizationResult.id == opt_id))
    opt = result.scalar_one_or_none()
    if not opt:
        raise HTTPException(status_code=404, detail="Optimization not found")

    return {
        "id": opt.id,
        "run_id": opt.run_id,
        "pareto_front": opt.pareto_front,
        "recommended_region": opt.recommended_region,
        "rationale": opt.rationale,
        "created_at": str(opt.created_at) if opt.created_at else None,
    }


@router.get("/grid/epi")
async def get_epi_grid(
    rpm_min: float = 1000,
    rpm_max: float = 5000,
    load_min: float = 10,
    load_max: float = 90,
    steps: int = 20,
):
    """Compute the EPI heatmap grid (RPM × Load)."""
    grid = compute_epi_grid(
        rpm_range=(rpm_min, rpm_max),
        load_range=(load_min, load_max),
        rpm_steps=steps,
        load_steps=steps,
    )

    return {
        "rpm_values": sorted({pt.rpm for pt in grid}),
        "load_values": sorted({pt.load_pct for pt in grid}),
        "grid": [
            {
                "rpm": pt.rpm,
                "load_pct": pt.load_pct,
                "epi": pt.epi,
                "wear_rate": pt.wear_rate,
                "bsfc": pt.bsfc,
                "knock_prob": pt.knock_prob,
            }
            for pt in grid
        ],
    }
