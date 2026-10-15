"""Tests for LTTB downsampling."""

import math

from app.pipeline.lttb import downsample_lttb


def test_no_downsampling_needed():
    """If data is already smaller than target, return as-is."""
    ts = [0.0, 1.0, 2.0]
    vals = [1.0, 2.0, 3.0]
    out_ts, out_vals = downsample_lttb(ts, vals, 10)
    assert out_ts == ts
    assert out_vals == vals


def test_downsampling_reduces_points():
    """LTTB reduces the number of points to the target."""
    n = 1000
    ts = [float(i) for i in range(n)]
    vals = [math.sin(2 * math.pi * i / 100) for i in range(n)]

    target = 100
    out_ts, out_vals = downsample_lttb(ts, vals, target)

    assert len(out_ts) == target
    assert len(out_vals) == target


def test_first_and_last_preserved():
    """LTTB always keeps the first and last point."""
    ts = [float(i) for i in range(500)]
    vals = [float(i * i) for i in range(500)]

    out_ts, out_vals = downsample_lttb(ts, vals, 50)

    assert out_ts[0] == ts[0]
    assert out_ts[-1] == ts[-1]
    assert out_vals[0] == vals[0]
    assert out_vals[-1] == vals[-1]


def test_monotonic_timestamps():
    """Output timestamps are monotonically increasing."""
    n = 2000
    ts = [float(i) * 0.001 for i in range(n)]
    vals = [math.sin(i * 0.1) + 0.5 * math.cos(i * 0.03) for i in range(n)]

    out_ts, _ = downsample_lttb(ts, vals, 200)

    for i in range(1, len(out_ts)):
        assert out_ts[i] > out_ts[i - 1], f"Non-monotonic at index {i}"
