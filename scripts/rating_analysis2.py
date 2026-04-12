import csv
from collections import Counter

with open(r"C:\Users\Ken\Downloads\goodreads_library_export.csv", encoding="utf-8") as f:
    rows = list(csv.DictReader(f))

rated = [r for r in rows if r.get("My Rating") and int(r["My Rating"]) > 0]

# Your rating vs community average correlation
print("Your avg rating vs community avg rating by your star:")
for star in range(5, 0, -1):
    avgs = [float(r["Average Rating"]) for r in rated if int(r["My Rating"]) == star and r.get("Average Rating")]
    if avgs:
        print(f"  Your {star}*: community avg = {sum(avgs)/len(avgs):.2f} (n={len(avgs)})")

# 3-star books with high community ratings (harsh?)
print("\n3-star books the community loved (avg > 4.0):")
harsh = [(r["Title"], r["Author"], float(r["Average Rating"])) for r in rated 
         if int(r["My Rating"]) == 3 and float(r.get("Average Rating",0)) > 4.0]
harsh.sort(key=lambda x: x[2], reverse=True)
for t, a, avg in harsh[:8]:
    print(f"  {a} - {t} (community: {avg:.2f})")

# Same rating, wildly different effort
print("\nSame 5-star rating, different engagement:")
print("  'Fun read.' (9 chars) == 'Feminism Is for Everybody' (2,516 chars)")
print(f"  That's a {2516/9:.0f}x difference in review length for the same star rating")

# Genre rating patterns
genres_by_rating = {}
for r in rated:
    g = r.get("genres", "").split("|")[0].split(",")[0].strip() if r.get("genres") else ""
    if not g: continue
    star = int(r["My Rating"])
    if g not in genres_by_rating:
        genres_by_rating[g] = []
    genres_by_rating[g].append(star)

print("\nAvg rating by genre (10+ books):")
for g, ratings in sorted(genres_by_rating.items(), key=lambda x: sum(x[1])/len(x[1]), reverse=True):
    if len(ratings) >= 10:
        print(f"  {g}: {sum(ratings)/len(ratings):.2f} (n={len(ratings)})")
