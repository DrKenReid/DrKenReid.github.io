/**
 * seasons/holi.js: Holi's art for js/season.js (see that file for the
 * pieces), for Holika Dahan and the day of colours after it: a branch of
 * palash in flower (the tree whose blossom gave the first colours) with a
 * pouch of gulal hanging from it, clouds of gulal rising over the
 * openers, a brass plate heaped with five colours, a dhol, a pichkari
 * standing in a brass lota, little bowls and heaps of powder between
 * them, a water balloon lobbed across the page that bursts into colour,
 * a favicon and a moon splashed with colour, a streak of colour that runs
 * along a post's top as far as the reader has read, a haze of colour
 * along the foot of the homepage hero, a 404 page that has gone out to
 * play, and a pink pointer with a splash at its tail.
 * Its own, on the day of colours: every click on a page opener (or a
 * slide of the homepage hero) throws a handful of gulal that stays where
 * it lands, never behind the type, and the colour builds up over the
 * visit (each opener starts with as many splashes as the reader has
 * thrown so far, up to a point). On the first
 * evening, Holika Dahan, the air carries embers instead, and a pyre
 * stands on the footer, lit from five in the evening. The day comes from
 * the season's own dates (KR_SEASONS); ?holi-day=eve or ?holi-day=colours
 * shows either one, in this tab.
 *
 * Classes only this file applies (css/seasons/holi.css):
 * .kr-season-pumpkin, .kr-season-dangler__body, .kr-season-flyer__body,
 * .kr-season-puff--gulal, .kr-season-flyer--lob, .kr-season-holi-balloon,
 * .kr-season-holi-burst, .kr-season-track--rang, .kr-season-holi-tip,
 * .kr-season-holi-eve (on <html>), .kr-season-holi-stains,
 * .kr-season-holi-stain (--fresh), .kr-season-holika (--lit),
 * .kr-season-holika__flame (--front), .kr-season-holika__spark.
 */
