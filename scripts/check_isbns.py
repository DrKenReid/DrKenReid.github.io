import json
d = json.load(open(r"C:\Users\Ken\DrKenReid.github.io\data\reviews.json", encoding="utf-8"))
for r in d:
    print(f"{r['title']:50s} isbn={r['isbn']:15s} isbn13={r['isbn13']}")
