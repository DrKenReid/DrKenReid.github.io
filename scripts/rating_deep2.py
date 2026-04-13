import csv
from collections import defaultdict

with open(r"C:\Users\Ken\Downloads\goodreads_library_export.csv", encoding="utf-8") as f:
    rows = list(csv.DictReader(f))

rated = [r for r in rows if r.get("My Rating") and int(r["My Rating"]) > 0]

# Rating vs publication year
print("=== Avg rating by publication decade ===")
by_decade = defaultdict(list)
for r in rated:
    yr = r.get("Original Publication Year", "").strip()
    if yr and yr.lstrip("-").isdigit():
        y = int(yr)
        if y >= 1800:
            decade = f"{(y//10)*10}s"
            by_decade[decade].append(int(r["My Rating"]))
for d in sorted(by_decade.keys()):
    vals = by_decade[d]
    if len(vals) >= 5:
        print(f"  {d}: avg={sum(vals)/len(vals):.2f} n={len(vals)}")

# My vs community: standard deviation
print("\n=== My rating variance vs community ===")
diffs = []
for r in rated:
    try:
        diffs.append(int(r["My Rating"]) - float(r["Average Rating"]))
    except: pass
import statistics
print(f"  Mean diff (my - community): {statistics.mean(diffs):+.2f}")
print(f"  Std dev of diff: {statistics.stdev(diffs):.2f}")
print(f"  I rate higher than community: {sum(1 for d in diffs if d > 0)}/{len(diffs)}")
print(f"  I rate lower than community: {sum(1 for d in diffs if d < 0)}/{len(diffs)}")
print(f"  Exact match: {sum(1 for d in diffs if abs(d) < 0.5)}/{len(diffs)}")
