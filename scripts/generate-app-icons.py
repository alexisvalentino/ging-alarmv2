"""Generate Ging's coordinated web, iOS, and Android launcher icons.

Requires Pillow (python -m pip install Pillow). The source mascot art stays in
public/gingy-face-cutout.webp; generated images are checked into the project.
"""

from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
MASCOT_PATH = ROOT / "public" / "gingy-face-cutout.webp"

CREAM = (255, 249, 245)
RUST = (164, 62, 0)
RING = (240, 153, 100)


def blend(first: tuple[int, int, int], second: tuple[int, int, int], amount: float) -> tuple[int, int, int]:
    return tuple(round(a + (b - a) * amount) for a, b in zip(first, second))


def make_background(size: int) -> Image.Image:
    """A soft Ging peach field with a restrained sunrise/clock halo."""
    image = Image.new("RGBA", (size, size))
    draw = ImageDraw.Draw(image)
    top = (255, 246, 240)
    bottom = (244, 191, 157)
    for y in range(size):
        amount = y / max(1, size - 1)
        draw.line((0, y, size, y), fill=blend(top, bottom, amount) + (255,))

    glow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow)
    center = size / 2
    glow_draw.ellipse(
        (center - size * 0.45, center - size * 0.45, center + size * 0.45, center + size * 0.45),
        fill=(255, 251, 247, 72),
    )
    glow = glow.filter(ImageFilter.GaussianBlur(max(1, round(size * 0.055))))
    image = Image.alpha_composite(image, glow)

    draw = ImageDraw.Draw(image)
    for angle in range(-90, 270, 45):
        start = size * 0.375
        end = size * (0.445 if angle % 90 == 0 else 0.42)
        radians = math.radians(angle)
        p1 = (center + math.cos(radians) * start, center + math.sin(radians) * start)
        p2 = (center + math.cos(radians) * end, center + math.sin(radians) * end)
        draw.line((p1, p2), fill=(RUST[0], RUST[1], RUST[2], 36), width=max(1, round(size * 0.008)))

    return image


def mascot_art(size: int, width_ratio: float) -> Image.Image:
    mascot = Image.open(MASCOT_PATH).convert("RGBA")
    alpha = mascot.getchannel("A")
    bounds = alpha.getbbox()
    if bounds:
        mascot = mascot.crop(bounds)

    width = round(size * width_ratio)
    height = round(mascot.height * width / mascot.width)
    return mascot.resize((width, height), Image.Resampling.LANCZOS)


