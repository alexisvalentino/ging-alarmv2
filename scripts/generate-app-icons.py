"""Regenerate Ging's mascot-only icons for native and web launchers.

Requires Pillow (python -m pip install Pillow). Keep assets/icon.png as the
canonical square icon and public/gingy-face-cutout.webp as the transparent
mascot source. No clock, ring, or extra background art is added here.
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
CANONICAL_ICON = ROOT / "assets" / "icon.png"
MASCOT_PATH = ROOT / "public" / "gingy-face-cutout.webp"
BACKGROUND = (255, 248, 246, 255)


def mascot_layer(size: int, width_ratio: float, monochrome: bool = False) -> Image.Image:
    mascot = Image.open(MASCOT_PATH).convert("RGBA")
    mascot = mascot.crop(mascot.getchannel("A").getbbox())
    width = round(size * width_ratio)
    height = round(mascot.height * width / mascot.width)
    mascot = mascot.resize((width, height), Image.Resampling.LANCZOS)
    if monochrome:
        alpha = mascot.getchannel("A")
        mascot = Image.new("RGBA", mascot.size, (255, 255, 255, 0))
        mascot.putalpha(alpha)

    layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    layer.alpha_composite(mascot, ((size - width) // 2, (size - height) // 2))
    return layer


def flat_background(size: int) -> Image.Image:
    return Image.new("RGBA", (size, size), BACKGROUND)


def validate_adaptive_safe_area(layer: Image.Image) -> None:
    """Fail if foreground artwork extends beyond Android's central safe circle."""
    alpha = layer.getchannel("A")
    bounds = alpha.getbbox()
    if not bounds:
        raise ValueError("Adaptive foreground has no visible mascot")

    center = layer.width / 2
    safe_radius = layer.width * 0.32
    left, top, right, bottom = bounds
    for y in range(top, bottom):
        for x in range(left, right):
            if alpha.getpixel((x, y)) > 8 and (x - center) ** 2 + (y - center) ** 2 > safe_radius**2:
                raise ValueError("Adaptive mascot exceeds the central launcher safe area")


def save_png(image: Image.Image, path: Path, size: int) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    image.resize((size, size), Image.Resampling.LANCZOS).save(path, format="PNG", optimize=True)


def canonical_icon(size: int) -> Image.Image:
    return Image.open(CANONICAL_ICON).convert("RGBA").resize((size, size), Image.Resampling.LANCZOS)


def maskable_icon(size: int) -> Image.Image:
    # The mascot stays inside the center 80% maskable safe zone.
    image = flat_background(size)
    image.alpha_composite(mascot_layer(size, 0.60))
    return image


def generate_android_icons() -> None:
    density_sizes = {"ldpi": 81, "mdpi": 108, "hdpi": 162, "xhdpi": 216, "xxhdpi": 324, "xxxhdpi": 432}
    legacy_sizes = {"ldpi": 36, "mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}
    res_dir = ROOT / "android" / "app" / "src" / "main" / "res"

    foreground = mascot_layer(432, 0.58)
    monochrome = mascot_layer(432, 0.58, monochrome=True)
    validate_adaptive_safe_area(foreground)

    for density, size in density_sizes.items():
        folder = res_dir / f"mipmap-{density}"
        save_png(foreground, folder / "ic_launcher_foreground.png", size)
        save_png(flat_background(432), folder / "ic_launcher_background.png", size)
        save_png(monochrome, folder / "ic_launcher_monochrome.png", size)

    for density, size in legacy_sizes.items():
        icon = canonical_icon(size)
        icon.convert("RGB").save(res_dir / f"mipmap-{density}" / "ic_launcher.png", format="PNG", optimize=True)

        round_icon = icon.copy()
        circle = Image.new("L", (size, size), 0)
        ImageDraw.Draw(circle).ellipse((0, 0, size - 1, size - 1), fill=255)
        round_icon.putalpha(circle)
        round_icon.save(res_dir / f"mipmap-{density}" / "ic_launcher_round.png", format="PNG", optimize=True)


def generate_ios_and_web_icons() -> None:
    # Both iOS app-icon catalogs use the same original artwork without overlays.
    canonical = Image.open(CANONICAL_ICON).convert("RGBA")
    canonical.save(ROOT / "assets" / "ios" / "Assets.xcassets" / "AppIcon.appiconset" / "AppIcon.png", optimize=True)
    canonical.save(ROOT / "ios" / "App" / "App" / "Assets.xcassets" / "AppIcon.appiconset" / "AppIcon-512@2x.png", optimize=True)

    save_png(canonical, ROOT / "public" / "android-chrome-512x512.png", 512)
    save_png(canonical, ROOT / "public" / "android-chrome-192x192.png", 192)
    save_png(maskable_icon(512), ROOT / "public" / "android-chrome-maskable-512x512.png", 512)
    save_png(canonical, ROOT / "public" / "apple-touch-icon.png", 180)
    save_png(canonical, ROOT / "public" / "favicon-32x32.png", 32)
    save_png(canonical, ROOT / "public" / "favicon-16x16.png", 16)

    favicon = canonical.resize((48, 48), Image.Resampling.LANCZOS)
    favicon.save(ROOT / "public" / "favicon.ico", format="ICO", sizes=[(16, 16), (32, 32), (48, 48)])


def main() -> None:
    for path in (CANONICAL_ICON, MASCOT_PATH):
        if not path.exists():
            raise SystemExit(f"Missing icon source: {path}")
    generate_android_icons()
    generate_ios_and_web_icons()
    print("Generated mascot-only adaptive launcher, iOS, PWA, and favicon assets.")


if __name__ == "__main__":
    main()
