from datetime import datetime, timezone


def serialize_utc_datetime(value: datetime | None) -> str | None:
    """Serialize naive UTC datetimes from SQLite with explicit Z suffix."""
    if value is None:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.isoformat().replace("+00:00", "Z")
