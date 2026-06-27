from __future__ import annotations

MONTHS = ("Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec")


def normalize_years(years: list[int] | None) -> list[int] | None:
    if not years:
        return None
    cleaned = sorted({int(y) for y in years if 1990 <= int(y) <= 2100})
    return cleaned or None


def years_to_storage(years: list[int] | None) -> str | None:
    normalized = normalize_years(years)
    if not normalized:
        return None
    return ",".join(str(y) for y in normalized)


def storage_to_years(value: str | None) -> list[int] | None:
    if not value or not value.strip():
        return None
    return normalize_years([int(part) for part in value.split(",") if part.strip().isdigit()])


def build_search1_args(years: list[int] | None) -> list[str]:
    """Tek imapsync işi için Yandex tarafında yıl aralığı filtresi."""
    normalized = normalize_years(years)
    if not normalized:
        return []

    start_year = normalized[0]
    end_year = normalized[-1]
    # Seçilen yılların birleşimi: en eski yılın başı → en yeni yılın sonu
    search = f"SENTSINCE 1-{MONTHS[0]}-{start_year} SENTBEFORE 1-{MONTHS[0]}-{end_year + 1}"
    return ["--search1", search]


def format_years_label(years: list[int] | None) -> str | None:
    normalized = normalize_years(years)
    if not normalized:
        return None
    if len(normalized) == 1:
        return str(normalized[0])
    if normalized[-1] - normalized[0] + 1 == len(normalized):
        return f"{normalized[0]}–{normalized[-1]}"
    return ", ".join(str(y) for y in normalized)
