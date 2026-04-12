"""Generate visualizations for the Rating Systems blog post."""
import csv, re
from collections import Counter
import matplotlib.pyplot as plt
import matplotlib
matplotlib.use('Agg')
from pathlib import Path

OUT = Path(r"C:\Users\Ken\DrKenReid.github.io\blog\img")
OUT.mkdir(exist_ok=True)

with open(r"C:\Users\Ken\Downloads\goodreads_library_export.csv", encoding="utf-8") as f:
    rows = list(csv.DictReader(f))

rated = [r for r in rows if r.get("My Rating") and int(r["My Rating"]) > 0]
RED = "#fc6060"

# 1. Rating distribution bar chart
fig, ax = plt.subplots(figsize=(8, 4))
dist = Counter(int(r["My Rating"]) for r in rated)
stars = [1, 2, 3, 4, 5]
counts = [dist.get(s, 0) for s in stars]
colors = ["#ddd", "#ddd", "#ddd", "#aaa", RED]
bars = ax.bar([f"{s}★" for s in stars], counts, color=colors, edgecolor="white", linewidth=1.5)
for bar, count in zip(bars, counts):
    ax.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 3, str(count), ha='center', fontsize=11, fontweight='bold')
ax.set_ylabel("Books")
ax.set_title("My Rating Distribution (569 books)", fontsize=14, fontweight='bold')
ax.spines[['top','right']].set_visible(False)
plt.tight_layout()
plt.savefig(OUT / "rating_distribution.png", dpi=150)
plt.close()

# 2. Review length by rating
def clean(t):
    return re.sub(r"<[^>]+>", "", t).strip()

fig, ax = plt.subplots(figsize=(8, 4))
avg_lens = []
for s in stars:
    revs = [clean(r["My Review"]) for r in rated if int(r["My Rating"]) == s and r.get("My Review","").strip()]
    avg_lens.append(sum(len(r) for r in revs) / len(revs) if revs else 0)
colors2 = [RED if s <= 2 else "#aaa" if s == 3 else "#ddd" for s in stars]
bars = ax.bar([f"{s}★" for s in stars], avg_lens, color=colors2, edgecolor="white", linewidth=1.5)
for bar, val in zip(bars, avg_lens):
    ax.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 8, f"{val:.0f}", ha='center', fontsize=11, fontweight='bold')
ax.set_ylabel("Avg chars")
ax.set_title("Average Review Length by Rating", fontsize=14, fontweight='bold')
ax.spines[['top','right']].set_visible(False)
plt.tight_layout()
plt.savefig(OUT / "review_length_by_rating.png", dpi=150)
plt.close()

# 3. My rating vs community avg scatter
fig, ax = plt.subplots(figsize=(8, 5))
for r in rated:
    try:
        my = int(r["My Rating"])
        avg = float(r["Average Rating"])
        ax.scatter(avg, my, alpha=0.3, s=20, c=RED, edgecolors='none')
    except: pass
ax.plot([1,5],[1,5], '--', color='#aaa', linewidth=1, label='Perfect agreement')
ax.set_xlabel("Community Average Rating")
ax.set_ylabel("My Rating")
ax.set_title("My Rating vs Community Average", fontsize=14, fontweight='bold')
ax.legend()
ax.spines[['top','right']].set_visible(False)
plt.tight_layout()
plt.savefig(OUT / "my_vs_community.png", dpi=150)
plt.close()

# 4. % with no review by rating
fig, ax = plt.subplots(figsize=(8, 4))
no_rev_pct = []
for s in stars:
    total = sum(1 for r in rated if int(r["My Rating"]) == s)
    no_rev = sum(1 for r in rated if int(r["My Rating"]) == s and not r.get("My Review","").strip())
    no_rev_pct.append(no_rev/total*100 if total else 0)
bars = ax.bar([f"{s}★" for s in stars], no_rev_pct, color=[RED if p > 50 else "#aaa" for p in no_rev_pct], edgecolor="white", linewidth=1.5)
for bar, val in zip(bars, no_rev_pct):
    ax.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 1, f"{val:.0f}%", ha='center', fontsize=11, fontweight='bold')
ax.set_ylabel("% with no review")
ax.set_title("Silent Ratings: Books with No Review Text", fontsize=14, fontweight='bold')
ax.set_ylim(0, 80)
ax.spines[['top','right']].set_visible(False)
plt.tight_layout()
plt.savefig(OUT / "silent_ratings.png", dpi=150)
plt.close()

print("Done! 4 charts saved to blog/img/")
