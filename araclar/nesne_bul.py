"""Sprite sayfasındaki ayrı nesneleri (saydam olmayan bağlı bölgeler) bulur, numaralı önizleme ve JSON üretir."""
import json, sys
from collections import deque
from PIL import Image, ImageDraw

kaynak, cikti_png, cikti_json = sys.argv[1:4]
im = Image.open(kaynak).convert("RGBA")
W, H = im.size
a = im.getchannel("A").load()
gor = [[False] * W for _ in range(H)]
kutular = []
for y in range(H):
    for x in range(W):
        if a[x, y] > 0 and not gor[y][x]:
            q = deque([(x, y)]); gor[y][x] = True
            x0 = x1 = x; y0 = y1 = y; n = 0
            while q:
                cx, cy = q.popleft(); n += 1
                x0, x1, y0, y1 = min(x0, cx), max(x1, cx), min(y0, cy), max(y1, cy)
                for dx in (-1, 0, 1):
                    for dy in (-1, 0, 1):
                        nx, ny = cx + dx, cy + dy
                        if 0 <= nx < W and 0 <= ny < H and not gor[ny][nx] and a[nx, ny] > 0:
                            gor[ny][nx] = True; q.append((nx, ny))
            if n >= 6:
                kutular.append([x0, y0, x1 - x0 + 1, y1 - y0 + 1])
kutular.sort(key=lambda k: (k[1] // 16, k[0]))
json.dump(kutular, open(cikti_json, "w"))
Z = 3
on = Image.new("RGBA", (W * Z, H * Z), (150, 165, 165, 255))
on.alpha_composite(im.resize((W * Z, H * Z), Image.NEAREST))
d = ImageDraw.Draw(on)
for i, (x, y, w, h) in enumerate(kutular):
    d.rectangle([x * Z, y * Z, (x + w) * Z - 1, (y + h) * Z - 1], outline=(255, 0, 0, 255))
    d.rectangle([x * Z, y * Z, x * Z + 6 * len(str(i)) + 2, y * Z + 10], fill=(0, 0, 0, 255))
    d.text((x * Z + 1, y * Z), str(i), fill=(255, 255, 0, 255))
on.save(cikti_png)
print(len(kutular), "nesne")