(function () {
    'use strict';
    var K = window.krSeasonKit;
    if (!K) return;
    var svg = K.svg;

    // Gulal: pink, yellow, green, blue, purple.
    var PINK = '#e8358f', YELLOW = '#ffc21a', GREEN = '#2fb35a', BLUE = '#2f7fe0', PURPLE = '#8e44c9';
    var GULAL = [PINK, YELLOW, GREEN, BLUE, PURPLE];
    var BRASS = '#d4a23a', BRASS_DEEP = '#9a7020', BRASS_LIGHT = '#f2cf6b';

    function fix(v) { return K.fix(+v); }

    /* Which day it is: the first day of this year's window is Holika
       Dahan (the bonfire, in the evening), any other is the day of
       colours. ?holi-day=eve|colours picks one for this tab (stored, then
       taken out of the address, as the engine does with its switches). */
    var DAY_KEY = 'kr-season-holi-day';
    function holiDay() {
        var q = new URLSearchParams(location.search), pick = null;
        if (q.has('holi-day')) {
            pick = q.get('holi-day');
            q.delete('holi-day');
            try {
                if (pick === 'eve' || pick === 'colours') sessionStorage.setItem(DAY_KEY, pick);
                else sessionStorage.removeItem(DAY_KEY);
            } catch (e) {}
            var rest = q.toString();
            try {
                history.replaceState(history.state, '', location.pathname + (rest ? '?' + rest : '') + location.hash);
            } catch (e) {}
        }
        try { pick = sessionStorage.getItem(DAY_KEY) || null; } catch (e) { pick = null; }
        if (pick === 'eve' || pick === 'colours') return pick;
        var now = new Date(), years = K.season.years || {}, wins = years[now.getFullYear()];
        var first = wins && wins[0] && wins[0][0];
        return first && now.getMonth() + 1 === first[0] && now.getDate() === first[1] ? 'eve' : 'colours';
    }
    var EVE = holiDay() === 'eve';
    if (EVE) document.documentElement.classList.add('kr-season-holi-eve');

    /* A palash flower: three curved petals like a parrot's beak, flame
       orange, from a dark velvet calyx at (x, y), turned and scaled. */
    function palash(x, y, turn, scale) {
        var petal = 'M0 0C3.2 1.6 5.4 5.6 4.4 11C3.4 7.8 1.4 5.2-1.6 3.6z';
        var out = '<g transform="translate(' + fix(x) + ' ' + fix(y) + ') rotate(' + turn + ') scale(' + scale + ')" stroke="none">';
        [[-48, '#e8551a', 0.85], [-6, '#f26a1b', 1], [36, '#ff8a2a', 0.9]].forEach(function (p) {
            out += '<path d="' + petal + '" fill="' + p[1] + '" transform="rotate(' + p[0] + ') scale(' + p[2] + ')"/>';
        });
        return out + '<ellipse cx="0" cy="-.4" rx="1.8" ry="1.4" fill="#3a2a24"/></g>';
    }

    // A bare palash bough reaching in from the corner, in flower.
    function palashArt() {
        return '<path d="M64 3C52 6 40 12 30 20S14 34 8 43M47 9c1 6 4 10 8 13M31 19c-6-2-12-1-16 3M20 30c1 5 4 8 8 10"' +
            ' fill="none" stroke-width="2" stroke-linecap="round"/>' +
            palash(55, 22, -10, 1) + palash(15, 22, 40, 0.9) + palash(28, 40, -30, 0.95) + palash(8, 43, 20, 1.05) +
            palash(39, 14, 10, 0.75) + palash(60, 5, -60, 0.7) +
            '<g stroke="none"><circle cx="49" cy="15" r="1.2" fill="' + PINK + '"/><circle cx="23" cy="34" r="1" fill="' + YELLOW + '"/>' +
            '<circle cx="35" cy="26" r=".9" fill="' + GREEN + '"/><circle cx="12" cy="31" r="1" fill="' + BLUE + '"/></g>';
    }

    // A potli of gulal on its drawstring: a pink pouch, ruffled at the neck.
    var POTLI = svg('kr-season-dangler__body', '0 0 20 20',
        '<path d="M7.2 6.2C3.4 8.6 2.2 13.4 4 16.6c1.8 3 10.2 3 12 0 1.8-3.2.6-8-3.2-10.4z" fill="' + PINK + '" stroke="#9c1a5c" stroke-width=".5"/>' +
        '<path d="M7.2 6.4L5.4 2.6l2.6 1.4L10 1.6l2 2.4 2.6-1.4-1.8 3.8z" fill="#ff7ab8" stroke="#9c1a5c" stroke-width=".4"/>' +
        '<rect x="6.4" y="5.4" width="7.2" height="1.8" rx=".9" fill="' + YELLOW + '"/>' +
        '<g fill="' + YELLOW + '"><circle cx="7" cy="12" r=".7"/><circle cx="10" cy="13.4" r=".7"/><circle cx="13" cy="12" r=".7"/>' +
        '<circle cx="8.6" cy="15.6" r=".6"/><circle cx="11.4" cy="15.6" r=".6"/></g>');

    /* A pinch of gulal in the air on the leaves' 24 x 24 box: a cluster
       of grains, big at the heart and finer outwards; a speck is K.DOT. */
    var PINCH = [[12, 12, 3.4], [8.2, 10.4, 2.3], [15.6, 9.4, 2.2], [14.4, 15.4, 2.4], [8.8, 15, 1.9], [11.6, 6.8, 1.6],
        [18.6, 13, 1.4], [5, 12.8, 1.3], [12.4, 19, 1.4], [17.4, 18.2, 1], [4.6, 7.4, .9], [19.4, 6.6, .9], [6.6, 19.4, .8]]
        .map(function (g) {
            return 'M' + fix(g[0] - g[2]) + ' ' + g[1] + 'a' + g[2] + ' ' + g[2] + ' 0 1 0 ' + fix(g[2] * 2) + ' 0a' + g[2] + ' ' +
                g[2] + ' 0 1 0 ' + fix(-g[2] * 2) + ' 0z';
        }).join('');
    var EMBERS = ['#ffb347', '#ffd36b', '#ff8a3d', '#ffe7a3'];

    // A heap of powder on a plate or the ground, centred on x, its foot at y.
    function heap(x, y, r, h, colour) {
        return '<path d="M' + fix(x - r) + ' ' + fix(y) + 'Q' + fix(x - r * 0.45) + ' ' + fix(y - h * 1.1) + ' ' + fix(x) + ' ' +
            fix(y - h) + 'T' + fix(x + r) + ' ' + fix(y) + 'z" fill="' + colour + '"/>' +
            '<ellipse cx="' + fix(x - r * 0.25) + '" cy="' + fix(y - h * 0.62) + '" rx="' + fix(r * 0.28) + '" ry="' + fix(h * 0.16) +
            '" fill="#ffffff" opacity=".35"/>';
    }

    /* A brass thali on the pumpkins' 64 x 56 box with five heaps of gulal
       on it, three behind and two in front. */
    var THALI = svg('kr-season-pumpkin', '0 0 64 56',
        '<ellipse cx="32" cy="45" rx="30" ry="8.6" fill="' + BRASS + '" stroke="' + BRASS_DEEP + '" stroke-width="1"/>' +
        '<ellipse cx="32" cy="44" rx="23.5" ry="5.6" fill="' + BRASS_LIGHT + '"/>' +
        heap(19, 42, 8.5, 12, PINK) + heap(32, 40.5, 8.5, 14, YELLOW) + heap(45, 42, 8.5, 12, BLUE) +
        heap(25.5, 47.5, 8.6, 10, GREEN) + heap(39, 47.5, 8.6, 10, PURPLE) +
        '<g fill="' + PINK + '"><circle cx="9" cy="47" r=".9"/><circle cx="56" cy="46" r=".8"/></g>' +
        '<circle cx="12" cy="50" r=".8" fill="' + GREEN + '"/><circle cx="52" cy="50" r=".9" fill="' + YELLOW + '"/>');

    /* A dhol on its side: a barrel painted saffron with bands of pink
       and green, its rope lacing, the near head pale, the strap over it. */
    var lacing = '';
    for (var lx = 16; lx < 50; lx += 6) lacing += 'M' + lx + ' 20.6L' + (lx + 3) + ' 43.4L' + (lx + 6) + ' 20.6';
    var DHOL = svg('kr-season-pumpkin', '0 0 64 56',
        '<path d="M14 22C18 4 46 4 50 22" fill="none" stroke="' + PINK + '" stroke-width="2.4" stroke-linecap="round"/>' +
        '<path d="M12 20Q32 13 52 20V44Q32 51 12 44z" fill="#e6a12c"/>' +
        '<path d="M14 19.4v25.2M50 19.4v25.2" stroke="' + GREEN + '" stroke-width="2.4"/>' +
        '<path d="M17.6 18.4v27M46.4 18.4v27" stroke="' + PINK + '" stroke-width="1.6"/>' +
        '<path d="' + lacing + '" fill="none" stroke="#fff6e0" stroke-width="1" stroke-linejoin="round"/>' +
        '<ellipse cx="52" cy="32" rx="3.6" ry="12.2" fill="#7a4a22"/>' +
        '<ellipse cx="12" cy="32" rx="5.4" ry="12.8" fill="#f3e6c8" stroke="#6b4a2a" stroke-width="1.2"/>' +
        '<ellipse cx="12" cy="32" rx="2.2" ry="5.4" fill="#e3d2ab"/>' +
        '<path d="M38 50l6 4M44 50l-4 5" stroke="#6b4a2a" stroke-width="1.4" stroke-linecap="round"/>');

    /* A brass lota of coloured water with a pichkari standing in it, its
       plunger up: a green barrel with yellow rings, a T-handle. */
    var LOTA = svg('kr-season-pumpkin', '0 0 64 56',
        '<g transform="translate(30 30) rotate(-50)">' +
        '<path d="M26 0h11M37-5.4v10.8" stroke="#6b4a2a" stroke-width="2.4" stroke-linecap="round"/>' +
        '<rect x="-4" y="-4" width="31" height="8" rx="1.6" fill="' + GREEN + '" stroke="#1f7a3c" stroke-width=".9"/>' +
        '<path d="M8 -4v8M17-4v8" stroke="' + YELLOW + '" stroke-width="2.2"/>' +
        '<rect x="25" y="-5" width="3" height="10" rx="1" fill="' + YELLOW + '"/>' +
        '<path d="M2-2.2h20" stroke="#ffffff" stroke-width="1.1" stroke-linecap="round" opacity=".45"/></g>' +
        '<path d="M21.6 28c-1-2.4-.6-4 1-4.4h14.8c1.6.4 2 2 1 4.4 7.4 3 11 8.6 11 14.2 0 7.4-7 12-19.4 12S10.6 49.6 10.6 42.2c0-5.6 3.6-11.2 11-14.2z"' +
        ' fill="' + BRASS + '" stroke="' + BRASS_DEEP + '" stroke-width="1"/>' +
        '<ellipse cx="30" cy="24.2" rx="9.6" ry="2.2" fill="' + PINK + '" stroke="' + BRASS_DEEP + '" stroke-width=".8"/>' +
        '<path d="M15 37c4-3 9-4.4 15-4.4" fill="none" stroke="' + BRASS_LIGHT + '" stroke-width="2" stroke-linecap="round"/>' +
        '<path d="M12.4 44.6c10.4 3.4 24.8 3.4 35.2 0" fill="none" stroke="' + BRASS_DEEP + '" stroke-width="1"/>');

    // A katori of gulal and a heap of it spilled, for between them.
    function katori(w, colour) {
        return '<svg class="kr-season-leaf" viewBox="0 0 24 16" width="' + w + '" height="' + fix(w * 16 / 24) + '"' +
            ' aria-hidden="true" focusable="false">' + heap(12, 8.4, 8, 6, colour) +
            '<path d="M2 8h20c-.6 4.6-4.6 7.4-10 7.4S2.6 12.6 2 8z" fill="' + BRASS + '" stroke="' + BRASS_DEEP + '" stroke-width=".7"/></svg>';
    }
    function pile(w, colour) {
        return '<svg class="kr-season-leaf" viewBox="0 0 24 12" width="' + w + '" height="' + fix(w / 2) + '"' +
            ' aria-hidden="true" focusable="false">' + heap(12, 12, 10, 7, colour) +
            '<circle cx="2" cy="11" r=".9" fill="' + colour + '"/><circle cx="22.4" cy="10.6" r=".7" fill="' + colour + '"/></svg>';
    }

    /* A water balloon lobbed across the page, blue and shiny, tied off;
       at the top of its arc it bursts into a ring of colour. */
    var burstDots = '';
    for (var b = 0; b < 12; b++) {
        var a = b / 12 * Math.PI * 2, r = 12 + (b % 3) * 3;
        burstDots += '<circle cx="' + fix(24 + Math.cos(a) * r) + '" cy="' + fix(24 + Math.sin(a) * r) + '" r="' + (3.4 - (b % 3) * 0.7) +
            '" fill="' + GULAL[b % 5] + '"/>';
    }
    var BALLOON = svg('kr-season-flyer__body', '0 0 48 48',
        '<g class="kr-season-holi-balloon"><path d="M24 6c7 0 11.6 5.4 11.6 12.4S30 34.4 24 35.4C18 34.4 12.4 25.4 12.4 18.4S17 6 24 6z"' +
        ' fill="' + BLUE + '" stroke="#1b4f99" stroke-width=".8"/>' +
        '<path d="M22.4 35.2l1.6 2.6 1.6-2.6z" fill="#1b4f99"/>' +
        '<path d="M17.6 13c1.2-2.4 3.2-3.6 5.4-3.8" fill="none" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round" opacity=".7"/></g>' +
        '<g class="kr-season-holi-burst">' + burstDots + '<circle cx="24" cy="24" r="7" fill="' + PINK + '" opacity=".75"/></g>');

    var SPLASH_ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">' +
        '<circle cx="16" cy="16.5" r="9" fill="' + PINK + '"/><circle cx="7.4" cy="8.6" r="5" fill="' + YELLOW + '"/>' +
        '<circle cx="24.6" cy="24.2" r="4.8" fill="' + GREEN + '"/><circle cx="25" cy="7.6" r="4.2" fill="' + BLUE + '"/>' +
        '<circle cx="7.6" cy="24.6" r="3.8" fill="' + PURPLE + '"/><circle cx="16" cy="2.6" r="1.6" fill="' + GREEN + '"/>' +
        '<circle cx="29.6" cy="16" r="1.5" fill="' + YELLOW + '"/></svg>';

    // A splash of colour across the moon, with two drops thrown off it.
    var MOON_SPLASH = 'M12 7.6c1.2 0 1.5 1.3 2.5 1.5s2.3-.5 2.7.6-.8 1.7-.4 2.6 1.6 1.5.8 2.5-2 .2-2.6 1.1-.4 2.5-1.6 2.5' +
        '-1.4-1.5-2.4-1.7-2.5.8-3.1-.4.8-1.7.4-2.7-1.8-1.3-1-2.5 2-.4 2.6-1.4.6-2.3 1.8-2.3z' +
        'M17.4 6.4a1 1 0 1 0 2 0a1 1 0 1 0-2 0zM5.4 16.6a.8.8 0 1 0 1.6 0a.8.8 0 1 0-1.6 0z';

    // The track's tip: a puff of powder at the reader.
    var PUFF_TIP = svg('kr-season-holi-tip', '0 0 16 12',
        '<circle cx="6" cy="7" r="4.4" fill="' + PINK + '"/><circle cx="10.6" cy="6" r="4" fill="' + YELLOW + '"/>' +
        '<circle cx="8.6" cy="3.6" r="3" fill="' + BLUE + '"/><circle cx="12.6" cy="9" r="2.4" fill="' + GREEN + '"/>');

    /* ---------------------------------------------------------------- *
     * The day of colours: gulal thrown at the openers stays there
     * ---------------------------------------------------------------- */

    var COUNT_KEY = 'kr-season-holi-thrown';
    var MAX_SPLASHES = 40;

    function thrown() {
        try { return parseInt(sessionStorage.getItem(COUNT_KEY), 10) || 0; } catch (e) { return 0; }
    }
    function throwOne() {
        try { sessionStorage.setItem(COUNT_KEY, String(Math.min(999, thrown() + 1))); } catch (e) {}
    }

    // One radial gradient per colour, soft at the edge, shared by every splash.
    function gradients() {
        if (document.getElementById('kr-season-holi-g0')) return;
        var defs = '';
        GULAL.forEach(function (c, i) {
            defs += '<radialGradient id="kr-season-holi-g' + i + '"><stop offset="0" stop-color="' + c + '" stop-opacity=".95"/>' +
                '<stop offset=".55" stop-color="' + c + '" stop-opacity=".7"/><stop offset="1" stop-color="' + c + '" stop-opacity="0"/></radialGradient>';
        });
        var holder = document.createElement('div');
        holder.setAttribute('aria-hidden', 'true');
        holder.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
        holder.innerHTML = '<svg width="0" height="0" focusable="false"><defs>' + defs + '</defs></svg>';
        document.body.appendChild(holder);
    }

    /* A handful of gulal where it landed: a soft cloud with puffs round
       it and specks flung further, in one colour, turned at random. */
    function stain(layer, x, y, fresh) {
        var k = (Math.random() * GULAL.length) | 0, size = 70 + Math.random() * 90;
        var body = '<circle cx="60" cy="60" r="34" fill="url(#kr-season-holi-g' + k + ')"/>';
        var puffs = 5 + ((Math.random() * 4) | 0);
        for (var i = 0; i < puffs; i++) {
            var a = Math.random() * Math.PI * 2, d = 22 + Math.random() * 18;
            body += '<circle cx="' + fix(60 + Math.cos(a) * d) + '" cy="' + fix(60 + Math.sin(a) * d) + '" r="' +
                fix(9 + Math.random() * 13) + '" fill="url(#kr-season-holi-g' + k + ')"/>';
        }
        for (var s = 0; s < 9; s++) {
            var sa = Math.random() * Math.PI * 2, sd = 40 + Math.random() * 18;
            body += '<circle cx="' + fix(60 + Math.cos(sa) * sd) + '" cy="' + fix(60 + Math.sin(sa) * sd) + '" r="' +
                fix(1.2 + Math.random() * 1.8) + '" fill="' + GULAL[k] + '" opacity=".8"/>';
        }
        var el = document.createElement('span');
        el.className = 'kr-season-holi-stain' + (fresh && !K.reduced ? ' kr-season-holi-stain--fresh' : '');
        el.style.cssText = 'left:' + fix(x) + '%;top:' + fix(y) + '%;width:' + Math.round(size) + 'px;height:' + Math.round(size) +
            'px;margin:' + Math.round(-size / 2) + 'px 0 0 ' + Math.round(-size / 2) + 'px;transform:rotate(' + ((Math.random() * 360) | 0) + 'deg)';
        el.innerHTML = '<svg viewBox="0 0 120 120" aria-hidden="true" focusable="false">' + body + '</svg>';
        layer.appendChild(el);
        while (layer.children.length > MAX_SPLASHES) layer.removeChild(layer.firstChild);
    }

    /* Whether (x, y), in percent of the host, is on or near its type: the
       splashes a page starts with keep clear of it. */
    // Where a host's type sits, measured once for all the splashes about to land.
    function typeBoxes(host) {
        var type = host.querySelectorAll('h1, h2, .breadcrumb, p, .kr-opener__credit');
        return { host: host.getBoundingClientRect(),
            type: Array.prototype.map.call(type, function (t) { return t.getBoundingClientRect(); }) };
    }

    function overType(boxes, x, y) {
        var r = boxes.host;
        var px = r.left + x / 100 * r.width, py = r.top + y / 100 * r.height;
        return boxes.type.some(function (t) {
            return t.width && px > t.left - 70 && px < t.right + 70 && py > t.top - 60 && py < t.bottom + 60;
        });
    }

    /* Each opener, and each of the homepage hero's slides, gets a layer
       under its type, starting with as many splashes as the reader has
       thrown so far this visit (two, then one more per throw, up to
       eighteen), clear of the type. */
    function layerFor(host) {
        var layer = host.querySelector(':scope > .kr-season-holi-stains');
        if (layer) return layer;
        layer = document.createElement('div');
        layer.className = 'kr-season-holi-stains';
        layer.setAttribute('aria-hidden', 'true');
        host.insertBefore(layer, host.querySelector(':scope > .container, :scope > .kr-opener__inner'));
        var start = 2 + Math.min(16, thrown()), boxes = typeBoxes(host);
        for (var i = 0, tries = 0; i < start && tries < 200; tries++) {
            var x = 4 + Math.random() * 92, y = 8 + Math.random() * 84;
            if (overType(boxes, x, y)) continue;
            stain(layer, x, y, false);
            i++;
        }
        return layer;
    }

    /* A click on an opener or a hero slide (not on a link, a button or a
       field, nor after selecting text) throws a handful where the pointer
       is. Under reduced motion it still lands, without the bloom. */
    function stains() {
        gradients();
        // Not on the carousel's copies of its slides (.cloned), which come
        // and go as it loops.
        var hosts = document.querySelectorAll('.breadcrumb-area, .kr-opener, .welcome-area .single-welcome-slide');
        Array.prototype.forEach.call(hosts, function (host) {
            if (!host.closest('.owl-item.cloned')) layerFor(host);
        });
        Array.prototype.forEach.call(document.querySelectorAll('.breadcrumb-area, .kr-opener, .welcome-area'), function (area) {
            area.addEventListener('click', function (e) {
                if (e.target.closest('a, button, input, select, textarea, label, [role="button"], .owl-dots, .owl-nav, .kr-season-corner')) return;
                var sel = window.getSelection && window.getSelection();
                if (sel && String(sel).length) return;
                var host = area.classList.contains('welcome-area') ? e.target.closest('.single-welcome-slide') : area;
                if (!host || host.closest('.owl-item.cloned')) return;
                var boxes = typeBoxes(host), r = boxes.host;
                if (!r.width || !r.height) return;
                var x = (e.clientX - r.left) / r.width * 100, y = (e.clientY - r.top) / r.height * 100;
                throwOne();
                // Colour never lands behind the type: a throw at the words misses.
                if (!overType(boxes, x, y)) stain(layerFor(host), x, y, true);
            });
        });
    }

    /* ---------------------------------------------------------------- *
     * Holika Dahan: the pyre on the footer
     * ---------------------------------------------------------------- */

    /* A pyre of sticks leant together, a garland of dung cakes round it,
       on the footer's top edge at its right; from five in the evening
       (or whenever ?holi-day=eve asks) it burns, sparks going up. */
    function pyre(kit) {
        var footer = document.querySelector('.kr-footer');
        if (!footer || footer.querySelector('.kr-season-holika')) return;
        var sticks = '';
        [[12, 66, 40, 8], [68, 66, 40, 8], [22, 66, 42, 12], [58, 66, 38, 12], [32, 66, 40, 6], [48, 66, 41, 6],
            [17, 66, 36, 18], [63, 66, 44, 18]].forEach(function (s, i) {
            sticks += '<path d="M' + s[0] + ' ' + s[1] + 'L' + s[2] + ' ' + s[3] + '" stroke="' + (i % 2 ? '#7a5232' : '#8f6640') +
                '" stroke-width="' + (i < 2 ? 3.4 : 2.6) + '" stroke-linecap="round"/>';
        });
        var cakes = '';
        for (var c = 0; c < 9; c++) {
            var t = c / 8, cx = 18 + t * 44, cy = 44 + Math.sin(t * Math.PI) * 6;
            cakes += '<circle cx="' + fix(cx) + '" cy="' + fix(cy) + '" r="2.4" fill="#8a6a4a" stroke="#5c4330" stroke-width=".6"/>';
        }
        var lit = EVE && (new Date().getHours() >= 17 || (function () {
            try { return sessionStorage.getItem(DAY_KEY) === 'eve'; } catch (e) { return false; }
        })());
        var el = document.createElement('div');
        el.className = 'kr-season-holika' + (lit ? ' kr-season-holika--lit' : '');
        el.setAttribute('aria-hidden', 'true');
        el.innerHTML = svg('', '0 0 80 72',
            '<ellipse cx="40" cy="67" rx="34" ry="4" fill="#5c5048" opacity=".55"/>' +
            '<g class="kr-season-holika__flame"><path d="M40 68C24 64 18 50 26 36c1 8 5 11 8 10-3-12 4-22 12-32-1 12 7 17 10 26 3 10-1 24-16 28z"' +
            ' fill="#ff8a1f"/><path d="M40 68c-8-2-12-10-7-19 1 5 3 7 5 6-1-7 2-12 7-17 0 7 4 10 5 15 1 7-3 13-10 15z" fill="#ffd34d"/></g>' +
            sticks + '<path d="M18 44Q40 56 62 44" fill="none" stroke="#5c4330" stroke-width=".8"/>' + cakes +
            '<g class="kr-season-holika__flame kr-season-holika__flame--front"><path d="M30 68c-4-3-4-8-1-12 0 3 2 4 3 3 0-4 2-6 4-8 0 4 2 6 2 9 0 5-3 8-8 8z' +
            'M50 68c-5 0-8-3-8-8 0-3 2-5 2-9 2 2 4 4 4 8 1 1 3 0 3-3 3 4 3 9-1 12z" fill="#ffb02e"/></g>');
        if (lit && !kit.reduced) {
            for (var s = 0; s < 4; s++) {
                var spark = document.createElement('span');
                spark.className = 'kr-season-holika__spark';
                spark.style.left = (34 + s * 9) + '%';
                spark.style.animationDelay = (s * 0.55).toFixed(2) + 's';
                el.appendChild(spark);
            }
        }
        footer.insertBefore(el, footer.firstChild);
    }

    K.dress({
        // The ribbon's card (season.js, ribbon).
        about: { short: 'Holi', when: 'The full moon of Phalguna, in February or March',
            text: 'The Hindu festival of spring and colours. On the first evening, Holika Dahan, bonfires remember the burning of Holika and the escape of Prahlad; the next day people throw gulal, coloured powder, and water at each other, friends and strangers alike.',
            link: 'https://en.wikipedia.org/wiki/Holi' },
        corner: palashArt, dangler: POTLI,
        // Clouds and specks of gulal rising, soft-edged; embers on the eve.
        leaves: EVE ? { kind: 'rise', colours: EMBERS, per1000: 22, shapes: [K.DOT], tumble: false, glow: true, size: [8, 16] } :
            { kind: 'rise', colours: GULAL, per1000: 14, shapes: [PINCH, K.DOT], tumble: false, glow: true, size: [16, 34] },
        // The thali is the crowd out in the colours, the dhol plays, the
        // pichkari squirts.
        patch: [{ art: THALI, size: 'big', sound: '' },
                { art: LOTA, size: 'small', sound: 'splash' },
                { art: DHOL, size: 'mid', sound: 'dhol' }],
        strew: [katori(20, PINK), pile(14, YELLOW), katori(18, GREEN), pile(13, BLUE), katori(16, PURPLE)],
        puff: 'kr-season-puff--gulal',
        flyer: BALLOON, flight: 'kr-season-flyer--lob',
        favicon: SPLASH_ICON, moonmark: MOON_SPLASH,
        // A streak of colour along a post's top, as far as the reader has read.
        track: { kind: 'rang', mode: 'fill', tip: PUFF_TIP },
        map: null,
        lost: {
            title: 'This Page Has Gone Out to Play Holi',
            lede: 'Whatever lived at this address went out this morning in its oldest clothes. When it comes back it will be ' +
                'pink and green and very hard to recognise. <i lang="hi-Latn">Bura na mano, Holi hai.</i>',
            caption: 'While it washes off, have one of my more colourful photographs. '
        },
        // A pink pointer with a splash of three colours at its tail.
        cursor: K.cursor('#ff5fae', '<circle cx="4" cy="4.4" r="3" fill="' + YELLOW + '" stroke="#5a1035" stroke-width=".6"/>' +
            '<circle cx="9" cy="5" r="2.4" fill="' + GREEN + '" stroke="#5a1035" stroke-width=".6"/>' +
            '<circle cx="6.4" cy="9.2" r="2.6" fill="' + BLUE + '" stroke="#5a1035" stroke-width=".6"/>', '#5a1035'),
        extra: function (kit) {
            if (EVE) pyre(kit);
            else stains();
        }
    });
})();
