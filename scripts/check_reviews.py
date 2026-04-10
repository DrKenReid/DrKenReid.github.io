import csv

with open(r"C:\Users\Ken\Downloads\goodreads_library_export.csv", encoding="utf-8") as f:
    reader = csv.DictReader(f)
    rows = list(reader)

reviewed = [r for r in rows if r.get("My Review", "").strip()]
print(f"Total books: {len(rows)}")
print(f"Books with reviews: {len(reviewed)}")
print()

# Sort by rating then show reviews
reviewed.sort(key=lambda r: float(r.get("My Rating", 0) or 0), reverse=True)
for r in reviewed:
    rating = r.get("My Rating", "?")
    title = r.get("Title", "")
    author = r.get("Author", "")
    review = r.get("My Review", "")[:200].replace("\n", " ")
    print(f"  [{rating}] {author} - {title}")
    print(f"     {review}...")
    print()
