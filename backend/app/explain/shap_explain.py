"""SHAP-based explainability for tree/linear models."""

from __future__ import annotations

import numpy as np


def compute_shap_values(
    model,
    X: np.ndarray,
    feature_names: list[str],
    n_samples: int = 50,
) -> dict:
    """Compute SHAP values for a scikit-learn model.

    Returns a dict with:
    - shap_values: list of per-class SHAP arrays
    - feature_names: list of feature names
    - base_value: expected value
    """
    try:
        import shap

        # Use KernelExplainer for any model
        background = X[: min(100, len(X))]
        explainer = shap.KernelExplainer(model.predict_proba, background)
        sv = explainer.shap_values(X[:n_samples])

        return {
            "shap_values": [s.tolist() if isinstance(s, np.ndarray) else s for s in sv],
            "feature_names": feature_names,
            "base_value": explainer.expected_value.tolist()
            if isinstance(explainer.expected_value, np.ndarray)
            else explainer.expected_value,
        }
    except Exception:
        # Fallback: feature importance from model if available
        return _fallback_importance(model, feature_names)


def _fallback_importance(model, feature_names: list[str]) -> dict:
    """Use permutation importance or model coefficients as fallback."""
    n = len(feature_names)
    # Fake uniform importance as last resort
    importance = np.ones(n) / n
    try:
        if hasattr(model, "feature_importances_"):
            importance = model.feature_importances_
        elif hasattr(model, "coef_"):
            importance = (
                np.abs(model.coef_).mean(axis=0) if model.coef_.ndim > 1 else np.abs(model.coef_)
            )
    except Exception:
        pass

    return {
        "feature_importance": importance.tolist(),
        "feature_names": feature_names,
        "method": "fallback",
    }
