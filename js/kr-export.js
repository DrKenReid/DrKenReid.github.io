/**
 * Saves a diagram as a PNG, with the page's address under it.
 *
 * js/diagrams.js puts a small button in the corner of every diagram
 * (initDiagramExport) and loads this file the first time one is
 * pressed, so a page nobody saves from never fetches it. It sets
 * window.krExport = { png, watermark, fileName }; the last two are plain
 * string functions, tested in tests/js/kr-export.test.js.
 *
 * How a diagram becomes a picture with no library. The diagram is HTML,
 * so it is copied into an SVG <foreignObject>, drawn onto a canvas and
 * read back as a PNG. An SVG drawn as an image sees no stylesheet and
 * fetches nothing, so the copy carries everything it needs: each
 * element's computed style written onto it, a rule for each ::before and
 * ::after that draws something (the flow chart's arrowheads), the
 * site's fonts as data URLs, and every <img> and <canvas> as a data URL.
 * It is drawn in the theme the reader is looking at, at twice the
 * screen's size, on the page's own background.
 *
 * The address is the page's canonical URL without the scheme, "www." or
 * ".html" (GitHub Pages serves a page without its extension), set small
 * and muted under the bottom right corner, so a diagram that travels on
 * its own still says where it came from.
 */
(function() {
    'use strict';

    var SVG_NS = 'http://www.w3.org/2000/svg';
    var XHTML_NS = 'http://www.w3.org/1999/xhtml';
    var SCALE = 2;
    var PAD = 24;              // CSS px of background around the diagram
    var MARK_SIZE = 11;        // CSS px, the address line
    var MARK_GAP = 10;         // CSS px between the diagram and the address
    // Copied styles that only matter to a live page, and would make the
    // still picture wrong (a half-run transition) or merely heavier.
    var SKIP = /^(transition|animation|cursor|will-change|pointer-events|user-select|-webkit-user-select|caret-color|scroll-|overscroll-|touch-action)/;
    // What is not drawn: the export button itself and floating UI that is
    // hidden until hover (a diagram's detail card).
    var LEAVE_OUT = '.kr-export-btn, .kr-offstage:not(.is-visible), [hidden]';

    /** "https://www.kenreid.co.uk/blog/x.html" -> "kenreid.co.uk/blog/x". */
    function watermark(href) {
        var s = String(href || '').trim()
            .replace(/^[a-z]+:\/\//i, '')
            .replace(/^www\./i, '')
            .replace(/[?#].*$/, '')
            .replace(/\/index\.html$/i, '/')
            .replace(/\.html$/i, '');
        return s.replace(/\/$/, '') || 'kenreid.co.uk';
    }

    /** Lower-case words joined by hyphens, cut at a word (48 characters at most). */
    function slug(s) {
        var out = String(s || '').toLowerCase()
            .replace(/&[a-z]+;/g, ' ')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
        if (out.length > 48) {
            out = out.slice(0, 49);
            out = out.slice(0, out.lastIndexOf('-') > 0 ? out.lastIndexOf('-') : 48);
        }
        return out.replace(/-+$/, '');
    }

    /** kenreid-<page>-<label>.png, label falling back to "diagram". */
    function fileName(href, label) {
        var page = watermark(href).split('/').pop();
        if (!page || page === 'kenreid.co.uk') page = 'home';
        return ['kenreid', slug(page), slug(label) || 'diagram'].join('-') + '.png';
    }

    function pageHref() {
        var c = document.querySelector('link[rel="canonical"]');
        return (c && c.getAttribute('href')) || (location.origin + location.pathname);
    }

    /** The first opaque background from el up, else the page's. */
    function backgroundOf(el) {
        for (var n = el; n && n.nodeType === 1; n = n.parentElement) {
            var bg = getComputedStyle(n).backgroundColor;
            if (bg && !/rgba\(.*,\s*0\)$|transparent/.test(bg)) return bg;
        }
        return getComputedStyle(document.body).backgroundColor || '#ffffff';
    }

    function cssText(cs) {
        var out = [];
        for (var i = 0; i < cs.length; i++) {
            var p = cs[i];
            if (SKIP.test(p)) continue;
            out.push(p + ':' + cs.getPropertyValue(p));
        }
        return out.join(';');
    }

    function toDataUrl(blob) {
        return new Promise(function(ok, fail) {
            var r = new FileReader();
            r.onload = function() { ok(r.result); };
            r.onerror = fail;
            r.readAsDataURL(blob);
        });
    }

    function fetchData(url) {
        return fetch(url).then(function(r) {
            if (!r.ok) throw new Error(r.status + ' ' + url);
            return r.blob();
        }).then(toDataUrl);
    }

    /**
     * @font-face rules, with data URLs, for the faces the copy uses. A
     * face is used when its family and weight (or weight range) match an
     * element's computed font; other sites' fonts are left out.
     */
    function fontFaces(used) {
        var jobs = [];
        Array.prototype.forEach.call(document.styleSheets, function(sheet) {
            var rules;
            try { rules = sheet.cssRules; } catch (e) { return; }
            Array.prototype.forEach.call(rules || [], function(rule) {
                if (rule.type !== 5) return;               // CSSFontFaceRule
                var st = rule.style;
                var fam = st.getPropertyValue('font-family').replace(/["']/g, '').trim().toLowerCase();
                var w = (st.getPropertyValue('font-weight') || '400').trim().split(/\s+/).map(Number);
                var style = (st.getPropertyValue('font-style') || 'normal').trim();
                var hit = used.some(function(u) {
                    var lo = w[0], hi = w.length > 1 ? w[1] : w[0];
                    return u.family === fam && u.style === style
                        && (isNaN(lo) || (u.weight >= lo && u.weight <= hi));
                });
                if (!hit) return;
                var m = /url\(["']?([^"')]+\.woff2[^"')]*)["']?\)/.exec(st.getPropertyValue('src'))
                    || /url\(["']?([^"')]+)["']?\)/.exec(st.getPropertyValue('src'));
                if (!m) return;
                var url = new URL(m[1], sheet.href || location.href);
                if (url.origin !== location.origin) return;
                jobs.push(fetchData(url.href).then(function(data) {
                    return '@font-face{font-family:"' + st.getPropertyValue('font-family').replace(/["']/g, '').trim()
                        + '";font-style:' + style + ';font-weight:' + w.join(' ')
                        + ';src:url(' + data + ')}';
                }, function() { return ''; }));
            });
        });
        return Promise.all(jobs).then(function(r) { return r.join(''); });
    }

    /**
     * A styled copy of el: [clone, pseudo-element rules, fonts used].
     * Walks the live tree and the copy side by side, so each copied node
     * gets its own original's computed style.
     */
    function copy(el) {
        var clone = el.cloneNode(true);
        var pseudo = [];
        var used = {};
        var images = [];
        var n = 0;
        (function walk(src, dst) {
            if (src.nodeType !== 1) return;
            var cs = getComputedStyle(src);
            dst.removeAttribute('id');
            dst.removeAttribute('class');
            dst.setAttribute('style', cssText(cs));
            var fam = cs.fontFamily.split(',')[0].replace(/["']/g, '').trim().toLowerCase();
            used[fam + '|' + cs.fontWeight + '|' + cs.fontStyle] = {
                family: fam, weight: Number(cs.fontWeight) || 400, style: cs.fontStyle
            };
            ['::before', '::after'].forEach(function(which) {
                var ps = getComputedStyle(src, which);
                if (!ps || ps.content === 'none' || ps.content === 'normal') return;
                var cls = 'kx' + (n++);
                dst.classList.add(cls);
                pseudo.push('.' + cls + which + '{' + cssText(ps) + '}');
            });
            if (src.tagName === 'CANVAS') {
                var img = document.createElement('img');
                try { img.src = src.toDataURL('image/png'); } catch (e) { /* tainted */ }
                img.setAttribute('style', cssText(cs));
                dst.parentNode.replaceChild(img, dst);
                return;
            }
            if (src.tagName === 'IMG') images.push(dst);
            var s = src.firstChild, d = dst.firstChild;
            while (s && d) {
                var sNext = s.nextSibling, dNext = d.nextSibling;
                if (s.nodeType === 1 && s.matches(LEAVE_OUT)) {
                    dst.removeChild(d);
                } else {
                    walk(s, d);
                }
                s = sNext; d = dNext;
            }
        })(el, clone);
        // The copy is laid out on its own: hold the box at the size the
        // reader sees, and drop the margin that placed it in the post and
        // the strip kept above it for the button (--kr-export-strip).
        var box = el.getBoundingClientRect();
        var host = getComputedStyle(el);
        var strip = parseFloat(host.getPropertyValue('--kr-export-strip')) || 0;
        clone.style.margin = '0';
        clone.style.width = box.width + 'px';
        clone.style.boxSizing = 'border-box';
        if (strip) clone.style.paddingTop = Math.max(0, parseFloat(host.paddingTop) - strip) + 'px';
        var jobs = images.map(function(img) {
            var src = img.currentSrc || img.getAttribute('src');
            img.removeAttribute('srcset');
            img.removeAttribute('loading');
            if (!src || /^data:/.test(src)) return null;
            return fetchData(new URL(src, location.href).href)
                .then(function(d) { img.setAttribute('src', d); }, function() {});
        });
        return Promise.all(jobs).then(function() {
            return fontFaces(Object.keys(used).map(function(k) { return used[k]; }));
        }).then(function(fonts) {
            return { node: clone, css: fonts + pseudo.join(''), width: box.width, height: box.height - strip };
        });
    }

    function loadImage(src) {
        return new Promise(function(ok, fail) {
            var img = new Image();
            img.onload = function() { ok(img); };
            img.onerror = function() { fail(new Error('The diagram could not be drawn.')); };
            img.src = src;
        });
    }

    function save(blob, name) {
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = name;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(function() { URL.revokeObjectURL(url); }, 4000);
    }

    /**
     * Draws el and the page address onto a canvas and saves it. `label`
     * names the file. Resolves with the file name; rejects when the
     * browser will not read back a canvas it drew an SVG on (older
     * Safari), so the caller can say so.
     */
    function png(el, label) {
        var href = pageHref();
        var mark = watermark(href);
        var bg = backgroundOf(el);
        var ink = getComputedStyle(document.body).color;
        return copy(el).then(function(c) {
            var w = Math.ceil(c.width), h = Math.ceil(c.height);
            var svg = document.createElementNS(SVG_NS, 'svg');
            svg.setAttribute('xmlns', SVG_NS);
            svg.setAttribute('width', w);
            svg.setAttribute('height', h);
            var fo = document.createElementNS(SVG_NS, 'foreignObject');
            fo.setAttribute('width', '100%');
            fo.setAttribute('height', '100%');
            var root = document.createElementNS(XHTML_NS, 'div');
            var style = document.createElementNS(XHTML_NS, 'style');
            style.textContent = c.css;
            root.appendChild(style);
            root.appendChild(c.node);
            fo.appendChild(root);
            svg.appendChild(fo);
            var text = new XMLSerializer().serializeToString(svg);
            return loadImage('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(text))
                .then(function(img) { return { img: img, w: w, h: h }; });
        }).then(function(d) {
            var markH = MARK_SIZE + MARK_GAP;
            var cw = d.w + PAD * 2, ch = d.h + PAD * 2 + markH;
            var canvas = document.createElement('canvas');
            canvas.width = cw * SCALE;
            canvas.height = ch * SCALE;
            var g = canvas.getContext('2d');
            g.scale(SCALE, SCALE);
            g.fillStyle = bg;
            g.fillRect(0, 0, cw, ch);
            g.drawImage(d.img, PAD, PAD, d.w, d.h);
            g.font = '500 ' + MARK_SIZE + 'px Poppins, system-ui, sans-serif';
            g.fillStyle = ink;
            g.globalAlpha = 0.6;
            g.textAlign = 'right';
            g.textBaseline = 'alphabetic';
            g.fillText(mark, cw - PAD, ch - PAD + 2);
            return new Promise(function(ok, fail) {
                try {
                    canvas.toBlob(function(blob) {
                        if (!blob) { fail(new Error('This browser would not save the picture.')); return; }
                        var name = fileName(href, label);
                        save(blob, name);
                        ok(name);
                    }, 'image/png');
                } catch (e) {
                    fail(new Error('This browser would not save the picture.'));
                }
            });
        });
    }

    window.krExport = { png: png, watermark: watermark, fileName: fileName };
})();
