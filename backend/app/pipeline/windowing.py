"""Sliding window segmentation for the pipeline."""

from __future__ import annotations

import numpy as np


def segment_windows(
    timestamps: np.ndarray,
    window_size_s: float = 5.0,
    hop_s: float = 2.5,
) -> list[tuple[float, float, int, int]]:
    """Segment a time axis into overlapping windows.

    Returns list of (t_start, t_end, idx_start, idx_end).
    """
    if len(timestamps) == 0:
        return []

    t_min, t_max = timestamps[0], timestamps[-1]
    windows = []
    t = t_min
    while t + window_size_s <= t_max + 1e-9:
        t_end = t + window_size_s
        idx_start = int(np.searchsorted(timestamps, t))
        idx_end = int(np.searchsorted(timestamps, t_end, side="right"))
        windows.append((t, t_end, idx_start, idx_end))
        t += hop_s
    return windows
