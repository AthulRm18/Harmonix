"""Database seed script.

Generates simulated engine runs, extracts features, trains all three ML models
(SVM, ANN, CNN), runs anomaly detection and prognosis, and populates the database.

Usage: python -m app.data.seed
"""

from __future__ import annotations

import asyncio
import logging
import uuid

import numpy as np
from sqlalchemy import text

from app.db import AsyncSessionLocal, Base, async_engine
from app.db.models import (
    AnomalyEvent,
    Engine,
    Model,
    Prediction,
    Run,
    Sensor,
    SensorReading,
    Window,
)
from app.models.ann import ANNClassifier
from app.models.anomaly import AnomalyDetector
from app.models.cnn import CNNClassifier
from app.models.evaluation import compare_models
from app.models.prognosis import PrognosisModel
from app.models.svm import SVMClassifier
from app.pipeline.features import extract_telemetry_features
from app.pipeline.windowing import segment_windows
from app.sensors import load_registry
from app.sim.engine import OperatingPoint, generate_telemetry
from app.sim.faults import FaultConfig, inject_fault
from app.sim.scenarios import SCENARIOS

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)


async def create_tables():
    """Create all tables."""
    async with async_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    log.info("Tables created.")


async def seed_engine(session) -> str:
    """Seed a default engine profile."""
    engine = Engine(
        id=str(uuid.uuid4()),
        name="Default 4-Cyl Inline",
        cylinders=4,
        firing_order="1-3-4-2",
        bore_mm=86.0,
        stroke_mm=86.0,
        displacement_cc=2000.0,
        description="2.0L naturally-aspirated inline-4 petrol engine.",
    )
    session.add(engine)
    await session.flush()
    log.info(f"Seeded engine: {engine.name}")
    return engine.id


async def seed_sensors(session):
    """Seed sensors from registry.yaml."""
    registry = load_registry()
    for s in registry.sensors:
        sensor = Sensor(
            id=s.id,
            name=s.name,
            unit=s.unit,
            sample_rate=s.sample_rate,
            physical_meaning=s.physical_meaning,
            normal_range_min=s.normal_range[0],
            normal_range_max=s.normal_range[1],
            obd_pid=s.obd_pid,
            provenance=s.provenance,
            description=s.description,
            category=s.category,
        )
        session.add(sensor)
    await session.flush()
    log.info(f"Seeded {len(registry.sensors)} sensors.")


