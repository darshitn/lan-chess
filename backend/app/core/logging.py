from __future__ import annotations

import logging
import sys

_configured = False


def configure_logging(level: str = "INFO") -> None:
    global _configured
    if _configured:
        return
    numeric = getattr(logging, level.upper(), logging.INFO)
    logging.basicConfig(
        level=numeric,
        format="%(asctime)s | %(levelname)-7s | %(name)s | %(message)s",
        stream=sys.stdout,
    )
    # Quiet noisy libs in dev
    logging.getLogger("uvicorn.access").setLevel(logging.INFO)
    _configured = True


def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(name)
