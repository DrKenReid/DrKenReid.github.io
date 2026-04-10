"""Generate a simple KR favicon."""
from PIL import Image, ImageDraw, ImageFont

sizes = [32, 180, 192, 512]

for size in sizes:
    img = Image.new("RGB", (size, size), "#fc6060")
    draw = ImageDraw.Draw(img)
    
    try:
        font_size = int(size * 0.45)
        font = ImageFont.truetype("arial.ttf", font_size)
    except:
        font = ImageFont.load_default()
    
    text = "KR"
    bbox = draw.textbbox((0, 0), text, font=font)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    x = (size - tw) / 2
    y = (size - th) / 2 - bbox[1]
    draw.text((x, y), text, fill="#ffffff", font=font)
    
    if size == 32:
        img.save(r"C:\Users\Ken\DrKenReid.github.io\img\core-img\favicon.png")
    elif size == 180:
        img.save(r"C:\Users\Ken\DrKenReid.github.io\img\core-img\apple-touch-icon.png")
    elif size == 192:
        img.save(r"C:\Users\Ken\DrKenReid.github.io\img\core-img\icon-192.png")
    elif size == 512:
        img.save(r"C:\Users\Ken\DrKenReid.github.io\img\core-img\icon-512.png")

print("Done!")
