import json
from datetime import datetime, timezone

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.session import Base
from app.models.audit_log import AuditLog
from app.models.device import Device
from app.models.discovery import DiscoveryObservation, DiscoveryScan, DiscoverySchedule
from app.models.site import Site
from app.models.topology_group import TopologyGroup
from app.schemas.discovery import DiscoveryHost
from app.services.discovery.scheduled import create_observations_for_scan
from app.services.discovery.scanner import serialize_results


def _session():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(
        engine,
        tables=[
            Site.__table__,
            TopologyGroup.__table__,
            Device.__table__,
            DiscoverySchedule.__table__,
            DiscoveryScan.__table__,
            DiscoveryObservation.__table__,
            AuditLog.__table__,
        ],
    )
    return sessionmaker(bind=engine, autoflush=False, autocommit=False)()


def _scan(*hosts: DiscoveryHost, schedule_id: int | None = None) -> DiscoveryScan:
    return DiscoveryScan(
        actor_user_id=1,
        schedule_id=schedule_id,
        target="192.168.1.0/24",
        scan_type="ping",
        status="completed",
        host_count=254,
        result_count=len(hosts),
        results_json=serialize_results(list(hosts)),
        completed_at=datetime.now(timezone.utc),
    )


def _schedule() -> DiscoverySchedule:
    now = datetime.now(timezone.utc)
    return DiscoverySchedule(
        owner_user_id=1,
        name="Daily LAN",
        target="192.168.1.0/24",
        scan_type="ping",
        interval_minutes=1440,
        confirm_large_scan=True,
        enabled=True,
        created_at=now,
        updated_at=now,
    )


def test_scheduled_discovery_auto_applies_mac_matched_ip_change():
    db = _session()
    existing = Device(
        hostname="wifi-phone",
        ip_address="192.168.1.10",
        mac_address="aa:bb:cc:dd:ee:ff",
        vendor="PhoneVendor",
        status="online",
    )
    schedule = _schedule()
    scan = _scan(
        DiscoveryHost(ip_address="192.168.1.84", hostname="wifi-phone", mac_address="AA-BB-CC-DD-EE-FF"),
        DiscoveryHost(ip_address="192.168.1.50", hostname="new-host", mac_address="11:22:33:44:55:66"),
    )
    db.add_all([existing, schedule, scan])
    db.commit()
    db.refresh(schedule)
    db.refresh(scan)
    device_id = existing.id

    observations = create_observations_for_scan(db, schedule, scan, None)

    # MAC-matched IP move is auto-applied — no ip_change observation created
    types = {observation.observation_type for observation in observations}
    assert "ip_change" not in types
    assert "new_device" in types
    # Device IP is updated in the database
    db.expire_all()
    updated = db.get(Device, device_id)
    assert updated.ip_address == "192.168.1.84"


def test_scheduled_discovery_ip_conflict_creates_observation():
    db = _session()
    existing = Device(
        hostname="wifi-phone",
        ip_address="192.168.1.10",
        mac_address="aa:bb:cc:dd:ee:ff",
        status="online",
    )
    # Another device already holds the IP the scan found
    blocker = Device(
        hostname="other-device",
        ip_address="192.168.1.84",
        status="online",
    )
    schedule = _schedule()
    scan = _scan(
        DiscoveryHost(ip_address="192.168.1.84", hostname="wifi-phone", mac_address="AA-BB-CC-DD-EE-FF"),
    )
    db.add_all([existing, blocker, schedule, scan])
    db.commit()
    db.refresh(schedule)
    db.refresh(scan)

    observations = create_observations_for_scan(db, schedule, scan, None)

    types = {observation.observation_type for observation in observations}
    assert "ip_change" in types
    ip_change = next(o for o in observations if o.observation_type == "ip_change")
    assert ip_change.device_id == existing.id
    assert ip_change.ip_address == "192.168.1.84"


def test_scheduled_discovery_waits_before_recording_disappeared_host():
    db = _session()
    schedule = _schedule()
    db.add(schedule)
    db.commit()
    db.refresh(schedule)
    previous = _scan(
        DiscoveryHost(ip_address="192.168.1.10", hostname="old-host", mac_address="aa:bb:cc:dd:ee:ff"),
        DiscoveryHost(ip_address="192.168.1.20", hostname="stable-host", mac_address="11:22:33:44:55:66"),
        schedule_id=schedule.id,
    )
    current = _scan(
        DiscoveryHost(ip_address="192.168.1.20", hostname="stable-host", mac_address="11:22:33:44:55:66"),
        schedule_id=schedule.id,
    )
    db.add_all([previous, current])
    db.commit()
    db.refresh(previous)
    db.refresh(current)

    observations = create_observations_for_scan(db, schedule, current, previous)

    disappeared = [observation for observation in observations if observation.observation_type == "disappeared"]
    assert disappeared == []


def test_scheduled_discovery_records_disappeared_after_three_missed_scans():
    db = _session()
    schedule = _schedule()
    db.add(schedule)
    db.commit()
    db.refresh(schedule)
    baseline = _scan(
        DiscoveryHost(ip_address="192.168.1.10", hostname="old-host", mac_address="aa:bb:cc:dd:ee:ff"),
        DiscoveryHost(ip_address="192.168.1.20", hostname="stable-host", mac_address="11:22:33:44:55:66"),
        schedule_id=schedule.id,
    )
    miss_one = _scan(
        DiscoveryHost(ip_address="192.168.1.20", hostname="stable-host", mac_address="11:22:33:44:55:66"),
        schedule_id=schedule.id,
    )
    miss_two = _scan(
        DiscoveryHost(ip_address="192.168.1.20", hostname="stable-host", mac_address="11:22:33:44:55:66"),
        schedule_id=schedule.id,
    )
    miss_three = _scan(
        DiscoveryHost(ip_address="192.168.1.20", hostname="stable-host", mac_address="11:22:33:44:55:66"),
        schedule_id=schedule.id,
    )
    db.add_all([baseline, miss_one, miss_two, miss_three])
    db.commit()
    db.refresh(miss_two)
    db.refresh(miss_three)

    observations = create_observations_for_scan(db, schedule, miss_three, miss_two)

    disappeared = [observation for observation in observations if observation.observation_type == "disappeared"]
    assert len(disappeared) == 1
    assert disappeared[0].ip_address == "192.168.1.10"
    details = json.loads(disappeared[0].details_json)
    assert details["previous_scan_id"] == baseline.id
    assert details["missed_scans"] == 3
