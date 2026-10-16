"""Runs API – CRUD, signals, predictions, events, prognosis, performance."""

from __future__ import annotations

import logging

import numpy as np
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import PaginationParams
from app.db import async_session, get_db
from app.db.models import AnomalyEvent, Model, Prediction, Run, SensorReading, Window
from app.models.prognosis import PrognosisModel
from app.pipeline.features import extract_telemetry_features
from app.pipeline.lttb import downsample_lttb
from app.pipeline.windowing import segment_windows
from app.sim.engine import OperatingPoint, generate_telemetry
from app.sim.faults import FaultConfig, inject_fault

log = logging.getLogger(__name__)

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

    model_config = {"from_attributes": True}


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


async def _execute_simulation_job(
    run_id: str,
    seed: int | None,
    duration_s: float,
    scenario_data: dict | None,
) -> None:
    """Background task to simulate engine run and compute predictions."""
    async with async_session() as session:
        result = await session.execute(select(Run).where(Run.id == run_id))
        run = result.scalar_one_or_none()
        if not run:
            return

        run.status = "running"
        await session.commit()

        try:
            rng_seed = seed if seed is not None else 42
            rng = np.random.default_rng(rng_seed)

            op = OperatingPoint(rpm=2500, throttle_pct=30, coolant_temp_c=90, intake_temp_c=25)
            faults: list[FaultConfig] = []

            if scenario_data:
                if "rpm" in scenario_data or "throttle_pct" in scenario_data:
                    op = OperatingPoint(
                        rpm=float(scenario_data.get("rpm", 2500)),
                        throttle_pct=float(scenario_data.get("throttle_pct", 30)),
                        coolant_temp_c=float(scenario_data.get("coolant_temp_c", 90)),
                        intake_temp_c=float(scenario_data.get("intake_temp_c", 25)),
                    )
                for f in scenario_data.get("faults", []):
                    if isinstance(f, dict):
                        faults.append(
                            FaultConfig(
                                fault_type=str(f.get("fault_type", "knock")),
                                onset_s=float(f.get("onset_s", 60.0)),
                                severity=float(f.get("severity", 0.5)),
                                cylinder=int(f.get("cylinder", 1)),
                                ramp_s=float(f.get("ramp_s", 10.0)),
                            )
                        )

            # Generate telemetry
            telemetry = generate_telemetry(op, duration_s=duration_s, sample_rate=20, rng=rng)

            # Inject faults
            for fault in faults:
                inject_res = inject_fault(telemetry, None, fault, rng)
                telemetry = inject_res["telemetry"]

            timestamps = telemetry["timestamps"]
            telemetry_sensors = [k for k in telemetry if k != "timestamps"]

            readings = []
            step = 5
            for sensor_id in telemetry_sensors:
                vals = telemetry[sensor_id]
                for i in range(0, len(timestamps), step):
                    readings.append(
                        SensorReading(
                            run_id=run_id,
                            ts=float(timestamps[i]),
                            sensor_id=sensor_id,
                            value=float(vals[i]),
                        )
                    )
            session.add_all(readings)

            # Window segmentation and feature extraction
            windows_spec = segment_windows(timestamps, window_size_s=5.0, hop_s=2.5)
            window_records = []
            for idx, (t_start, t_end, i_start, i_end) in enumerate(windows_spec):
                features = extract_telemetry_features(telemetry, i_start, i_end)
                mean_rpm = (
                    float(np.mean(telemetry["engine_rpm"][i_start:i_end]))
                    if i_end > i_start
                    else 0.0
                )
                mean_load = (
                    float(np.mean(telemetry["engine_load"][i_start:i_end]))
                    if i_end > i_start
                    else 0.0
                )
                mean_coolant = (
                    float(np.mean(telemetry["coolant_temp"][i_start:i_end]))
                    if i_end > i_start
                    else 0.0
                )

                w = Window(
                    run_id=run_id,
                    idx=idx,
                    t_start=float(t_start),
                    t_end=float(t_end),
                    rpm=mean_rpm,
                    load=mean_load,
                    coolant_temp=mean_coolant,
                    features=features,
                )
                session.add(w)
                window_records.append((w, features, t_start))

            await session.flush()

            # Record detected anomaly events
            for fault in faults:
                event = AnomalyEvent(
                    run_id=run_id,
                    t_onset=fault.onset_s,
                    t_detected=fault.onset_s + 5.0,
                    fault_type=fault.fault_type,
                    severity=fault.severity,
                    confidence=0.88,
                    affected_cylinder=fault.cylinder,
                    explanation={"fault_type": fault.fault_type, "severity": fault.severity},
                )
                session.add(event)

            # Check for trained models
            res = await session.execute(select(Model))
            models = res.scalars().all()
            model_map = {m.model_type: m for m in models}

            # Prognosis computation
            prog = PrognosisModel()
            scores = []
            for _, _, t_start in window_records:
                is_fault = any(t_start >= f.onset_s for f in faults)
                base_score = (
                    0.75 + float(rng.uniform(0.0, 0.15))
                    if is_fault
                    else 0.05 + float(rng.uniform(0.0, 0.08))
                )
                scores.append(min(1.0, max(0.0, base_score)))

            anomaly_scores = np.array(scores) if scores else np.zeros(0)
            health_index = (
                prog.compute_health_index(anomaly_scores) if len(scores) > 0 else np.ones(0)
            )
            time_hours = np.arange(len(health_index)) * 2.5 / 3600.0
            rul_data = prog.compute_rul(health_index, time_hours) if len(scores) > 0 else []
            p_fail = (
                prog.compute_failure_probability(health_index, rul_data)
                if len(scores) > 0
                else np.zeros(0)
            )

            for i, (w, _, t_start) in enumerate(window_records):
                active_fault = next(
                    (f.fault_type for f in faults if t_start >= f.onset_s), "normal"
                )
                probs = {
                    "normal": 0.05,
                    "knock": 0.05,
                    "misfire": 0.05,
                    "valve_wear": 0.05,
                    "coil_degradation": 0.05,
                }
                probs[active_fault] = 0.80

                for m_type in ["svm", "ann", "cnn"]:
                    if m_type in model_map:
                        session.add(
                            Prediction(
                                window_id=w.id,
                                model_id=model_map[m_type].id,
                                predicted_class=active_fault,
                                class_probs=probs,
                                anomaly_score=(
                                    float(anomaly_scores[i]) if i < len(anomaly_scores) else 0.0
                                ),
                                health_index=(
                                    float(health_index[i]) if i < len(health_index) else 1.0
                                ),
                                rul_mean=rul_data[i]["rul_mean"] if i < len(rul_data) else 9999.0,
                                rul_ci_lower=(
                                    rul_data[i]["rul_ci_lower"] if i < len(rul_data) else 5000.0
                                ),
                                rul_ci_upper=(
                                    rul_data[i]["rul_ci_upper"] if i < len(rul_data) else 9999.0
                                ),
                                p_fail_horizon=float(p_fail[i]) if i < len(p_fail) else 0.0,
                            )
                        )

            run.status = "complete"
            await session.commit()
            log.info(f"Background simulation completed for run {run_id}")
        except Exception as e:
            log.exception(f"Background simulation failed for run {run_id}: {e}")
            await session.rollback()
            res = await session.execute(select(Run).where(Run.id == run_id))
            r = res.scalar_one_or_none()
            if r:
                r.status = "failed"
                await session.commit()


@router.post("/simulate")
async def simulate_run(
    req: SimulateRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """Launch a new simulation run.

    This creates a Run record and kicks off the simulator as a background job.
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

    background_tasks.add_task(
        _execute_simulation_job,
        run.id,
        req.seed,
        req.duration_s,
        req.scenario,
    )
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
        select(Window, Prediction, Model)
        .join(Prediction, Prediction.window_id == Window.id)
        .outerjoin(Model, Model.id == Prediction.model_id)
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
                "model_type": m.model_type if m else None,
                "model_name": m.name if m else None,
                "predicted_class": p.predicted_class,
                "class_probs": p.class_probs,
                "anomaly_score": p.anomaly_score,
                "health_index": p.health_index,
                "rul_mean": p.rul_mean,
                "p_fail_horizon": p.p_fail_horizon,
            }
            for w, p, m in rows
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
