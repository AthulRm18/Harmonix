"""LTTB (Largest Triangle Three Buckets) downsampling.

Server-side downsampling for time-series visualisation.
Preserves visual shape while reducing point count.
"""

from __future__ import annotations

import math


def downsample_lttb(
    timestamps: list[float],
    values: list[float],
    target_points: int,
) -> tuple[list[float], list[float]]:
    """Downsample a time series using the LTTB algorithm.

    Args:
        timestamps: Monotonically increasing time values.
        values: Corresponding signal values.
        target_points: Desired number of output points.

    Returns:
        (downsampled_timestamps, downsampled_values)
    """
    n = len(timestamps)
    if n <= target_points or target_points < 3:
        return timestamps, values

    # Always keep the first and last point
    out_ts = [timestamps[0]]
    out_val = [values[0]]

    bucket_size = (n - 2) / (target_points - 2)

    a_idx = 0  # index of the previously selected point

    for i in range(1, target_points - 1):
        # Calculate bucket boundaries
        bucket_start = int(math.floor((i - 1) * bucket_size)) + 1
        bucket_end = int(math.floor(i * bucket_size)) + 1
        bucket_end = min(bucket_end, n - 1)

        # Calculate the average point of the next bucket
        next_start = int(math.floor(i * bucket_size)) + 1
        next_end = int(math.floor((i + 1) * bucket_size)) + 1
        next_end = min(next_end, n)

        avg_ts = 0.0
        avg_val = 0.0
        count = next_end - next_start
        if count > 0:
            for j in range(next_start, next_end):
                avg_ts += timestamps[j]
                avg_val += values[j]
            avg_ts /= count
            avg_val /= count
        else:
            avg_ts = timestamps[-1]
            avg_val = values[-1]

        # Find the point in the current bucket that forms the largest triangle
        max_area = -1.0
        max_idx = bucket_start

        point_a_ts = timestamps[a_idx]
        point_a_val = values[a_idx]

        for j in range(bucket_start, bucket_end):
            area = abs(
                (point_a_ts - avg_ts) * (values[j] - point_a_val)
                - (point_a_ts - timestamps[j]) * (avg_val - point_a_val)
            )
            if area > max_area:
                max_area = area
                max_idx = j

        out_ts.append(timestamps[max_idx])
        out_val.append(values[max_idx])
        a_idx = max_idx

    # Always keep the last point
    out_ts.append(timestamps[-1])
    out_val.append(values[-1])

    return out_ts, out_val
