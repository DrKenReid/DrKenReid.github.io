import csv, re
from collections import Counter, defaultdict

with open(r"C:\Users\Ken\Downloads\goodreads_library_export.csv", encoding="utf-8") as f:
    rows = list(csv.DictReader(f))

rated = [r for r in rows if r.get("My Rating") and int(r["My Rating"]) > 0]

def clean(t):
    return re.sub(r"<[^>]+>", "", t).strip()

# 1. Rating over time: has my average changed year over year?
print("=== Average rating by year read ===")
by_year = defaultdict(list)
for r in rated:
    dr = r.get("Date Read", "").strip()
    if dr and "/" in dr:
        year = dr.split("/")[-1]
        if year.isdigit() and int(year) >= 2015:
            by_year[year].append(int(r["My Rating"]))
for y in sorted(by_year.keys()):
    vals = by_year[y]
    print(f"  {y}: avg={sum(vals)/len(vals):.2f} n={len(vals)}")

# 2. Page count vs rating
print("\n=== Avg rating by page count bucket ===")
buckets = {"<200": (0,200), "200-400": (200,400), "400-600": (400,600), "600+": (600,99999)}
for label, (lo, hi) in buckets.items():
    vals = [int(r["My Rating"]) for r in rated if r.get("Number of Pages") and r["Number of Pages"].isdigit() and lo <= int(r["Number of Pages"]) < hi]
    if vals:
        print(f"  {label} pages: avg={sum(vals)/len(vals):.2f} n={len(vals)}")

# 3. Do I rate rereads higher?
print("\n=== Reread vs first read ===")
rereads = [int(r["My Rating"]) for r in rated if r.get("Read Count") and int(r.get("Read Count",1)) > 1]
firsts = [int(r["My Rating"]) for r in rated if not r.get("Read Count") or int(r.get("Read Count",1)) <= 1]
if rereads:
    print(f"  Rereads: avg={sum(rereads)/len(rereads):.2f} n={len(rereads)}")
print(f"  First reads: avg={sum(firsts)/len(firsts):.2f} n={len(firsts)}")

# 4. Review sentiment vs rating (do my words match my stars?)
print("\n=== Negative words in positive reviews ===")
neg_words = ["disappointing", "boring", "dull", "tedious", "mediocre", "frustrating", "annoying", "poorly", "weak", "lackluster", "unfortunately"]
for star in [5, 4]:
    revs = [(r["Title"], clean(r["My Review"])) for r in rated if int(r["My Rating"]) == star and r.get("My Review","").strip()]
    flagged = [(t, rev) for t, rev in revs if any(w in rev.lower() for w in neg_words)]
    print(f"  {star}*: {len(flagged)}/{len(revs)} reviews contain negative language")
    for t, rev in flagged[:3]:
        words = [w for w in neg_words if w in rev.lower()]
        print(f"    {t}: {words}")

# 5. Rating consistency for series
print("\n=== Series rating drift ===")
# Find books with series info in title
series_books = defaultdict(list)
for r in rated:
    title = r["Title"]
    m = re.search(r'\(([^,]+),\s*#(\d+)\)', title)
    if m:
        series = m.group(1).strip()
        num = int(m.group(2))
        series_books[series].append((num, int(r["My Rating"]), title))

for series, books in sorted(series_books.items()):
    if len(books) >= 4:
        books.sort()
        ratings = [b[1] for b in books]
        drift = ratings[-1] - ratings[0]
        if abs(drift) >= 2:
            print(f"  {series}: {' -> '.join(str(r) for _, r, _ in books)} (drift: {drift:+d})")
