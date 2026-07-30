"""Build the complete premium ChromaCards raster deck.

ImageGen establishes the visual master. This deterministic painter applies that
master to every runtime face so geometry, colors, corner indices and symbols
remain exact across all 55 unique assets.
"""

from __future__ import annotations

import argparse
import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


W, H = 208, 320
AA = 4
SW, SH = W * AA, H * AA
FONT_ROUND = Path(r"C:\Windows\Fonts\ARLRDBD.TTF")
FONT_CONDENSED = Path(r"C:\Windows\Fonts\ARIALNB.TTF")

COLORS = {
    "red": ("#ff1728", "#d60019"),
    "yellow": ("#ffc515", "#e69a00"),
    "green": ("#2fd000", "#159800"),
    "blue": ("#0798d8", "#006caf"),
}
INK = "#111417"
IVORY = "#fffdf3"
PAPER = "#f8f7ef"


def q(value: float | int) -> int:
    return round(value * AA)


def pts(points: tuple[tuple[float, float], ...]) -> tuple[tuple[int, int], ...]:
    return tuple((q(x), q(y)) for x, y in points)


def font(path: Path, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(path), q(size))


def downsample(image: Image.Image) -> Image.Image:
    return image.resize((W, H), Image.Resampling.LANCZOS)


def hex_rgba(value: str, alpha: int = 255) -> tuple[int, int, int, int]:
    value = value.lstrip("#")
    return (
        int(value[0:2], 16),
        int(value[2:4], 16),
        int(value[4:6], 16),
        alpha,
    )


def lighten(value: str, amount: float) -> tuple[int, int, int, int]:
    r, g, b, _ = hex_rgba(value)
    return (
        round(r + (255 - r) * amount),
        round(g + (255 - g) * amount),
        round(b + (255 - b) * amount),
        255,
    )


def darken(value: str, amount: float) -> tuple[int, int, int, int]:
    r, g, b, _ = hex_rgba(value)
    return (round(r * (1 - amount)), round(g * (1 - amount)), round(b * (1 - amount)), 255)


