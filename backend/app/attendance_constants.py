"""Shared attendance timezone offset (must match check-in late logic)."""
from datetime import timedelta

# Default timezone offset (UTC+6); keep in sync with business rules
DEFAULT_TIMEZONE_OFFSET = timedelta(hours=6)
