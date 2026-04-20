from pathlib import Path
text = Path('edu-a0037478_extracted.txt').read_text(encoding='utf-8', errors='ignore').splitlines()
patterns = ['listening comprehension','reading comprehension','no statistically significant','significant relationship','oral and written','audiobook','e-text']
for i, line in enumerate(text):
    l = line.lower()
    if any(p in l for p in patterns):
        if not line.strip():
            continue
        print(f'[{i}] {line.strip()}')
        if i-1 >= 0 and text[i-1].strip():
            print('   PREV:', text[i-1].strip())
        if i+1 < len(text) and text[i+1].strip():
            print('   NEXT:', text[i+1].strip())
        print()
