#!/usr/bin/env python3
"""Refresh listening.json, in data/: scrobbles per week, over the whole account.

The music page draws a listening calendar from it (js/listening.js): one
cell per week, shaded by that week's scrobbles, with the week's most
played artist in the cell's card. Last.fm keeps a chart for every week
since an account opened, so the whole history is there to be asked for,
one week at a time. It runs weekly from the live-data workflow.

    python .github/scripts/refresh_listening.py              # the weeks not on file, and the newest two
    python .github/scripts/refresh_listening.py --backfill   # the same, with no time limit
    python .github/scripts/refresh_listening.py --dry-run    # fetch and merge, write nothing

Requires LASTFM_API_KEY in the environment (the workflow passes the
repository secret).

The file (data/schema/listening.schema.json has the full descriptions):

    user        the Last.fm account
    registered  the day the account opened; no week before it is asked for
    updated     the date of the run that last wrote the file
    weeks       one record per chart week, oldest first:
        d  the day the chart week starts (UTC; Last.fm's weeks start on
           a Sunday at noon)
        n  scrobbles that week: the plays of every artist in the week's
           chart, added up
        a  the week's most played artist     (left out of a week
        p  that artist's plays                with nothing played)

Incremental. A week on file is kept, so a run asks only for the chart
weeks the file does not have and, again, for the newest RECENT (2):
scrobbles made offline reach Last.fm late, and its newest chart can still
be filling. A normal weekly run is three requests. The first run finds a
file with no weeks and walks the whole history, about 52 requests for
every year of the account, DELAY apart. Without --backfill a run stops
asking after TIME_BUDGET seconds, so the weekly job can never spend its
whole allowance here; what it fetched is written and the next run carries
on from there. A long run also writes every SAVE_EVERY weeks, so one that
is interrupted keeps what it had fetched.

Three stages, so the rules can be tested without a network:

    ask()                       the network: one API call, with retries
    registered_from(), charts_from(), week_from()
                                pure: responses to the file's shapes
    wanted(), merge(), lost_history()
                                pure: what to ask for, and the new list

What can go wrong, and what happens:

  - One week fails (after TRIES attempts): it is left out, the rest
    carry on, and the next run asks for it again, since it is still not
    on file. The exit status stays 0.
  - GIVE_UP weeks fail in a row: Last.fm is down or refusing, so the run
    stops asking and writes what it has.
  - The chart list or the registration date cannot be fetched, the key is
    refused, or every week asked for failed: the file is left as it was
    and the exit status is 1, which the workflow reports.
  - There is no file yet, and the run fetched nothing: it writes one with
    no weeks before it ends, whatever went wrong (main). The page asks
    for the file and the workflow commits it by name, so a run never ends
    without one; from a file with no weeks the page draws nothing.
  - A week comes back with nothing played where the file has plays: the
    file's record is kept (merge). Nothing on file is ever dropped, and
    main() checks that with lost_history() before every write.
  - The file is there but cannot be read: nothing is written, exit 1. A
    person should look before a run starts the history again from empty.
"""
from __future__ import annotations

import http.client
import json
import os
import sys
import time
import urllib.error
from datetime import date, datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import refresh_now  # noqa: E402  (the account, and the one Last.fm call the site makes)
import sitelib  # noqa: E402

ROOT = sitelib.ROOT
LISTENING = ROOT / "data" / "listening.json"
LASTFM_USER = refresh_now.LASTFM_USER

RECENT = 2          # the newest chart weeks, asked for again on every run
DELAY = 0.25        # seconds between requests: four a second at most
TRIES = 3           # attempts at one request
BACKOFF = 2.0       # seconds before the second attempt, twice that before the third
GIVE_UP = 4         # failed weeks in a row before the run stops asking
TIME_BUDGET = 300   # seconds a run without --backfill may spend asking
SAVE_EVERY = 50     # weeks fetched between writes on a long run

# Last.fm error codes that asking again cannot cure: authentication
# failed, invalid API key, suspended API key.
FATAL_CODES = {4, 10, 26}


class LastfmError(RuntimeError):
    """Last.fm answered with an error payload: {"error": code, "message": ...}."""

    def __init__(self, code, message=""):
        super().__init__("Last.fm error %s: %s" % (code, message or "no message"))
        self.code = code


