"""generate_photo_dims.py --stamp-img: width and height on post images.

The header readers must agree with the files without an image library
(the CI job has none), the scanner must find every <img> a browser would
lay out and exempt the ones a demo or a generator owns, and a stamp must
change nothing in the page but the attributes it adds.

Run from the repo root:
    python -m unittest discover -s tests -v
"""

import struct
import sys
import tempfile
import unittest
import zlib
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / ".github" / "scripts"))
import generate_photo_dims as gpd  # noqa: E402


def png(width, height):
    def chunk(kind, data):
        return (struct.pack(">I", len(data)) + kind + data
                + struct.pack(">I", zlib.crc32(kind + data) & 0xFFFFFFFF))
    ihdr = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IEND", b"")


def jpeg(width, height):
    # SOI, an APP0 segment to skip over, then a baseline start-of-frame.
    app0 = b"\xff\xe0" + struct.pack(">H", 16) + b"JFIF\x00" + b"\x01\x01\x00" + b"\x00" * 6
    sof0 = b"\xff\xc0" + struct.pack(">HBHHB", 11, 8, height, width, 1) + b"\x01\x11\x00"
    return b"\xff\xd8" + app0 + sof0 + b"\xff\xd9"


def gif(width, height):
    return b"GIF89a" + struct.pack("<HH", width, height) + b"\x00\x00\x00;"


class HeaderReaders(unittest.TestCase):
    def test_png_jpeg_gif(self):
        with tempfile.TemporaryDirectory() as tmp:
            for name, data, size in (("a.png", png(1520, 832), (1520, 832)),
                                     ("b.jpg", jpeg(1100, 1151), (1100, 1151)),
                                     ("c.gif", gif(40, 30), (40, 30))):
                path = Path(tmp) / name
                path.write_bytes(data)
                self.assertEqual(tuple(gpd.image_size(path)), size, name)


class Scanner(unittest.TestCase):
    PAGE = (
        '<div class="blog-post">\n'
        '  <img src="a.png" alt="">\n'
        '  <div class="kr-viz"><div><img src="sprite.png" alt=""></div></div>\n'
        '  <img src="b.png" alt="" />\n'
        '  <div class="related-posts"><img src="card.webp" alt=""></div>\n'
        '  <div class="kr-viz__caption"><img src="c.png" alt=""></div>\n'
        '  <script>var t = \'<img src="d.png">\';</script>\n'
        '</div>\n'
    )

    def test_offsets_and_exemptions(self):
        images = gpd.post_images(self.PAGE)
        self.assertEqual([(i.attrs["src"], i.skip) for i in images], [
            ("a.png", None), ("sprite.png", "kr-viz"), ("b.png", None),
            ("card.webp", "related-posts"), ("c.png", None)])
        for img in images:
            self.assertTrue(self.PAGE.startswith(img.raw, img.start))


class WithDims(unittest.TestCase):
    def test_added_at_the_end_of_the_tag(self):
        self.assertEqual(gpd.with_dims('<img src="a.png" alt="x">', 10, 5),
                         '<img src="a.png" alt="x" width="10" height="5">')
        self.assertEqual(gpd.with_dims('<img src="a.png" />', 10, 5),
                         '<img src="a.png" width="10" height="5" />')

    def test_an_existing_value_is_replaced_in_place(self):
        self.assertEqual(gpd.with_dims('<img width="300" src="a.png">', 300, 150),
                         '<img width="300" src="a.png" height="150">')
        self.assertEqual(gpd.with_dims('<img src="a.png"\n     width=600 alt="">', 600, 300),
                         '<img src="a.png"\n     width="600" alt="" height="300">')

    def test_words_inside_other_values_are_not_attributes(self):
        # Alt text is the reader's; a "width =" in it is prose, not markup.
        self.assertEqual(
            gpd.with_dims('<img src="a.png" alt="the width = 3 and height=4">', 10, 5),
            '<img src="a.png" alt="the width = 3 and height=4" width="10" height="5">')


class Stamp(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        (self.root / "blog" / "img").mkdir(parents=True)
        (self.root / "blog" / "img" / "chart.png").write_bytes(png(1520, 832))
        (self.root / "blog" / "img" / "wide.png").write_bytes(png(1000, 500))
        self.page = self.root / "blog" / "post.html"
        self._root = gpd.ROOT
        gpd.ROOT = self.root

    def tearDown(self):
        gpd.ROOT = self._root
        self.tmp.cleanup()

    def test_only_the_attributes_change(self):
        self.page.write_bytes(
            b'<div class="blog-post">\r\n'
            b'  <img src="img/chart.png" alt="A chart" loading="lazy">\r\n'
            b'  <img src="img/wide.png" alt="" width="400">\r\n'
            b'  <img src="img/wide.png" alt="" width="600" height="600">\r\n'
            b'  <img src="https://example.org/x.png" alt="">\r\n'
            b'</div>\r\n')
        self.assertEqual(gpd.stamp_post(self.page, {}), 3)
        self.assertEqual(self.page.read_bytes(), (
            b'<div class="blog-post">\r\n'
            b'  <img src="img/chart.png" alt="A chart" loading="lazy" width="1520" height="832">\r\n'
            b'  <img src="img/wide.png" alt="" width="400" height="200">\r\n'
            b'  <img src="img/wide.png" alt="" width="600" height="300">\r\n'
            b'  <img src="https://example.org/x.png" alt="">\r\n'
            b'</div>\r\n'))
        missing, mismatched, remote = gpd.examine_post(self.page, {})
        self.assertEqual((missing, mismatched, len(remote)), ([], [], 1))
        self.assertEqual(gpd.stamp_post(self.page, {}), 0)

    def test_thumbnails_use_the_recorded_sizes(self):
        thumb = self.root / "img" / "photography" / "thumb"
        thumb.mkdir(parents=True)
        (thumb / "7.webp").write_bytes(b"not read: the recorded size wins")
        self.page.write_text('<img src="../img/photography/thumb/7.webp" alt="">', encoding="utf-8")
        gpd.stamp_post(self.page, {"7": [400, 266]})
        self.assertIn('width="400" height="266"', self.page.read_text(encoding="utf-8"))


if __name__ == "__main__":
    unittest.main()
