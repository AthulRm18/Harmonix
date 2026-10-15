"""SVM classifier for engine fault classification."""

from __future__ import annotations

import numpy as np
from sklearn.preprocessing import StandardScaler
from sklearn.svm import SVC


class SVMClassifier:
    """Support Vector Machine classifier for engine fault types.

    Classes: normal, knock, misfire, valve_wear, coil_degradation
    """

    CLASSES = ["normal", "knock", "misfire", "valve_wear", "coil_degradation"]

    def __init__(self, kernel: str = "rbf", C: float = 10.0, random_state: int = 42):
        self.scaler = StandardScaler()
        self.model = SVC(
            kernel=kernel,
            C=C,
            probability=True,
            random_state=random_state,
            class_weight="balanced",
        )
        self._fitted = False

    def fit(self, X: np.ndarray, y: np.ndarray) -> SVMClassifier:
        X_scaled = self.scaler.fit_transform(X)
        self.model.fit(X_scaled, y)
        self._fitted = True
        return self

    def predict(self, X: np.ndarray) -> np.ndarray:
        if not self._fitted:
            raise RuntimeError("Model not fitted.")
        X_scaled = self.scaler.transform(X)
        return self.model.predict(X_scaled)

    def predict_proba(self, X: np.ndarray) -> np.ndarray:
        if not self._fitted:
            raise RuntimeError("Model not fitted.")
        X_scaled = self.scaler.transform(X)
        return self.model.predict_proba(X_scaled)

    def get_metrics(self, X: np.ndarray, y: np.ndarray) -> dict:
        from sklearn.metrics import accuracy_score, confusion_matrix, f1_score

        y_pred = self.predict(X)
        return {
            "accuracy": float(accuracy_score(y, y_pred)),
            "f1_macro": float(f1_score(y, y_pred, average="macro", zero_division=0)),
            "f1_weighted": float(f1_score(y, y_pred, average="weighted", zero_division=0)),
            "confusion_matrix": confusion_matrix(y, y_pred, labels=self.CLASSES).tolist(),
        }