class Refused(RuntimeError):
    """The key is refused (FATAL_CODES): no request will work until it is fixed."""


# --- the network -----------------------------------------------------------

def _error_in(payload) -> LastfmError | None:
    if isinstance(payload, dict) and "error" in payload:
        try:
            code = int(payload["error"])
        except (TypeError, ValueError):
            code = payload["error"]
        return LastfmError(code, payload.get("message", ""))
    return None


def ask(method: str, key: str, *, lastfm=None, sleep=time.sleep, **params) -> dict:
    """One Last.fm API call as parsed JSON, asked up to TRIES times.

    Raises Refused at once for a key Last.fm will not take, and the last
    error (LastfmError, an HTTP or network error, or ValueError for an
    answer that is not JSON) when every attempt failed. Last.fm reports
    most faults twice over, as an HTTP status and as an error payload in
    the body, so a failed status is read for its payload too.
    """
    lastfm = lastfm or refresh_now.lastfm
    err: Exception = RuntimeError("not asked")
    for attempt in range(TRIES):
        if attempt:
            sleep(BACKOFF * attempt)
        try:
            data = lastfm(method, key, **params)
            err = _error_in(data)
            if err is None:
                return data
        except urllib.error.HTTPError as e:
            err = e
            try:
                err = _error_in(json.loads(e.read())) or e
            except (OSError, ValueError):
                pass
        except (OSError, ValueError, http.client.HTTPException) as e:
            err = e  # URLError and timeouts are OSErrors; a cut-off body is an HTTPException
        if isinstance(err, LastfmError) and err.code in FATAL_CODES:
            raise Refused(str(err))
    raise err


# --- responses to the file's shapes (pure) -------------------------------------

def day(ts: int) -> str:
    """A unix time as its UTC date, 'YYYY-MM-DD'."""
    return datetime.fromtimestamp(int(ts), timezone.utc).date().isoformat()


def midnight(d: str) -> int:
    """'YYYY-MM-DD' as the unix time of that day's start, UTC."""
    return int(datetime.strptime(d, "%Y-%m-%d").replace(tzinfo=timezone.utc).timestamp())


def registered_from(info: dict) -> str:
    """user.getinfo -> the day the account opened, 'YYYY-MM-DD'.

    ValueError when the answer does not say: without the date a first run
    would ask for every week since Last.fm's own first chart, in 2005.
    """
    reg = (info.get("user") or {}).get("registered")
    if isinstance(reg, dict):
        reg = reg.get("unixtime") or reg.get("#text")
    try:
        ts = int(reg)
    except (TypeError, ValueError):
        raise ValueError("user.getinfo gave no registration date") from None
    if ts <= 0:
        raise ValueError("user.getinfo gave no registration date")
    return day(ts)


def charts_from(chartlist: dict, since: str, now: int) -> list[tuple[int, int]]:
    """user.getweeklychartlist -> [(from, to)] oldest first: the chart
    weeks that end after the day `since` began and have started by `now`.

    Last.fm lists every week since its own first chart, whoever asks, so
    the weeks before the account opened are left out here. ValueError for
    an answer with no chart list in it.
    """
    body = chartlist.get("weeklychartlist")
    if not isinstance(body, dict):
        raise ValueError("no weeklychartlist in the answer")
    charts = body.get("chart") or []
    if isinstance(charts, dict):  # a list of one arrives as the one
        charts = [charts]
    floor = midnight(since)
    out = set()
    for c in charts:
        try:
            start, end = int(c["from"]), int(c["to"])
        except (KeyError, TypeError, ValueError):
            continue
        if end > floor and start <= now and end > start:
            out.add((start, end))
    return sorted(out)


