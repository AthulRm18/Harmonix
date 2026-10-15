# EngineSense – Model Documentation

> Formulas, architectures, and training procedures for all models.

## 1. Feature Engineering

### Time-Domain Features (per window)
- **RMS**: Root mean square amplitude
- **Peak**: Maximum absolute amplitude
- **Crest Factor**: Peak / RMS
- **Kurtosis**: 4th standardised moment (impulse sensitivity)
- **Skewness**: 3rd standardised moment
- **Zero-Crossing Rate**: transitions per second

### Frequency-Domain Features (per window)
- **Band Energies**: configurable bands, including knock band (bore-dependent, typically 6–8 kHz)
- **Spectral Centroid**: amplitude-weighted mean frequency
- **Spectral Spread**: amplitude-weighted std of frequency
- **Spectral Roll-off**: frequency below which 85% of energy lies
- **Spectral Flatness**: geometric mean / arithmetic mean of spectrum (tonality measure)
- **Harmonic Ratios**: energy at firing harmonics vs total
- **Sub-harmonic Energy**: energy at half-order harmonics (misfire indicator)

### Electrical Features
- **Coil Current Peak**: maximum current in the charge pulse
- **Charge Time**: duration from charge start to peak
- **Dwell**: total energisation time

### Per-Cylinder Features
- **Crank-angle-resolved vibration energy**: energy in crank windows centred on each cylinder's TDC

## 2. Operating-Condition Normalisation

Features are normalised by operating condition (RPM, load, temperature) to remove normal variation:

```
residual(x) = x - E[x | RPM, load, temp]
```

E[x | condition] is learned from healthy runs using gradient boosting regression.

## 3. Anomaly Detection

### Isolation Forest
- Trained on healthy data features only
- Contamination parameter: 0.01 (calibrated on healthy validation set)
- Threshold: set at 95th percentile of healthy validation anomaly scores

### Autoencoder
- Architecture: encoder [N_features → 64 → 32 → 16], decoder [16 → 32 → 64 → N_features]
- Loss: MSE reconstruction error
- Threshold: mean + 3σ of healthy validation reconstruction errors

Anomaly score = ensemble average of normalised IF score and autoencoder reconstruction error.

## 4. Fault Classifiers

### Classes
`normal`, `knock`, `misfire`, `valve_wear`, `ignition_fault`, `unknown/anomalous`

### SVM (Support Vector Machine)
- Kernel: RBF
- Input: engineered features (condition-normalised)
- Probability calibration: Platt scaling
- Class imbalance: class weights inversely proportional to frequency
- Output: Softmax-like calibrated probabilities

### ANN (Artificial Neural Network / MLP)
- Architecture: [N_features → 128 → 64 → 32 → N_classes]
- Activation: ReLU hidden, **Softmax** output
- Loss: Cross-entropy with class weights
- Regularisation: dropout 0.3, weight decay 1e-4
- Output: Softmax probabilities

### CNN (Convolutional Neural Network)
- Input: mel spectrogram (128 × T) + telemetry branch (N_telemetry × T)
- Architecture:
  - Spectrogram branch: Conv2D(1→32, 3×3) → BN → ReLU → Pool → Conv2D(32→64, 3×3) → BN → ReLU → Pool → Flatten
  - Telemetry branch: Conv1D(N→32, 5) → BN → ReLU → Pool → Conv1D(32→64, 3) → BN → ReLU → Pool → Flatten
  - Fusion: Concat → Dense(256) → ReLU → Dropout → Dense(N_classes) → **Softmax**
- Loss: Focal loss (γ=2) for class imbalance
- Output: Softmax probabilities

### Evaluation
- Identical train/val/test splits (by run, not by window)
- Metrics: per-class P/R/F1, macro-F1, confusion matrix
- Robustness: SNR sweep, unseen RPM/load ranges

## 5. Onset Detection

- CUSUM on anomaly score time series
- `ruptures` change-point detection (Pelt, RBF kernel) on health index
- Report: detected onset time, ground truth onset (for synthetic), detection latency

## 6. Prognosis

### Health Index HI(t)
- Fused from condition-normalised features using learned weights
- Normalised to [0, 1]: 1 = healthy, 0 = failure

### RUL (Remaining Useful Life)
- **Primary (explainable)**: Linear/exponential degradation trend fit on HI(t) history
  - Extrapolate to failure threshold (HI = 0.2)
  - Confidence interval from fit uncertainty + historical variance
- **Secondary (benchmark)**: GRU or 1D-CNN trained on synthetic run-to-failure data and C-MAPSS
  - Output: point estimate + MC-dropout uncertainty

### Failure Probability
- P(failure within horizon H) = CDF of RUL distribution at H
- Displayed as a gauge with configurable H (default: 100 hours)

## 7. Performance Features

### Engine Performance Index (EPI)
```
EPI = w_eff × η_norm + w_power × P_norm + w_comb × CQ_norm
```
Where:
- η_norm = normalised fuel efficiency proxy (from MAF, lambda)
- P_norm = normalised power proxy (from load, RPM, airflow)
- CQ_norm = normalised combustion quality (1 - CoV_IMEP_proxy - misfire_rate)
- Default weights: w_eff = 0.4, w_power = 0.3, w_comb = 0.3

### Fault-Risk-Adjusted Performance (FRAP)
```
FRAP = EPI × (1 - α × anomaly_score) × (1 - β × wear_rate)
```
Where:
- α = 0.5 (anomaly penalty weight)
- β = 0.3 (wear penalty weight)
- anomaly_score ∈ [0, 1]
- wear_rate = -dHI/dt (normalised)

## 8. Optimiser

### Surrogate Model
- Gradient boosting (XGBoost or LightGBM) mapping:
  - Inputs: RPM band, throttle/load, ignition advance, target lambda, coolant setpoint
  - Outputs: EPI, knock probability, wear rate, EGT proxy
- Trained on simulator sweeps + real-data-derived relationships
- Validated via cross-validation on held-out sweeps

### Multi-Objective Optimisation
- Algorithm: NSGA-II (via pymoo) or Optuna multi-objective
- Objectives: maximise EPI, minimise wear rate
- Constraints: knock probability < threshold, temperatures within limits
- Output: Pareto front + recommended sweet spot region
- The sweet spot is a region (not a point), reported with uncertainty bounds