async def generate_run(
    session,
    scenario: dict,
    engine_id: str,
    seed: int,
) -> tuple[str, dict, list[dict], str]:
    """Generate a single run: simulate, store readings, extract features."""
    rng = np.random.default_rng(seed)

    run_id = str(uuid.uuid4())
    op: OperatingPoint = scenario["op"]
    duration_s: float = scenario["duration_s"]
    faults: list[FaultConfig] = scenario["faults"]

    # Determine ground truth label
    if not faults:
        fault_label = "normal"
        ground_truth = {"fault_type": "normal", "onset_s": None, "severity": 0, "cylinder": None}
    else:
        fault_label = faults[0].fault_type
        ground_truth = {
            "fault_type": faults[0].fault_type,
            "onset_s": faults[0].onset_s,
            "severity": faults[0].severity,
            "cylinder": faults[0].cylinder,
        }

    # Generate telemetry
    telemetry = generate_telemetry(op, duration_s, sample_rate=20, rng=rng)

    # Inject faults
    for fault in faults:
        result = inject_fault(telemetry, None, fault, rng)
        telemetry = result["telemetry"]

    # Create Run record
    run = Run(
        id=run_id,
        name=scenario["name"],
        source="synthetic",
        seed=seed,
        engine_id=engine_id,
        duration_s=duration_s,
        ground_truth=ground_truth,
        status="complete",
    )
    session.add(run)

    # Store sensor readings (subsample to keep DB reasonable)
    timestamps = telemetry["timestamps"]
    telemetry_sensors = [k for k in telemetry if k != "timestamps"]

    readings = []
    # Store every 5th point to reduce DB size
    step = 5
    for sensor_id in telemetry_sensors:
        values = telemetry[sensor_id]
        for i in range(0, len(timestamps), step):
            readings.append(
                SensorReading(
                    run_id=run_id,
                    ts=float(timestamps[i]),
                    sensor_id=sensor_id,
                    value=float(values[i]),
                )
            )

    session.add_all(readings)

    # Extract features per window
    windows_spec = segment_windows(timestamps, window_size_s=5.0, hop_s=2.5)
    window_records = []
    feature_rows = []

    for idx, (t_start, t_end, i_start, i_end) in enumerate(windows_spec):
        features = extract_telemetry_features(telemetry, i_start, i_end)

        # Assign label based on fault onset
        if not faults:
            label = "normal"
        else:
            # Window is faulty if t_start >= fault onset
            label = "normal"
            for f in faults:
                if t_start >= f.onset_s:
                    label = f.fault_type
                    break

        mean_rpm = float(np.mean(telemetry["engine_rpm"][i_start:i_end])) if i_end > i_start else 0
        mean_load = (
            float(np.mean(telemetry["engine_load"][i_start:i_end])) if i_end > i_start else 0
        )
        mean_coolant = (
            float(np.mean(telemetry["coolant_temp"][i_start:i_end])) if i_end > i_start else 0
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
        window_records.append(w)
        feature_rows.append({"features": features, "label": label, "window": w})

    # Create anomaly events for fault scenarios
    for fault in faults:
        event = AnomalyEvent(
            run_id=run_id,
            t_onset=fault.onset_s,
            t_detected=fault.onset_s + 5.0,  # Detection delay
            fault_type=fault.fault_type,
            severity=fault.severity,
            confidence=0.85 + rng.random() * 0.1,
            affected_cylinder=fault.cylinder,
            explanation=ground_truth,
        )
        session.add(event)

    await session.flush()

    log.info(f"  Run '{scenario['name']}' → {len(window_records)} windows, label='{fault_label}'")
    return run_id, telemetry, feature_rows, fault_label


def _build_feature_matrix(all_feature_rows: list[dict]) -> tuple[np.ndarray, np.ndarray, list[str]]:
    """Build a consistent feature matrix from all windows."""
    # Collect all feature names
    all_keys: set[str] = set()
    for row in all_feature_rows:
        all_keys.update(row["features"].keys())
    feature_names = sorted(all_keys)

    X = np.zeros((len(all_feature_rows), len(feature_names)))
    y = np.array([row["label"] for row in all_feature_rows])

    for i, row in enumerate(all_feature_rows):
        for j, key in enumerate(feature_names):
            val = row["features"].get(key, 0.0)
            if val is None or (isinstance(val, float) and np.isnan(val)):
                val = 0.0
            X[i, j] = val

    # Replace any remaining NaN/inf
    X = np.nan_to_num(X, nan=0.0, posinf=0.0, neginf=0.0)

    return X, y, feature_names


async def train_and_store_models(
    session,
    all_feature_rows: list[dict],
) -> dict[str, dict]:
    """Train SVM, ANN, CNN, anomaly detector, run prognosis."""
    X, y, feature_names = _build_feature_matrix(all_feature_rows)

    log.info(f"Feature matrix: {X.shape[0]} windows × {X.shape[1]} features")
    log.info(f"Class distribution: {dict(zip(*np.unique(y, return_counts=True), strict=False))}")

    # ── Train classifiers ──
    log.info("Training SVM...")
    svm = SVMClassifier()
    svm.fit(X, y)
    svm_metrics = svm.get_metrics(X, y)

    log.info("Training ANN...")
    ann = ANNClassifier(epochs=80)
    ann.fit(X, y)
    ann_metrics = ann.get_metrics(X, y)

    log.info("Training CNN...")
    cnn = CNNClassifier(epochs=80)
    cnn.fit(X, y)
    cnn_metrics = cnn.get_metrics(X, y)

    # ── Train anomaly detector on normal data ──
    log.info("Training anomaly detector...")
    normal_mask = y == "normal"
    detector = AnomalyDetector()
    detector.fit(X[normal_mask])
    anomaly_scores = detector.score(X)

    # ── Prognosis ──
    log.info("Computing prognosis...")
    prog = PrognosisModel()
    health_index = prog.compute_health_index(anomaly_scores)
    time_hours = np.arange(len(health_index)) * 2.5 / 3600.0  # windows to hours
    rul_data = prog.compute_rul(health_index, time_hours)
    p_fail = prog.compute_failure_probability(health_index, rul_data)

    # ── Store model records ──
    model_records = {}
    for name, metrics in [("SVM", svm_metrics), ("ANN", ann_metrics), ("CNN", cnn_metrics)]:
        m = Model(
            id=str(uuid.uuid4()),
            name=f"EngineSense {name} v1",
            model_type=name.lower(),
            version="1.0",
            metrics=metrics,
        )
        session.add(m)
        model_records[name] = m

    anomaly_model = Model(
        id=str(uuid.uuid4()),
        name="EngineSense Isolation Forest v1",
        model_type="isolation_forest",
        version="1.0",
        metrics={"contamination": 0.05, "n_estimators": 200},
    )
    session.add(anomaly_model)

    await session.flush()

    # ── Store predictions per window ──
    log.info("Storing predictions...")
    svm_probs = svm.predict_proba(X)
    ann_probs = ann.predict_proba(X)
    cnn_probs = cnn.predict_proba(X)
    svm_preds = svm.predict(X)
    ann_preds = ann.predict(X)
    cnn_preds = cnn.predict(X)

    classes = SVMClassifier.CLASSES

    for i, row in enumerate(all_feature_rows):
        window = row["window"]
        window_id = window.id

        # SVM prediction
        session.add(
            Prediction(
                window_id=window_id,
                model_id=model_records["SVM"].id,
                predicted_class=str(svm_preds[i]),
                class_probs={c: float(svm_probs[i][j]) for j, c in enumerate(classes)},
                anomaly_score=float(anomaly_scores[i]),
                health_index=float(health_index[i]),
                rul_mean=rul_data[i]["rul_mean"],
                rul_ci_lower=rul_data[i]["rul_ci_lower"],
                rul_ci_upper=rul_data[i]["rul_ci_upper"],
                p_fail_horizon=float(p_fail[i]),
            )
        )

        # ANN prediction
        session.add(
            Prediction(
                window_id=window_id,
                model_id=model_records["ANN"].id,
                predicted_class=str(ann_preds[i]),
                class_probs={c: float(ann_probs[i][j]) for j, c in enumerate(classes)},
                anomaly_score=float(anomaly_scores[i]),
            )
        )

        # CNN prediction
        session.add(
            Prediction(
                window_id=window_id,
                model_id=model_records["CNN"].id,
                predicted_class=str(cnn_preds[i]),
                class_probs={c: float(cnn_probs[i][j]) for j, c in enumerate(classes)},
                anomaly_score=float(anomaly_scores[i]),
            )
        )

    await session.flush()

    # ── Compare models ──
    comparison = compare_models(
        {
            "SVM": svm_metrics,
            "ANN": ann_metrics,
            "CNN": cnn_metrics,
        }
    )
    log.info(
        f"Model comparison: best accuracy={comparison['best_accuracy']}, best F1={comparison['best_f1']}"
    )
    for m in comparison["models"]:
        log.info(f"  {m['model']}: acc={m['accuracy']:.3f}, F1={m['f1_macro']:.3f}")

    return {"SVM": svm_metrics, "ANN": ann_metrics, "CNN": cnn_metrics}


async def seed_all():
    """Main seed function: create tables, generate data, train models."""
    log.info("=" * 60)
    log.info("EngineSense Database Seeder")
    log.info("=" * 60)

    await create_tables()

    async with AsyncSessionLocal() as session:
        # Check if already seeded
        result = await session.execute(text("SELECT COUNT(*) FROM runs"))
        count = result.scalar()
        if count and count > 0:
            log.info(f"Database already contains {count} runs. Skipping seed.")
            return

        engine_id = await seed_engine(session)
        await seed_sensors(session)

        all_feature_rows: list[dict] = []

        for i, scenario in enumerate(SCENARIOS):
            seed = 1000 + i
            _, _, feature_rows, _ = await generate_run(session, scenario, engine_id, seed)
            all_feature_rows.extend(feature_rows)

        log.info(f"Total windows across all runs: {len(all_feature_rows)}")

        await train_and_store_models(session, all_feature_rows)

        await session.commit()
        log.info("=" * 60)
        log.info("Seed complete!")
        log.info("=" * 60)


def main():
    asyncio.run(seed_all())


if __name__ == "__main__":
    main()
