"""Isolation Forest anomaly detector for engine data."""

from __future__ import annotations

import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler


class AnomalyDetector:
    """Isolation Forest–based anomaly detector.

    Trained on normal operating windows, scores new windows from 0 (normal)
    to 1 (highly anomalous).
    """

    def __init__(
        self, contamination: float = 0.05, n_estimators: int = 200, random_state: int = 42
    ):
        self.scaler = StandardScaler()
        self.model = IsolationForest(
            n_estimators=n_estimators,
            contamination=contamination,
            random_state=random_state,
        )
        self._fitted = False

    def fit(self, X: np.ndarray) -> AnomalyDetector:
        """Fit on normal data."""
        X_scaled = self.scaler.fit_transform(X)
        self.model.fit(X_scaled)
        self._fitted = True
        return self

    def score(self, X: np.ndarray) -> np.ndarray:
        """Return anomaly scores in [0, 1]. Higher = more anomalous."""
        if not self._fitted:
            raise RuntimeError("Model not fitted. Call fit() first.")
        X_scaled = self.scaler.transform(X)
        raw_scores = self.model.decision_function(X_scaled)
        # decision_function: higher = more normal. Invert & normalise to [0, 1].
        scores = -raw_scores
        s_min, s_max = scores.min(), scores.max()
        if s_max - s_min > 1e-12:
            scores = (scores - s_min) / (s_max - s_min)
        else:
            scores = np.zeros_like(scores)
        return scores

    def predict(self, X: np.ndarray) -> np.ndarray:
        """Return binary labels: 1 = anomaly, 0 = normal."""
        if not self._fitted:
            raise RuntimeError("Model not fitted. Call fit() first.")
        X_scaled = self.scaler.transform(X)
        preds = self.model.predict(X_scaled)
        # IsolationForest returns 1 for inliers, -1 for outliers
        return (preds == -1).astype(int)
