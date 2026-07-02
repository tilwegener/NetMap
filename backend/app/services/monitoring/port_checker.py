from __future__ import annotations

import socket
import ssl
import urllib.error
import urllib.request
from ipaddress import ip_address


def check_port(host: str, port: int, timeout: float = 2.0, *, protocol: str = "tcp", http_path: str | None = None) -> bool:
    if protocol == "udp":
        return _check_udp(host, port, timeout)
    if protocol in ("http", "https"):
        return _check_http(host, port, timeout, protocol, http_path or "/")
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except OSError:
        return False


def _check_http(host: str, port: int, timeout: float, scheme: str, path: str) -> bool:
    host_part = f"[{host}]" if ":" in host else host
    url = f"{scheme}://{host_part}:{port}{path}"
    # ponytail: TLS is deliberately unverified — this is a reachability/health check
    # against LAN devices where self-signed certs are the norm, not a security check.
    context = ssl._create_unverified_context() if scheme == "https" else None
    request = urllib.request.Request(url, method="GET", headers={"User-Agent": "NetMap-Monitor"})
    try:
        with urllib.request.urlopen(request, timeout=timeout, context=context) as response:
            return response.status < 500
    except urllib.error.HTTPError as exc:
        # 401/403/404 etc. mean the HTTP service answered — it is up
        return exc.code < 500
    except (urllib.error.URLError, OSError, ValueError):
        return False


def _check_udp(host: str, port: int, timeout: float) -> bool:
    try:
        family = socket.AF_INET6 if ip_address(host).version == 6 else socket.AF_INET
    except ValueError:
        family = socket.AF_INET
    sock = socket.socket(family, socket.SOCK_DGRAM)
    sock.settimeout(timeout)
    try:
        sock.sendto(b"\x00", (host, port))
        sock.recvfrom(1024)
        return True
    except socket.timeout:
        return False
    except ConnectionRefusedError:
        return False
    except OSError:
        return False
    finally:
        sock.close()
