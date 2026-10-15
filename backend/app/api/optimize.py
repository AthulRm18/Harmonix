"""Optimizer API – sweet-spot optimisation endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.db.models import OptimizationResult

router = APIRouter()


class OptimizeRequest(BaseModel):
    """Parameters for launching an optimisation run."""

    run_id: str | None = None
    rpm_range: tuple[float, float] = (1000, 5000)
    load_range: tuple[float, float] = (10, 90)
    knock_threshold: float = 0.1
    max_coolant_temp: float = 105.0
    n_generations: int = 50


@router.post("")
async def start_optimization(
    req: OptimizeRequest,
    db: AsyncSession = Depends(get_db),
):
    """Launch a multi-objective optimisation run.

    TODO: Kick off NSGA-II / Optuna as a background job.
    """
    opt = OptimizationResult(
        run_id=req.run_id,
        recommended_region={
            "status": "pending",
            "params": req.model_dump(),
        },
    )
    db.add(opt)
    await db.commit()
    await db.refresh(opt)

    return {"id": opt.id, "status": "pending"}


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