def week_from(chart: dict, start: int) -> dict:
    """user.getweeklyartistchart -> the week's record.

    {"d", "n"}, and "a" and "p" when anything was played. The top artist
    is the one with the most plays, the first of them in Last.fm's own
    order when two tie. ValueError for an answer with no chart in it, so
    a malformed answer is a failed week and not a week of silence.
    """
    body = chart.get("weeklyartistchart")
    if not isinstance(body, dict):
        raise ValueError("no weeklyartistchart in the answer")
    artists = body.get("artist") or []
    if isinstance(artists, dict):  # one artist arrives as an object, not a list
        artists = [artists]
    total, top, top_plays = 0, "", 0
    for a in artists:
        plays = int(a.get("playcount") or 0)
        total += plays
        if plays > top_plays:
            top, top_plays = str(a.get("name") or ""), plays
    week = {"d": day(start), "n": total}
    if total > 0 and top:
        week["a"] = top
        week["p"] = top_plays
    return week


# --- the rules (pure) --------------------------------------------------------

def wanted(stored: list[dict], charts: list[tuple[int, int]], recent: int = RECENT) -> list[tuple[int, int]]:
    """The chart weeks to ask for: every one not on file, oldest first,
    then those of the `recent` newest that are on file, to be asked again."""
    have = {w["d"] for w in stored}
    missing = [c for c in charts if day(c[0]) not in have]
    again = [c for c in charts[-recent:] if day(c[0]) in have] if recent > 0 else []
    return missing + again


def merge(stored: list[dict], fetched: list[dict]) -> list[dict]:
    """The weeks on file with the fetched ones laid over them, oldest first.

    Pure: no network, no clock, no files. A fetched week replaces the one
    on file for the same day, with one exception: a week that comes back
    with nothing played where the file has plays keeps the file's record.
    An empty answer for a week that had music is a fault upstream far more
    often than a week of scrobbles deleted, and the record cannot be had
    again once Last.fm stops serving it. A week on file is never dropped,
    whether or not this run's chart list still names it.
    """
    weeks = {w["d"]: w for w in stored}
    for w in fetched:
        old = weeks.get(w["d"])
        if old is not None and old.get("n", 0) > 0 and w.get("n", 0) == 0:
            continue
        weeks[w["d"]] = w
    return [weeks[d] for d in sorted(weeks)]


def lost_history(old: list[dict], new: list[dict]) -> list[str]:
    """The weeks on file that the new list drops, or empties of plays.
    merge() is built never to produce one; this is the guard that proves
    it before anything is written."""
    after = {w["d"]: w for w in new}
    out = []
    for w in old:
        now = after.get(w["d"])
        if now is None:
            out.append("%s: gone" % w["d"])
        elif w.get("n", 0) > 0 and now.get("n", 0) == 0:
            out.append("%s: %d scrobbles on file, none now" % (w["d"], w["n"]))
    return out


# --- the file ----------------------------------------------------------------

class Unreadable(RuntimeError):
    """The file is there, but is not the one this script writes."""


def load(path: Path) -> dict:
    """The file as {"user", "weeks", ...}; a file with no weeks when there
    is none yet. Unreadable when it exists and cannot be used: starting
    again from empty would write over whatever history it held."""
    if not path.exists():
        return {"user": LASTFM_USER, "weeks": []}
    try:
        doc = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError) as e:
        raise Unreadable("%s cannot be read (%s)" % (path.name, e)) from None
    weeks = doc.get("weeks") if isinstance(doc, dict) else None
    if not isinstance(weeks, list) or not all(
            isinstance(w, dict) and isinstance(w.get("d"), str) for w in weeks):
        raise Unreadable("%s is not a listening history: no list of weeks" % path.name)
    return doc


def dumps(doc: dict) -> str:
    """The file's text: the head on the first line, then a week a line,
    so a weekly refresh is a diff of two or three lines."""
    head = {k: doc[k] for k in ("user", "registered", "updated") if doc.get(k)}
    compact = {"ensure_ascii": False, "separators": (",", ":")}
    weeks = ",\n".join(json.dumps(w, **compact) for w in doc["weeks"])
    return json.dumps(head, **compact)[:-1] + ',"weeks":[\n' + weeks + "\n]}\n"


def write(path: Path, doc: dict) -> None:
    """Whole or not at all: the text goes to a file beside it, which then
    takes its place, so a run stopped mid-write leaves the old file."""
    tmp = path.with_name(path.name + ".tmp")
    tmp.write_text(dumps(doc), encoding="utf-8", newline="\n")
    os.replace(tmp, path)


