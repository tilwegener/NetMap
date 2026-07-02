"""Checks for the 2026-07-02 feature batch: pause/lifecycle, HTTP checks,
next-available-IP, reservation expiry, webhook provider, flapping badge."""
from datetime import datetime, timedelta, timezone
from http.server import BaseHTTPRequestHandler, HTTPServer
import threading

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.v1.ipam import next_available_ip
from app.api.v1.monitoring import _build_device_summaries
from app.db.session import Base
from app.models.device import Device
from app.models.dhcp_lease import DhcpLease
from app.models.ip_reservation import IpReservation
from app.models.monitor_history import DeviceMonitorHistory
from app.models.site import Site
from app.models.subnet import Subnet
from app.models.topology_group import TopologyGroup
from app.services.monitoring.port_checker import check_port
from app.services.notifications import _send_webhook


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
            DeviceMonitorHistory.__table__,
            Subnet.__table__,
            IpReservation.__table__,
            DhcpLease.__table__,
        ],
    )
    return sessionmaker(bind=engine, autoflush=False, autocommit=False)()


class _Handler(BaseHTTPRequestHandler):
    def do_GET(self):  # noqa: N802
        code = 404 if self.path == "/missing" else 500 if self.path == "/broken" else 200
        self.send_response(code)
        self.send_header("Content-Length", "2")
        self.end_headers()
        self.wfile.write(b"ok")

    def do_POST(self):  # noqa: N802
        self.send_response(200)
        self.send_header("Content-Length", "2")
        self.end_headers()
        self.wfile.write(b"ok")

    def log_message(self, *args):  # silence test output
        pass


def _http_server():
    server = HTTPServer(("127.0.0.1", 0), _Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    return server


def test_http_check_up_down_and_error_statuses():
    server = _http_server()
    port = server.server_address[1]
    try:
        assert check_port("127.0.0.1", port, 3.0, protocol="http") is True
        # 404 means the HTTP service answered — up
        assert check_port("127.0.0.1", port, 3.0, protocol="http", http_path="/missing") is True
        # 5xx means the service is erroring — down
        assert check_port("127.0.0.1", port, 3.0, protocol="http", http_path="/broken") is False
    finally:
        server.shutdown()
    # closed port — down
    assert check_port("127.0.0.1", port, 0.5, protocol="http") is False


def test_webhook_provider_posts_json():
    server = _http_server()
    port = server.server_address[1]
    try:
        result = _send_webhook("hello", {"webhook_url": f"http://127.0.0.1:{port}/hook"})
        assert result == "ok"
    finally:
        server.shutdown()
    assert _send_webhook("hello", {}) == "Webhook URL is required"


def test_next_available_ip_skips_used_gateway_and_dhcp_pool():
    db = _session()
    now = datetime.now(timezone.utc)
    subnet = Subnet(
        name="lan", cidr="192.168.1.0/29", gateway="192.168.1.1",
        dhcp_start="192.168.1.2", dhcp_end="192.168.1.3",
        created_at=now, updated_at=now,
    )
    db.add(subnet)
    db.add(Device(ip_address="192.168.1.4", status="online"))
    db.add(IpReservation(ip_address="192.168.1.5", label="printer", created_at=now, updated_at=now))
    db.commit()
    # .1 gateway, .2-.3 DHCP pool, .4 device, .5 reserved → first free is .6
    result = next_available_ip(subnet.id, None, db)
    assert result == {"ip": "192.168.1.6"}


def test_monitor_summaries_flag_paused_and_flapping():
    db = _session()
    now = datetime.now(timezone.utc)
    paused = Device(ip_address="10.0.0.1", status="online", monitor_status="online", monitoring_paused=True)
    retired = Device(ip_address="10.0.0.2", status="online", monitor_status="offline", lifecycle="retired")
    flappy = Device(ip_address="10.0.0.3", status="online", monitor_status="online")
    db.add_all([paused, retired, flappy])
    db.commit()
    statuses = ["online", "offline", "online", "offline", "online", "offline"]
    for i, status in enumerate(statuses):
        db.add(DeviceMonitorHistory(
            device_id=flappy.id,
            checked_at=now - timedelta(minutes=50 - i * 8),
            status=status,
            rtt_ms=1.0,
            port_results="[]",
        ))
    db.commit()

    summaries = {s.ip_address: s for s in _build_device_summaries(db, [paused, retired, flappy])}
    assert summaries["10.0.0.1"].status == "paused"
    assert summaries["10.0.0.2"].status == "paused"
    assert summaries["10.0.0.3"].flapping is True
    assert summaries["10.0.0.1"].flapping is False
