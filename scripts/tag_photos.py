"""
Batch photo tagger using OpenCLIP (ViT-B-32).
Classifies gallery images into multi-label categories.
"""

import open_clip
import torch
import json
import os
from PIL import Image
from pathlib import Path
from tqdm import tqdm

# --- Config ---
IMG_DIR = Path(r"C:\Users\Ken\DrKenReid.github.io\img\bg-img")
OUTPUT = Path(r"C:\Users\Ken\DrKenReid.github.io\data\photo-tags.json")

# Categories with descriptive prompts for CLIP
CATEGORIES = {
    "landscape": [
        "a wide landscape photograph of hills and countryside",
        "a scenic vista with mountains or rolling hills",
        "a panoramic view of nature with sky and horizon",
        "a wide shot of a lake, river, or ocean scenery",
    ],
    "urban": [
        "a photograph of a city street or urban scene",
        "an urban photograph with buildings and streets",
        "a canal or waterway in a city",
        "a cityscape photograph",
    ],
    "architecture": [
        "a photograph focused on a building or architectural structure",
        "a church, cathedral, or historic building",
        "a bridge or monument",
        "architectural details of a structure",
    ],
    "abandoned": [
        "a photograph of an abandoned or derelict building",
        "urban decay, ruins, or overgrown structures",
        "a crumbling or disused building",
        "an abandoned industrial site or shipwreck",
    ],
    "wildlife": [
        "a photograph of an animal or bird",
        "wildlife photography of birds, squirrels, or other animals",
        "a close-up photo of an animal in nature",
        "farm animals like sheep, cows, or chickens",
    ],
    "nature": [
        "a close-up photograph of trees, flowers, or plants",
        "a woodland path or forest scene",
        "a nature photograph of leaves, moss, or ferns",
        "a garden or botanical photograph",
    ],
    "portrait": [
        "a portrait photograph of a person",
        "a photograph with a person as the main subject",
        "a self-portrait or photo of someone posing",
        "people in a photograph",
    ],
    "bw": [
        "a black and white photograph",
        "a monochrome photograph with no color",
        "a grayscale photograph",
    ],
    "silhouette": [
        "a silhouette photograph with a backlit subject",
        "a dark outline of a subject against bright sky",
        "a dramatic silhouette at sunset or sunrise",
    ],
    "winter": [
        "a winter photograph with snow on the ground",
        "a snowy landscape or frost-covered scene",
        "a cold winter scene with ice or snow",
    ],
}

# Thresholds per category — lowered to get ~2 tags avg
DEFAULT_THRESHOLD = 0.20
THRESHOLDS = {
    "landscape": 0.21,
    "urban": 0.21,
    "architecture": 0.21,
    "abandoned": 0.22,
    "wildlife": 0.22,
    "nature": 0.19,
    "portrait": 0.23,
    "bw": 0.25,
    "silhouette": 0.23,
    "winter": 0.24,
}


def main():
    print("Loading OpenCLIP model (ViT-B-32)...")
    device = "cuda" if torch.cuda.is_available() else "cpu"
    model, _, preprocess = open_clip.create_model_and_transforms("ViT-B-32", pretrained="laion2b_s34b_b79k")
    tokenizer = open_clip.get_tokenizer("ViT-B-32")
    model = model.to(device)
    model.eval()
    print(f"Model loaded on {device}")

    # Pre-encode all category text prompts
    print("Encoding category prompts...")
    category_features = {}
    for cat, prompts in CATEGORIES.items():
        tokens = tokenizer(prompts).to(device)
        with torch.no_grad():
            text_feats = model.encode_text(tokens)
            text_feats /= text_feats.norm(dim=-1, keepdim=True)
            category_features[cat] = text_feats.mean(dim=0, keepdim=True)
            category_features[cat] /= category_features[cat].norm(dim=-1, keepdim=True)

    cat_names = list(category_features.keys())
    cat_tensor = torch.cat([category_features[c] for c in cat_names], dim=0)

    # Find all images
    image_files = sorted(
        [f for f in IMG_DIR.iterdir() if f.suffix.lower() in (".png", ".jpg", ".jpeg")],
        key=lambda f: (not f.stem.isdigit(), int(f.stem) if f.stem.isdigit() else 0, f.stem)
    )
    print(f"Found {len(image_files)} images")

    # Resume support
    results = {}
    if OUTPUT.exists():
        with open(OUTPUT) as f:
            results = json.load(f)
        print(f"Resuming: {len(results)} already tagged")

    tagged = 0
    for img_path in tqdm(image_files, desc="Tagging"):
        key = img_path.stem
        if key in results:
            continue

        try:
            image = preprocess(Image.open(img_path).convert("RGB")).unsqueeze(0).to(device)
            with torch.no_grad():
                image_features = model.encode_image(image)
                image_features /= image_features.norm(dim=-1, keepdim=True)
                similarities = (image_features @ cat_tensor.T).squeeze(0)

            tags = []
            for i, cat in enumerate(cat_names):
                score = similarities[i].item()
                threshold = THRESHOLDS.get(cat, DEFAULT_THRESHOLD)
                if score >= threshold:
                    tags.append(cat)

            if not tags:
                best_idx = similarities.argmax().item()
                tags = [cat_names[best_idx]]

            results[key] = sorted(tags)
            tagged += 1

            if tagged % 50 == 0:
                OUTPUT.parent.mkdir(parents=True, exist_ok=True)
                with open(OUTPUT, "w") as f:
                    json.dump(results, f, indent=2, sort_keys=True)
                print(f"\n  Checkpoint: {len(results)} tagged")

        except Exception as e:
            print(f"\n  Error {img_path.name}: {e}")
            results[key] = ["nature"]

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT, "w") as f:
        json.dump(results, f, indent=2, sort_keys=True)

    print(f"\nDone! Tagged {len(results)} images -> {OUTPUT}")

    from collections import Counter
    all_tags = [t for tags in results.values() for t in tags]
    dist = Counter(all_tags).most_common()
    print("\nCategory distribution:")
    for cat, count in dist:
        pct = count / len(results) * 100
        print(f"  {cat:15s}: {count:3d} ({pct:.1f}%)")


if __name__ == "__main__":
    main()
