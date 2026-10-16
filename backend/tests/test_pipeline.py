"""Tests for windowing, feature extraction, and signal signatures."""

import numpy as np

from app.pipeline.features import (
    extract_freq_features,
    extract_telemetry_features,
    extract_time_features,
)
from app.pipeline.signatures import (
    compute_envelope,
    compute_fft,
    compute_stft,
)
from app.pipeline.windowing import segment_windows


def test_segment_windows():
    ts = np.linspace(0, 30.0, 600)  # 20 Hz, 30 seconds
    windows = segment_windows(ts, window_size_s=5.0, hop_s=2.5)

    assert len(windows) > 5
    for t_start, t_end, idx_start, idx_end in windows:
        assert t_end > t_start
        assert idx_end > idx_start
        assert abs((t_end - t_start) - 5.0) < 0.1


def test_extract_time_features():
    signal = np.sin(np.linspace(0, 10 * np.pi, 200))
    feats = extract_time_features(signal)

    assert "mean" in feats
    assert "rms" in feats
    assert "crest_factor" in feats
    assert "kurtosis" in feats
    assert feats["rms"] > 0


def test_extract_freq_features():
    sr = 1000
    t = np.linspace(0, 1.0, sr, endpoint=False)
    signal = np.sin(2 * np.pi * 50 * t) + 0.5 * np.sin(2 * np.pi * 200 * t)
    feats = extract_freq_features(signal, sr)

    assert "spectral_centroid" in feats
    assert "peak_frequency" in feats
    assert 45 <= feats["peak_frequency"] <= 55


def test_extract_telemetry_features():
    t = np.linspace(0, 5.0, 100)
    telem = {
        "engine_rpm": 2000 + 50 * np.sin(t),
        "throttle_position": 25 + 2 * np.cos(t),
        "engine_load": 40 + np.random.randn(100),
    }
    feats = extract_telemetry_features(telem, 0, 100)
    assert "engine_rpm_mean" in feats
    assert "throttle_position_std" in feats


def test_signatures_fft_stft():
    sr = 2000
    t = np.linspace(0, 1.0, sr, endpoint=False)
    signal = np.sin(2 * np.pi * 120 * t)

    fft_res = compute_fft(signal, sr)
    assert len(fft_res["frequencies"]) == len(fft_res["magnitudes"])
    assert len(fft_res["frequencies"]) > 0

    stft_res = compute_stft(signal, sr, nperseg=128)
    assert len(stft_res["times"]) > 0
    assert len(stft_res["frequencies"]) > 0
    assert len(stft_res["power"]) > 0

    env_res = compute_envelope(signal, sr)
    assert len(env_res["frequencies"]) > 0
