import csv
from collections import Counter

with open(r"C:\Users\Ken\Downloads\goodreads_library_export.csv", encoding="utf-8") as f:
    rows = list(csv.DictReader(f))

# Rating distribution
ratings = [int(r["My Rating"]) for r in rows if r.get("My Rating") and int(r["My Rating"]) > 0]
rated = [r for r in rows if r.get("My Rating") and int(r["My Rating"]) > 0]
unrated = [r for r in rows if not r.get("My Rating") or int(r["My Rating"]) == 0]

print(f"Total books: {len(rows)}")
print(f"Rated: {len(rated)}")
print(f"Unrated: {len(unrated)}")
print(f"\nRating distribution:")
dist = Counter(ratings)
for star in range(5, 0, -1):
    count = dist.get(star, 0)
    pct = count / len(rated) * 100
    bar = "#" * int(pct)
    print(f"  {star}*: {count:3d} ({pct:.1f}%) {bar}")

avg = sum(ratings) / len(ratings)
print(f"\nAverage rating: {avg:.2f}")

# Review length by rating
import re
def clean(t):
    t = re.sub(r"<[^>]+>", "", t)
    return t.strip()

print(f"\nAvg review length by rating:")
for star in range(5, 0, -1):
    revs = [clean(r["My Review"]) for r in rated if int(r["My Rating"]) == star and r.get("My Review","").strip()]
    if revs:
        avg_len = sum(len(r) for r in revs) / len(revs)
        print(f"  {star}*: {len(revs)} reviews, avg {avg_len:.0f} chars")
    else:
        print(f"  {star}*: 0 reviews")

# Shortest and longest 5-star reviews
five_star_reviewed = [(r["Title"], r["Author"], clean(r["My Review"])) for r in rated 
                       if int(r["My Rating"]) == 5 and r.get("My Review","").strip()]
five_star_reviewed.sort(key=lambda x: len(x[2]))
print(f"\nShortest 5* reviews:")
for t, a, rev in five_star_reviewed[:5]:
    print(f"  {a} - {t}: \"{rev[:80]}\" ({len(rev)} chars)")
print(f"\nLongest 5* reviews:")
for t, a, rev in five_star_reviewed[-5:]:
    print(f"  {a} - {t}: \"{rev[:80]}...\" ({len(rev)} chars)")

# Rating vs avg community rating
print(f"\nBiggest disagreements (your rating vs avg):")
disagree = []
for r in rated:
    try:
        my = int(r["My Rating"])
        avg_r = float(r["Average Rating"])
        diff = my - avg_r
        disagree.append((r["Title"], r["Author"], my, avg_r, diff))
    except: pass
disagree.sort(key=lambda x: x[4])
print("  You rated LOWER than community:")
for t, a, my, avg_r, diff in disagree[:5]:
    print(f"    {a} - {t}: you={my}* avg={avg_r:.2f} (diff={diff:+.2f})")
print("  You rated HIGHER than community:")
for t, a, my, avg_r, diff in disagree[-5:]:
    print(f"    {a} - {t}: you={my}* avg={avg_r:.2f} (diff={diff:+.2f})")

# How many books at each rating have NO review
print(f"\nBooks with NO review by rating:")
for star in range(5, 0, -1):
    total = sum(1 for r in rated if int(r["My Rating"]) == star)
    no_rev = sum(1 for r in rated if int(r["My Rating"]) == star and not r.get("My Review","").strip())
    pct = no_rev/total*100 if total else 0
    print(f"  {star}*: {no_rev}/{total} ({pct:.0f}%) have no review")
