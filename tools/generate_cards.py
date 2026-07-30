"""
Generate classic 4-color party card faces as PNG (raster only, no SVG).
Layout matches real UNO-style cards: white rim, colored field, diagonal oval,
corner marks, printed-style symbols.
"""
from __future__ import annotations

import math
import os
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

OUT = Path(__file__).resolve().parents[1] / "client" / "public" / "assets" / "cards"
OUT.mkdir(parents=True, exist_ok=True)

# High-res master size (scaled down in UI)
W, H = 420, 630
RIM = 22
FIELD_R = 28
CARD_R = 36

# Classic deck colors (from real cards)
COLORS = {
    "red": {"fill": (214, 45, 36), "deep": (170, 28, 22), "ink": (196, 32, 28)},
    "yellow": {"fill": (245, 200, 24), "deep": (220, 170, 10), "ink": (214, 168, 12)},
    "green": {"fill": (56, 160, 64), "deep": (36, 120, 44), "ink": (40, 140, 48)},
    "blue": {"fill": (36, 120, 200), "deep": (20, 80, 150), "ink": (28, 100, 180)},
    "black": {"fill": (28, 28, 28), "deep": (10, 10, 10), "ink": (20, 20, 20)},
}

WHITE = (255, 255, 255)
NEAR_WHITE = (250, 250, 250)


def rounded_rect(draw, xy, radius, fill, outline=None, width=1):
    draw.rounded_rectangle(xy, radius=radius, fill=fill, outline=outline, width=width)


def load_font(size: int, bold=True):
    # Prefer rounded/bold display fonts closest to toy-card numerals
    candidates = [
        r"C:\Windows\Fonts\seguiemj.ttf",
        r"C:\Windows\Fonts\comicbd.ttf",
        r"C:\Windows\Fonts\COMICBD.TTF",
        r"C:\Windows\Fonts\arialbd.ttf",
        r"C:\Windows\Fonts\ARIALBD.TTF",
        r"C:\Windows\Fonts\segoeuib.ttf",
        r"C:\Windows\Fonts\impact.ttf",
        r"C:\Windows\Fonts\arial.ttf",
    ]
    for p in candidates:
        if os.path.exists(p):
            try:
                return ImageFont.truetype(p, size=size)
            except OSError:
                continue
    return ImageFont.load_default()


def base_card(color_key: str) -> tuple[Image.Image, ImageDraw.ImageDraw]:
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # white plastic shell
    rounded_rect(draw, (0, 0, W - 1, H - 1), CARD_R, WHITE)
    # subtle outer edge
    draw.rounded_rectangle((0, 0, W - 1, H - 1), radius=CARD_R, outline=(210, 210, 210), width=2)

    c = COLORS[color_key]
    # colored field with slight vertical gradient via two rects + blur optional
    field = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    fd = ImageDraw.Draw(field)
    rounded_rect(fd, (RIM, RIM, W - RIM - 1, H - RIM - 1), FIELD_R, c["fill"])
    # deeper bottom shade
    shade = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shade)
    rounded_rect(sd, (RIM, RIM + int(H * 0.35), W - RIM - 1, H - RIM - 1), FIELD_R, (*c["deep"], 90))
    field = Image.alpha_composite(field, shade)
    img = Image.alpha_composite(img, field)
    draw = ImageDraw.Draw(img)
    return img, draw


def oval_mask(size: tuple[int, int], angle: float = -28) -> Image.Image:
    ow, oh = size
    oval = Image.new("L", (ow, oh), 0)
    od = ImageDraw.Draw(oval)
    od.ellipse((0, 0, ow - 1, oh - 1), fill=255)
    return oval.rotate(angle, resample=Image.Resampling.BICUBIC, expand=True)


