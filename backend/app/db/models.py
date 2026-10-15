"""SQLAlchemy ORM models for EngineSense.

Tables:
- engines: engine profile and configuration
- sensors: mirrors the registry YAML
- runs: simulation/import runs with ground truth
- sensor_readings: telemetry time-series (hypertable in TimescaleDB)
- signal_chunks: high-rate data file references
- windows: feature windows
- predictions: per-window model outputs
- anomaly_events: detected fault events
- explanations: explainability artefacts
- models: trained model registry
- optimization_results: sweet-spot optimiser outputs
- jobs: background task tracking
"""

from __future__ import annotations

import uuid

from sqlalchemy import (
    JSON,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.orm import relationship

from app.db import Base


def _uuid() -> str:
    return str(uuid.uuid4())


class Engine(Base):
    """Engine profile and configuration."""

    __tablename__ = "engines"

    id = Column(String(36), primary_key=True, default=_uuid)
    name = Column(String(200), nullable=False, default="Default 4-Cyl Inline")
    cylinders = Column(Integer, nullable=False, default=4)
    firing_order = Column(String(50), nullable=False, default="1-3-4-2")
    bore_mm = Column(Float, nullable=False, default=86.0)
    stroke_mm = Column(Float, nullable=False, default=86.0)
    displacement_cc = Column(Float, nullable=False, default=2000.0)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())


class Sensor(Base):
    """Sensor metadata (mirrors registry.yaml)."""

    __tablename__ = "sensors"

    id = Column(String(50), primary_key=True)
    name = Column(String(200), nullable=False)
    unit = Column(String(50), nullable=False)
    sample_rate = Column(Integer, nullable=False)
    physical_meaning = Column(Text, nullable=True)
    normal_range_min = Column(Float, nullable=True)
    normal_range_max = Column(Float, nullable=True)
    obd_pid = Column(String(20), nullable=True)
    provenance = Column(String(20), nullable=False, default="synthetic")
    description = Column(Text, nullable=True)
    category = Column(String(20), nullable=False, default="telemetry")


class Run(Base):
    """A simulation or import run."""

    __tablename__ = "runs"

    id = Column(String(36), primary_key=True, default=_uuid)
    name = Column(String(200), nullable=False)
    source = Column(String(20), nullable=False, default="synthetic")  # real|synthetic|hybrid
    scenario_yaml = Column(Text, nullable=True)
    seed = Column(Integer, nullable=True)
    engine_id = Column(String(36), ForeignKey("engines.id"), nullable=True)
    start_time = Column(DateTime, nullable=True)
    duration_s = Column(Float, nullable=True)
    ground_truth = Column(JSON, nullable=True)  # {fault_type, onset_s, severity, cylinder}
    status = Column(
        String(20), nullable=False, default="pending"
    )  # pending|running|complete|failed
    created_at = Column(DateTime, server_default=func.now())

    # Relationships
    engine = relationship("Engine", backref="runs")
    readings = relationship("SensorReading", back_populates="run", cascade="all, delete-orphan")
    signal_chunks = relationship("SignalChunk", back_populates="run", cascade="all, delete-orphan")
    windows = relationship("Window", back_populates="run", cascade="all, delete-orphan")
    events = relationship("AnomalyEvent", back_populates="run", cascade="all, delete-orphan")


class SensorReading(Base):
    """Telemetry time-series data (hypertable in TimescaleDB)."""

    __tablename__ = "sensor_readings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    run_id = Column(String(36), ForeignKey("runs.id"), nullable=False)
    ts = Column(Float, nullable=False)  # seconds from run start
    sensor_id = Column(String(50), ForeignKey("sensors.id"), nullable=False)
    value = Column(Float, nullable=False)

    run = relationship("Run", back_populates="readings")

    __table_args__ = (
        Index("ix_readings_run_ts", "run_id", "ts"),
        Index("ix_readings_run_sensor_ts", "run_id", "sensor_id", "ts"),
    )


class SignalChunk(Base):
    """Reference to a high-rate signal file in the BlobStore."""

    __tablename__ = "signal_chunks"

    id = Column(Integer, primary_key=True, autoincrement=True)
    run_id = Column(String(36), ForeignKey("runs.id"), nullable=False)
    sensor_id = Column(String(50), ForeignKey("sensors.id"), nullable=False)
    t_start = Column(Float, nullable=False)
    t_end = Column(Float, nullable=False)
    sample_rate = Column(Integer, nullable=False)
    n_samples = Column(Integer, nullable=False)
    uri = Column(String(500), nullable=False)  # relative path in BlobStore
    format = Column(String(10), nullable=False, default="npz")  # npz|parquet

    run = relationship("Run", back_populates="signal_chunks")

    __table_args__ = (Index("ix_chunks_run_sensor", "run_id", "sensor_id"),)


