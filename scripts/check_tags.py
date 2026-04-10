import json
d = json.load(open(r"C:\Users\Ken\DrKenReid.github.io\data\photo-tags.json"))
samples = ["1","2","3","4","5","15","50","100","150","200","250","300","350","chaos","chickens","ken1","ken2","lotr","res"]
for k in samples:
    print(f"{k:10s} -> {d.get(k, 'MISSING')}")
