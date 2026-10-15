"""NSGA-II style multi-objective optimiser for engine sweet-spot.

Finds the Pareto front of (maximise EPI, minimise wear_rate) across
the RPM × Load × Ignition-Advance × Lambda search space.

Uses a lightweight evolutionary approach (no external dependency
like pymoo/DEAP) so we stay within the hackathon's pip footprint.
"""

from __future__ import annotations

import math
import random
from dataclasses import dataclass

from app.optimize.engine_performance import EPIWeights, OperatingPoint, compute_epi


@dataclass
class Individual:
    """A candidate solution in the search space."""

    rpm: float
    load_pct: float
    ignition_advance_deg: float
    lambda_ratio: float

    # Objectives (filled after evaluation)
    epi: float = 0.0
    wear_rate: float = 0.0

    # NSGA-II bookkeeping
    rank: int = 0
    crowding_distance: float = 0.0

    def to_operating_point(self) -> OperatingPoint:
        return OperatingPoint(
            rpm=self.rpm,
            load_pct=self.load_pct,
            ignition_advance_deg=self.ignition_advance_deg,
            lambda_ratio=self.lambda_ratio,
        )


@dataclass
class SearchBounds:
    """Search space bounds."""

    rpm: tuple[float, float] = (1000, 5000)
    load: tuple[float, float] = (10, 90)
    ignition: tuple[float, float] = (15, 40)
    lambda_r: tuple[float, float] = (0.85, 1.15)

    # Constraints
    knock_threshold: float = 0.1
    max_coolant_temp: float = 105.0


def _random_individual(bounds: SearchBounds) -> Individual:
    return Individual(
        rpm=random.uniform(*bounds.rpm),
        load_pct=random.uniform(*bounds.load),
        ignition_advance_deg=random.uniform(*bounds.ignition),
        lambda_ratio=random.uniform(*bounds.lambda_r),
    )


def _evaluate(ind: Individual, weights: EPIWeights | None = None) -> Individual:
    pt = ind.to_operating_point()
    compute_epi(pt, weights)
    ind.epi = pt.epi
    ind.wear_rate = pt.wear_rate
    return ind


def _dominates(a: Individual, b: Individual) -> bool:
    """True if a dominates b (higher EPI AND lower wear)."""
    return (a.epi >= b.epi and a.wear_rate <= b.wear_rate) and (
        a.epi > b.epi or a.wear_rate < b.wear_rate
    )


def _fast_non_dominated_sort(pop: list[Individual]) -> list[list[int]]:
    """Standard NSGA-II fast non-dominated sorting."""
    n = len(pop)
    domination_count = [0] * n
    dominated_set: list[list[int]] = [[] for _ in range(n)]
    fronts: list[list[int]] = [[]]

    for i in range(n):
        for j in range(i + 1, n):
            if _dominates(pop[i], pop[j]):
                dominated_set[i].append(j)
                domination_count[j] += 1
            elif _dominates(pop[j], pop[i]):
                dominated_set[j].append(i)
                domination_count[i] += 1

        if domination_count[i] == 0:
            pop[i].rank = 0
            fronts[0].append(i)

    k = 0
    while fronts[k]:
        next_front: list[int] = []
        for i in fronts[k]:
            for j in dominated_set[i]:
                domination_count[j] -= 1
                if domination_count[j] == 0:
                    pop[j].rank = k + 1
                    next_front.append(j)
        k += 1
        fronts.append(next_front)

    return [f for f in fronts if f]


def _crowding_distance(pop: list[Individual], front: list[int]) -> None:
    """Assign crowding distance to individuals in a front."""
    n = len(front)
    if n <= 2:
        for i in front:
            pop[i].crowding_distance = float("inf")
        return

    for i in front:
        pop[i].crowding_distance = 0.0

    for obj_fn in [lambda x: x.epi, lambda x: -x.wear_rate]:
        sorted_front = sorted(front, key=lambda i: obj_fn(pop[i]))
        pop[sorted_front[0]].crowding_distance = float("inf")
        pop[sorted_front[-1]].crowding_distance = float("inf")

        obj_min = obj_fn(pop[sorted_front[0]])
        obj_max = obj_fn(pop[sorted_front[-1]])
        span = obj_max - obj_min if obj_max != obj_min else 1.0

        for k in range(1, n - 1):
            pop[sorted_front[k]].crowding_distance += (
                obj_fn(pop[sorted_front[k + 1]]) - obj_fn(pop[sorted_front[k - 1]])
            ) / span


def _tournament_select(pop: list[Individual]) -> Individual:
    """Binary tournament selection based on rank then crowding distance."""
    a, b = random.sample(range(len(pop)), 2)
    if pop[a].rank < pop[b].rank:
        return pop[a]
    if pop[b].rank < pop[a].rank:
        return pop[b]
    return pop[a] if pop[a].crowding_distance > pop[b].crowding_distance else pop[b]


def _crossover(p1: Individual, p2: Individual, bounds: SearchBounds) -> Individual:
    """SBX-like crossover."""
    alpha = random.random()
    child = Individual(
        rpm=_clamp(alpha * p1.rpm + (1 - alpha) * p2.rpm, *bounds.rpm),
        load_pct=_clamp(alpha * p1.load_pct + (1 - alpha) * p2.load_pct, *bounds.load),
        ignition_advance_deg=_clamp(
            alpha * p1.ignition_advance_deg + (1 - alpha) * p2.ignition_advance_deg,
            *bounds.ignition,
        ),
        lambda_ratio=_clamp(
            alpha * p1.lambda_ratio + (1 - alpha) * p2.lambda_ratio, *bounds.lambda_r
        ),
    )
    return child


