from pathlib import Path
import os


def load_environment() -> None:
    env_path = Path(__file__).resolve().parents[3] / ".env"

    if not env_path.exists():
        return

    for line in env_path.read_text(encoding="utf-8").splitlines():
        cleaned_line = line.strip()

        if not cleaned_line or cleaned_line.startswith("#") or "=" not in cleaned_line:
            continue

        key, value = cleaned_line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))
