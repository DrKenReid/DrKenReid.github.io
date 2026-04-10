"""
Generate a visual contact sheet showing sample photos with their CLIP tags.
"""
import json
from PIL import Image, ImageDraw, ImageFont
from pathlib import Path

IMG_DIR = Path(r"C:\Users\Ken\DrKenReid.github.io\img\bg-img")
TAGS_FILE = Path(r"C:\Users\Ken\DrKenReid.github.io\data\photo-tags.json")
OUTPUT = Path(r"C:\Users\Ken\.openclaw\workspace\photo-tag-samples.png")

EMOJI_MAP = {
    "landscape": "Landscape",
    "urban": "Urban",
    "architecture": "Architecture",
    "abandoned": "Abandoned",
    "wildlife": "Wildlife",
    "nature": "Nature",
    "portrait": "Portrait",
    "bw": "B&W",
    "silhouette": "Silhouette",
    "winter": "Winter",
}

# Pick a diverse set of samples
SAMPLES = ["1", "2", "4", "15", "50", "100", "150", "200", "250", "300", "350", "chickens"]

with open(TAGS_FILE) as f:
    tags = json.load(f)

# Layout: 4 columns x 3 rows
COLS = 4
ROWS = 3
THUMB_W = 400
THUMB_H = 300
LABEL_H = 50
PADDING = 10
CELL_W = THUMB_W + PADDING * 2
CELL_H = THUMB_H + LABEL_H + PADDING * 2

canvas_w = COLS * CELL_W
canvas_h = ROWS * CELL_H
canvas = Image.new("RGB", (canvas_w, canvas_h), (30, 30, 30))
draw = ImageDraw.Draw(canvas)

# Try to get a decent font
try:
    font = ImageFont.truetype("arial.ttf", 22)
    font_small = ImageFont.truetype("arial.ttf", 16)
except:
    font = ImageFont.load_default()
    font_small = font

for idx, key in enumerate(SAMPLES):
    if idx >= COLS * ROWS:
        break
    
    col = idx % COLS
    row = idx // COLS
    x = col * CELL_W + PADDING
    y = row * CELL_H + PADDING

    # Find image file
    img_path = IMG_DIR / f"{key}.png"
    if not img_path.exists():
        img_path = IMG_DIR / f"{key}.jpg"
    if not img_path.exists():
        continue

    # Load and resize
    img = Image.open(img_path).convert("RGB")
    img.thumbnail((THUMB_W, THUMB_H), Image.LANCZOS)
    
    # Center the thumbnail in the cell
    offset_x = x + (THUMB_W - img.width) // 2
    offset_y = y + (THUMB_H - img.height) // 2
    canvas.paste(img, (offset_x, offset_y))

    # Draw image number
    draw.text((x + 5, y + 5), f"#{key}", fill=(255, 255, 255), font=font,
              stroke_width=2, stroke_fill=(0, 0, 0))

    # Draw tags below image
    tag_list = tags.get(key, [])
    tag_text = " | ".join(EMOJI_MAP.get(t, t) for t in tag_list)
    
    tag_y = y + THUMB_H + 8
    # Tag background
    draw.rectangle([(x, tag_y - 4), (x + THUMB_W, tag_y + LABEL_H - 8)], fill=(50, 50, 50))
    draw.text((x + 10, tag_y + 2), tag_text, fill=(252, 96, 96), font=font_small)

canvas.save(OUTPUT, quality=90)
print(f"Saved to {OUTPUT}")
print(f"Size: {canvas_w}x{canvas_h}")
