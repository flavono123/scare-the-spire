"""Locate the local Slay the Spire 1 desktop-1.0.jar."""

from __future__ import annotations

import os
import zipfile


DEFAULT_JAR_PATHS = {
    "darwin": os.path.expanduser(
        "~/Library/Application Support/Steam/steamapps/common/"
        "SlayTheSpire/SlayTheSpire.app/Contents/Resources/desktop-1.0.jar"
    ),
    "win32": r"C:\Program Files (x86)\Steam\steamapps\common\SlayTheSpire\desktop-1.0.jar",
    "linux": os.path.expanduser(
        "~/.local/share/Steam/steamapps/common/SlayTheSpire/desktop-1.0.jar"
    ),
}


def default_sts1_jar_path() -> str:
    return DEFAULT_JAR_PATHS.get(os.sys.platform, DEFAULT_JAR_PATHS["linux"])


def open_sts1_jar(path: str | None = None) -> zipfile.ZipFile:
    jar_path = path or default_sts1_jar_path()
    if not os.path.isfile(jar_path):
        raise FileNotFoundError(f"STS1 jar not found: {jar_path}")
    return zipfile.ZipFile(jar_path)
