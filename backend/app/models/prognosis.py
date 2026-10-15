"""Prognosis module: health index, remaining useful life, failure probability."""

from __future__ import annotations

import numpy as np
from sklearn.linear_model import LinearRegression


class PrognosisModel:
    """Computes health index (HI), remaining useful life (RUL), and P(failure).

    Health Index: 1.0 (perfect) → 0.0 (failed), derived from anomaly scores.
    RUL: Linear extrapolation of HI degradation trend with confidence interval.
    P(fail): Probability of failure within a time horizon.
    """

    def __init__(self, failure_threshold: float = 0.3, horizon_hours: float = 100.0):
        self.failure_threshold = failure_threshold
        self.horizon_hours = horizon_hours

    def compute_health_index(self, anomaly_scores: np.ndarray) -> np.ndarray:
        """Convert anomaly scores [0,1] to health index [0,1]."""
        # Exponential moving average for smoothing
        alpha = 0.1
        hi = np.zeros_like(anomaly_scores)
        hi[0] = 1.0 - anomaly_scores[0]
        for i in range(1, len(anomaly_scores)):
            raw = 1.0 - anomaly_scores[i]
            hi[i] = alpha * raw + (1 - alpha) * hi[i - 1]
        return np.clip(hi, 0, 1)

    def compute_rul(
        self,
        health_index: np.ndarray,
        time_axis_hours: np.ndarray,
        lookback: int = 20,
    ) -> list[dict]:
        """Compute RUL at each time step via linear extrapolation.

        Returns list of {rul_mean, rul_ci_lower, rul_ci_upper} per step.
        """
        results = []
        for i in range(len(health_index)):
            if i < 3:
                results.append({"rul_mean": 9999.0, "rul_ci_lower": 5000.0, "rul_ci_upper": 9999.0})
                continue

            start = max(0, i - lookback)
            t_window = time_axis_hours[start : i + 1].reshape(-1, 1)
            hi_window = health_index[start : i + 1]

            reg = LinearRegression()
            reg.fit(t_window, hi_window)
            slope = reg.coef_[0]

            if slope >= 0:
                # HI is improving or stable → very large RUL
                results.append({"rul_mean": 9999.0, "rul_ci_lower": 5000.0, "rul_ci_upper": 9999.0})
            else:
                # Time to reach failure threshold
                current_hi = health_index[i]
                time_axis_hours[i]
                time_to_fail = (self.failure_threshold - current_hi) / slope
                rul = max(time_to_fail, 0)

                # Confidence interval from residual std
                hi_pred = reg.predict(t_window)
                residual_std = np.std(hi_window - hi_pred.flatten())
                ci_factor = residual_std / max(abs(slope), 1e-6) * 2.0

                results.append(
                    {
                        "rul_mean": float(rul),
                        "rul_ci_lower": float(max(rul - ci_factor, 0)),
                        "rul_ci_upper": float(rul + ci_factor),
                    }
                )

        return results

    def compute_failure_probability(
        self,
        health_index: np.ndarray,
        rul_data: list[dict],
    ) -> np.ndarray:
        """Estimate P(failure within horizon) at each time step."""
        p_fail = np.zeros(len(health_index))
        for i, rul in enumerate(rul_data):
            rul_mean = rul["rul_mean"]
            if rul_mean <= 0:
                p_fail[i] = 1.0
            elif rul_mean >= self.horizon_hours * 10:
                p_fail[i] = 0.0
            else:
                # Sigmoid-like probability: higher as RUL shrinks
                p_fail[i] = 1.0 / (
                    1.0 + np.exp((rul_mean - self.horizon_hours) / (self.horizon_hours * 0.3))
                )
        return np.clip(p_fail, 0, 1)
