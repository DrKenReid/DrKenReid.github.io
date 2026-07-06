#!/usr/bin/env python3
"""Refresh data/lastfm.json with the current Last.fm scrobble count.

Runs in CI on a schedule (see .github/workflows/lastfm-refresh.yml).
Requires the LASTFM_API_KEY environment variable — create a key at
https://www.last.fm/api/account/create and add it as a repository
secret named LASTFM_API_KEY.

Pages read data/lastfm.json at load time and update any element with a
data-lastfm attribute (see shared-components.js), so the committed
number is only a fallback.
"""

import json
import os
import sys
import urllib.request
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
USER = "GoheX"


def main():
    key = os.environ.get("LASTFM_API_KEY")
    if not key:
        print("LASTFM_API_KEY not set — aborting without changes.")
        return 1

    url = ("https://ws.audioscrobbler.com/2.0/"
           f"?method=user.getinfo&user={USER}&api_key={key}&format=json")
    with urllib.request.urlopen(url, timeout=30) as resp:
        info = json.load(resp)

    playcount = int(info["user"]["playcount"])
    out = ROOT / "data" / "lastfm.json"
    payload = {"scrobbles": playcount, "user": USER, "updated": date.today().isoformat()}
    out.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8", newline="\n")
    print(f"scrobbles: {playcount:,} -> {out.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
