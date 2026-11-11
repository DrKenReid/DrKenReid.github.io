"""generate_photo_exif.py: what is read from an original, and what never is.

The originals are not in the repository, so these cases build their own:
a PNG with an eXIf chunk, a JPEG with an APP1 segment (some originals are
JPEGs under a .png name), a PNG whose camera data is an ImageMagick "Raw
profile" or only an XMP packet. Each stand-in block also carries what a
camera writes beside the exposure (a GPS position, the body's serial
number, the owner's name, the software, the date), and the first thing
pinned is that none of it reaches the entry. Then the merge: a frame the
folder cannot speak for keeps the entry it had. Last, the file in the
repository is held to the same rule.

No image library: the reader walks chunks and never decodes a pixel.

Run from the repo root:
    python -m unittest discover -s tests -v
"""

import contextlib
import io
import json
import struct
import sys
import tempfile
import unittest
import zlib
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / ".github" / "scripts"))
import generate_photo_exif as gpe  # noqa: E402

PRIVATE = ("Ken Reid", "0123456789", "Lightroom", "2019:05:04 10:11:12", "56.1")


def run(argv):
    """main(argv), with what it prints kept out of the test log."""
    with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
        return gpe.main(argv)


def tiff(order="<", exposure=(1, 400), fnumber=(63, 10), iso=500, focal=(250, 1),
         model=b"Canon EOS 60D", lens=b"EF-S55-250mm f/4-5.6 IS STM"):
    """An EXIF block as a camera writes one: IFD0 (maker, model, software,
    artist, pointers to the Exif and GPS IFDs), the Exif IFD (exposure,
    the date, the owner, the serial number, the lens) and a GPS IFD."""
    head = (b"II" if order == "<" else b"MM") + struct.pack(order + "HI", 42, 8)

    def build(start, entries):
        """An IFD at offset `start`: (tag, type, count, value bytes)."""
        table = struct.pack(order + "H", len(entries))
        extra = b""
        at = start + 2 + 12 * len(entries) + 4
        for tag, kind, count, data in entries:
            if len(data) <= 4:
                field = data.ljust(4, b"\0")
            else:
                field = struct.pack(order + "I", at + len(extra))
                extra += data + (b"\0" if len(data) % 2 else b"")
            table += struct.pack(order + "HHI", tag, kind, count) + field
        return table + struct.pack(order + "I", 0) + extra

    def text(value):
        return value + b"\0"

    def rational(pair):
        return struct.pack(order + "II", *pair)

    ifd0_tags = [(0x010F, 2, 6, text(b"Canon")),
                 (0x0110, 2, len(model) + 1, text(model)),
                 (0x0131, 2, 10, text(b"Lightroom")),
                 (0x013B, 2, 9, text(b"Ken Reid")),
                 (0x8769, 4, 1, b"EXIF"),      # patched below
                 (0x8825, 4, 1, b"GPS!")]
    ifd0_len = len(build(8, ifd0_tags))
    exif_at = 8 + ifd0_len
    exif_tags = [(0x829A, 5, 1, rational(exposure)),
                 (0x829D, 5, 1, rational(fnumber)),
                 (0x8827, 3, 1, struct.pack(order + "H", iso)),
                 (0x9003, 2, 20, text(b"2019:05:04 10:11:12")),
                 (0x920A, 5, 1, rational(focal)),
                 (0xA430, 2, 9, text(b"Ken Reid")),
                 (0xA431, 2, 11, text(b"0123456789")),
                 (0xA434, 2, len(lens) + 1, text(lens))]
    exif_ifd = build(exif_at, exif_tags)
    gps_at = exif_at + len(exif_ifd)
    gps_ifd = build(gps_at, [(0x0002, 5, 3, rational((56, 1)) + rational((7, 1)) + rational((561, 10)))])
    ifd0_tags[4] = (0x8769, 4, 1, struct.pack(order + "I", exif_at))
    ifd0_tags[5] = (0x8825, 4, 1, struct.pack(order + "I", gps_at))
    return head + build(8, ifd0_tags) + exif_ifd + gps_ifd


