"""Model evaluation and comparison utilities."""

from __future__ import annotations


def compare_models(model_metrics: dict[str, dict]) -> dict:
    """Compare multiple models by their metrics.

    Args:
        model_metrics: {model_name: {accuracy, f1_macro, ...}}

    Returns:
        Comparison summary with rankings.
    """
    if not model_metrics:
        return {"models": [], "best_accuracy": None, "best_f1": None}

    rows = []
    for name, m in model_metrics.items():
        rows.append(
            {
                "model": name,
                "accuracy": m.get("accuracy", 0),
                "f1_macro": m.get("f1_macro", 0),
                "f1_weighted": m.get("f1_weighted", 0),
                "confusion_matrix": m.get("confusion_matrix"),
            }
        )

    best_acc = max(rows, key=lambda r: r["accuracy"])
    best_f1 = max(rows, key=lambda r: r["f1_macro"])

    return {
        "models": rows,
        "best_accuracy": best_acc["model"],
        "best_f1": best_f1["model"],
    }
