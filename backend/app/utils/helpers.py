"""
Shared utility helpers.
"""

import re
from math import ceil
from typing import Any, Dict, Optional, TypeVar

T = TypeVar("T")


def paginate(total: int, page: int, page_size: int) -> Dict[str, int]:
    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": ceil(total / page_size) if page_size else 0,
    }


def slugify(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r"[^\w\s-]", "", text)
    return re.sub(r"[\s_-]+", "-", text)


def truncate(text: Optional[str], length: int = 100) -> Optional[str]:
    if not text:
        return text
    return text if len(text) <= length else text[:length] + "…"
