"""Map Bandit test_id prefixes to OWASP Top 10 2021 categories."""

OWASP_MAPPING: dict[str, tuple[str, str]] = {
    # A01:2021 - Broken Access Control
    "B108": ("A01:2021", "Broken Access Control"),
    # A02:2021 - Cryptographic Failures
    "B501": ("A02:2021", "Cryptographic Failures"),
    "B502": ("A02:2021", "Cryptographic Failures"),
    "B503": ("A02:2021", "Cryptographic Failures"),
    "B504": ("A02:2021", "Cryptographic Failures"),
    "B505": ("A02:2021", "Cryptographic Failures"),
    "B506": ("A02:2021", "Cryptographic Failures"),
    "B507": ("A02:2021", "Cryptographic Failures"),
    # A03:2021 - Injection
    "B301": ("A03:2021", "Injection"),
    "B302": ("A03:2021", "Injection"),
    "B303": ("A03:2021", "Injection"),
    "B304": ("A03:2021", "Injection"),
    "B305": ("A03:2021", "Injection"),
    "B306": ("A03:2021", "Injection"),
    "B307": ("A03:2021", "Injection"),
    "B308": ("A03:2021", "Injection"),
    "B309": ("A03:2021", "Injection"),
    "B310": ("A03:2021", "Injection"),
    "B311": ("A03:2021", "Injection"),
    "B312": ("A03:2021", "Injection"),
    "B313": ("A03:2021", "Injection"),
    "B314": ("A03:2021", "Injection"),
    "B315": ("A03:2021", "Injection"),
    "B316": ("A03:2021", "Injection"),
    "B317": ("A03:2021", "Injection"),
    "B318": ("A03:2021", "Injection"),
    "B319": ("A03:2021", "Injection"),
    "B320": ("A03:2021", "Injection"),
    "B321": ("A03:2021", "Injection"),
    "B322": ("A03:2021", "Injection"),
    "B323": ("A03:2021", "Injection"),
    "B324": ("A03:2021", "Injection"),
    "B601": ("A03:2021", "Injection"),
    "B602": ("A03:2021", "Injection"),
    "B603": ("A03:2021", "Injection"),
    "B604": ("A03:2021", "Injection"),
    "B605": ("A03:2021", "Injection"),
    "B606": ("A03:2021", "Injection"),
    "B607": ("A03:2021", "Injection"),
    "B608": ("A03:2021", "Injection"),
    "B609": ("A03:2021", "Injection"),
    "B610": ("A03:2021", "Injection"),
    "B611": ("A03:2021", "Injection"),
    "B701": ("A03:2021", "Injection"),
    "B702": ("A03:2021", "Injection"),
    "B703": ("A03:2021", "Injection"),
    # A04:2021 - Insecure Design
    "B101": ("A04:2021", "Insecure Design"),
    "B102": ("A04:2021", "Insecure Design"),
    "B103": ("A04:2021", "Insecure Design"),
    "B104": ("A04:2021", "Insecure Design"),
    "B105": ("A04:2021", "Insecure Design"),
    "B106": ("A04:2021", "Insecure Design"),
    "B107": ("A04:2021", "Insecure Design"),
    "B110": ("A04:2021", "Insecure Design"),
    "B112": ("A04:2021", "Insecure Design"),
    "B113": ("A04:2021", "Insecure Design"),
    # A05:2021 - Security Misconfiguration
    "B104": ("A05:2021", "Security Misconfiguration"),
    "B108": ("A05:2021", "Security Misconfiguration"),
    # A06:2021 - Vulnerable & Outdated Components (not directly mapped)
    # A07:2021 - Identification & Authentication Failures
    "B105": ("A07:2021", "Identification & Authentication Failures"),
    "B106": ("A07:2021", "Identification & Authentication Failures"),
    "B107": ("A07:2021", "Identification & Authentication Failures"),
    # A08:2021 - Software & Data Integrity Failures
    "B301": ("A08:2021", "Software & Data Integrity Failures"),
    "B302": ("A08:2021", "Software & Data Integrity Failures"),
    # A09:2021 - Security Logging & Monitoring Failures (catch-all default)
    # A10:2021 - Server-Side Request Forgery
    "B310": ("A10:2021", "Server-Side Request Forgery"),
}

# Default for unmapped test IDs
DEFAULT_OWASP = ("A09:2021", "Security Logging & Monitoring Failures")


def get_owasp_category(test_id: str) -> tuple[str, str]:
    """Return (category_id, category_name) for a Bandit test_id."""
    return OWASP_MAPPING.get(test_id, DEFAULT_OWASP)