def paste_oval(img: Image.Image, content: Image.Image | None = None, angle: float = -28):
    """Paste white diagonal oval + optional content already oriented upright."""
    ow, oh = int(W * 0.70), int(H * 0.72)
    # white oval plate
    plate = Image.new("RGBA", (ow, oh), (0, 0, 0, 0))
    pd = ImageDraw.Draw(plate)
    pd.ellipse((0, 0, ow - 1, oh - 1), fill=NEAR_WHITE)
    # soft inner shadow
    ring = Image.new("RGBA", (ow, oh), (0, 0, 0, 0))
    rd = ImageDraw.Draw(ring)
    rd.ellipse((4, 4, ow - 5, oh - 5), outline=(0, 0, 0, 30), width=3)
    plate = Image.alpha_composite(plate, ring)

    if content is not None:
        # center content on plate
        cw, ch = content.size
        px = (ow - cw) // 2
        py = (oh - ch) // 2
        plate.alpha_composite(content, (px, py))

    rotated = plate.rotate(angle, resample=Image.Resampling.BICUBIC, expand=True)
    # soft shadow under oval
    shadow = Image.new("RGBA", rotated.size, (0, 0, 0, 0))
    mask = rotated.split()[-1]
    sh = Image.new("RGBA", rotated.size, (0, 0, 0, 70))
    shadow.paste(sh, (0, 0), mask)
    shadow = shadow.filter(ImageFilter.GaussianBlur(6))

    rx = (W - rotated.width) // 2 + 2
    ry = (H - rotated.height) // 2 + 4
    img.alpha_composite(shadow, (rx, ry))
    img.alpha_composite(rotated, (rx - 2, ry - 4))
    return img