def chunk(kind, data):
    return (struct.pack(">I", len(data)) + kind + data
            + struct.pack(">I", zlib.crc32(kind + data) & 0xFFFFFFFF))


def png(*chunks):
    ihdr = struct.pack(">IIBBBBB", 6000, 4000, 8, 2, 0, 0, 0)
    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + b"".join(chunks)
            + chunk(b"IDAT", b"\0" * 64) + chunk(b"IEND", b""))


def jpeg(*app1):
    out = b"\xff\xd8" + b"\xff\xe0" + struct.pack(">H", 16) + b"JFIF\0" + b"\0" * 9
    for block in app1:
        out += b"\xff\xe1" + struct.pack(">H", len(block) + 2) + block
    return out + b"\xff\xda" + struct.pack(">H", 2) + b"\0\0\xff\xd9"


XMP = ('<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF><rdf:Description '
       'tiff:Model="Canon EOS 60D" exif:FNumber="56/10" exif:ExposureTime="1/60" '
       'exif:FocalLength="50/1" aux:Lens="EF50mm f/1.4 USM" aux:SerialNumber="0123456789">'
       '<exif:ISOSpeedRatings><rdf:Seq><rdf:li>800</rdf:li></rdf:Seq></exif:ISOSpeedRatings>'
       '<dc:creator><rdf:Seq><rdf:li>Ken Reid</rdf:li></rdf:Seq></dc:creator>'
       '</rdf:Description></rdf:RDF></x:xmpmeta>')

FULL = {"camera": "Canon EOS 60D", "lens": "EF-S 55-250mm f/4-5.6 IS STM",
        "focal": 250, "aperture": 6.3, "shutter": "1/400", "iso": 500}


