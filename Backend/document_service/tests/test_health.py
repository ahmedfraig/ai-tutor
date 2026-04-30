"""
tests/test_health.py
"""
import pytest


def test_liveness(client):
    r = client.get("/health")
    assert r.status_code == 200
    data = r.json()
    assert data["status"] in ("ok", "loading", "ready")
    assert "version" in data
    assert "device" in data


def test_readiness_returns_valid_status(client):
    r = client.get("/health/ready")
    # 200 (ready) or 503 (still loading) are both valid
    assert r.status_code in (200, 503)
    data = r.json()
    assert data["status"] in ("ready", "loading")
