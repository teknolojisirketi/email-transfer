from datetime import datetime, timezone
from typing import Optional


def serialize_utc_datetime(value: Optional[datetime]) -> Optional[str]:
    """Serialize naive UTC datetimes from SQLite with explicit Z suffix."""
    if value is None:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.isoformat().replace("+00:00", "Z")
