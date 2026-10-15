"""Signatures API – FFT, STFT, envelope, and order spectrum endpoints."""

from __future__ import annotations

import numpy as np
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.db.models import SensorReading
from app.pipeline.signatures import (
    compute_envelope,
    compute_fft,
    compute_order_spectrum,
    compute_stft,
)

router = APIRouter()


async def _fetch_signal(
    run_id: str,
    sensor_id: str,
    t0: float,
    t1: float,
    db: AsyncSession,
) -> tuple[np.ndarray, int]:
    """Fetch raw signal data from the DB and return (values, sample_rate).

    Falls back to generating synthetic demo data if no DB rows exist.
    """
    q = (
        select(SensorReading.ts, SensorReading.value)
        .where(SensorReading.run_id == run_id)
        .where(SensorReading.sensor_id == sensor_id)
        .where(SensorReading.ts >= t0)
        .where(SensorReading.ts <= t1)
        .order_by(SensorReading.ts)
    )
    result = await db.execute(q)
    rows = result.all()

    if rows:
        values = np.array([r[1] for r in rows])
        # Infer sample rate from timestamps
        if len(rows) > 1:
            dt = rows[1][0] - rows[0][0]
            sr = int(round(1.0 / dt)) if dt > 0 else 8000
        else:
            sr = 8000
        return values, sr

    # Generate synthetic demo signal for preview
    sr = 8000
    duration = t1 - t0 if t1 > t0 else 1.0
    n_samples = int(sr * duration)
    t = np.linspace(0, duration, n_samples)

    # Base vibration + harmonics + noise
    rng = np.random.default_rng(42)
    sig = (
        1.0 * np.sin(2 * np.pi * 120 * t)  # 1st order at 120 Hz (3600 RPM)
        + 0.6 * np.sin(2 * np.pi * 240 * t)  # 2nd order
        + 0.3 * np.sin(2 * np.pi * 360 * t)  # 3rd order
        + 0.15 * np.sin(2 * np.pi * 6500 * t)  # Knock band
        + 0.4 * rng.normal(0, 1, n_samples)  # Noise
    )

    return sig, sr


@router.get("/{run_id}/fft")
async def get_fft(
    run_id: str,
    sensor: str = Query("vibration", description="Sensor ID"),
    t0: float = Query(0.0),
    t1: float = Query(1.0),
    db: AsyncSession = Depends(get_db),
):
    """Get FFT spectrum for a sensor window."""
    data, sr = await _fetch_signal(run_id, sensor, t0, t1, db)
    result = compute_fft(data, sr)
    return {"sensor": sensor, "sample_rate": sr, "n_samples": len(data), **result}


@router.get("/{run_id}/stft")
async def get_stft(
    run_id: str,
    sensor: str = Query("vibration", description="Sensor ID"),
    t0: float = Query(0.0),
    t1: float = Query(2.0),
    nperseg: int = Query(256, ge=64, le=2048),
    db: AsyncSession = Depends(get_db),
):
    """Get STFT spectrogram for a sensor window."""
    data, sr = await _fetch_signal(run_id, sensor, t0, t1, db)
    result = compute_stft(data, sr, nperseg=nperseg)
    return {"sensor": sensor, "sample_rate": sr, **result}


@router.get("/{run_id}/envelope")
async def get_envelope(
    run_id: str,
    sensor: str = Query("vibration", description="Sensor ID"),
    t0: float = Query(0.0),
    t1: float = Query(1.0),
    db: AsyncSession = Depends(get_db),
):
    """Get envelope spectrum for a sensor window."""
    data, sr = await _fetch_signal(run_id, sensor, t0, t1, db)
    result = compute_envelope(data, sr)
    return {"sensor": sensor, "sample_rate": sr, **result}


@router.get("/{run_id}/order")
async def get_order_spectrum(
    run_id: str,
    sensor: str = Query("vibration", description="Sensor ID"),
    t0: float = Query(0.0),
    t1: float = Query(1.0),
    rpm: float = Query(3000.0, description="Engine RPM for order calculation"),
    db: AsyncSession = Depends(get_db),
):
    """Get order spectrum for a sensor window."""
    data, sr = await _fetch_signal(run_id, sensor, t0, t1, db)
    result = compute_order_spectrum(data, sr, rpm)
    return {"sensor": sensor, "sample_rate": sr, "rpm": rpm, **result}


@router.get("/{run_id}/waveform")
async def get_waveform(
    run_id: str,
    sensor: str = Query("vibration", description="Sensor ID"),
    t0: float = Query(0.0),
    t1: float = Query(0.05),
    max_points: int = Query(2000, ge=100, le=10000),
    db: AsyncSession = Depends(get_db),
):
    """Get raw waveform for a sensor window (time domain)."""
    data, sr = await _fetch_signal(run_id, sensor, t0, t1, db)

    # Downsample if needed
    if len(data) > max_points:
        step = len(data) // max_points
        data = data[::step]

    duration = t1 - t0 if t1 > t0 else len(data) / sr
    timestamps = np.linspace(t0, t0 + duration, len(data))

    return {
        "sensor": sensor,
        "sample_rate": sr,
        "count": len(data),
        "timestamps": timestamps.tolist(),
        "values": data.tolist(),
    }
