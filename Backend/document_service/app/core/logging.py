"""
app/core/logging.py  — Structured JSON logging via structlog.
"""
from __future__ import annotations

import logging
import sys

import structlog


def configure_logging(level: str = "INFO") -> None:
    numeric = getattr(logging, level, logging.INFO)

    logging.basicConfig(format="%(message)s", stream=sys.stdout, level=numeric)

    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.stdlib.add_log_level,
            # NOTE: add_logger_name is intentionally omitted — it requires a
            # stdlib logger backend and raises AttributeError with PrintLoggerFactory.
            # The logger name is passed as a kwarg via get_logger(name=...) instead.
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            structlog.processors.JSONRenderer(),
        ],
        wrapper_class=structlog.make_filtering_bound_logger(numeric),
        context_class=dict,
        logger_factory=structlog.PrintLoggerFactory(),
        cache_logger_on_first_use=True,
    )


def get_logger(name: str = __name__):
    return structlog.get_logger(name)