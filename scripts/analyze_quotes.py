import csv
from collections import Counter

with open(r"C:\Users\Ken\GoodReads-Quotes-PDF\data\goodreads_quotes_export.csv", encoding="utf-8") as f:
    reader = csv.DictReader(f)
    rows = list(reader)

print(f"Total quotes: {len(rows)}")
authors = Counter(r["Author"] for r in rows)
print(f"Unique authors: {len(authors)}")
print("\nTop 15 authors:")
for a, c in authors.most_common(15):
    print(f"  {c:3d}  {a}")

print(f"\nMost popular quotes (by Goodreads popularity):")
by_pop = sorted(rows, key=lambda r: int(r.get("Quote Popularity", 0) or 0), reverse=True)
for r in by_pop[:15]:
    q = r["Quote"][:100].replace("\n", " ").replace("<br/>", " ")
    print(f"  [{r['Quote Popularity']:>4s}] {r['Author']} — {r['Book']}")
    print(f"        \"{q}...\"")
