"""Signature extraction: FFT, STFT, envelope analysis.

These operate on high-rate signals (acoustic, vibration, coil current)
and return frequency-domain representations for the Signatures Lab screen.
"""

from __future__ import annotations

import numpy as np
from scipy import signal as sp_signal


def compute_fft(
    data: np.ndarray,
    sample_rate: int,
    n_fft: int | None = None,
) -> dict:
    """Compute single-sided FFT magnitude spectrum.

    Returns dict with 'frequencies' and 'magnitudes' arrays.
    """
    if n_fft is None:
        n_fft = len(data)
    n_fft = min(n_fft, len(data))

    windowed = data[:n_fft] * np.hanning(n_fft)
    fft_vals = np.fft.rfft(windowed)
    magnitudes = 2.0 / n_fft * np.abs(fft_vals)
    frequencies = np.fft.rfftfreq(n_fft, d=1.0 / sample_rate)

    return {
        "frequencies": frequencies.tolist(),
        "magnitudes": magnitudes.tolist(),
    }


def compute_stft(
    data: np.ndarray,
    sample_rate: int,
    nperseg: int = 256,
    noverlap: int | None = None,
) -> dict:
    """Compute Short-Time Fourier Transform (spectrogram).

    Returns dict with 'times', 'frequencies', and 'power' (2D).
    """
    if noverlap is None:
        noverlap = nperseg // 2

    f, t, Zxx = sp_signal.stft(
        data,
        fs=sample_rate,
        nperseg=nperseg,
        noverlap=noverlap,
        window="hann",
    )
    power = np.abs(Zxx) ** 2

    # Downsample for API response if too large
    max_time_bins = 200
    max_freq_bins = 128
    if power.shape[1] > max_time_bins:
        step_t = power.shape[1] // max_time_bins
        power = power[:, ::step_t]
        t = t[::step_t]
    if power.shape[0] > max_freq_bins:
        step_f = power.shape[0] // max_freq_bins
        power = power[::step_f, :]
        f = f[::step_f]

    return {
        "times": t.tolist(),
        "frequencies": f.tolist(),
        "power": power.tolist(),
    }


def compute_envelope(
    data: np.ndarray,
    sample_rate: int,
    lowcut: float = 100.0,
) -> dict:
    """Compute envelope spectrum via Hilbert transform.

    Useful for detecting bearing faults and modulation patterns.
    Returns dict with 'frequencies' and 'magnitudes'.
    """
    from scipy.signal import hilbert

    analytic = hilbert(data)
    envelope = np.abs(analytic)

    # Remove DC from envelope
    envelope -= envelope.mean()

    # FFT of envelope
    return compute_fft(envelope, sample_rate)


def compute_order_spectrum(
    data: np.ndarray,
    sample_rate: int,
    rpm: float,
) -> dict:
    """Compute order spectrum (frequency normalised to engine orders).

    Order 1 = once per revolution, Order 2 = twice per revolution, etc.
    """
    fft_result = compute_fft(data, sample_rate)
    freq_arr = np.array(fft_result["frequencies"])
    mag_arr = np.array(fft_result["magnitudes"])

    rev_per_sec = rpm / 60.0
    if rev_per_sec > 0:
        orders = freq_arr / rev_per_sec
    else:
        orders = freq_arr

    return {
        "orders": orders.tolist(),
        "magnitudes": mag_arr.tolist(),
    }
