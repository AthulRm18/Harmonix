"""Runs API – CRUD, signals, predictions, events, prognosis, performance."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import PaginationParams
from app.db import get_db
from app.db.models import AnomalyEvent, Prediction, Run, SensorReading, Window
from app.pipeline.lttb import downsample_lttb

router = APIRouter()


# ── Schemas ───────────────────────────────────────────────────────────


class SimulateRequest(BaseModel):
    """Parameters for launching a simulation run."""

    name: str = "Simulation Run"
    scenario: dict | None = None
    duration_s: float = 300.0
    seed: int | None = None


class RunResponse(BaseModel):
    id: str
    name: str
    source: str
    status: str
    duration_s: float | None
    ground_truth: dict | None
    created_at: str | None

    class Config:
        from_attributes = True


# ── Endpoints ─────────────────────────────────────────────────────────


@router.get("")
async def list_runs(
    page: PaginationParams = Depends(),
    db: AsyncSession = Depends(get_db),
):
    """List all runs with pagination."""
    count_q = select(func.count()).select_from(Run)
    total = (await db.execute(count_q)).scalar() or 0

    q = select(Run).order_by(Run.created_at.desc()).offset(page.offset).limit(page.limit)
    result = await db.execute(q)
    runs = result.scalars().all()

    return {
        "total": total,
        "offset": page.offset,
        "limit": page.limit,
        "runs": [
            {
                "id": r.id,
                "name": r.name,
                "source": r.source,
                "status": r.status,
                "duration_s": r.duration_s,
                "ground_truth": r.ground_truth,
                "created_at": str(r.created_at) if r.created_at else None,
            }
            for r in runs
        ],
    }


@router.get("/{run_id}")
async def get_run(run_id: str, db: AsyncSession = Depends(get_db)):
    """Get a single run's details."""
    result = await db.execute(select(Run).where(Run.id == run_id))
    run = result.scalar_one_or_none()
    if not run:
        raise HTTPException(status_code=404, detail=f"Run '{run_id}' not found")
    return {
        "id": run.id,
        "name": run.name,
        "source": run.source,
        "scenario_yaml": run.scenario_yaml,
        "seed": run.seed,
        "status": run.status,
        "duration_s": run.duration_s,
        "ground_truth": run.ground_truth,
        "created_at": str(run.created_at) if run.created_at else None,
    }


@router.post("/simulate")
async def simulate_run(
    req: SimulateRequest,
    db: AsyncSession = Depends(get_db),
):
    """Launch a new simulation run.

    This creates a Run record and (TODO) kicks off the simulator
    as a background job.
    """
    import yaml as _yaml

    run = Run(
        name=req.name,
        source="synthetic",
        scenario_yaml=_yaml.dump(req.scenario) if req.scenario else None,
        seed=req.seed,
        duration_s=req.duration_s,
        status="pending",
        ground_truth=req.scenario,
    )
    db.add(run)
    await db.commit()
    await db.refresh(run)

    # TODO: kick off background simulation job
    return {"id": run.id, "status": run.status}


@router.get("/{run_id}/signals")
async def get_signals(
    run_id: str,
    sensor: str = Query(..., description="Sensor ID"),
    t0: float = Query(0.0, description="Start time (seconds)"),
    t1: float | None = Query(None, description="End time (seconds)"),
    max_points: int = Query(2000, ge=10, le=10000),
    db: AsyncSession = Depends(get_db),
):
    """Get time-series data for a sensor in a run, LTTB-downsampled."""
    q = (
        select(SensorReading.ts, SensorReading.value)
        .where(SensorReading.run_id == run_id)
        .where(SensorReading.sensor_id == sensor)
        .where(SensorReading.ts >= t0)
    )
    if t1 is not None:
        q = q.where(SensorReading.ts <= t1)
    q = q.order_by(SensorReading.ts)

    result = await db.execute(q)
    rows = result.all()

    if not rows:
        return {"sensor": sensor, "count": 0, "timestamps": [], "values": []}

    timestamps = [r[0] for r in rows]
    values = [r[1] for r in rows]

    # Downsample if needed
    if len(timestamps) > max_points:
        timestamps, values = downsample_lttb(timestamps, values, max_points)

    return {
        "sensor": sensor,
        "count": len(timestamps),
        "timestamps": timestamps,
        "values": values,
    }


@router.get("/{run_id}/predictions")
async def get_predictions(
    run_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Get all predictions for a run."""
    q = (
        select(Window, Prediction)
        .join(Prediction, Prediction.window_id == Window.id)
        .where(Window.run_id == run_id)
        .order_by(Window.t_start)
    )
    result = await db.execute(q)
    rows = result.all()

    return {
        "run_id": run_id,
        "count": len(rows),
        "predictions": [
            {
                "window_idx": w.idx,
                "t_start": w.t_start,
                "t_end": w.t_end,
                "model_id": p.model_id,
                "predicted_class": p.predicted_class,
                "class_probs": p.class_probs,
                "anomaly_score": p.anomaly_score,
                "health_index": p.health_index,
                "rul_mean": p.rul_mean,
                "p_fail_horizon": p.p_fail_horizon,
            }
            for w, p in rows
        ],
    }


@router.get("/{run_id}/events")
async def get_events(run_id: str, db: AsyncSession = Depends(get_db)):
    """Get anomaly onset events for a run (markers for the timeline)."""
    q = select(AnomalyEvent).where(AnomalyEvent.run_id == run_id).order_by(AnomalyEvent.t_onset)
    result = await db.execute(q)
    events = result.scalars().all()

    return {
        "run_id": run_id,
        "count": len(events),
        "events": [
            {
                "id": e.id,
                "t_onset": e.t_onset,
                "t_detected": e.t_detected,
                "fault_type": e.fault_type,
                "severity": e.severity,
                "confidence": e.confidence,
                "affected_cylinder": e.affected_cylinder,
                "explanation": e.explanation,
            }
            for e in events
        ],
    }


@router.get("/{run_id}/prognosis")
async def get_prognosis(run_id: str, db: AsyncSession = Depends(get_db)):
    """Get prognosis data (health index, RUL) for a run."""
    q = (
        select(Window, Prediction)
        .join(Prediction, Prediction.window_id == Window.id)
        .where(Window.run_id == run_id)
        .where(Prediction.health_index.isnot(None))
        .order_by(Window.t_start)
    )
    result = await db.execute(q)
    rows = result.all()

    return {
        "run_id": run_id,
        "count": len(rows),
        "prognosis": [
            {
                "t": w.t_start,
                "health_index": p.health_index,
                "rul_mean": p.rul_mean,
                "rul_ci_lower": p.rul_ci_lower,
                "rul_ci_upper": p.rul_ci_upper,
                "p_fail_horizon": p.p_fail_horizon,
            }
            for w, p in rows
        ],
    }


@router.get("/{run_id}/performance")
async def get_performance(run_id: str, db: AsyncSession = Depends(get_db)):
    """Get performance features for a run."""
    q = select(Window).where(Window.run_id == run_id).order_by(Window.t_start)
    result = await db.execute(q)
    windows = result.scalars().all()

    return {
        "run_id": run_id,
        "count": len(windows),
        "performance": [
            {
                "t_start": w.t_start,
                "t_end": w.t_end,
                "rpm": w.rpm,
                "load": w.load,
                "features": w.features,
            }
            for w in windows
        ],
    }
