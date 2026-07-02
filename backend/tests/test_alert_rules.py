from datetime import datetime, timedelta, timezone

import pytest
from pydantic import ValidationError

from app.models import device, site, snmp_profile, topology_group  # noqa: F401  (mapper config)
from app.models.alert_rule import AlertRule
from app.schemas.alert import AlertRuleCreate
from app.services.alerting.service import AlertMonitorService


def _rule(**kwargs) -> AlertRule:
    defaults = dict(
        id=1,
        name="High RTT",
        enabled=True,
        event_type="rtt_above",
        device_id=None,
        channels='["profile:1"]',
        cooldown_minutes=30,
        threshold_ms=100,
        last_triggered_at=None,
    )
    defaults.update(kwargs)
    return AlertRule(**defaults)


def test_rtt_breaches_matches_only_devices_over_threshold():
    now = datetime.now(timezone.utc)
    rtt_map = {1: 250.0, 2: 50.0, 3: None}
    breaches = AlertMonitorService._rtt_breaches([_rule()], rtt_map, now)
    assert [(device_id, rtt) for _, device_id, rtt in breaches] == [(1, 250.0)]


def test_rtt_breaches_respects_device_scope_and_exact_threshold():
    now = datetime.now(timezone.utc)
    rtt_map = {1: 250.0, 2: 300.0, 3: 100.0}
    scoped = _rule(device_id=2)
    breaches = AlertMonitorService._rtt_breaches([scoped], rtt_map, now)
    assert [(device_id, rtt) for _, device_id, rtt in breaches] == [(2, 300.0)]
    # rtt exactly equal to the threshold does not fire
    exact = _rule(device_id=3)
    assert AlertMonitorService._rtt_breaches([exact], rtt_map, now) == []


def test_rtt_breaches_skips_cooldown_and_non_rtt_rules():
    now = datetime.now(timezone.utc)
    rtt_map = {1: 250.0}
    cooling = _rule(last_triggered_at=now - timedelta(minutes=5))
    offline = _rule(id=2, event_type="device_offline", threshold_ms=None)
    missing_threshold = _rule(id=3, threshold_ms=None)
    assert AlertMonitorService._rtt_breaches([cooling, offline, missing_threshold], rtt_map, now) == []
    # after the cooldown elapses the same rule fires again
    expired = _rule(last_triggered_at=now - timedelta(minutes=31))
    assert len(AlertMonitorService._rtt_breaches([expired], rtt_map, now)) == 1


def test_rtt_message_includes_rtt_and_threshold():
    message = AlertMonitorService._build_message(
        "rtt_above", "Core Router", "10.0.0.1", "online", "NetMap",
        rtt_ms=251.4, threshold_ms=100,
    )
    assert "Core Router" in message
    assert "251 ms" in message
    assert "100 ms" in message


def test_rtt_rule_schema_requires_threshold():
    with pytest.raises(ValidationError):
        AlertRuleCreate(name="High RTT", event_type="rtt_above", channels=["profile:1"])
    rule = AlertRuleCreate(name="High RTT", event_type="rtt_above", channels=["profile:1"], threshold_ms=200)
    assert rule.threshold_ms == 200
    # status rules do not need a threshold
    AlertRuleCreate(name="Offline", event_type="device_offline", channels=["profile:1"])
