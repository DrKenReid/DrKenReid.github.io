"""refresh_listening: the weekly listening history never loses a week.

The listening file (listening.json, in data/) is built a week at a time
from Last.fm's weekly
charts and kept: a run asks only for the weeks the file does not have and
the newest two. So the file is the record, and these cases pin what the
module docstring of .github/scripts/refresh_listening.py promises about
it: one bad week is skipped and asked for again, a run that could fetch
nothing writes nothing, an empty answer never replaces a week that had
plays, and a run cut short keeps what it had fetched.

No test touches the network. FakeLastfm stands in for the one function
that does (refresh_now.lastfm), answering in the shapes Last.fm's JSON
uses, oddities included: a chart list that starts years before the
account, a single artist as an object and not a list of one, an error
as a payload.

Run from the repo root:
    python -m unittest tests.test_refresh_listening -v
"""

import contextlib
import io
import json
import os
import sys
import tempfile
import unittest
import urllib.error
from pathlib import Path
from unittest import mock

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / ".github" / "scripts"))
import refresh_listening as rl  # noqa: E402
import validate_data  # noqa: E402

FIXTURE = ROOT / "tests" / "fixtures" / "listening.json"
WEEK = 7 * 24 * 3600
NOON = 12 * 3600


def start_of(d):
    """The unix time a chart week starts: noon UTC on the day `d`."""
    return rl.midnight(d) + NOON


def chart_for(week):
    """The user.getweeklyartistchart answer that says what `week` says:
    its top artist first, then others, none of them with more plays."""
    artists = []
    if week["n"] > 0:
        artists.append({"name": week["a"], "playcount": str(week["p"]), "@attr": {"rank": "1"}})
        rest, i = week["n"] - week["p"], 0
        while rest > 0:
            i += 1
            take = min(rest, max(1, week["p"] - 1))
            artists.append({"name": "Other %d" % i, "playcount": str(take), "@attr": {"rank": str(i + 1)}})
            rest -= take
    if len(artists) == 1:
        artists = artists[0]
    return {"weeklyartistchart": {"artist": artists, "@attr": {"user": "fixture-user"}}}


class FakeLastfm:
    """refresh_now.lastfm with no network: lastfm(method, key, **params).

    `weeks` is the history it serves; `registered` the day the account
    opened. `broken` holds the days whose chart raises, `payload_errors`
    {day: code} those answered with an error payload, and `empty` the
    days answered with a chart that has nothing in it.
    """

    def __init__(self, weeks, registered="2014-03-21"):
        self.weeks = {w["d"]: w for w in weeks}
        self.registered = registered
        self.calls = []
        self.broken = set()
        self.payload_errors = {}
        self.empty = set()
        self.fail_chart_list = False

    def asked(self, method):
        return [params for m, params in self.calls if m == method]

    def __call__(self, method, key, **params):
        self.calls.append((method, params))
        if method == "user.getinfo":
            ts = rl.midnight(self.registered) + 3600
            return {"user": {"name": "fixture-user", "registered": {"unixtime": str(ts), "#text": ts}}}
        if method == "user.getweeklychartlist":
            if self.fail_chart_list:
                raise urllib.error.URLError("timed out")
            first = min(start_of(d) for d in self.weeks)
            # As Last.fm does: the list starts long before the account.
            starts = [first - WEEK * k for k in range(8, 0, -1)] + sorted(start_of(d) for d in self.weeks)
            return {"weeklychartlist": {
                "chart": [{"#text": "", "from": str(s), "to": str(s + WEEK)} for s in starts],
                "@attr": {"user": "fixture-user"}}}
        if method == "user.getweeklyartistchart":
            d = rl.day(params["from"])
            if d in self.broken:
                raise urllib.error.URLError("connection reset")
            if d in self.payload_errors:
                return {"error": self.payload_errors[d], "message": "said the fake"}
            if d in self.empty:
                return {"weeklyartistchart": {"#text": "\n", "@attr": {"user": "fixture-user"}}}
            return chart_for(self.weeks[d])
        raise AssertionError("unexpected method %s" % method)