def main(argv=None, **network) -> int:
    ap = sitelib.arg_parser(__doc__)
    ap.add_argument("--backfill", action="store_true",
                    help="no time limit: walk the whole history in one run")
    ap.add_argument("--dry-run", action="store_true", help="fetch and merge, write nothing")
    args = ap.parse_args(argv)
    code = refresh(args, **network)
    # A run never ends without a file (see "What can go wrong").
    if not args.dry_run and not LISTENING.exists():
        write(LISTENING, {"user": LASTFM_USER, "weeks": []})
        print("listening: no file yet and nothing fetched; wrote one with no weeks.")
    return code


def refresh(args, *, lastfm=None, sleep=time.sleep, clock=time.monotonic, today=None) -> int:
    """The run itself: the exit status. `lastfm`, `sleep`, `clock` and
    `today` stand in for the network, the waiting and the date in a test."""
    key = os.environ.get("LASTFM_API_KEY")
    if not key:
        print("::error::LASTFM_API_KEY not set; nothing fetched.")
        return 1
    try:
        doc = load(LISTENING)
    except Unreadable as e:
        print("::error::%s; leaving it alone." % e)
        return 1
    on_file = list(doc["weeks"])
    today = today or date.today().isoformat()

    def call(method, **params):
        return ask(method, key, lastfm=lastfm, sleep=sleep, **params)

    try:
        registered = doc.get("registered") or registered_from(call("user.getinfo"))
        sleep(DELAY)
        charts = charts_from(call("user.getweeklychartlist"), registered, int(time.time()))
        if not charts:
            raise ValueError("the chart list names no week since %s" % registered)
    except Exception as e:  # nothing can be asked for without these two
        print("::error::Last.fm chart list failed (%s); leaving listening.json alone." % e)
        return 1

    def save(fetched) -> bool:
        """Write the merge of the file and `fetched`; False if the guard refused."""
        weeks = merge(on_file, fetched)
        lost = lost_history(on_file, weeks)
        if lost:
            print("::error::refusing to write: the merge would lose %d week(s) on file: %s"
                  % (len(lost), "; ".join(lost[:5])))
            return False
        if weeks == on_file and doc.get("registered") == registered:
            return True  # nothing new: the file, and its date, stay as they are
        if not args.dry_run:
            write(LISTENING, {"user": doc.get("user") or LASTFM_USER, "registered": registered,
                              "updated": today, "weeks": weeks})
        return True

    todo = wanted(on_file, charts)
    deadline = None if args.backfill else clock() + TIME_BUDGET
    fetched, failed, in_a_row, left = [], [], 0, 0
    refused = None
    for i, (start, end) in enumerate(todo):
        if deadline is not None and clock() > deadline:
            left = len(todo) - i
            break
        sleep(DELAY)
        try:
            fetched.append(week_from(call("user.getweeklyartistchart", **{"from": start, "to": end}), start))
            in_a_row = 0
        except Refused as e:
            refused = e
            break
        except Exception as e:  # one bad week never stops the rest
            failed.append(day(start))
            in_a_row += 1
            print("::warning::week of %s failed (%s); the next run asks for it again" % (day(start), e))
            if in_a_row >= GIVE_UP:
                left = len(todo) - i - 1
                print("::warning::%d weeks failed in a row; not asking for the other %d this run"
                      % (GIVE_UP, left))
                break
            continue
        if len(fetched) % SAVE_EVERY == 0 and not save(fetched):
            return 1

    # With nothing fetched there is nothing to write, registration date
    # included: the file is left as it was.
    if fetched and not save(fetched):
        return 1
    weeks = merge(on_file, fetched)
    print("listening: %d weeks on file, %s scrobbles (%d fetched this run, %d failed%s)%s"
          % (len(weeks), format(sum(w["n"] for w in weeks), ","), len(fetched), len(failed),
             ", %d left for the next run" % left if left else "",
             " [dry run: nothing written]" if args.dry_run else ""))
    if refused is not None:
        print("::error::%s; no request will work until the key is fixed." % refused)
        return 1
    if not fetched:
        print("::error::none of the %d week(s) asked for could be fetched; leaving listening.json alone."
              % len(todo))
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
