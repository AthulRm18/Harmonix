"""Tests for ML models, anomaly detection, and prognosis."""

import numpy as np

from app.models.ann import ANNClassifier
from app.models.anomaly import AnomalyDetector
from app.models.cnn import CNNClassifier
from app.models.prognosis import PrognosisModel
from app.models.splits import run_split
from app.models.svm import SVMClassifier


def test_svm_classifier():
    np.random.seed(42)
    X = np.random.randn(50, 10)
    classes = ["normal", "knock", "misfire", "valve_wear", "coil_degradation"]
    y = np.random.choice(classes, size=50)

    clf = SVMClassifier()
    clf.fit(X, y)

    preds = clf.predict(X)
    assert len(preds) == 50
    probs = clf.predict_proba(X)
    assert probs.shape == (50, 5)

    metrics = clf.get_metrics(X, y)
    assert "accuracy" in metrics
    assert "confusion_matrix" in metrics


def test_ann_classifier():
    np.random.seed(42)
    X = np.random.randn(40, 8)
    classes = ["normal", "knock", "misfire", "valve_wear", "coil_degradation"]
    y = np.random.choice(classes, size=40)

    clf = ANNClassifier(epochs=5)
    clf.fit(X, y)

    preds = clf.predict(X)
    assert len(preds) == 40
    probs = clf.predict_proba(X)
    assert probs.shape == (40, 5)


def test_cnn_classifier():
    np.random.seed(42)
    X = np.random.randn(40, 8)
    classes = ["normal", "knock", "misfire", "valve_wear", "coil_degradation"]
    y = np.random.choice(classes, size=40)

    clf = CNNClassifier(epochs=5)
    clf.fit(X, y)

    preds = clf.predict(X)
    assert len(preds) == 40
    probs = clf.predict_proba(X)
    assert probs.shape == (40, 5)


def test_anomaly_detector():
    np.random.seed(42)
    X_normal = np.random.normal(0, 1, (100, 5))
    X_anomaly = np.random.normal(5, 1, (20, 5))

    detector = AnomalyDetector()
    detector.fit(X_normal)

    scores_normal = detector.score(X_normal)
    scores_anomaly = detector.score(X_anomaly)

    assert len(scores_normal) == 100
    assert len(scores_anomaly) == 20
    # Anomalous points should have higher anomaly scores
    assert np.mean(scores_anomaly) > np.mean(scores_normal)


def test_prognosis_model():
    prog = PrognosisModel(failure_threshold=0.3, horizon_hours=100.0)

    # Simulated degrading anomaly scores [0 -> 1]
    raw_scores = np.linspace(0.1, 0.9, 50)
    hi = prog.compute_health_index(raw_scores)

    assert len(hi) == 50
    assert hi[0] > hi[-1]  # Health index degrades

    time_hours = np.linspace(0, 50, 50)
    rul_data = prog.compute_rul(hi, time_hours)
    assert len(rul_data) == 50
    assert "rul_mean" in rul_data[-1]

    p_fail = prog.compute_failure_probability(hi, rul_data)
    assert len(p_fail) == 50
    assert p_fail[-1] >= p_fail[0]  # Failure probability increases


def test_run_split():
    s1 = run_split("run-abc-123")
    s2 = run_split("run-abc-123")
    assert s1 == s2  # Deterministic
    assert s1 in {"train", "val", "test"}