def some_weeks(n, first="2014-03-16"):
    """`n` consecutive chart weeks with plays, the third of them silent."""
    out, ts = [], rl.midnight(first)
    for i in range(n):
        d = rl.day(ts + i * WEEK)
        out.append({"d": d, "n": 0} if i == 2 else {"d": d, "n": 20 + i, "a": "Artist %d" % (i % 3), "p": 5 + i % 4})
    return out


class Shapes(unittest.TestCase):
    """Last.fm's answers to the file's records."""

    def test_a_week_is_every_artists_plays_added_up_with_the_top_one_named(self):
        chart = {"weeklyartistchart": {"artist": [
            {"name": "Second", "playcount": "7", "@attr": {"rank": "2"}},
            {"name": "First", "playcount": "12", "@attr": {"rank": "1"}},
            {"name": "Third", "playcount": "1", "@attr": {"rank": "3"}}]}}
        self.assertEqual(rl.week_from(chart, start_of("2020-01-05")),
                         {"d": "2020-01-05", "n": 20, "a": "First", "p": 12})

    def test_a_tie_goes_to_the_first_in_lastfms_order(self):
        chart = {"weeklyartistchart": {"artist": [
            {"name": "Ranked first", "playcount": "4"}, {"name": "Ranked second", "playcount": "4"}]}}
        self.assertEqual(rl.week_from(chart, start_of("2020-01-05"))["a"], "Ranked first")

    def test_one_artist_arrives_as_an_object(self):
        chart = {"weeklyartistchart": {"artist": {"name": "Only", "playcount": "3"}}}
        self.assertEqual(rl.week_from(chart, start_of("2020-01-05")),
                         {"d": "2020-01-05", "n": 3, "a": "Only", "p": 3})

    def test_a_week_with_nothing_played_has_no_artist(self):
        for body in ({"artist": []}, {"#text": "\n", "@attr": {"user": "x"}}):
            self.assertEqual(rl.week_from({"weeklyartistchart": body}, start_of("2020-01-05")),
                             {"d": "2020-01-05", "n": 0})

    def test_an_answer_with_no_chart_is_a_failure_not_a_silent_week(self):
        for answer in ({}, {"weeklyartistchart": None}, {"something": "else"}):
            with self.assertRaises(ValueError):
                rl.week_from(answer, start_of("2020-01-05"))

    def test_the_chart_list_starts_where_the_account_does(self):
        now = start_of("2014-05-01")
        charts = {"weeklychartlist": {"chart": [
            {"from": str(start_of("2005-02-13")), "to": str(start_of("2005-02-20"))},
            {"from": str(start_of("2014-03-09")), "to": str(start_of("2014-03-16"))},
            {"from": str(start_of("2014-03-23")), "to": str(start_of("2014-03-30"))},
            # The week the account opened in: it ends after that day began.
            {"from": str(start_of("2014-03-16")), "to": str(start_of("2014-03-23"))},
            {"from": "not a time", "to": "nor this"},
            # Not started yet.
            {"from": str(start_of("2014-05-04")), "to": str(start_of("2014-05-11"))}]}}
        self.assertEqual([rl.day(s) for s, _ in rl.charts_from(charts, "2014-03-21", now)],
                         ["2014-03-16", "2014-03-23"])

    def test_a_chart_list_of_one_and_a_missing_one(self):
        one = {"weeklychartlist": {"chart": {"from": str(start_of("2020-01-05")), "to": str(start_of("2020-01-12"))}}}
        self.assertEqual(len(rl.charts_from(one, "2014-03-21", start_of("2026-01-01"))), 1)
        with self.assertRaises(ValueError):
            rl.charts_from({"error": 8}, "2014-03-21", 0)

    def test_the_registration_date(self):
        ts = rl.midnight("2014-03-21") + 5000
        self.assertEqual(rl.registered_from({"user": {"registered": {"unixtime": str(ts), "#text": ts}}}), "2014-03-21")
        self.assertEqual(rl.registered_from({"user": {"registered": {"#text": ts}}}), "2014-03-21")
        for info in ({}, {"user": {}}, {"user": {"registered": {"unixtime": "0"}}}, {"user": {"registered": "soon"}}):
            with self.assertRaises(ValueError):
                rl.registered_from(info)