class Window(Base):
    """Feature window extracted by the pipeline."""

    __tablename__ = "windows"

    id = Column(Integer, primary_key=True, autoincrement=True)
    run_id = Column(String(36), ForeignKey("runs.id"), nullable=False)
    idx = Column(Integer, nullable=False)
    t_start = Column(Float, nullable=False)
    t_end = Column(Float, nullable=False)
    rpm = Column(Float, nullable=True)
    load = Column(Float, nullable=True)
    coolant_temp = Column(Float, nullable=True)
    features = Column(JSON, nullable=True)  # JSONB on PostgreSQL

    run = relationship("Run", back_populates="windows")
    predictions = relationship("Prediction", back_populates="window", cascade="all, delete-orphan")

    __table_args__ = (Index("ix_windows_run", "run_id"),)


class Model(Base):
    """Trained model metadata."""

    __tablename__ = "models"

    id = Column(String(36), primary_key=True, default=_uuid)
    name = Column(String(200), nullable=False)
    model_type = Column(String(50), nullable=False)  # svm|ann|cnn|isolation_forest|autoencoder|gru
    version = Column(String(50), nullable=False, default="1.0")
    mlflow_run_id = Column(String(100), nullable=True)
    metrics = Column(JSON, nullable=True)
    trained_at = Column(DateTime, server_default=func.now())
    data_hash = Column(String(64), nullable=True)
    file_path = Column(String(500), nullable=True)


class Prediction(Base):
    """Per-window model prediction."""

    __tablename__ = "predictions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    window_id = Column(Integer, ForeignKey("windows.id"), nullable=False)
    model_id = Column(String(36), ForeignKey("models.id"), nullable=False)
    class_probs = Column(JSON, nullable=True)  # {normal: 0.9, knock: 0.05, ...}
    predicted_class = Column(String(50), nullable=True)
    anomaly_score = Column(Float, nullable=True)
    health_index = Column(Float, nullable=True)
    rul_mean = Column(Float, nullable=True)
    rul_ci_lower = Column(Float, nullable=True)
    rul_ci_upper = Column(Float, nullable=True)
    p_fail_horizon = Column(Float, nullable=True)

    window = relationship("Window", back_populates="predictions")
    model = relationship("Model")
    explanations = relationship(
        "Explanation", back_populates="prediction", cascade="all, delete-orphan"
    )

    __table_args__ = (Index("ix_predictions_window", "window_id"),)


class AnomalyEvent(Base):
    """Detected anomaly/fault event."""

    __tablename__ = "anomaly_events"

    id = Column(Integer, primary_key=True, autoincrement=True)
    run_id = Column(String(36), ForeignKey("runs.id"), nullable=False)
    t_onset = Column(Float, nullable=False)
    t_detected = Column(Float, nullable=True)
    fault_type = Column(String(50), nullable=False)
    severity = Column(Float, nullable=True)
    confidence = Column(Float, nullable=True)
    affected_cylinder = Column(Integer, nullable=True)
    explanation = Column(JSON, nullable=True)

    run = relationship("Run", back_populates="events")


class Explanation(Base):
    """Explainability artefact for a prediction."""

    __tablename__ = "explanations"

    id = Column(Integer, primary_key=True, autoincrement=True)
    prediction_id = Column(Integer, ForeignKey("predictions.id"), nullable=False)
    explanation_type = Column(String(20), nullable=False)  # gradcam|shap|physics|text
    payload = Column(JSON, nullable=True)
    uri = Column(String(500), nullable=True)  # for large artefacts stored in BlobStore

    prediction = relationship("Prediction", back_populates="explanations")


class OptimizationResult(Base):
    """Sweet-spot optimiser output."""

    __tablename__ = "optimization_results"

    id = Column(Integer, primary_key=True, autoincrement=True)
    run_id = Column(String(36), ForeignKey("runs.id"), nullable=True)
    model_id = Column(String(36), ForeignKey("models.id"), nullable=True)
    grid = Column(JSON, nullable=True)
    pareto_front = Column(JSON, nullable=True)
    recommended_region = Column(JSON, nullable=True)
    rationale = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())


class Job(Base):
    """Long-running background task tracking."""

    __tablename__ = "jobs"

    id = Column(String(36), primary_key=True, default=_uuid)
    job_type = Column(String(50), nullable=False)  # simulate|train|optimize|import
    status = Column(
        String(20), nullable=False, default="pending"
    )  # pending|running|complete|failed
    progress = Column(Float, nullable=True)  # 0.0 – 1.0
    result = Column(JSON, nullable=True)
    error = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
