#!/usr/bin/env python3
"""Generate favicon, PWA icons, and OG image from SVG sources."""

import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ICONS = ROOT / "icons"

ICON_SIZES = {
    "favicon-16.png": (16, "icon.svg"),
    "favicon-32.png": (32, "icon.svg"),
    "icon-180.png": (180, "icon.svg"),
    "icon-192.png": (192, "icon.svg"),
    "icon-512.png": (512, "icon.svg"),
    "icon-maskable-512.png": (512, "icon-maskable.svg"),
}


def render_png(name: str, size: int, source: str) -> None:
    src = ICONS / source
    out = ICONS / name
    subprocess.run(
        [
            "convert",
            "-background",
            "none",
            str(src),
            "-resize",
            f"{size}x{size}",
            str(out),
        ],
        check=True,
    )
    print(f"wrote {out} ({size}x{size})")


def render_og_image() -> None:
    src = ICONS / "og-image.svg"
    out = ICONS / "og-image.jpg"
    subprocess.run(
        [
            "convert",
            "-background",
            "#075e54",
            str(src),
            "-resize",
            "1200x630!",
            "-quality",
            "92",
            str(out),
        ],
        check=True,
    )
    print(f"wrote {out} (1200x630)")


def main() -> None:
    for name, (size, source) in ICON_SIZES.items():
        if not (ICONS / source).exists():
            raise SystemExit(f"Missing source icon: {ICONS / source}")
        render_png(name, size, source)

    if not (ICONS / "og-image.svg").exists():
        raise SystemExit("Missing og-image.svg")
    render_og_image()

    ico_path = ICONS / "favicon.ico"
    subprocess.run(
        [
            "convert",
            str(ICONS / "favicon-16.png"),
            str(ICONS / "favicon-32.png"),
            str(ico_path),
        ],
        check=True,
    )
    print(f"wrote {ico_path}")


if __name__ == "__main__":
    main()