class WhatToAskFor(unittest.TestCase):
    def setUp(self):
        self.weeks = some_weeks(6)
        self.charts = [(start_of(w["d"]), start_of(w["d"]) + WEEK) for w in self.weeks]

    def days(self, charts):
        return [rl.day(s) for s, _ in charts]

    def test_an_empty_file_asks_for_the_whole_history_oldest_first(self):
        self.assertEqual(self.days(rl.wanted([], self.charts)), [w["d"] for w in self.weeks])

    def test_a_full_file_asks_for_the_newest_two_again(self):
        self.assertEqual(self.days(rl.wanted(self.weeks, self.charts)), [w["d"] for w in self.weeks[-2:]])

    def test_a_new_week_and_the_one_before_it(self):
        self.assertEqual(self.days(rl.wanted(self.weeks[:-1], self.charts)),
                         [self.weeks[-1]["d"], self.weeks[-2]["d"]])

    def test_a_hole_is_asked_for_before_the_newest(self):
        on_file = self.weeks[:1] + self.weeks[2:]
        self.assertEqual(self.days(rl.wanted(on_file, self.charts)),
                         [self.weeks[1]["d"], self.weeks[-2]["d"], self.weeks[-1]["d"]])


class Merge(unittest.TestCase):
    def test_fetched_weeks_are_laid_over_the_file_oldest_first(self):
        old = [{"d": "2020-01-05", "n": 10, "a": "A", "p": 4}, {"d": "2020-01-19", "n": 3, "a": "B", "p": 3}]
        new = [{"d": "2020-01-19", "n": 8, "a": "C", "p": 5}, {"d": "2020-01-12", "n": 0}]
        self.assertEqual(rl.merge(old, new), [
            {"d": "2020-01-05", "n": 10, "a": "A", "p": 4},
            {"d": "2020-01-12", "n": 0},
            {"d": "2020-01-19", "n": 8, "a": "C", "p": 5}])
        self.assertEqual(rl.lost_history(old, rl.merge(old, new)), [])

    def test_an_empty_answer_never_replaces_a_week_that_had_plays(self):
        old = [{"d": "2020-01-05", "n": 10, "a": "A", "p": 4}]
        self.assertEqual(rl.merge(old, [{"d": "2020-01-05", "n": 0}]), old)
        # A lower count is a correction (a duplicate removed) and is taken.
        self.assertEqual(rl.merge(old, [{"d": "2020-01-05", "n": 9, "a": "A", "p": 4}])[0]["n"], 9)

    def test_a_week_the_chart_list_no_longer_names_stays(self):
        old = [{"d": "2019-12-29", "n": 2, "a": "A", "p": 2}]
        self.assertEqual(rl.merge(old, [{"d": "2020-01-05", "n": 1, "a": "B", "p": 1}])[0], old[0])

    def test_the_guard_names_a_dropped_week_and_an_emptied_one(self):
        old = [{"d": "2020-01-05", "n": 10, "a": "A", "p": 4}, {"d": "2020-01-12", "n": 6, "a": "A", "p": 2},
               {"d": "2020-01-19", "n": 0}]
        lost = rl.lost_history(old, [{"d": "2020-01-12", "n": 0}, {"d": "2020-01-19", "n": 0}])
        self.assertEqual(len(lost), 2)
        self.assertIn("2020-01-05", lost[0])
        self.assertIn("2020-01-12", lost[1])


