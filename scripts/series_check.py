import csv, re
from collections import defaultdict

with open(r"C:\Users\Ken\Downloads\goodreads_library_export.csv", encoding="utf-8") as f:
    rows = list(csv.DictReader(f))
rated = [r for r in rows if r.get("My Rating") and int(r["My Rating"]) > 0]

series_books = defaultdict(list)
for r in rated:
    m = re.search(r'\(([^,]+),\s*#([\d.]+)\)', r["Title"])
    if m:
        series = m.group(1).strip()
        try:
            num = float(m.group(2))
        except: continue
        series_books[series].append((num, int(r["My Rating"])))

for series, books in sorted(series_books.items(), key=lambda x: len(x[1]), reverse=True):
    if len(books) >= 5:
        books.sort()
        ratings = " -> ".join(str(b[1]) for b in books)
        avg = sum(b[1] for b in books) / len(books)
        print(f"{series} ({len(books)} books, avg {avg:.1f}): {ratings}")
