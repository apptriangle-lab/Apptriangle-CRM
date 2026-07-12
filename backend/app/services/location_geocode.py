"""Reverse geocode lat,lng coordinates for attendance reports."""

from __future__ import annotations

import json
import urllib.error
import urllib.parse
import urllib.request

_CACHE_LANG = "en"
_cache: dict[str, str] = {}


def resolve_location_label(coordinates: str | None) -> str:
    """Resolve stored coordinates to a readable place name (cached)."""
    raw = (coordinates or "").strip()
    if not raw:
        return ""

    cache_key = f"{_CACHE_LANG}|{raw}"
    if cache_key in _cache:
        return _cache[cache_key]

    parts = [p.strip() for p in raw.split(",")]
    if len(parts) != 2:
        _cache[cache_key] = raw
        return raw

    try:
        lat = float(parts[0])
        lng = float(parts[1])
    except ValueError:
        _cache[cache_key] = raw
        return raw

    label = _reverse_geocode(lat, lng) or raw
    _cache[cache_key] = label
    return label


def _reverse_geocode(lat: float, lng: float) -> str | None:
    params = urllib.parse.urlencode(
        {
            "format": "json",
            "lat": lat,
            "lon": lng,
            "zoom": 18,
            "addressdetails": 1,
        }
    )
    url = f"https://nominatim.openstreetmap.org/reverse?{params}"
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "AppTriangle-CRM/1.0",
            "Accept-Language": "en",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=8) as res:
            data = json.loads(res.read().decode("utf-8"))
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, ValueError):
        return None

    address = data.get("address") or {}
    if address.get("road"):
        if address.get("house_number"):
            return f"{address['road']} {address['house_number']}"
        return str(address["road"])
    if address.get("suburb") or address.get("neighbourhood"):
        name = address.get("suburb") or address.get("neighbourhood")
        city = address.get("city") or address.get("town") or address.get("village")
        return f"{name}, {city}" if city else str(name)
    if address.get("city") or address.get("town") or address.get("village"):
        return str(address.get("city") or address.get("town") or address.get("village"))

    display = data.get("display_name")
    if display:
        parts = [p.strip() for p in str(display).split(",")]
        return ", ".join(parts[:2]).strip()
    return None
