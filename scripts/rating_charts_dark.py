import csv, re
from collections import Counter, defaultdict
import matplotlib.pyplot as plt
import matplotlib
matplotlib.use('Agg')
from pathlib import Path

OUT = Path(r"C:\Users\Ken\DrKenReid.github.io\blog\img")
with open(r"C:\Users\Ken\Downloads\goodreads_library_export.csv", encoding="utf-8") as f:
    rows = list(csv.DictReader(f))
rated = [r for r in rows if r.get("My Rating") and int(r["My Rating"]) > 0]
RED = "#fc6060"
BG = "#1e1e1e"
FG = "#e0e0e0"
GRID = "#333333"

def dark_style(ax, fig):
    fig.patch.set_facecolor(BG)
    ax.set_facecolor(BG)
    ax.tick_params(colors=FG)
    ax.xaxis.label.set_color(FG)
    ax.yaxis.label.set_color(FG)
    ax.title.set_color(FG)
    for s in ax.spines.values():
        s.set_color(GRID)

stars = [1,2,3,4,5]

# 1. Rating distribution
fig, ax = plt.subplots(figsize=(8, 4))
dist = Counter(int(r["My Rating"]) for r in rated)
counts = [dist.get(s, 0) for s in stars]
colors = ["#555", "#555", "#777", "#999", RED]
ax.bar([f"{s}★" for s in stars], counts, color=colors, edgecolor=BG, linewidth=1.5)
for i, c in enumerate(counts):
    ax.text(i, c + 3, str(c), ha='center', fontsize=11, fontweight='bold', color=FG)
ax.set_ylabel("Books")
ax.set_title("My Rating Distribution (569 books)", fontsize=14, fontweight='bold')
dark_style(ax, fig)
ax.spines[['top','right']].set_visible(False)
plt.tight_layout()
plt.savefig(OUT / "rating_distribution.png", dpi=150)
plt.close()

# 2. Review length by rating
fig, ax = plt.subplots(figsize=(8, 4))
avg_lens = []
for s in stars:
    revs = [re.sub(r"<[^>]+>","",r["My Review"]).strip() for r in rated if int(r["My Rating"])==s and r.get("My Review","").strip()]
    avg_lens.append(sum(len(r) for r in revs)/len(revs) if revs else 0)
colors2 = [RED if s <= 2 else "#777" if s == 3 else "#555" for s in stars]
ax.bar([f"{s}★" for s in stars], avg_lens, color=colors2, edgecolor=BG, linewidth=1.5)
for i, v in enumerate(avg_lens):
    ax.text(i, v + 8, f"{v:.0f}", ha='center', fontsize=11, fontweight='bold', color=FG)
ax.set_ylabel("Avg chars")
ax.set_title("Average Review Length by Rating", fontsize=14, fontweight='bold')
dark_style(ax, fig)
ax.spines[['top','right']].set_visible(False)
plt.tight_layout()
plt.savefig(OUT / "review_length_by_rating.png", dpi=150)
plt.close()

# 3. My vs community scatter
fig, ax = plt.subplots(figsize=(8, 5))
for r in rated:
    try:
        ax.scatter(float(r["Average Rating"]), int(r["My Rating"]), alpha=0.35, s=20, c=RED, edgecolors='none')
    except: pass
ax.plot([1,5],[1,5], '--', color='#666', linewidth=1, label='Perfect agreement')
ax.set_xlabel("Community Average Rating")
ax.set_ylabel("My Rating")
ax.set_title("My Rating vs Community Average", fontsize=14, fontweight='bold')
ax.legend(facecolor=BG, edgecolor=GRID, labelcolor=FG)
dark_style(ax, fig)
ax.spines[['top','right']].set_visible(False)
plt.tight_layout()
plt.savefig(OUT / "my_vs_community.png", dpi=150)
plt.close()

# 4. Silent ratings
fig, ax = plt.subplots(figsize=(8, 4))
no_rev_pct = []
for s in stars:
    total = sum(1 for r in rated if int(r["My Rating"])==s)
    no_rev = sum(1 for r in rated if int(r["My Rating"])==s and not r.get("My Review","").strip())
    no_rev_pct.append(no_rev/total*100 if total else 0)
