"""Integration tests for FastAPI endpoints."""

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] in ("healthy", "ok")
    assert "version" in data


def test_sensors_endpoint():
    response = client.get("/sensors")
    assert response.status_code == 200
    data = response.json()
    assert "sensors" in data
    assert len(data["sensors"]) > 0


def test_list_runs_endpoint():
    response = client.get("/runs")
    assert response.status_code == 200
    data = response.json()
    assert "runs" in data
    assert "total" in data


def test_optimize_grid_endpoint():
    response = client.get("/optimize/grid/epi?steps=5")
    assert response.status_code == 200
    data = response.json()
    assert "grid" in data
    assert len(data["grid"]) == 25


def test_optimize_run_endpoint():
    response = client.post("/optimize", json={"pop_size": 10, "n_generations": 5})
    assert response.status_code == 200
    data = response.json()
    assert "recommended_region" in data
    assert "pareto_front" in data


def test_sensor_intelligence_failure_modes_endpoint():
    response = client.get("/sensors/intelligence/failure-modes")
    assert response.status_code == 200
    data = response.json()
    assert "catalog" in data
    assert len(data["catalog"]) >= 6
    # verify surrogate sensor is specified
    first = data["catalog"][0]
    assert "surrogate_sensor" in first
    assert "surrogate_method" in first
    assert "ecu_fallback" in first
    assert "engine_impact" in first


def test_sensor_intelligence_correlations_and_extremes_endpoint():
    runs_res = client.get("/runs")
    assert runs_res.status_code == 200
    runs = runs_res.json().get("runs", [])
    if runs:
        run_id = runs[0]["id"]
        # test correlations
        corr_res = client.get(f"/sensors/intelligence/correlations/{run_id}")
        assert corr_res.status_code == 200
        corr_data = corr_res.json()
        assert "matrix" in corr_data
        assert "sensors" in corr_data

        # test extremes and arbiter
        ext_res = client.get(f"/sensors/intelligence/extremes/{run_id}?time_s=50.0")
        assert ext_res.status_code == 200
        ext_data = ext_res.json()
        assert "sensors" in ext_data
        assert "arbiter" in ext_data
        assert "verdict" in ext_data["arbiter"]
