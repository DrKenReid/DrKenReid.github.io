from pathlib import Path
lines = Path('edu-a0037478_extracted.txt').read_text(encoding='utf-8', errors='ignore').splitlines()
for center in [1068,1076,1086,1208,1460,1483,2221,2253,2276,2290]:
    print('\n' + '='*18 + f' around {center+1} ' + '='*18)
    for i in range(max(0,center-2), min(len(lines), center+3)):
        if lines[i].strip():
            print(f'[{i+1}] {lines[i].strip()}')
