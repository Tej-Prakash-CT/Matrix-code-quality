from dataclasses import dataclass


@dataclass
class Config:
    api_prefix: str = "/api"
    volume_path: str = "/Volumes/abs_metadata_dev/code_quality/reports"
    cache_ttl_seconds: int = 60
    coverage_threshold: int = 80
    duplication_threshold: float = 20.0


conf = Config()