class Asking(unittest.TestCase):
    """ask(): retries, and the errors no retry can cure."""

    def run_ask(self, answers):
        """ask() against a lastfm that gives `answers` in turn (an
        exception is raised, anything else returned)."""
        answers, slept = list(answers), []

        def lastfm(method, key, **params):
            a = answers.pop(0)
            if isinstance(a, BaseException):
                raise a
            return a
        return (lambda: rl.ask("user.getinfo", "k", lastfm=lastfm, sleep=slept.append)), answers, slept

    def http_error(self, status, body):
        return urllib.error.HTTPError("https://example.invalid/", status, "nope", {}, io.BytesIO(body))

    def test_a_passing_fault_is_asked_again_after_a_pause(self):
        call, left, slept = self.run_ask([urllib.error.URLError("reset"), {"error": 29, "message": "slow down"},
                                          {"ok": 1}])
        self.assertEqual(call(), {"ok": 1})
        self.assertEqual(slept, [rl.BACKOFF, rl.BACKOFF * 2])

    def test_the_last_error_is_raised_after_every_attempt(self):
        call, left, slept = self.run_ask([{"error": 16, "message": "busy"}] * rl.TRIES + [{"ok": 1}])
        with self.assertRaises(rl.LastfmError) as caught:
            call()
        self.assertEqual(caught.exception.code, 16)
        self.assertEqual(len(left), 1)  # no fourth attempt

    def test_a_refused_key_is_not_asked_twice(self):
        for answer in ({"error": 10, "message": "Invalid API key"},
                       self.http_error(403, b'{"error": 26, "message": "Suspended"}')):
            call, left, slept = self.run_ask([answer, {"ok": 1}])
            with self.assertRaises(rl.Refused):
                call()
            self.assertEqual((len(left), slept), (1, []))

    def test_a_failed_status_is_read_for_its_payload(self):
        # A fresh error each time: a body can be read once.
        call, _, _ = self.run_ask([self.http_error(429, b'{"error": 29, "message": "Rate limit"}')
                                   for _ in range(rl.TRIES)])
        with self.assertRaises(rl.LastfmError):
            call()
        call, _, _ = self.run_ask([self.http_error(502, b"<html>Bad gateway</html>") for _ in range(rl.TRIES)])
        with self.assertRaises(urllib.error.HTTPError):
            call()

    def test_an_answer_that_is_not_json_is_asked_again(self):
        call, _, slept = self.run_ask([json.JSONDecodeError("no", "<html>", 0), {"ok": 1}])
        self.assertEqual(call(), {"ok": 1})
        self.assertEqual(len(slept), 1)


