"""Feature extraction from windowed sensor data.

Extracts time-domain and frequency-domain features from each window
for use by the ML classifiers.
"""

from __future__ import annotations

import numpy as np
from scipy import stats as sp_stats


def extract_time_features(values: np.ndarray) -> dict[str, float]:
    """Extract time-domain statistical features from a signal window."""
    if len(values) == 0:
        return {}
    return {
        "mean": float(np.mean(values)),
        "std": float(np.std(values)),
        "rms": float(np.sqrt(np.mean(values**2))),
        "peak": float(np.max(np.abs(values))),
        "crest_factor": float(np.max(np.abs(values)) / max(np.sqrt(np.mean(values**2)), 1e-12)),
        "skewness": float(sp_stats.skew(values)),
        "kurtosis": float(sp_stats.kurtosis(values)),
        "peak_to_peak": float(np.ptp(values)),
    }


def extract_freq_features(values: np.ndarray, sample_rate: int) -> dict[str, float]:
    """Extract frequency-domain features from a signal window."""
    if len(values) < 4:
        return {}

    n = len(values)
    windowed = values * np.hanning(n)
    fft_mag = np.abs(np.fft.rfft(windowed))
    freqs = np.fft.rfftfreq(n, d=1.0 / sample_rate)

    # Skip DC
    fft_mag = fft_mag[1:]
    freqs = freqs[1:]

    if len(fft_mag) == 0 or fft_mag.sum() < 1e-12:
        return {}

    # Spectral features
    total_power = np.sum(fft_mag**2)
    spectral_centroid = np.sum(freqs * fft_mag**2) / total_power
    spectral_spread = np.sqrt(np.sum((freqs - spectral_centroid) ** 2 * fft_mag**2) / total_power)
    peak_freq = freqs[np.argmax(fft_mag)]

    # Band energy ratios (useful for knock detection)
    low_mask = freqs < 2000
    mid_mask = (freqs >= 2000) & (freqs < 6000)
    high_mask = freqs >= 6000
    knock_mask = (freqs >= 6000) & (freqs <= 8000)

    low_energy = np.sum(fft_mag[low_mask] ** 2) / total_power if low_mask.any() else 0.0
    mid_energy = np.sum(fft_mag[mid_mask] ** 2) / total_power if mid_mask.any() else 0.0
    high_energy = np.sum(fft_mag[high_mask] ** 2) / total_power if high_mask.any() else 0.0
    knock_band_energy = np.sum(fft_mag[knock_mask] ** 2) / total_power if knock_mask.any() else 0.0

    return {
        "spectral_centroid": float(spectral_centroid),
        "spectral_spread": float(spectral_spread),
        "peak_frequency": float(peak_freq),
        "total_spectral_power": float(total_power),
        "low_band_ratio": float(low_energy),
        "mid_band_ratio": float(mid_energy),
        "high_band_ratio": float(high_energy),
        "knock_band_ratio": float(knock_band_energy),
    }


def extract_telemetry_features(
    telemetry: dict[str, np.ndarray],
    idx_start: int,
    idx_end: int,
) -> dict[str, float]:
    """Extract features from telemetry signals within a window."""
    features: dict[str, float] = {}

    key_sensors = [
        "engine_rpm",
        "throttle_position",
        "engine_load",
        "coolant_temp",
        "lambda_o2",
        "stft",
        "ltft",
        "ignition_timing_advance",
        "crank_speed_fluctuation",
        "map_kpa",
        "maf_gps",
    ]

    for sensor in key_sensors:
        if sensor in telemetry:
            window = telemetry[sensor][idx_start:idx_end]
            if len(window) > 0:
                features[f"{sensor}_mean"] = float(np.mean(window))
                features[f"{sensor}_std"] = float(np.std(window))
                features[f"{sensor}_min"] = float(np.min(window))
                features[f"{sensor}_max"] = float(np.max(window))

    return features


def extract_all_features(
    telemetry: dict[str, np.ndarray],
    high_rate: dict[str, np.ndarray] | None,
    idx_start: int,
    idx_end: int,
    hr_idx_start: int | None = None,
    hr_idx_end: int | None = None,
) -> dict[str, float]:
    """Extract all features (telemetry + high-rate) for a window."""
    features = extract_telemetry_features(telemetry, idx_start, idx_end)

    if high_rate is not None:
        # Acoustic features
        if "acoustic_mic" in high_rate and hr_idx_start is not None:
            acoustic_window = high_rate["acoustic_mic"][hr_idx_start:hr_idx_end]
            if len(acoustic_window) > 0:
                time_feats = extract_time_features(acoustic_window)
                for k, v in time_feats.items():
                    features[f"acoustic_{k}"] = v
                freq_feats = extract_freq_features(acoustic_window, 16000)
                for k, v in freq_feats.items():
                    features[f"acoustic_{k}"] = v

        # Vibration features
        if "accel_block" in high_rate and hr_idx_start is not None:
            vib_window = high_rate["accel_block"][hr_idx_start:hr_idx_end]
            if len(vib_window) > 0:
                time_feats = extract_time_features(vib_window)
                for k, v in time_feats.items():
                    features[f"vibration_{k}"] = v
                freq_feats = extract_freq_features(vib_window, 25600)
                for k, v in freq_feats.items():
                    features[f"vibration_{k}"] = v

    return features
