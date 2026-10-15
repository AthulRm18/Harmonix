"""Models API – model registry and metrics."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.db.models import Model, Prediction, Explanation

router = APIRouter()


@router.get("")
async def list_models(db: AsyncSession = Depends(get_db)):
    """List all trained models."""
    result = await db.execute(select(Model).order_by(Model.trained_at.desc()))
    models = result.scalars().all()

    return {
        "count": len(models),
        "models": [
            {
                "id": m.id,
                "name": m.name,
                "model_type": m.model_type,
                "version": m.version,
                "metrics": m.metrics,
                "trained_at": str(m.trained_at) if m.trained_at else None,
            }
            for m in models
        ],
    }


@router.get("/{model_id}")
async def get_model(model_id: str, db: AsyncSession = Depends(get_db)):
    """Get a model's details."""
    result = await db.execute(select(Model).where(Model.id == model_id))
    m = result.scalar_one_or_none()
    if not m:
        raise HTTPException(status_code=404, detail=f"Model '{model_id}' not found")

    return {
        "id": m.id,
        "name": m.name,
        "model_type": m.model_type,
        "version": m.version,
        "metrics": m.metrics,
        "trained_at": str(m.trained_at) if m.trained_at else None,
        "mlflow_run_id": m.mlflow_run_id,
        "data_hash": m.data_hash,
    }


@router.get("/{model_id}/metrics")
async def get_model_metrics(model_id: str, db: AsyncSession = Depends(get_db)):
    """Get a model's evaluation metrics (confusion matrix, per-class P/R/F1)."""
    result = await db.execute(select(Model).where(Model.id == model_id))
    m = result.scalar_one_or_none()
    if not m:
        raise HTTPException(status_code=404, detail=f"Model '{model_id}' not found")

    return {
        "model_id": m.id,
        "model_type": m.model_type,
        "metrics": m.metrics or {},
    }


@router.get("/predictions/{prediction_id}/explanation")
async def get_explanation(prediction_id: int, db: AsyncSession = Depends(get_db)):
    """Get explainability artefacts for a prediction."""
    result = await db.execute(
        select(Explanation).where(Explanation.prediction_id == prediction_id)
    )
    explanations = result.scalars().all()

    if not explanations:
        raise HTTPException(status_code=404, detail="No explanations found")

    return {
        "prediction_id": prediction_id,
        "explanations": [
            {
                "id": e.id,
                "type": e.explanation_type,
                "payload": e.payload,
                "uri": e.uri,
            }
            for e in explanations
        ],
    }
