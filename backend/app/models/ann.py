"""ANN classifier with softmax output for engine fault classification."""

from __future__ import annotations

import numpy as np
import torch
import torch.nn as nn
from sklearn.preprocessing import StandardScaler


class ANNModel(nn.Module):
    """Feed-forward neural network with softmax output."""

    def __init__(self, input_dim: int, n_classes: int = 5, hidden: int = 128):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(input_dim, hidden),
            nn.BatchNorm1d(hidden),
            nn.ReLU(),
            nn.Dropout(0.3),
            nn.Linear(hidden, hidden // 2),
            nn.BatchNorm1d(hidden // 2),
            nn.ReLU(),
            nn.Dropout(0.2),
            nn.Linear(hidden // 2, n_classes),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.net(x)


class ANNClassifier:
    """ANN with Softmax classifier wrapper.

    Classes: normal, knock, misfire, valve_wear, coil_degradation
    """

    CLASSES = ["normal", "knock", "misfire", "valve_wear", "coil_degradation"]

    def __init__(self, hidden: int = 128, lr: float = 1e-3, epochs: int = 100):
        self.hidden = hidden
        self.lr = lr
        self.epochs = epochs
        self.scaler = StandardScaler()
        self.model: ANNModel | None = None
        self._fitted = False
        self.device = torch.device("cpu")

    def fit(self, X: np.ndarray, y: np.ndarray) -> ANNClassifier:
        X_scaled = self.scaler.fit_transform(X)

        # Encode labels
        label_to_idx = {c: i for i, c in enumerate(self.CLASSES)}
        y_idx = np.array([label_to_idx.get(str(label), 0) for label in y])

        X_t = torch.tensor(X_scaled, dtype=torch.float32, device=self.device)
        y_t = torch.tensor(y_idx, dtype=torch.long, device=self.device)

        self.model = ANNModel(X.shape[1], len(self.CLASSES), self.hidden).to(self.device)
        optimizer = torch.optim.Adam(self.model.parameters(), lr=self.lr)

        # Class weights for imbalanced data
        class_counts = np.bincount(y_idx, minlength=len(self.CLASSES)).astype(float)
        class_counts = np.maximum(class_counts, 1.0)
        weights = 1.0 / class_counts
        weights /= weights.sum()
        loss_fn = nn.CrossEntropyLoss(
            weight=torch.tensor(weights, dtype=torch.float32, device=self.device)
        )

        self.model.train()
        for _epoch in range(self.epochs):
            optimizer.zero_grad()
            logits = self.model(X_t)
            loss = loss_fn(logits, y_t)
            loss.backward()
            optimizer.step()

        self._fitted = True
        return self

    def predict(self, X: np.ndarray) -> np.ndarray:
        if not self._fitted or self.model is None:
            raise RuntimeError("Model not fitted.")
        X_scaled = self.scaler.transform(X)
        X_t = torch.tensor(X_scaled, dtype=torch.float32, device=self.device)
        self.model.eval()
        with torch.no_grad():
            logits = self.model(X_t)
            preds = logits.argmax(dim=1).cpu().numpy()
        return np.array([self.CLASSES[i] for i in preds])

    def predict_proba(self, X: np.ndarray) -> np.ndarray:
        if not self._fitted or self.model is None:
            raise RuntimeError("Model not fitted.")
        X_scaled = self.scaler.transform(X)
        X_t = torch.tensor(X_scaled, dtype=torch.float32, device=self.device)
        self.model.eval()
        with torch.no_grad():
            logits = self.model(X_t)
            probs = torch.softmax(logits, dim=1).cpu().numpy()
        return probs

    def get_metrics(self, X: np.ndarray, y: np.ndarray) -> dict:
        from sklearn.metrics import accuracy_score, confusion_matrix, f1_score

        y_pred = self.predict(X)
        return {
            "accuracy": float(accuracy_score(y, y_pred)),
            "f1_macro": float(f1_score(y, y_pred, average="macro", zero_division=0)),
            "f1_weighted": float(f1_score(y, y_pred, average="weighted", zero_division=0)),
            "confusion_matrix": confusion_matrix(y, y_pred, labels=self.CLASSES).tolist(),
        }
