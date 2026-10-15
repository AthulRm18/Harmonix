"""Integration tests for FastAPI endpoints."""

from fastapi.testclient import TestClient
import pytest

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

