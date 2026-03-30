import logging
import os
from dataclasses import dataclass
from functools import lru_cache

import psutil

logger = logging.getLogger(__name__)

_GB = 1024 ** 3
_MIN_FREE_RAM_BYTES = 2 * _GB


@dataclass(frozen=True)
class RuntimeConfig:
    detected_cores: int
    free_ram_bytes: int
    free_ram_gb: float
    computed_workers: int
    max_workers: int
    env_override_used: bool


@lru_cache(maxsize=1)
def get_runtime_config() -> RuntimeConfig:
    cpu_count = os.cpu_count() or 1
    free_ram_bytes = int(psutil.virtual_memory().available)
    free_ram_gb = free_ram_bytes / _GB

    computed_workers = _compute_workers(cpu_count=cpu_count, free_ram_bytes=free_ram_bytes)

    max_workers = computed_workers
    env_override_used = False

    raw_override = os.getenv("VULN_WORKERS", "").strip()
    if raw_override:
        try:
            parsed_override = int(raw_override)
            if parsed_override > 0:
                max_workers = parsed_override
                env_override_used = True
            else:
                logger.warning(
                    "[vuln_scanner] runtime_config invalid_env_override key=VULN_WORKERS value=%s",
                    raw_override,
                )
        except ValueError:
            logger.warning(
                "[vuln_scanner] runtime_config invalid_env_override key=VULN_WORKERS value=%s",
                raw_override,
            )

    config = RuntimeConfig(
        detected_cores=cpu_count,
        free_ram_bytes=free_ram_bytes,
        free_ram_gb=free_ram_gb,
        computed_workers=computed_workers,
        max_workers=max_workers,
        env_override_used=env_override_used,
    )

    logger.info(
        "[vuln_scanner] runtime_config detected_cores=%d free_ram_gb=%.2f computed_workers=%d max_workers=%d env_override_used=%s",
        config.detected_cores,
        config.free_ram_gb,
        config.computed_workers,
        config.max_workers,
        str(config.env_override_used).lower(),
    )

    return config


def get_optimal_workers() -> int:
    return get_runtime_config().max_workers


def _compute_workers(cpu_count: int, free_ram_bytes: int) -> int:
    if cpu_count <= 2 or free_ram_bytes < _MIN_FREE_RAM_BYTES:
        return 2

    if cpu_count <= 8:
        return cpu_count * 2

    if cpu_count <= 15:
        return cpu_count * 3

    return cpu_count * 4