class Reading(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.dir = Path(self.tmp.name)

    def tearDown(self):
        self.tmp.cleanup()

    def frame(self, name, data):
        path = self.dir / name
        path.write_bytes(data)
        return gpe.read_frame(path)

    def assert_public(self, entry):
        self.assertLessEqual(set(entry), set(gpe.FIELDS))
        text = json.dumps(entry)
        for secret in PRIVATE:
            self.assertNotIn(secret, text)

    def test_png_exif_chunk_either_byte_order(self):
        for order in "<>":
            entry = self.frame("335.png", png(chunk(b"eXIf", tiff(order))))
            self.assertEqual(entry, FULL, order)
            self.assertEqual(list(entry), list(gpe.FIELDS))
            self.assert_public(entry)

    def test_a_jpeg_under_a_png_name(self):
        entry = self.frame("400.png", jpeg(b"Exif\0\0" + tiff()))
        self.assertEqual(entry, FULL)
        self.assert_public(entry)

    def test_a_raw_profile_text_chunk(self):
        blob = b"Exif\0\0" + tiff()
        profile = ("\nAPP1\n%8d\n%s\n" % (len(blob), blob.hex())).encode("ascii")
        entry = self.frame("9.png", png(chunk(b"zTXt", b"Raw profile type APP1\0\0" + zlib.compress(profile))))
        self.assertEqual(entry, FULL)

    def test_xmp_alone_and_xmp_behind_exif(self):
        itxt = chunk(b"iTXt", b"XML:com.adobe.xmp\0\0\0\0\0" + XMP.encode("utf-8"))
        alone = self.frame("7.png", png(itxt))
        self.assertEqual(alone, {"camera": "Canon EOS 60D", "lens": "EF 50mm f/1.4 USM", "focal": 50,
                                 "aperture": 5.6, "shutter": "1/60", "iso": 800})
        self.assert_public(alone)
        # EXIF speaks first; XMP only fills what it does not say.
        self.assertEqual(self.frame("8.png", png(chunk(b"eXIf", tiff()), itxt)), FULL)
        self.assertEqual(self.frame("8.jpg", jpeg(b"http://ns.adobe.com/xap/1.0/\0" + XMP.encode("utf-8"))), alone)

    def test_nothing_to_read(self):
        self.assertEqual(self.frame("1.png", png()), {})
        self.assertEqual(self.frame("2.png", b"not an image at all"), {})
        self.assertEqual(self.frame("3.png", png(chunk(b"eXIf", b"II*\0"))), {})   # cut short
        # a block with the camera's name and nothing about the exposure
        self.assertEqual(gpe.entry_from({"make": "Canon", "model": "Canon EOS 60D"}), {})

    def test_a_camera_s_unknowns_are_left_out(self):
        entry = self.frame("4.png", png(chunk(b"eXIf", tiff(exposure=(0, 1), fnumber=(0, 0), iso=0,
                                                              lens=b"----"))))
        self.assertEqual(entry, {"camera": "Canon EOS 60D", "focal": 250})
        # 65535 in the ISO tag says "look in another tag", not ISO 65535.
        self.assertNotIn("iso", gpe.entry_from({"model": "X", "focal": 50, "iso": 65535}))


class Values(unittest.TestCase):
    def test_shutter_as_a_camera_shows_it(self):
        for seconds, text in ((1 / 400, "1/400"), (10 / 4000, "1/400"), (1 / 8000, "1/8000"),
                              (0.25, "1/4"), (0.3, "0.3"), (0.5, "0.5"), (1, "1"), (2.5, "2.5"), (30, "30")):
            self.assertEqual(gpe.shutter_text(seconds), text)

    def test_camera_and_lens_names(self):
        self.assertEqual(gpe.camera_name("Canon", "Canon EOS 60D"), "Canon EOS 60D")
        self.assertEqual(gpe.camera_name("motorola", "Nexus 6"), "Motorola Nexus 6")
        self.assertEqual(gpe.camera_name("NIKON CORPORATION", "NIKON D90"), "NIKON D90")
        self.assertEqual(gpe.camera_name("Canon", ""), "")
        self.assertEqual(gpe.lens_name("EF50mm  f/1.4 USM"), "EF 50mm f/1.4 USM")
        self.assertEqual(gpe.lens_name("RF24-105mm F4 L IS USM"), "RF 24-105mm F4 L IS USM")
        self.assertEqual(gpe.lens_name("0.0 mm f/0.0"), "")

    def test_whole_numbers_are_integers(self):
        entry = gpe.entry_from({"model": "X", "focal": 18.0, "aperture": 8.0, "shutter": 1 / 60, "iso": 100})
        self.assertEqual(json.dumps(entry), '{"camera": "X", "focal": 18, "aperture": 8, "shutter": "1/60", "iso": 100}')


class Merge(unittest.TestCase):
    OLD = {1: {"camera": "A", "lens": "L", "focal": 50, "iso": 100},
           2: {"camera": "A", "focal": 35},
           9: {"camera": "A", "focal": 24}}

    def test_the_folder_adds_and_refreshes_and_never_takes_away(self):
        found = {1: {"camera": "A", "focal": 55, "aperture": 4}, 3: {"focal": 200}}
        merged = gpe.merge(self.OLD, found, listed=[1, 2, 3, 4])
        self.assertEqual(merged[1], {"camera": "A", "lens": "L", "focal": 55, "aperture": 4, "iso": 100})
        self.assertEqual(merged[2], self.OLD[2])            # not in the folder: kept
        self.assertEqual(merged[3], {"focal": 200})         # new
        self.assertNotIn(4, merged)                         # listed, no data anywhere
        self.assertNotIn(9, merged)                         # left the gallery
        self.assertEqual(list(merged[1]), ["camera", "lens", "focal", "aperture", "iso"])

    def test_a_run_against_a_partial_folder_keeps_the_file(self):
        with tempfile.TemporaryDirectory() as tmp:
            folder, out = Path(tmp) / "originals", Path(tmp) / "photo-exif.json"
            folder.mkdir()
            (folder / "3.png").write_bytes(png(chunk(b"eXIf", tiff())))
            (folder / "2.png").write_bytes(png())           # here, but stripped of its data
            (folder / "77.png").write_bytes(png(chunk(b"eXIf", tiff())))   # not a gallery frame
            (folder / "notes.txt").write_text("not a frame", encoding="utf-8")
            out.write_text(gpe.dump(self.OLD), encoding="utf-8", newline="\n")
            with mock.patch.object(gpe, "OUT", out), \
                    mock.patch.object(gpe, "listed_frames", lambda: [1, 2, 3]):
                self.assertEqual(run([str(folder), "--report"]), 0)
                self.assertEqual(gpe.load(out), self.OLD)   # --report writes nothing
                self.assertEqual(run([str(folder)]), 0)
                first = out.read_bytes()
                self.assertEqual(gpe.load(out), {1: self.OLD[1], 2: self.OLD[2], 3: FULL})
                self.assertEqual(run([str(folder)]), 0)
                self.assertEqual(out.read_bytes(), first)   # a second run changes nothing
                self.assertNotIn(b"\r", first)
                self.assertEqual(run(["--check"]), 0)

    def test_a_new_set_from_the_files_it_was_made_from(self):
        # A frame re-saved for the release has lost its camera data, so a
        # new set is read from its exports, numbered in the order given.
        with tempfile.TemporaryDirectory() as tmp:
            tmp = Path(tmp)
            out = tmp / "photo-exif.json"
            a, b, c = tmp / "IMG_1.jpg", tmp / "IMG_2.tif", tmp / "IMG_3.png"
            a.write_bytes(jpeg(b"Exif\0\0" + tiff()))
            b.write_bytes(tiff(">", focal=(50, 1)))         # a TIFF is an EXIF block itself
            c.write_bytes(png())
            out.write_text(gpe.dump(self.OLD), encoding="utf-8", newline="\n")
            with mock.patch.object(gpe, "OUT", out), \
                    mock.patch.object(gpe, "listed_frames", lambda: [1, 2, 9, 10, 11, 12]):
                self.assertEqual(run(["--first", "10", str(a), str(b), str(c)]), 0)
                got = gpe.load(out)
                self.assertEqual(got[10], FULL)
                self.assertEqual(got[11]["focal"], 50)
                self.assertNotIn(12, got)                   # no camera data in it
                self.assertEqual(got[1], self.OLD[1])       # the rest of the file is kept
                before = out.read_bytes()
                for argv in (["--first", "12", str(a), str(b)],         # frame 13 is not listed yet
                             ["--first", "10", str(tmp / "missing.jpg")],
                             ["--first", "10"],
                             [str(tmp), str(tmp)]):
                    with self.assertRaises(SystemExit, msg=argv):
                        run(argv)
                self.assertEqual(out.read_bytes(), before)

    def test_the_folder_comes_from_the_argument_or_the_environment(self):
        with mock.patch.dict("os.environ", {}, clear=False) as env:
            env.pop(gpe.FOLDER_ENV, None)
            with self.assertRaises(SystemExit):
                run([])


class TheFile(unittest.TestCase):
    """data/photo-exif.json as committed."""

    def test_it_is_as_the_generator_writes_it(self):
        with open(gpe.OUT, encoding="utf-8", newline="") as fh:
            text = fh.read()
        self.assertEqual(gpe.problems(text, gpe.listed_frames()), [])

    def test_only_the_public_fields(self):
        frames = json.loads(gpe.OUT.read_text(encoding="utf-8"))["frames"]
        self.assertTrue(frames)
        for frame in frames:
            self.assertLessEqual(set(frame), {"n", *gpe.FIELDS}, frame)

    def test_check_refuses_what_it_should(self):
        good = gpe.dump({1: {"camera": "A", "focal": 50}})
        self.assertEqual(gpe.problems(good, [1, 2]), [])
        self.assertTrue(gpe.problems(good, [2]))                                    # an unlisted frame
        self.assertTrue(gpe.problems(good.replace('"focal": 50', '"gps": [56.1, -3.9]'), [1]))
        self.assertTrue(gpe.problems(gpe.dump({1: {"camera": "A"}}), [1]))          # no exposure
        self.assertTrue(gpe.problems(good.replace('"camera"', '"serial": "0123", "camera"'), [1]))
        self.assertTrue(gpe.problems("[]", [1]))


if __name__ == "__main__":
    unittest.main()