class Runs(unittest.TestCase):
    """main(), with the file in a temporary folder and FakeLastfm for the network."""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.path = Path(self.tmp.name) / "listening.json"
        self.weeks = some_weeks(8)
        self.fake = FakeLastfm(self.weeks)

    def run_main(self, *args, fake=None, **kwargs):
        out = io.StringIO()
        with mock.patch.object(rl, "LISTENING", self.path), \
                mock.patch.dict(os.environ, {"LASTFM_API_KEY": "not-a-key"}), \
                contextlib.redirect_stdout(out):
            code = rl.main(list(args), lastfm=fake or self.fake, sleep=lambda s: None,
                           today="2026-11-09", **kwargs)
        return code, out.getvalue()

    def on_file(self):
        return json.loads(self.path.read_text(encoding="utf-8"))

    def test_a_first_run_walks_the_whole_history(self):
        code, out = self.run_main()
        self.assertEqual(code, 0, out)
        doc = self.on_file()
        self.assertEqual(doc["weeks"], self.weeks)
        self.assertEqual((doc["user"], doc["registered"], doc["updated"]),
                         (rl.LASTFM_USER, "2014-03-21", "2026-11-09"))
        # The eight weeks the list names before the account are never asked for.
        self.assertEqual(len(self.fake.asked("user.getweeklyartistchart")), len(self.weeks))
        self.assertEqual(validate_data.validate_file(self.path), [])

    def test_an_empty_file_is_a_first_run_too(self):
        self.path.write_text('{"user":"%s","weeks":[\n\n]}\n' % rl.LASTFM_USER, encoding="utf-8")
        self.assertEqual(validate_data.validate_file(self.path), [])
        code, _ = self.run_main()
        self.assertEqual(code, 0)
        self.assertEqual(self.on_file()["weeks"], self.weeks)

    def test_the_file_is_a_week_a_line(self):
        self.run_main()
        text = self.path.read_bytes()
        self.assertNotIn(b"\r", text)
        self.assertTrue(text.endswith(b"\n]}\n"))
        self.assertEqual(text.count(b"\n"), len(self.weeks) + 2)

    def test_the_next_run_asks_for_the_newest_two_and_nothing_else(self):
        self.run_main()
        again = FakeLastfm(self.weeks)
        code, _ = self.run_main(fake=again)
        self.assertEqual(code, 0)
        self.assertEqual([m for m, _ in again.calls],
                         ["user.getweeklychartlist", "user.getweeklyartistchart", "user.getweeklyartistchart"])
        self.assertEqual([rl.day(p["from"]) for p in again.asked("user.getweeklyartistchart")],
                         [w["d"] for w in self.weeks[-2:]])
        self.assertEqual(self.on_file()["weeks"], self.weeks)

    def test_a_run_that_changes_nothing_leaves_the_file_and_its_date(self):
        self.run_main()
        before = self.path.read_bytes()
        out = io.StringIO()
        with mock.patch.object(rl, "LISTENING", self.path), \
                mock.patch.dict(os.environ, {"LASTFM_API_KEY": "not-a-key"}), contextlib.redirect_stdout(out):
            rl.main([], lastfm=FakeLastfm(self.weeks), sleep=lambda s: None, today="2026-11-16")
        self.assertEqual(self.path.read_bytes(), before)

    def test_a_new_week_is_added_and_a_late_scrobble_counted(self):
        self.run_main()
        late = dict(self.weeks[-1], n=self.weeks[-1]["n"] + 3)
        new = {"d": rl.day(rl.midnight(self.weeks[-1]["d"]) + WEEK), "n": 9, "a": "New", "p": 9}
        code, _ = self.run_main(fake=FakeLastfm(self.weeks[:-1] + [late, new]))
        self.assertEqual(code, 0)
        self.assertEqual(self.on_file()["weeks"], self.weeks[:-1] + [late, new])

    def test_one_bad_week_is_skipped_and_asked_for_next_time(self):
        bad = self.weeks[3]["d"]
        self.fake.broken.add(bad)
        code, out = self.run_main()
        self.assertEqual(code, 0, out)
        self.assertIn("week of %s failed" % bad, out)
        self.assertEqual([w["d"] for w in self.on_file()["weeks"]], [w["d"] for w in self.weeks if w["d"] != bad])
        mended = FakeLastfm(self.weeks)
        self.run_main(fake=mended)
        self.assertEqual(rl.day(mended.asked("user.getweeklyartistchart")[0]["from"]), bad)
        self.assertEqual(self.on_file()["weeks"], self.weeks)

    def test_an_error_payload_for_a_week_is_a_bad_week(self):
        self.fake.payload_errors[self.weeks[4]["d"]] = 8
        code, _ = self.run_main()
        self.assertEqual(code, 0)
        self.assertEqual(len(self.on_file()["weeks"]), len(self.weeks) - 1)

    def test_when_every_week_fails_nothing_is_written(self):
        self.run_main()
        before = self.path.read_bytes()
        down = FakeLastfm(self.weeks)
        down.broken.update(w["d"] for w in self.weeks)
        code, out = self.run_main(fake=down)
        self.assertEqual(code, 1)
        self.assertIn("leaving listening.json alone", out)
        self.assertEqual(self.path.read_bytes(), before)

    def test_a_first_run_that_fetches_nothing_leaves_a_file_with_no_weeks(self):
        # The page asks for the file and the workflow commits it by name,
        # so a run never ends without one.
        self.fake.broken.update(w["d"] for w in self.weeks)
        code, out = self.run_main()
        self.assertEqual(code, 1)
        self.assertIn("wrote one with no weeks", out)
        self.assertEqual(self.on_file(), {"user": rl.LASTFM_USER, "weeks": []})
        self.assertEqual(validate_data.validate_file(self.path), [])
        # The next run takes it for a first run and fills it.
        code, _ = self.run_main(fake=FakeLastfm(self.weeks))
        self.assertEqual(code, 0)
        self.assertEqual(self.on_file()["weeks"], self.weeks)

    def test_weeks_failing_in_a_row_end_the_asking(self):
        weeks = some_weeks(12)
        fake = FakeLastfm(weeks)
        fake.broken.update(w["d"] for w in weeks[2:])
        code, out = self.run_main(fake=fake)
        self.assertEqual(code, 0)  # the first two were fetched and are kept
        # Each failing week is tried TRIES times; GIVE_UP of them, then no more.
        asked = fake.asked("user.getweeklyartistchart")
        self.assertEqual(len({p["from"] for p in asked}), 2 + rl.GIVE_UP)
        self.assertEqual(len(asked), 2 + rl.GIVE_UP * rl.TRIES)
        self.assertEqual(self.on_file()["weeks"], weeks[:2])

    def test_a_failed_chart_list_leaves_the_file_alone(self):
        self.run_main()
        before = self.path.read_bytes()
        down = FakeLastfm(self.weeks)
        down.fail_chart_list = True
        code, out = self.run_main(fake=down)
        self.assertEqual(code, 1)
        self.assertIn("chart list failed", out)
        self.assertEqual(down.asked("user.getweeklyartistchart"), [])
        self.assertEqual(self.path.read_bytes(), before)

    def test_a_refused_key_stops_the_run_at_once(self):
        self.fake.payload_errors[self.weeks[0]["d"]] = 10
        code, out = self.run_main()
        self.assertEqual(code, 1)
        self.assertEqual(len(self.fake.asked("user.getweeklyartistchart")), 1)
        self.assertEqual(self.on_file()["weeks"], [])

    def test_a_recent_week_that_comes_back_empty_keeps_its_plays(self):
        self.run_main()
        glitch = FakeLastfm(self.weeks)
        glitch.empty.add(self.weeks[-1]["d"])
        code, _ = self.run_main(fake=glitch)
        self.assertEqual(code, 0)
        self.assertEqual(self.on_file()["weeks"], self.weeks)

    def test_the_time_budget_ends_a_run_and_the_next_carries_on(self):
        ticks = iter(range(0, 10 ** 6, rl.TIME_BUDGET // 3))
        code, out = self.run_main(clock=lambda: next(ticks))
        self.assertEqual(code, 0, out)
        self.assertIn("left for the next run", out)
        got = self.on_file()["weeks"]
        self.assertTrue(0 < len(got) < len(self.weeks))
        self.assertEqual(got, self.weeks[:len(got)])
        code, _ = self.run_main("--backfill", fake=FakeLastfm(self.weeks), clock=lambda: next(ticks))
        self.assertEqual(code, 0)
        self.assertEqual(self.on_file()["weeks"], self.weeks)

    def test_a_run_cut_short_keeps_what_it_had_fetched(self):
        weeks = some_weeks(7)

        class Interrupted(FakeLastfm):
            def __call__(self, method, key, **params):
                if method == "user.getweeklyartistchart" and len(self.asked(method)) == 5:
                    raise KeyboardInterrupt
                return super().__call__(method, key, **params)
        with mock.patch.object(rl, "SAVE_EVERY", 2), self.assertRaises(KeyboardInterrupt):
            self.run_main(fake=Interrupted(weeks))
        self.assertEqual(self.on_file()["weeks"], weeks[:4])

    def test_a_dry_run_writes_nothing(self):
        code, out = self.run_main("--dry-run")
        self.assertEqual(code, 0)
        self.assertIn("nothing written", out)
        self.assertFalse(self.path.exists())

    def test_a_file_that_cannot_be_read_is_left_alone(self):
        for text in ("{not json", '{"weeks": "none"}', "[]"):
            self.path.write_text(text, encoding="utf-8")
            code, out = self.run_main()
            self.assertEqual(code, 1)
            self.assertIn("leaving it alone", out)
            self.assertEqual(self.path.read_text(encoding="utf-8"), text)
            self.assertEqual(self.fake.calls, [])

    def test_no_key_no_run(self):
        out = io.StringIO()
        with mock.patch.object(rl, "LISTENING", self.path), \
                mock.patch.dict(os.environ, {}, clear=True), contextlib.redirect_stdout(out):
            code = rl.main([], lastfm=self.fake, sleep=lambda s: None)
        self.assertEqual(code, 1)
        self.assertEqual(self.fake.calls, [])
        self.assertEqual(self.on_file()["weeks"], [])

    def test_a_failed_run_never_touches_a_file_that_is_there(self):
        self.run_main()
        before = self.path.read_bytes()
        out = io.StringIO()
        with mock.patch.object(rl, "LISTENING", self.path),                 mock.patch.dict(os.environ, {}, clear=True), contextlib.redirect_stdout(out):
            self.assertEqual(rl.main([], lastfm=self.fake, sleep=lambda s: None), 1)
        self.assertNotIn("wrote one", out.getvalue())
        self.assertEqual(self.path.read_bytes(), before)


class Fixture(unittest.TestCase):
    """tests/fixtures/listening.json, the made-up history the page's own
    tests draw (tests/js/listening.test.js): it has the file's shape, and
    a first run against a Last.fm that held it writes it back."""

    def test_the_fixture_matches_the_schema(self):
        self.assertEqual(validate_data.validate_file(FIXTURE), [])

    def test_the_file_on_disk_matches_the_schema(self):
        if rl.LISTENING.exists():
            self.assertEqual(validate_data.validate_file(rl.LISTENING), [])

    def test_the_validator_passes_over_the_file_until_it_is_written(self):
        # Its first run writes it, so a checkout may not have one; any
        # other missing file is still the fault it always was.
        with tempfile.TemporaryDirectory() as tmp:
            out = io.StringIO()
            with contextlib.redirect_stdout(out):
                code = validate_data.main([str(Path(tmp) / "listening.json")])
            self.assertEqual(code, 0)
            self.assertIn("not written yet", out.getvalue())
            with contextlib.redirect_stdout(io.StringIO()):
                self.assertEqual(validate_data.main([str(Path(tmp) / "lastfm.json")]), 2)
            # There and wrong, it fails like any other.
            (Path(tmp) / "listening.json").write_text('{"weeks": [{"d": "soon"}]}', encoding="utf-8")
            with contextlib.redirect_stdout(io.StringIO()):
                self.assertEqual(validate_data.main([str(Path(tmp) / "listening.json")]), 1)

    def test_round_trip(self):
        fixture = json.loads(FIXTURE.read_text(encoding="utf-8"))
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "listening.json"
            with mock.patch.object(rl, "LISTENING", path), \
                    mock.patch.dict(os.environ, {"LASTFM_API_KEY": "not-a-key"}), \
                    contextlib.redirect_stdout(io.StringIO()):
                code = rl.main(["--backfill"], lastfm=FakeLastfm(fixture["weeks"], fixture["registered"]),
                               sleep=lambda s: None, today=fixture["updated"])
            self.assertEqual(code, 0)
            written = json.loads(path.read_text(encoding="utf-8"))
        self.assertEqual(written["weeks"], fixture["weeks"])
        self.assertEqual(written["registered"], fixture["registered"])


if __name__ == "__main__":
    unittest.main()