def make_foreground(size: int, badge_ratio: float, mascot_ratio: float) -> Image.Image:
    """Adaptive-safe portrait medallion; transparent outside the designed badge."""
    center = size / 2
    radius = size * badge_ratio / 2
    image = Image.new("RGBA", (size, size), (0, 0, 0, 0))

    shadow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    shadow_draw = ImageDraw.Draw(shadow)
    shadow_offset = size * 0.012
    shadow_draw.ellipse(
        (center - radius, center - radius + shadow_offset, center + radius, center + radius + shadow_offset),
        fill=(104, 49, 22, 72),
    )
    image = Image.alpha_composite(image, shadow.filter(ImageFilter.GaussianBlur(max(1, round(size * 0.019)))))

    draw = ImageDraw.Draw(image)
    draw.ellipse((center - radius, center - radius, center + radius, center + radius), fill=RUST + (255,))
    border = max(2, round(size * 0.011))
    draw.ellipse(
        (center - radius + border, center - radius + border, center + radius - border, center + radius - border),
        fill=(255, 239, 229, 255),
    )
    draw.ellipse(
        (center - radius + border * 2, center - radius + border * 2, center + radius - border * 2, center + radius - border * 2),
        fill=CREAM + (255,),
        outline=RING + (180,),
        width=max(1, round(size * 0.004)),
    )

    # Four quiet clock marks stay between the portrait and its circular rim.
    mark_color = (188, 88, 36, 190)
    mark_length = size * 0.026
    mark_width = max(2, round(size * 0.012))
    mark_radius = radius * 0.83
    for angle in (0, 90, 180, 270):
        radians = math.radians(angle)
        x = center + math.cos(radians) * mark_radius
        y = center + math.sin(radians) * mark_radius
        if angle in (0, 180):
            box = (x - mark_width / 2, y - mark_length / 2, x + mark_width / 2, y + mark_length / 2)
        else:
            box = (x - mark_length / 2, y - mark_width / 2, x + mark_length / 2, y + mark_width / 2)
        draw.rounded_rectangle(box, radius=mark_width / 2, fill=mark_color)

    mascot = mascot_art(size, mascot_ratio)
    mascot_alpha = mascot.getchannel("A")
    mascot_shadow = Image.new("RGBA", mascot.size, (63, 37, 26, 0))
    mascot_shadow.putalpha(mascot_alpha.point(lambda value: round(value * 0.28)))
    shadow_layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    position = ((size - mascot.width) // 2, round((size - mascot.height) / 2 + size * 0.008))
    shadow_layer.alpha_composite(mascot_shadow, (position[0], position[1] + round(size * 0.01)))
    image = Image.alpha_composite(image, shadow_layer.filter(ImageFilter.GaussianBlur(max(1, round(size * 0.012)))))
    image.alpha_composite(mascot, position)
    return image


def make_full_icon(size: int, badge_ratio: float, mascot_ratio: float) -> Image.Image:
    image = make_background(size)
    return Image.alpha_composite(image, make_foreground(size, badge_ratio, mascot_ratio))


def make_monochrome(size: int) -> Image.Image:
    """One-color mascot silhouette with negative-space eyes and smile for themed icons."""
    mascot = Image.open(MASCOT_PATH).convert("RGBA")
    mascot = mascot.crop(mascot.getchannel("A").getbbox())
    width = round(size * 0.55)
    height = round(mascot.height * width / mascot.width)
    alpha = mascot.getchannel("A").resize((width, height), Image.Resampling.LANCZOS)
    x = (size - width) // 2
    y = round((size - height) / 2 + size * 0.008)
    mask = Image.new("L", (size, size), 0)
    mask.paste(alpha, (x, y))

    # Keep the face recognizable when the launcher tints this layer to one color.
    scale = width / 804
    for cx, cy, rx, ry in ((410, 507, 25, 33), (574, 507, 25, 33)):
        eye_box = (
            round(x + (cx - rx - 23) * scale),
            round(y + (cy - ry - 23) * scale),
            round(x + (cx + rx - 23) * scale),
            round(y + (cy + ry - 23) * scale),
        )
        ImageDraw.Draw(mask).ellipse(eye_box, fill=0)
    mouth_box = (
        round(x + (490 - 95 - 23) * scale),
        round(y + (641 - 47 - 23) * scale),
        round(x + (490 + 95 - 23) * scale),
        round(y + (641 + 47 - 23) * scale),
    )
    ImageDraw.Draw(mask).ellipse(mouth_box, fill=0)

    output = Image.new("RGBA", (size, size), (255, 255, 255, 0))
    output.putalpha(mask)
    return output


def save_png(image: Image.Image, path: Path, size: int) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    image.resize((size, size), Image.Resampling.LANCZOS).save(path, format="PNG", optimize=True)


def generate_android_icons() -> None:
    density_sizes = {"ldpi": 81, "mdpi": 108, "hdpi": 162, "xhdpi": 216, "xxhdpi": 324, "xxxhdpi": 432}
    legacy_sizes = {"ldpi": 36, "mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}
    res_dir = ROOT / "android" / "app" / "src" / "main" / "res"

    for density, size in density_sizes.items():
        folder = res_dir / f"mipmap-{density}"
        save_png(make_foreground(432, 0.64, 0.535), folder / "ic_launcher_foreground.png", size)
        save_png(make_background(432), folder / "ic_launcher_background.png", size)
        save_png(make_monochrome(432), folder / "ic_launcher_monochrome.png", size)

    for density, size in legacy_sizes.items():
        full = make_full_icon(432, 0.84, 0.70).resize((size, size), Image.Resampling.LANCZOS)
        full.convert("RGB").save(res_dir / f"mipmap-{density}" / "ic_launcher.png", format="PNG", optimize=True)

        round_icon = full.convert("RGBA")
        mask = Image.new("L", (size, size), 0)
        ImageDraw.Draw(mask).ellipse((0, 0, size - 1, size - 1), fill=255)
        round_icon.putalpha(mask)
        round_icon.save(res_dir / f"mipmap-{density}" / "ic_launcher_round.png", format="PNG", optimize=True)


def generate_web_and_ios_icons() -> None:
    save_png(make_full_icon(1024, 0.82, 0.69), ROOT / "assets" / "icon.png", 1024)
    save_png(make_full_icon(1024, 0.82, 0.69), ROOT / "assets" / "ios" / "Assets.xcassets" / "AppIcon.appiconset" / "AppIcon.png", 1024)
    save_png(make_full_icon(1024, 0.82, 0.69), ROOT / "ios" / "App" / "App" / "Assets.xcassets" / "AppIcon.appiconset" / "AppIcon-512@2x.png", 1024)

    save_png(make_full_icon(512, 0.82, 0.69), ROOT / "public" / "android-chrome-512x512.png", 512)
    save_png(make_full_icon(512, 0.78, 0.66), ROOT / "public" / "android-chrome-maskable-512x512.png", 512)
    save_png(make_full_icon(192, 0.82, 0.69), ROOT / "public" / "android-chrome-192x192.png", 192)
    save_png(make_full_icon(512, 0.82, 0.69), ROOT / "public" / "apple-touch-icon.png", 180)
    save_png(make_full_icon(512, 0.84, 0.71), ROOT / "public" / "favicon-32x32.png", 32)
    save_png(make_full_icon(512, 0.84, 0.71), ROOT / "public" / "favicon-16x16.png", 16)

    ico_base = make_full_icon(256, 0.84, 0.71)
    ico_base.save(ROOT / "public" / "favicon.ico", format="ICO", sizes=[(16, 16), (32, 32), (48, 48)])


def main() -> None:
    if not MASCOT_PATH.exists():
        raise SystemExit(f"Missing source mascot: {MASCOT_PATH}")
    generate_android_icons()
    generate_web_and_ios_icons()
    print("Generated Android adaptive/legacy, iOS, web app, and favicon assets.")


if __name__ == "__main__":
    main()
