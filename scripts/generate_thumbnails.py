"""
Generate WebP thumbnails for gallery images.
Keeps originals, creates thumb/ directory with smaller WebP versions.
"""
from PIL import Image
from pathlib import Path
from tqdm import tqdm

IMG_DIR = Path(r"C:\Users\Ken\DrKenReid.github.io\img\bg-img")
THUMB_DIR = IMG_DIR / "thumb"
THUMB_WIDTH = 400
WEBP_QUALITY = 80

def main():
    THUMB_DIR.mkdir(exist_ok=True)
    
    images = sorted([f for f in IMG_DIR.iterdir() 
                     if f.suffix.lower() in (".png", ".jpg", ".jpeg") and f.parent == IMG_DIR])
    
    print(f"Found {len(images)} images")
    total_orig = 0
    total_thumb = 0
    
    for img_path in tqdm(images, desc="Generating thumbnails"):
        try:
            img = Image.open(img_path).convert("RGB")
            
            # Resize maintaining aspect ratio
            ratio = THUMB_WIDTH / img.width
            new_height = int(img.height * ratio)
            img = img.resize((THUMB_WIDTH, new_height), Image.LANCZOS)
            
            # Save as WebP
            out_path = THUMB_DIR / f"{img_path.stem}.webp"
            img.save(out_path, "WEBP", quality=WEBP_QUALITY)
            
            total_orig += img_path.stat().st_size
            total_thumb += out_path.stat().st_size
            
        except Exception as e:
            print(f"\n  Error: {img_path.name}: {e}")
    
    print(f"\nDone!")
    print(f"Original: {total_orig / 1024 / 1024:.1f} MB")
    print(f"Thumbnails: {total_thumb / 1024 / 1024:.1f} MB")
    print(f"Savings: {(1 - total_thumb/total_orig) * 100:.0f}%")

if __name__ == "__main__":
    main()