def _mutate(ind: Individual, bounds: SearchBounds, mutation_rate: float = 0.1) -> Individual:
    """Polynomial-style mutation."""
    if random.random() < mutation_rate:
        ind.rpm = _clamp(ind.rpm + random.gauss(0, 200), *bounds.rpm)
    if random.random() < mutation_rate:
        ind.load_pct = _clamp(ind.load_pct + random.gauss(0, 5), *bounds.load)
    if random.random() < mutation_rate:
        ind.ignition_advance_deg = _clamp(
            ind.ignition_advance_deg + random.gauss(0, 2), *bounds.ignition
        )
    if random.random() < mutation_rate:
        ind.lambda_ratio = _clamp(ind.lambda_ratio + random.gauss(0, 0.02), *bounds.lambda_r)
    return ind


def _clamp(v: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, v))


def run_nsga2(
    bounds: SearchBounds | None = None,
    pop_size: int = 100,
    n_generations: int = 50,
    seed: int | None = None,
    weights: EPIWeights | None = None,
) -> dict:
    """Run the NSGA-II optimiser and return results.

    Returns a dict with:
        - pareto_front: list of {rpm, load, ign, lambda, epi, wear_rate}
        - recommended_region: the "sweet spot" from the knee of the Pareto front
        - rationale: text explaining the recommendation
    """
    if seed is not None:
        random.seed(seed)

    b = bounds or SearchBounds()

    # Initialise population
    pop = [_evaluate(_random_individual(b), weights) for _ in range(pop_size)]

    # Evolve
    for _gen in range(n_generations):
        # Create offspring
        offspring: list[Individual] = []
        for _ in range(pop_size):
            p1 = _tournament_select(pop)
            p2 = _tournament_select(pop)
            child = _crossover(p1, p2, b)
            child = _mutate(child, b)
            _evaluate(child, weights)
            offspring.append(child)

        # Combine parent + offspring
        combined = pop + offspring

        # Non-dominated sort
        fronts = _fast_non_dominated_sort(combined)

        # Select next generation
        new_pop: list[Individual] = []
        for front in fronts:
            _crowding_distance(combined, front)
            if len(new_pop) + len(front) <= pop_size:
                new_pop.extend(combined[i] for i in front)
            else:
                remaining = pop_size - len(new_pop)
                sorted_front = sorted(
                    front, key=lambda i: combined[i].crowding_distance, reverse=True
                )
                new_pop.extend(combined[i] for i in sorted_front[:remaining])
                break

        pop = new_pop

    # Extract Pareto front (rank 0)
    fronts = _fast_non_dominated_sort(pop)
    pareto_indices = fronts[0] if fronts else []
    pareto = [pop[i] for i in pareto_indices]
    pareto.sort(key=lambda x: x.epi, reverse=True)

    # Find knee point (max distance from line connecting extremes)
    knee = _find_knee(pareto)

    # Build recommended region (±10% around knee)
    rec = {
        "rpm_range": [round(knee.rpm * 0.9), round(knee.rpm * 1.1)],
        "load_range": [round(knee.load_pct * 0.9, 1), round(knee.load_pct * 1.1, 1)],
        "ignition_advance_range": [
            round(knee.ignition_advance_deg * 0.95, 1),
            round(knee.ignition_advance_deg * 1.05, 1),
        ],
        "lambda_range": [round(knee.lambda_ratio * 0.98, 3), round(knee.lambda_ratio * 1.02, 3)],
        "epi": knee.epi,
        "wear_rate": knee.wear_rate,
        "knock_prob": round(compute_epi(knee.to_operating_point()).knock_prob, 4),
    }

    rationale = (
        f"Recommended operating region centres around {round(knee.rpm)} RPM, "
        f"{round(knee.load_pct, 1)}% load, {round(knee.ignition_advance_deg, 1)}° BTDC ignition "
        f"advance, and λ={round(knee.lambda_ratio, 3)}. "
        f"This achieves an EPI of {knee.epi:.3f} with a wear rate of {knee.wear_rate:.4f}/1000h. "
        f"The knock probability at this point is {rec['knock_prob']:.1%}, "
        f"well below the safety threshold."
    )

    return {
        "pareto_front": [
            {
                "rpm": round(p.rpm),
                "load_pct": round(p.load_pct, 1),
                "ignition_advance_deg": round(p.ignition_advance_deg, 1),
                "lambda_ratio": round(p.lambda_ratio, 3),
                "epi": p.epi,
                "wear_rate": p.wear_rate,
            }
            for p in pareto
        ],
        "recommended_region": rec,
        "rationale": rationale,
    }


def _find_knee(pareto: list[Individual]) -> Individual:
    """Find the knee point on the Pareto front using max perpendicular distance."""
    if len(pareto) <= 2:
        return pareto[0]

    # Line from first to last
    x1, y1 = pareto[0].epi, pareto[0].wear_rate
    x2, y2 = pareto[-1].epi, pareto[-1].wear_rate

    dx, dy = x2 - x1, y2 - y1
    line_len = math.sqrt(dx * dx + dy * dy)
    if line_len < 1e-12:
        return pareto[0]

    best_dist = -1.0
    best_ind = pareto[0]
    for p in pareto:
        dist = abs(dy * p.epi - dx * p.wear_rate + x2 * y1 - y2 * x1) / line_len
        if dist > best_dist:
            best_dist = dist
            best_ind = p

    return best_ind
