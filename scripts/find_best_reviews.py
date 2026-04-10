import csv
import re

with open(r"C:\Users\Ken\Downloads\goodreads_library_export.csv", encoding="utf-8") as f:
    rows = list(csv.DictReader(f))

reviewed = [r for r in rows if r.get("My Review", "").strip()]

def clean(text):
    text = re.sub(r"<br\s*/?>", "\n", text)
    text = re.sub(r"<[^>]+>", "", text)
    return text.strip()

# Find reviews that are substantive (100+ chars), have ISBNs, and show personality
candidates = []
for r in reviewed:
    review = clean(r["My Review"])
    isbn = r.get("ISBN", "").strip().strip("=").strip('"')
    isbn13 = r.get("ISBN13", "").strip().strip("=").strip('"')
    rating = int(r.get("My Rating", 0) or 0)
    if len(review) < 100:
        continue
    if not isbn and not isbn13:
        continue
    candidates.append({
        "title": r["Title"],
        "author": r["Author"],
        "rating": rating,
        "review": review,
        "length": len(review),
    })

# Sort by review length (longer = more substantive)
candidates.sort(key=lambda r: r["length"], reverse=True)

# Print top 30 for selection
for i, c in enumerate(candidates[:30]):
    preview = c["review"][:150].replace("\n", " ")
    print(f"{i+1:2d}. [{'*'*c['rating']:5s}] {c['author']} - {c['title']}")
    print(f"    ({c['length']} chars) {preview}...")
    print()