def text_img(text: str, font: ImageFont.FreeTypeFont, fill, pad=8, stroke=0) -> Image.Image:
    # measure
    tmp = Image.new("RGBA", (10, 10))
    d = ImageDraw.Draw(tmp)
    bbox = d.textbbox((0, 0), text, font=font, stroke_width=stroke)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    im = Image.new("RGBA", (tw + pad * 2, th + pad * 2), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.text(
        (pad - bbox[0], pad - bbox[1]),
        text,
        font=font,
        fill=fill,
        stroke_width=stroke,
        stroke_fill=fill,
    )
    return im


def draw_corner(img: Image.Image, text: str, color, top_left=True, symbol_fn=None):
    """Corner labels: upright top-left, rotated 180 bottom-right."""
    font = load_font(52)
    if symbol_fn:
        piece = symbol_fn(56, color)
    else:
        piece = text_img(text, font, color, pad=2)

    # slight margin from field
    m = RIM + 10
    if top_left:
        img.alpha_composite(piece, (m, m + 4))
    else:
        rot = piece.rotate(180, expand=True)
        img.alpha_composite(rot, (W - m - rot.width, H - m - rot.height - 4))


def symbol_skip(size: int, color) -> Image.Image:
    im = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    # circle with slash — classic "no" symbol
    m = 3
    d.ellipse((m, m, size - m - 1, size - m - 1), outline=color, width=max(4, size // 8))
    # diagonal bar
    d.line((size * 0.22, size * 0.78, size * 0.78, size * 0.22), fill=color, width=max(4, size // 8))
    return im


def symbol_reverse(size: int, color) -> Image.Image:
    """Classic reverse: two thick S-curve arrows (matches physical deck)."""
    im = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    w = max(6, size // 7)

    def thick_arc(bbox, start, end):
        d.arc(bbox, start=start, end=end, fill=color, width=w)

    def head(points):
        d.polygon(points, fill=color)

    # Upper arrow: curves left then down, head points up-left
    thick_arc((size * 0.08, size * 0.14, size * 0.78, size * 0.78), 200, 10)
    head(
        [
            (size * 0.18, size * 0.16),
            (size * 0.42, size * 0.10),
            (size * 0.36, size * 0.36),
        ]
    )
    # Lower arrow: curves right then up, head points down-right
    thick_arc((size * 0.22, size * 0.22, size * 0.92, size * 0.86), 20, 190)
    head(
        [
            (size * 0.82, size * 0.84),
            (size * 0.58, size * 0.90),
            (size * 0.64, size * 0.64),
        ]
    )
    return im


def symbol_draw2(size: int, color) -> Image.Image:
    """Two overlapping mini cards like real +2 symbol."""
    im = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    # back card (tilted left)
    c1 = Image.new("RGBA", (int(size * 0.42), int(size * 0.58)), (0, 0, 0, 0))
    cd = ImageDraw.Draw(c1)
    cd.rounded_rectangle((0, 0, c1.width - 1, c1.height - 1), radius=6, fill=color)
    c1 = c1.rotate(18, expand=True, resample=Image.Resampling.BICUBIC)
    # front card
    c2 = Image.new("RGBA", (int(size * 0.42), int(size * 0.58)), (0, 0, 0, 0))
    cd2 = ImageDraw.Draw(c2)
    cd2.rounded_rectangle((0, 0, c2.width - 1, c2.height - 1), radius=6, fill=color)
    # lighter inset
    inset = 4
    lighter = tuple(min(255, int(c * 1.15)) if isinstance(c, int) else c for c in (color if len(color) == 3 else color[:3]))
    cd2.rounded_rectangle((inset, inset, c2.width - inset - 1, c2.height - inset - 1), radius=4, fill=lighter)

    im.alpha_composite(c1, (int(size * 0.08), int(size * 0.18)))
    im.alpha_composite(c2, (int(size * 0.34), int(size * 0.12)))
    return im


def symbol_wild4_blocks(size: int) -> Image.Image:
    """Four stacked colored rectangles like real wild +4."""
    im = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    blocks = [
        ((0.38, 0.12), (214, 45, 36)),  # red top
        ((0.22, 0.28), (36, 120, 200)),  # blue
        ((0.42, 0.40), (56, 160, 64)),  # green
        ((0.28, 0.52), (245, 200, 24)),  # yellow bottom
    ]
    bw, bh = int(size * 0.34), int(size * 0.42)
    for (x, y), col in blocks:
        card = Image.new("RGBA", (bw, bh), (0, 0, 0, 0))
        d = ImageDraw.Draw(card)
        d.rounded_rectangle((0, 0, bw - 1, bh - 1), radius=5, fill=col)
        d.rounded_rectangle((3, 3, bw - 4, bh - 4), radius=3, outline=(255, 255, 255, 90), width=2)
        im.alpha_composite(card, (int(size * x), int(size * y)))
    return im


def symbol_wild_pie(size: int) -> Image.Image:
    """Four-color pie chart like classic wild oval fill."""
    im = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    # pie slices: red, blue, green, yellow (clockwise from classic photo)
    # In photo: top-left red, top-right blue, bottom-right green, bottom-left yellow
    cx, cy = size // 2, size // 2
    r = size // 2 - 2
    # use pieslice
    d.pieslice((2, 2, size - 3, size - 3), start=180, end=270, fill=(214, 45, 36))  # red TL
    d.pieslice((2, 2, size - 3, size - 3), start=270, end=360, fill=(36, 120, 200))  # blue TR
    d.pieslice((2, 2, size - 3, size - 3), start=0, end=90, fill=(56, 160, 64))  # green BR
    d.pieslice((2, 2, size - 3, size - 3), start=90, end=180, fill=(245, 200, 24))  # yellow BL
    # white ring
    d.ellipse((2, 2, size - 3, size - 3), outline=WHITE, width=max(3, size // 28))
    return im


def tiny_wild_corner(size: int = 36) -> Image.Image:
    return symbol_wild_pie(size)


def make_number(color_key: str, value: int) -> Image.Image:
    img, _ = base_card(color_key)
    ink = COLORS[color_key]["ink"]
    # big number content
    font = load_font(220)
    # stroke thickens digits like printed UNO numerals
    num = text_img(str(value), font, ink, pad=10, stroke=6)
    # slight italic lean like classic deck
    num = num.transform(
        num.size,
        Image.Transform.AFFINE,
        (1, -0.12, 16, 0, 1, 0),
        resample=Image.Resampling.BICUBIC,
    )
    img = paste_oval(img, num)
    # corners white
    draw_corner(img, str(value), WHITE, True)
    draw_corner(img, str(value), WHITE, False)
    return finish(img)


def make_skip(color_key: str) -> Image.Image:
    img, _ = base_card(color_key)
    ink = COLORS[color_key]["ink"]
    sym = symbol_skip(200, ink)
    img = paste_oval(img, sym)
    corner = symbol_skip(48, WHITE)
    m = RIM + 10
    img.alpha_composite(corner, (m, m + 6))
    rot = corner.rotate(180, expand=True)
    img.alpha_composite(rot, (W - m - rot.width, H - m - rot.height - 6))
    return finish(img)


def make_reverse(color_key: str) -> Image.Image:
    img, _ = base_card(color_key)
    ink = COLORS[color_key]["ink"]
    sym = symbol_reverse(210, ink)
    img = paste_oval(img, sym)
    corner = symbol_reverse(48, WHITE)
    m = RIM + 8
    img.alpha_composite(corner, (m, m + 4))
    rot = corner.rotate(180, expand=True)
    img.alpha_composite(rot, (W - m - rot.width, H - m - rot.height - 4))
    return finish(img)


def make_draw2(color_key: str) -> Image.Image:
    img, _ = base_card(color_key)
    ink = COLORS[color_key]["ink"]
    sym = symbol_draw2(220, ink)
    img = paste_oval(img, sym)
    font = load_font(44)
    label = text_img("+2", font, WHITE, pad=2)
    m = RIM + 8
    img.alpha_composite(label, (m, m + 6))
    rot = label.rotate(180, expand=True)
    img.alpha_composite(rot, (W - m - rot.width, H - m - rot.height - 6))
    return finish(img)


def make_wild() -> Image.Image:
    img, _ = base_card("black")
    pie = symbol_wild_pie(260)
    # white oval with pie filling most of it
    ow, oh = int(W * 0.70), int(H * 0.72)
    plate = Image.new("RGBA", (ow, oh), (0, 0, 0, 0))
    pd = ImageDraw.Draw(plate)
    pd.ellipse((0, 0, ow - 1, oh - 1), fill=NEAR_WHITE)
    # paste pie centered
    px = (ow - pie.width) // 2
    py = (oh - pie.height) // 2
    # clip pie to oval-ish by pasting full pie
    plate.alpha_composite(pie, (px, py))
    rotated = plate.rotate(-28, resample=Image.Resampling.BICUBIC, expand=True)
    shadow = Image.new("RGBA", rotated.size, (0, 0, 0, 0))
    mask = rotated.split()[-1]
    sh = Image.new("RGBA", rotated.size, (0, 0, 0, 80))
    shadow.paste(sh, (0, 0), mask)
    shadow = shadow.filter(ImageFilter.GaussianBlur(6))
    rx = (W - rotated.width) // 2
    ry = (H - rotated.height) // 2
    img.alpha_composite(shadow, (rx + 2, ry + 4))
    img.alpha_composite(rotated, (rx, ry))
    # tiny pie corners
    tiny = tiny_wild_corner(40)
    m = RIM + 12
    img.alpha_composite(tiny, (m, m + 8))
    rot = tiny.rotate(180, expand=True)
    img.alpha_composite(rot, (W - m - rot.width, H - m - rot.height - 8))
    return finish(img)


def make_wild4() -> Image.Image:
    img, _ = base_card("black")
    blocks = symbol_wild4_blocks(240)
    img = paste_oval(img, blocks)
    font = load_font(44)
    label = text_img("+4", font, WHITE, pad=2)
    m = RIM + 8
    img.alpha_composite(label, (m, m + 6))
    rot = label.rotate(180, expand=True)
    img.alpha_composite(rot, (W - m - rot.width, H - m - rot.height - 6))
    return finish(img)


def finish(img: Image.Image) -> Image.Image:
    """Plastic gloss overlay clipped to card shape."""
    gloss = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    gd = ImageDraw.Draw(gloss)
    # soft top-left sheen band
    for i in range(90):
        alpha = max(0, int(28 * (1 - i / 90)))
        gd.arc((-40, -60 + i // 2, int(W * 0.95), int(H * 0.7) + i // 2), start=200, end=330, fill=(255, 255, 255, alpha), width=3)

    mask = Image.new("L", (W, H), 0)
    md = ImageDraw.Draw(mask)
    md.rounded_rectangle((1, 1, W - 2, H - 2), radius=CARD_R, fill=255)
    r, g, b, a = gloss.split()
    a = ImageChops.multiply(a, mask)
    gloss = Image.merge("RGBA", (r, g, b, a))
    return Image.alpha_composite(img, gloss)


def save(img: Image.Image, name: str):
    path = OUT / f"{name}.png"
    # downscale with high quality for web
    web = img.resize((280, 420), Image.Resampling.LANCZOS)
    web.save(path, "PNG", optimize=True)
    print("wrote", path.name)


def main():
    for color in ("red", "yellow", "green", "blue"):
        for n in range(10):
            save(make_number(color, n), f"{color}_number_{n}")
        save(make_skip(color), f"{color}_skip")
        save(make_reverse(color), f"{color}_reverse")
        save(make_draw2(color), f"{color}_draw2")
    save(make_wild(), "black_wild")
    save(make_wild4(), "black_wild4")
    print("Done. Cards in", OUT)


if __name__ == "__main__":
    main()
