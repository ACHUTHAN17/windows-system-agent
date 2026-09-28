"""Generates build/icon.png (512) and build/icon.ico from pure geometry (no fonts needed).
Run: python scripts/make-icon.py   (needs Pillow)"""
from PIL import Image, ImageDraw
import os

S = 1024
img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
# gradient rounded square
grad = Image.new("RGBA", (S, S))
px = grad.load()
c1, c2 = (108, 140, 255), (138, 92, 255)
for y in range(S):
    for x in range(S):
        t = (x + y) / (2 * S)
        px[x, y] = tuple(int(c1[i] + (c2[i] - c1[i]) * t) for i in range(3)) + (255,)
mask = Image.new("L", (S, S), 0)
ImageDraw.Draw(mask).rounded_rectangle((32, 32, S - 32, S - 32), radius=230, fill=255)
img.paste(grad, (0, 0), mask)
d = ImageDraw.Draw(img)
w = 84
# ">" chevron
d.line([(300, 330), (520, 512), (300, 694)], fill="white", width=w, joint="curve")
for p in [(300, 330), (520, 512), (300, 694)]:
    d.ellipse((p[0] - w // 2, p[1] - w // 2, p[0] + w // 2, p[1] + w // 2), fill="white")
# "_" cursor
d.rounded_rectangle((580, 660, 790, 660 + w), radius=w // 2, fill="white")

here = os.path.dirname(os.path.abspath(__file__))
out = os.path.join(here, "..", "build")
os.makedirs(out, exist_ok=True)
img.resize((512, 512), Image.LANCZOS).save(os.path.join(out, "icon.png"))
img.save(os.path.join(out, "icon.ico"), sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
print("icons written to", os.path.normpath(out))
