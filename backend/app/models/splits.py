"""Train/val/test split by run to prevent data leakage.

Ensures no run appears in multiple splits. Uses deterministic hashing
so splits are reproducible.
"""

from __future__ import annotations

import hashlib


def run_split(run_id: str, train_frac: float = 0.7, val_frac: float = 0.15) -> str:
    """Assign a run to train/val/test based on its ID hash.

    Returns 'train', 'val', or 'test'.
    """
    h = int(hashlib.sha256(run_id.encode()).hexdigest(), 16) % 1000
    train_cutoff = int(train_frac * 1000)
    val_cutoff = train_cutoff + int(val_frac * 1000)

    if h < train_cutoff:
        return "train"
    elif h < val_cutoff:
        return "val"
    else:
        return "test"
