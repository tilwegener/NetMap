"""OIDC provider metadata and JWKS retrieval.

Uses stdlib ``urllib`` (matching the version-check fetcher) with strict
timeouts. HTTPS is required except for loopback issuers so local development
against a compose-hosted provider still works. Discovery metadata and JWKS
are cached in-process with a short TTL; a JWKS refetch is forced when a token
arrives signed with an unknown ``kid`` (provider key rotation).
"""

from __future__ import annotations

import json
import logging
import threading
import time
import urllib.error
import urllib.parse
import urllib.request

logger = logging.getLogger(__name__)

HTTP_TIMEOUT_SECONDS = 10
CACHE_TTL_SECONDS = 300

_cache_lock = threading.Lock()
_metadata_cache: dict[str, tuple[float, dict]] = {}
_jwks_cache: dict[str, tuple[float, dict]] = {}


class OidcProviderError(Exception):
    """Provider communication or metadata validation failure.

    ``code`` is a stable machine-readable identifier safe to expose to the
    frontend; ``detail`` may contain more context for logs/diagnostics but
    must never contain secrets.
    """

    def __init__(self, code: str, detail: str) -> None:
        super().__init__(detail)
        self.code = code
        self.detail = detail


def _require_safe_url(url: str, purpose: str) -> None:
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme == "https":
        return
    if parsed.scheme == "http" and parsed.hostname in {"localhost", "127.0.0.1", "::1"}:
        return
    raise OidcProviderError(
        "insecure_provider_url",
        f"{purpose} URL must use HTTPS (got {parsed.scheme or 'no scheme'})",
    )


def _http_get_json(url: str) -> dict:
    request = urllib.request.Request(url, headers={"Accept": "application/json", "User-Agent": "NetMap"})
    try:
        with urllib.request.urlopen(request, timeout=HTTP_TIMEOUT_SECONDS) as resp:
            payload = json.loads(resp.read())
    except (urllib.error.URLError, TimeoutError, OSError) as exc:
        raise OidcProviderError("provider_unreachable", f"Unable to reach identity provider: {exc}") from exc
    except (ValueError, TypeError) as exc:
        raise OidcProviderError("provider_invalid_response", "Identity provider returned invalid JSON") from exc
    if not isinstance(payload, dict):
        raise OidcProviderError("provider_invalid_response", "Identity provider returned unexpected JSON")
    return payload


def _http_post_form(url: str, data: dict[str, str], *, basic_auth: tuple[str, str] | None = None) -> dict:
    body = urllib.parse.urlencode(data).encode("utf-8")
    headers = {
        "Accept": "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "NetMap",
    }
    if basic_auth is not None:
        import base64

        credentials = base64.b64encode(
            f"{urllib.parse.quote(basic_auth[0], safe='')}:{urllib.parse.quote(basic_auth[1], safe='')}".encode()
        ).decode()
        headers["Authorization"] = f"Basic {credentials}"
    request = urllib.request.Request(url, data=body, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(request, timeout=HTTP_TIMEOUT_SECONDS) as resp:
            payload = json.loads(resp.read())
    except urllib.error.HTTPError as exc:
        detail = "Token exchange was rejected by the identity provider"
        try:
            error_body = json.loads(exc.read())
            if isinstance(error_body, dict) and error_body.get("error"):
                detail = f"{detail} ({error_body['error']})"
        except Exception:
            pass
        raise OidcProviderError("token_exchange_failed", detail) from exc
    except (urllib.error.URLError, TimeoutError, OSError) as exc:
        raise OidcProviderError("provider_unreachable", f"Unable to reach identity provider: {exc}") from exc
    except (ValueError, TypeError) as exc:
        raise OidcProviderError("provider_invalid_response", "Identity provider returned invalid JSON") from exc
    if not isinstance(payload, dict):
        raise OidcProviderError("provider_invalid_response", "Identity provider returned unexpected JSON")
    return payload


def discovery_url(issuer: str) -> str:
    return issuer.rstrip("/") + "/.well-known/openid-configuration"


REQUIRED_METADATA_FIELDS = ("issuer", "authorization_endpoint", "token_endpoint", "jwks_uri")


def fetch_provider_metadata(issuer: str, *, force_refresh: bool = False) -> dict:
    issuer = issuer.rstrip("/")
    _require_safe_url(issuer, "Issuer")
    now = time.monotonic()
    with _cache_lock:
        cached = _metadata_cache.get(issuer)
        if cached and not force_refresh and now - cached[0] < CACHE_TTL_SECONDS:
            return cached[1]

    metadata = _http_get_json(discovery_url(issuer))
    for field_name in REQUIRED_METADATA_FIELDS:
        if not metadata.get(field_name):
            raise OidcProviderError(
                "provider_metadata_invalid",
                f"Discovery metadata is missing required field '{field_name}'",
            )
    if metadata["issuer"].rstrip("/") != issuer:
        raise OidcProviderError(
            "issuer_mismatch",
            "Discovery metadata issuer does not match the configured issuer",
        )
    for endpoint_field in ("authorization_endpoint", "token_endpoint", "jwks_uri"):
        _require_safe_url(str(metadata[endpoint_field]), endpoint_field)
    if metadata.get("userinfo_endpoint"):
        _require_safe_url(str(metadata["userinfo_endpoint"]), "userinfo_endpoint")

    with _cache_lock:
        _metadata_cache[issuer] = (now, metadata)
    return metadata


def fetch_jwks(jwks_uri: str, *, force_refresh: bool = False) -> dict:
    _require_safe_url(jwks_uri, "JWKS")
    now = time.monotonic()
    with _cache_lock:
        cached = _jwks_cache.get(jwks_uri)
        if cached and not force_refresh and now - cached[0] < CACHE_TTL_SECONDS:
            return cached[1]

    jwks = _http_get_json(jwks_uri)
    keys = jwks.get("keys")
    if not isinstance(keys, list) or not keys:
        raise OidcProviderError("jwks_invalid", "JWKS response contains no signing keys")

    with _cache_lock:
        _jwks_cache[jwks_uri] = (now, jwks)
    return jwks


def fetch_userinfo(userinfo_endpoint: str, access_token: str) -> dict:
    _require_safe_url(userinfo_endpoint, "userinfo_endpoint")
    request = urllib.request.Request(
        userinfo_endpoint,
        headers={
            "Accept": "application/json",
            "Authorization": f"Bearer {access_token}",
            "User-Agent": "NetMap",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=HTTP_TIMEOUT_SECONDS) as resp:
            payload = json.loads(resp.read())
    except (urllib.error.URLError, TimeoutError, OSError, ValueError, TypeError) as exc:
        logger.warning("OIDC userinfo fetch failed: %s", exc)
        return {}
    return payload if isinstance(payload, dict) else {}


def clear_provider_caches() -> None:
    with _cache_lock:
        _metadata_cache.clear()
        _jwks_cache.clear()
