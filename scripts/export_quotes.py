"""
Export curated quotes from Goodreads CSV for the website.
Picks diverse, memorable quotes across different authors/books.
Outputs a JSON file for the literature page to consume.
"""
import csv
import json
import re
from pathlib import Path

INPUT = Path(r"C:\Users\Ken\GoodReads-Quotes-PDF\data\goodreads_quotes_export.csv")
OUTPUT = Path(r"C:\Users\Ken\DrKenReid.github.io\data\quotes.json")

# Read all quotes
with open(INPUT, encoding="utf-8") as f:
    reader = csv.DictReader(f)
    rows = list(reader)

# Clean HTML tags from quotes
def clean(text):
    text = re.sub(r"<br\s*/?>", " ", text)
    text = re.sub(r"<[^>]+>", "", text)
    text = text.replace("\u00e2\u0080\u0099", "\u2019")  # fix encoding
    text = text.strip()
    return text

# Select diverse, high-quality quotes
# Criteria: readable length (20-400 chars), good popularity, diverse authors
selected = []
seen_authors = set()
seen_books = set()

# First pass: high popularity, one per author
by_pop = sorted(rows, key=lambda r: int(r.get("Quote Popularity", 0) or 0), reverse=True)
for r in by_pop:
    q = clean(r["Quote"])
    author = r["Author"].strip()
    book = r["Book"].strip()
    
    if len(q) < 20 or len(q) > 500:
        continue
    if author in seen_authors:
        continue
    
    selected.append({
        "quote": q,
        "author": author,
        "book": book,
        "popularity": int(r.get("Quote Popularity", 0) or 0)
    })
    seen_authors.add(author)
    seen_books.add(book)
    
    if len(selected) >= 30:
        break

# Output
OUTPUT.parent.mkdir(parents=True, exist_ok=True)
with open(OUTPUT, "w", encoding="utf-8") as f:
    json.dump(selected, f, indent=2, ensure_ascii=False)

print(f"Exported {len(selected)} quotes to {OUTPUT}")
for i, q in enumerate(selected):
    preview = q["quote"][:80]
    print(f"  {i+1:2d}. [{q['popularity']:>5d}] {q['author']} — {q['book']}")
    print(f"      \"{preview}...\"")