ax.bar([f"{s}★" for s in stars], no_rev_pct, color=[RED if p > 50 else "#777" for p in no_rev_pct], edgecolor=BG, linewidth=1.5)
for i, v in enumerate(no_rev_pct):
    ax.text(i, v + 1, f"{v:.0f}%", ha='center', fontsize=11, fontweight='bold', color=FG)
ax.set_ylabel("% with no review")
ax.set_title("Silent Ratings: Books with No Review Text", fontsize=14, fontweight='bold')
ax.set_ylim(0, 80)
dark_style(ax, fig)
ax.spines[['top','right']].set_visible(False)
plt.tight_layout()
plt.savefig(OUT / "silent_ratings.png", dpi=150)
plt.close()

# 5. Genre rating bias
genres = defaultdict(list)
for r in rated:
    g = r.get("genres","").split("|")[0].split(",")[0].strip() if r.get("genres") else ""
    if g: genres[g].append(int(r["My Rating"]))
data = [(g, sum(v)/len(v), len(v)) for g,v in genres.items() if len(v)>=10]
data.sort(key=lambda x: x[1])
fig, ax = plt.subplots(figsize=(8, 5))
ax.barh([f"{g} ({n})" for g,_,n in data], [a for _,a,_ in data], color=[RED if a>=4.0 else "#777" for _,a,_ in data], edgecolor=BG)
for i, (g,avg,n) in enumerate(data):
    ax.text(avg+0.02, i, f"{avg:.2f}", va='center', fontsize=10, fontweight='bold', color=FG)
ax.set_xlabel("Average Rating")
ax.set_title("My Avg Rating by Genre (10+ books)", fontsize=14, fontweight='bold')
ax.set_xlim(3.0, 4.5)
dark_style(ax, fig)
ax.spines[['top','right']].set_visible(False)
plt.tight_layout()
plt.savefig(OUT / "genre_rating_bias.png", dpi=150)
plt.close()

# 6. Page count
fig, ax = plt.subplots(figsize=(8, 4))
buckets = [("<200",0,200),("200-400",200,400),("400-600",400,600),("600+",600,99999)]
labels, avgs = [], []
for label,lo,hi in buckets:
    vals = [int(r["My Rating"]) for r in rated if r.get("Number of Pages") and r["Number of Pages"].isdigit() and lo<=int(r["Number of Pages"])<hi]
    if vals:
        labels.append(f"{label}\n(n={len(vals)})")
        avgs.append(sum(vals)/len(vals))
ax.bar(labels, avgs, color=[RED if a>=4.0 else "#777" for a in avgs], edgecolor=BG, linewidth=1.5)
for i, v in enumerate(avgs):
    ax.text(i, v+0.02, f"{v:.2f}", ha='center', fontsize=11, fontweight='bold', color=FG)
ax.set_ylabel("My Avg Rating")
ax.set_title("Rating by Page Count", fontsize=14, fontweight='bold')
ax.set_ylim(3.4, 4.5)
dark_style(ax, fig)
ax.spines[['top','right']].set_visible(False)
plt.tight_layout()
plt.savefig(OUT / "page_count_rating.png", dpi=150)
plt.close()

# 7. HWFWM drift
books = []
for r in rated:
    m = re.search(r'\(He Who Fights with Monsters,\s*#(\d+)\)', r["Title"])
    if m: books.append((int(m.group(1)), int(r["My Rating"])))
books.sort()
fig, ax = plt.subplots(figsize=(10, 4))
ax.plot([b[0] for b in books], [b[1] for b in books], 'o-', color=RED, linewidth=2, markersize=8)
ax.set_xlabel("Book #")
ax.set_ylabel("My Rating")
ax.set_title("He Who Fights with Monsters: The Mid-Series Dip", fontsize=14, fontweight='bold')
ax.set_ylim(0.5, 5.5)
ax.set_yticks([1,2,3,4,5])
ax.set_xticks([b[0] for b in books])
dark_style(ax, fig)
ax.spines[['top','right']].set_visible(False)
plt.tight_layout()
plt.savefig(OUT / "hwfwm_drift.png", dpi=150)
plt.close()

print("Done! 7 dark-theme charts regenerated")
