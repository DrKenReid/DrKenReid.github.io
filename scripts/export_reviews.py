"""
Export selected reviews for the literature page.
Picks diverse, interesting reviews across ratings and genres.
"""
import csv
import json
import re
from pathlib import Path

INPUT = Path(r"C:\Users\Ken\Downloads\goodreads_library_export.csv")
OUTPUT = Path(r"C:\Users\Ken\DrKenReid.github.io\data\reviews.json")

def clean_html(text):
    text = re.sub(r"<br\s*/?>", "\n", text)
    text = re.sub(r"<blockquote>", '"', text)
    text = re.sub(r"</blockquote>", '" ', text)
    text = re.sub(r"<i>", "", text)
    text = re.sub(r"</i>", "", text)
    text = re.sub(r"<[^>]+>", "", text)
    text = text.strip()
    return text

with open(INPUT, encoding="utf-8") as f:
    rows = list(csv.DictReader(f))

reviewed = [r for r in rows if r.get("My Review", "").strip()]

# Hand-picked diverse selection
picks = [
    # 5-star passionate reviews
    "Babel",
    "Stoner",
    "Cobalt Red",
    "Dune (Dune",
    "To Kill a Mockingbird",
    "Perdido Street Station",
    # 3-star mixed
    "The Great Gatsby",
    "What We Owe the Future",
    # Thoughtful / reflective
    "White Fragility",
    "A Little Life",
    "Life of Pi",
    "Name of the Wind",
]

selected = []
for title_search in picks:
    for r in reviewed:
        if r["Title"] == title_search or title_search in r["Title"]:
            review_text = clean_html(r["My Review"])
            selected.append({
                "title": r["Title"],
                "author": r["Author"],
                "rating": int(r.get("My Rating", 0) or 0),
                "review": review_text,
                "isbn": r.get("ISBN", "").strip().strip("=").strip('"'),
                "isbn13": r.get("ISBN13", "").strip().strip("=").strip('"'),
            })
            break

OUTPUT.parent.mkdir(parents=True, exist_ok=True)
with open(OUTPUT, "w", encoding="utf-8") as f:
    json.dump(selected, f, indent=2, ensure_ascii=False)

print(f"Exported {len(selected)} reviews")
for r in selected:
    stars = r["rating"]
    preview = r["review"][:120].replace("\n", " ")
    print(f"  {'*' * stars} {r['author']} - {r['title']}")
    print(f"    {preview}...")
    print()