def base_card(color: str) -> tuple[Image.Image, ImageDraw.ImageDraw]:
    main, deep = COLORS[color]
    image = Image.new("RGBA", (SW, SH), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)

    # Premium double frame: dark keyline, substantial warm-white rim, dark inset.
    draw.rounded_rectangle(
        (q(2), q(2), q(W - 3), q(H - 3)),
        radius=q(21),
        fill=INK,
    )
    draw.rounded_rectangle(
        (q(5), q(5), q(W - 6), q(H - 6)),
        radius=q(18),
        fill=IVORY,
    )
    draw.rounded_rectangle(
        (q(12), q(12), q(W - 13), q(H - 13)),
        radius=q(13),
        fill=INK,
    )
    draw.rounded_rectangle(
        (q(14), q(14), q(W - 15), q(H - 15)),
        radius=q(11),
        fill=main,
    )

    # Controlled diagonal planes add depth while preserving pure, vivid color.
    draw.polygon(
        pts(((15, 15), (W - 15, 15), (W - 15, 77), (66, 176), (15, 124))),
        fill=lighten(main, 0.10),
    )
    draw.polygon(
        pts(((W - 15, 82), (W - 15, H - 15), (84, H - 15), (139, 200))),
        fill=deep,
    )
    draw.polygon(
        pts(((W // 2, 64), (W - 25, H // 2), (W // 2, H - 64), (25, H // 2))),
        fill=IVORY,
    )
    # A hairline makes the central diamond read cleanly at small sizes.
    diamond = pts(((W // 2, 64), (W - 25, H // 2), (W // 2, H - 64), (25, H // 2)))
    draw.line((*diamond, diamond[0]), fill=(24, 28, 29, 42), width=q(1), joint="curve")
    return image, draw


def outlined_text(
    draw: ImageDraw.ImageDraw,
    xy: tuple[float, float],
    value: str,
    typeface: ImageFont.FreeTypeFont,
    *,
    fill: str | tuple[int, int, int, int],
    stroke: int,
    anchor: str = "mm",
) -> None:
    draw.text(
        (q(xy[0]), q(xy[1])),
        value,
        font=typeface,
        anchor=anchor,
        fill=fill,
        stroke_width=q(stroke),
        stroke_fill=INK,
    )


def corner_text(image: Image.Image, value: str, *, size: int | None = None) -> None:
    size = size or (42 if len(value) == 1 else 31)
    typeface = font(FONT_ROUND, size)
    draw = ImageDraw.Draw(image)
    outlined_text(draw, (10, 9), value, typeface, fill=IVORY, stroke=3, anchor="la")

    corner = Image.new("RGBA", (q(72), q(58)), (0, 0, 0, 0))
    cd = ImageDraw.Draw(corner)
    outlined_text(cd, (36, 29), value, typeface, fill=IVORY, stroke=3)
    corner = corner.rotate(180, expand=False, resample=Image.Resampling.BICUBIC)
    image.alpha_composite(corner, (q(W - 71), q(H - 59)))


def number_card(color: str, value: int) -> Image.Image:
    image, draw = base_card(color)
    _, deep = COLORS[color]
    # A bright edge between dark outline and suit fill keeps the numeral readable.
    outlined_text(draw, (W / 2, H / 2 + 5), str(value), font(FONT_ROUND, 133), fill=deep, stroke=8)
    corner_text(image, str(value))
    return downsample(image)


def reverse_shape(layer: Image.Image, color: str, scale: float = 1.0) -> None:
    draw = ImageDraw.Draw(layer)
    main, deep = COLORS[color]
    cx, cy = layer.width / AA / 2, layer.height / AA / 2
    radius = 48 * scale
    width_outer = max(8, round(15 * scale))
    width_inner = max(5, round(9 * scale))
    box = (q(cx - radius), q(cy - radius), q(cx + radius), q(cy + radius))
    draw.arc(box, 205, 344, fill=INK, width=q(width_outer))
    draw.arc(box, 25, 164, fill=INK, width=q(width_outer))
    draw.arc(box, 205, 344, fill=main, width=q(width_inner))
    draw.arc(box, 25, 164, fill=main, width=q(width_inner))

    draw.polygon(
        pts(((cx + 35 * scale, cy - 52 * scale), (cx + 62 * scale, cy - 22 * scale), (cx + 23 * scale, cy - 18 * scale))),
        fill=INK,
    )
    draw.polygon(
        pts(((cx - 35 * scale, cy + 52 * scale), (cx - 62 * scale, cy + 22 * scale), (cx - 23 * scale, cy + 18 * scale))),
        fill=INK,
    )
    draw.polygon(
        pts(((cx + 35 * scale, cy - 45 * scale), (cx + 52 * scale, cy - 26 * scale), (cx + 28 * scale, cy - 23 * scale))),
        fill=main,
    )
    draw.polygon(
        pts(((cx - 35 * scale, cy + 45 * scale), (cx - 52 * scale, cy + 26 * scale), (cx - 28 * scale, cy + 23 * scale))),
        fill=main,
    )


def reverse_icon(image: Image.Image, color: str) -> None:
    layer = Image.new("RGBA", image.size, (0, 0, 0, 0))
    reverse_shape(layer, color, 1.0)
    image.alpha_composite(layer)


def skip_icon(image: Image.Image, color: str) -> None:
    draw = ImageDraw.Draw(image)
    main, deep = COLORS[color]
    draw.ellipse((q(50), q(106), q(158), q(214)), fill=INK)
    draw.ellipse((q(64), q(120), q(144), q(200)), fill=IVORY)
    draw.line((q(65), q(198), q(145), q(118)), fill=INK, width=q(22))
    draw.line((q(72), q(191), q(138), q(125)), fill=deep, width=q(12))
    draw.ellipse((q(76), q(132), q(132), q(188)), outline=lighten(main, 0.1), width=q(2))


def mini_card(color: str, value: str, angle: float) -> Image.Image:
    main, deep = COLORS[color]
    layer = Image.new("RGBA", (q(76), q(112)), (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    draw.rounded_rectangle((q(1), q(1), q(75), q(111)), q(9), fill=INK)
    draw.rounded_rectangle((q(4), q(4), q(72), q(108)), q(7), fill=IVORY)
    draw.rounded_rectangle((q(8), q(8), q(68), q(104)), q(5), fill=main)
    draw.polygon(pts(((38, 26), (61, 56), (38, 86), (15, 56))), fill=IVORY)
    outlined_text(draw, (38, 57), value, font(FONT_ROUND, 43), fill=deep, stroke=3)
    return layer.rotate(angle, expand=True, resample=Image.Resampling.BICUBIC)


def draw_two_icon(image: Image.Image, color: str) -> None:
    left = mini_card(color, "2", -10)
    right = mini_card(color, "2", 10)
    image.alpha_composite(left, (q(61) - left.width // 2, q(160) - left.height // 2))
    image.alpha_composite(right, (q(145) - right.width // 2, q(160) - right.height // 2))


def corner_action(image: Image.Image, color: str, kind: str) -> None:
    symbol = Image.new("RGBA", (q(48), q(48)), (0, 0, 0, 0))
    draw = ImageDraw.Draw(symbol)
    main, deep = COLORS[color]
    if kind == "skip":
        draw.ellipse((q(7), q(7), q(41), q(41)), fill=INK)
        draw.ellipse((q(13), q(13), q(35), q(35)), fill=IVORY)
        draw.line((q(12), q(37), q(37), q(12)), fill=INK, width=q(8))
        draw.line((q(16), q(34), q(34), q(16)), fill=deep, width=q(4))
    else:
        center = (24, 24)
        radius = 14
        box = (q(center[0] - radius), q(center[1] - radius), q(center[0] + radius), q(center[1] + radius))
        draw.arc(box, 205, 344, fill=INK, width=q(7))
        draw.arc(box, 25, 164, fill=INK, width=q(7))
        draw.arc(box, 205, 344, fill=main, width=q(4))
        draw.arc(box, 25, 164, fill=main, width=q(4))
        draw.polygon(pts(((34, 7), (44, 18), (29, 17))), fill=INK)
        draw.polygon(pts(((14, 41), (4, 30), (19, 31))), fill=INK)
    image.alpha_composite(symbol, (q(7), q(6)))
    image.alpha_composite(symbol.rotate(180, resample=Image.Resampling.BICUBIC), (q(W - 55), q(H - 54)))


def action_card(color: str, kind: str) -> Image.Image:
    image, _ = base_card(color)
    if kind == "reverse":
        reverse_icon(image, color)
        corner_action(image, color, kind)
    elif kind == "skip":
        skip_icon(image, color)
        corner_action(image, color, kind)
    else:
        draw_two_icon(image, color)
        corner_text(image, "+2", size=30)
    return downsample(image)


def wild_segments(draw: ImageDraw.ImageDraw, center: tuple[float, float], radius: float) -> None:
    cx, cy = center
    box = (q(cx - radius), q(cy - radius), q(cx + radius), q(cy + radius))
    draw.ellipse(box, fill=INK)
    inset = 8
    inner = (q(cx - radius + inset), q(cy - radius + inset), q(cx + radius - inset), q(cy + radius - inset))
    draw.pieslice(inner, 180, 270, fill=COLORS["red"][0])
    draw.pieslice(inner, 270, 360, fill=COLORS["yellow"][0])
    draw.pieslice(inner, 0, 90, fill=COLORS["blue"][0])
    draw.pieslice(inner, 90, 180, fill=COLORS["green"][0])
    draw.line((q(cx), q(cy - radius + inset), q(cx), q(cy + radius - inset)), fill=IVORY, width=q(4))
    draw.line((q(cx - radius + inset), q(cy), q(cx + radius - inset), q(cy)), fill=IVORY, width=q(4))
    draw.ellipse((q(cx - 8), q(cy - 8), q(cx + 8), q(cy + 8)), fill=INK)


def wild_base() -> tuple[Image.Image, ImageDraw.ImageDraw]:
    image = Image.new("RGBA", (SW, SH), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle((q(2), q(2), q(W - 3), q(H - 3)), q(21), fill=INK)
    draw.rounded_rectangle((q(5), q(5), q(W - 6), q(H - 6)), q(18), fill=IVORY)
    draw.rounded_rectangle((q(12), q(12), q(W - 13), q(H - 13)), q(13), fill=INK)
    draw.rounded_rectangle((q(14), q(14), q(W - 15), q(H - 15)), q(11), fill="#17191b")
    draw.polygon(pts(((15, 15), (W - 15, 15), (W - 15, 95), (74, 182), (15, 127))), fill="#24272a")
    draw.polygon(pts(((W // 2, 64), (W - 25, H // 2), (W // 2, H - 64), (25, H // 2))), fill=IVORY)
    return image, draw


def wild_card() -> Image.Image:
    image, draw = wild_base()
    wild_segments(draw, (W / 2, H / 2), 61)
    wild_segments(draw, (30, 34), 15)
    corner = Image.new("RGBA", (q(60), q(65)), (0, 0, 0, 0))
    wild_segments(ImageDraw.Draw(corner), (30, 32.5), 15)
    image.alpha_composite(corner.rotate(180, resample=Image.Resampling.BICUBIC), (q(W - 60), q(H - 65)))
    return downsample(image)


def wild_four_card() -> Image.Image:
    image, draw = wild_base()
    cards = (
        ("red", -18, -21),
        ("yellow", -6, -7),
        ("green", 7, 7),
        ("blue", 19, 21),
    )
    for color, angle, xoff in cards:
        mini = mini_card(color, "", angle)
        image.alpha_composite(mini, (q(W / 2 + xoff) - mini.width // 2, q(H / 2 + 7) - mini.height // 2))
    outlined_text(draw, (35, 29), "+4", font(FONT_ROUND, 30), fill=IVORY, stroke=3)
    corner = Image.new("RGBA", (q(70), q(58)), (0, 0, 0, 0))
    cd = ImageDraw.Draw(corner)
    outlined_text(cd, (35, 29), "+4", font(FONT_ROUND, 30), fill=IVORY, stroke=3)
    image.alpha_composite(corner.rotate(180, resample=Image.Resampling.BICUBIC), (q(W - 73), q(H - 61)))
    return downsample(image)


def card_back() -> Image.Image:
    image = Image.new("RGBA", (SW, SH), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle((q(2), q(2), q(W - 3), q(H - 3)), q(21), fill=INK)
    draw.rounded_rectangle((q(5), q(5), q(W - 6), q(H - 6)), q(18), fill=IVORY)
    draw.rounded_rectangle((q(12), q(12), q(W - 13), q(H - 13)), q(13), fill=INK)
    draw.rounded_rectangle((q(15), q(15), q(W - 16), q(H - 16)), q(10), fill="#080a0b")
    # Restrained woven diagonal texture, clipped to the dark inset.
    texture = Image.new("RGBA", image.size, (0, 0, 0, 0))
    td = ImageDraw.Draw(texture)
    for offset in range(-H, W + H, 13):
        td.line((q(offset), q(H - 16), q(offset + H), q(16)), fill="#1c2022", width=q(5))
    mask = Image.new("L", image.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        (q(15), q(15), q(W - 16), q(H - 16)),
        q(10),
        fill=255,
    )
    image.alpha_composite(Image.composite(texture, Image.new("RGBA", image.size), mask))
    draw.rounded_rectangle((q(15), q(15), q(W - 16), q(H - 16)), q(10), outline="#2b3032", width=q(2))
    diamond = pts(((W / 2, 76), (W - 28, H / 2), (W / 2, H - 76), (28, H / 2)))
    draw.polygon(diamond, fill=IVORY)
    inner = pts(((W / 2, 88), (W - 40, H / 2), (W / 2, H - 88), (40, H / 2)))
    draw.polygon(inner, fill=INK)
    cx, cy = W / 2, H / 2
    draw.polygon(pts(((cx, cy - 61), (cx + 61, cy), (cx, cy))), fill=COLORS["red"][0])
    draw.polygon(pts(((cx + 61, cy), (cx, cy + 61), (cx, cy))), fill=COLORS["yellow"][0])
    draw.polygon(pts(((cx, cy + 61), (cx - 61, cy), (cx, cy))), fill=COLORS["blue"][0])
    draw.polygon(pts(((cx - 61, cy), (cx, cy - 61), (cx, cy))), fill=COLORS["green"][0])
    outlined_text(draw, (cx, cy), "C", font(FONT_CONDENSED, 67), fill=IVORY, stroke=5)
    return downsample(image)


def contact_sheet(paths: list[Path], output: Path) -> None:
    cols = 11
    thumb_w, thumb_h = 104, 160
    rows = math.ceil(len(paths) / cols)
    sheet = Image.new("RGBA", (cols * (thumb_w + 18) + 18, rows * (thumb_h + 34) + 18), "#08283cff")
    draw = ImageDraw.Draw(sheet)
    label_font = ImageFont.truetype(str(FONT_CONDENSED), 12)
    for index, path in enumerate(paths):
        card = Image.open(path).convert("RGBA").resize((thumb_w, thumb_h), Image.Resampling.LANCZOS)
        x = 18 + (index % cols) * (thumb_w + 18)
        y = 18 + (index // cols) * (thumb_h + 34)
        sheet.alpha_composite(card, (x, y))
        label = path.stem.replace("_number_", " ").replace("_", " ")
        draw.text((x + thumb_w / 2, y + thumb_h + 7), label, font=label_font, anchor="ma", fill="#d7f4fa")
    sheet.convert("RGB").save(output, optimize=True)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--sheet", type=Path, help="Legacy compatibility; the complete deck is now deterministic.")
    parser.add_argument("--contact-sheet", type=Path)
    args = parser.parse_args()
    args.out.mkdir(parents=True, exist_ok=True)

    paths: list[Path] = []
    for color in COLORS:
        for value in range(10):
            path = args.out / f"{color}_number_{value}.png"
            number_card(color, value).save(path, optimize=True)
            paths.append(path)
        for kind in ("skip", "reverse", "draw2"):
            path = args.out / f"{color}_{kind}.png"
            action_card(color, kind).save(path, optimize=True)
            paths.append(path)

    for name, card in (("wild.png", wild_card()), ("wild4.png", wild_four_card()), ("back.png", card_back())):
        path = args.out / name
        card.save(path, optimize=True)
        paths.append(path)

    if args.contact_sheet:
        args.contact_sheet.parent.mkdir(parents=True, exist_ok=True)
        contact_sheet(paths, args.contact_sheet)

    print(f"generated {len(paths)} premium raster card assets in {args.out}")


if __name__ == "__main__":
    main()
