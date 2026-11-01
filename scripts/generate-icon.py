#!/usr/bin/env python3
"""Generate premium app icon assets (Apple HIG-oriented) with Pillow.

Concept: a single confident upward area-trend line on a rich diagonal violet
gradient. No baked shadows, thick rounded strokes, generous margins (safe for
Android adaptive masking). Rendered at 4x supersampling for crisp edges.
"""
from PIL import Image, ImageDraw, ImageChops
import os

BASE = 1024
SS = 4
W = BASE * SS

HERE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets")

# ---- palette ----
C_TL = (138, 106, 250)   # #8A6AFA  upper-left (lighter violet)
C_BR = (58, 30, 134)     # #3A1E86  lower-right (deep indigo)
WHITE = (255, 255, 255)

# ---- mark geometry (in base-1024 coords) ----
# A confident upward trend with one gentle dip so it reads as a chart, not a
# plain diagonal. Centered in the canvas with generous margins.
PTS = [(240, 600), (406, 498), (560, 546), (788, 398)]
BASELINE_Y = 680
LINE_W = 80
APEX_R = 56
START_R = 20
AREA_ALPHA = 0.22


def lerp(a, b, t):
    return tuple(int(round(a[i] + (b[i] - a[i]) * t)) for i in range(3))


def make_gradient(size):
    """Diagonal violet gradient + soft top-left light + bottom-right vignette.
    Computed on a small grid then upscaled for speed and smoothness."""
    g = 256
    grad = Image.new("RGB", (g, g))
    px = grad.load()
    for y in range(g):
        for x in range(g):
            fx, fy = x / (g - 1), y / (g - 1)
            t = (fx + fy) / 2.0
            r, gg, b = lerp(C_TL, C_BR, t)
            # top-left light
            d_tl = ((fx) ** 2 + (fy) ** 2) ** 0.5 / 1.414
            light = max(0.0, 1.0 - d_tl / 0.75) * 0.10
            # bottom-right vignette
            d_br = ((1 - fx) ** 2 + (1 - fy) ** 2) ** 0.5 / 1.414
            vig = max(0.0, 1.0 - d_br / 0.85) * 0.14
            r = min(255, max(0, int(r + 255 * light - 120 * vig)))
            gg = min(255, max(0, int(gg + 255 * light - 120 * vig)))
            b = min(255, max(0, int(b + 255 * light - 120 * vig)))
            px[x, y] = (r, gg, b)
    return grad.resize((size, size), Image.BICUBIC)


def draw_mark(size, with_area=True):
    """White trend mark on transparent, supersampled. Coords scaled from 1024."""
    s = size / BASE
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    pts = [(x * s, y * s) for (x, y) in PTS]
    lw = LINE_W * s

    # translucent area fill under the line (depth via opacity, not shadow)
    if with_area:
        poly = pts + [(pts[-1][0], BASELINE_Y * s), (pts[0][0], BASELINE_Y * s)]
        poly_mask = Image.new("L", (size, size), 0)
        ImageDraw.Draw(poly_mask).polygon(poly, fill=255)
        top_y = min(p[1] for p in pts)
        base_y = BASELINE_Y * s
        vgrad = Image.new("L", (size, size), 0)
        vpx = vgrad.load()
        span = max(1.0, base_y - top_y)
        amax = int(AREA_ALPHA * 255)
        # build a 1px-tall column then broadcast
        col = []
        for y in range(size):
            f = (y - top_y) / span
            f = min(1.0, max(0.0, f))
            col.append(int(amax * (1.0 - f)))
        for y in range(size):
            v = col[y]
            if v:
                vpx[0, y] = v
        # broadcast column across width
        onecol = vgrad.crop((0, 0, 1, size)).resize((size, size))
        area_alpha = ImageChops.multiply(poly_mask, onecol)
        white_layer = Image.new("RGBA", (size, size), (255, 255, 255, 0))
        white_layer.putalpha(area_alpha)
        img = Image.alpha_composite(img, white_layer)
        draw = ImageDraw.Draw(img)

    # the trend line (round caps/joins via curve joint + end discs)
    draw.line(pts, fill=WHITE, width=int(lw), joint="curve")
    r = lw / 2.0
    for (x, y) in pts:
        draw.ellipse([x - r, y - r, x + r, y + r], fill=WHITE)

    # apex node (single point of emphasis — the "arrival")
    ax, ay = pts[-1]
    ar = APEX_R * s
    draw.ellipse([ax - ar, ay - ar, ax + ar, ay + ar], fill=WHITE)
    return img


def rounded(img, radius):
    mask = Image.new("L", img.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, img.size[0], img.size[1]], radius=radius, fill=255)
    out = img.convert("RGBA")
    out.putalpha(mask)
    return out


def down(img):
    return img.resize((BASE, BASE), Image.LANCZOS)


def main():
    grad = make_gradient(W)
    mark = draw_mark(W, with_area=False)
    mark_solid = mark  # monochrome silhouette is the same clean white mark

    # 1) icon.png  — full-bleed gradient + mark (iOS masks corners itself)
    icon = grad.convert("RGBA")
    icon = Image.alpha_composite(icon, mark)
    icon_1024 = down(icon)
    icon_1024.convert("RGB").save(os.path.join(HERE, "icon.png"))

    # 2) adaptive-icon.png — transparent foreground (mark only), safe-zone sized
    down(mark).save(os.path.join(HERE, "adaptive-icon.png"))

    # 3) adaptive-bg.png — full-bleed gradient background for Android
    down(grad.convert("RGBA")).convert("RGB").save(os.path.join(HERE, "adaptive-bg.png"))

    # 4) adaptive-monochrome.png — white silhouette for Android themed icons
    down(mark_solid).save(os.path.join(HERE, "adaptive-monochrome.png"))

    # 5) splash-icon.png — rounded gradient badge on transparent (shows on white)
    badge_px = int(BASE * 0.70)
    badge = icon_1024.resize((badge_px, badge_px), Image.LANCZOS)
    badge = rounded(badge, int(badge_px * 0.225))
    splash = Image.new("RGBA", (BASE, BASE), (0, 0, 0, 0))
    off = (BASE - badge_px) // 2
    splash.alpha_composite(badge, (off, off))
    splash.save(os.path.join(HERE, "splash-icon.png"))

    # 6) favicon.png — 48px
    icon_1024.convert("RGB").resize((48, 48), Image.LANCZOS).save(os.path.join(HERE, "favicon.png"))

    print("generated:", ", ".join([
        "icon.png", "adaptive-icon.png", "adaptive-bg.png",
        "adaptive-monochrome.png", "splash-icon.png", "favicon.png"]))


if __name__ == "__main__":
    main()
