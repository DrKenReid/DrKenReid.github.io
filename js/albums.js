/**
 * albums.js: the record crate on the music page.
 *
 * Renders data/topalbums.json (refreshed weekly by the lastfm-refresh
 * Action, 3-month Last.fm window) as sleeves stood in a crate, most
 * played at the front. Hover or focus a sleeve and it lifts out with
 * its label; the rest stay filed. The crate is CSS: each sleeve is an
 * absolutely placed link, in a list item of its own, with its index in
 * --i, and the front board is a sibling that sits above the sleeves'
 * lower edges.
 *
 * Touch. There is no hover to lift a sleeve with, and a tap used to go
 * straight to Last.fm, so nobody on a phone saw a label. Now the first
 * tap on a sleeve pulls it out (.is-out, drawn as a hovered one) instead
 * of following the link; a tap on the sleeve that is out follows it, and
 * a tap anywhere else puts it back. A mouse click, a key, and a screen
 * reader's activation of a sleeve it has already focused (so already
 * lifted) follow the link at once. On a phone the crate scrolls sideways
 * (style.css §15), so every sleeve shows a strip wide enough to tap; it
 * opens at the front, and a sleeve pulled out near an edge, or reached
 * with Tab, is scrolled into view with its label.
 *
 * Hover lifts a sleeve only where the primary pointer can hover
 * (style.css §15). A tap sets :hover as well, just before its click, and
 * under reduced motion, with no transition to wait for, the lift took a
 * phone-sized sleeve from under the finger at once, so the click fell
 * on the sleeve behind it. Where hover does lift a sleeve and a finger
 * can still tap one (a touch laptop, an iPad with a trackpad), a sleeve
 * already hovered as a tap begins counts as out, since it is drawn out:
 * Safari sends no click for a tap that makes content appear on :hover,
 * so there the first tap only lifts it and the second must open it.
 *
 * The lede gets the date of the refresh, so a crate that stopped
 * updating says how old it is.
 */
(function () {
    // How much a pulled-out sleeve grows (the scale in style.css's
    // --kr-crate-out), and the room kept around it and its label when the
    // crate scrolls to show them.
    var OUT_SCALE = 1.06;
    var REVEAL_MARGIN = 8;

    /* Scrolls a sideways-scrolling crate so the pulled-out sleeve and its
       label are in view. Worked out from the layout rather than measured,
       since the lift is still animating: the label sits under the sleeve,
       slid from its left edge (the back sleeve) to its right (the front
       one) by the sleeve's place in the crate, as style.css places it. */
    function reveal(crate, sleeve) {
        if (getComputedStyle(crate).overflowX === 'visible' || crate.scrollWidth <= crate.clientWidth + 1) return;
        var label = sleeve.querySelector('.kr-crate__label');
        var n = +getComputedStyle(crate).getPropertyValue('--kr-n') || 1;
        var at = n > 1 ? +sleeve.style.getPropertyValue('--i') / (n - 1) : 0;
        var left = sleeve.offsetLeft, width = sleeve.offsetWidth * OUT_SCALE;
        var from = left, to = left + width;
        if (label) {
            var lw = label.offsetWidth;
            var ll = left + OUT_SCALE * at * (sleeve.offsetWidth - lw);
            from = Math.min(from, ll);
            to = Math.max(to, ll + OUT_SCALE * lw);
        }
        var target = crate.scrollLeft;
        if (to - from + 2 * REVEAL_MARGIN > crate.clientWidth) target = (from + to - crate.clientWidth) / 2;
        else if (from - REVEAL_MARGIN < target) target = from - REVEAL_MARGIN;
        else if (to + REVEAL_MARGIN > target + crate.clientWidth) target = to + REVEAL_MARGIN - crate.clientWidth;
        if (target === crate.scrollLeft) return;
        var still = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        crate.scrollTo({ left: Math.max(0, target), behavior: still ? 'auto' : 'smooth' });
    }

    /* The touch behaviour (see the header). */
    function initTouch(crate) {
        var touched = false;
        // The sleeve under the finger if hover had already drawn it out as
        // the tap began (see the header). Read at pointerdown, before this
        // tap's own emulated mouse events hover it, so a first tap never
        // counts; and only where hover lifts a sleeve, since elsewhere a
        // :hover left behind by an earlier tap shows nothing.
        var hovered = null;
        var canHover = window.matchMedia ? window.matchMedia('(hover: hover)') : null;
        function putBack() {
            var out = crate.querySelector('.kr-crate__sleeve.is-out');
            if (out) out.classList.remove('is-out');
        }
        crate.addEventListener('pointerdown', function (e) {
            touched = e.pointerType === 'touch' || e.pointerType === 'pen';
            var sleeve = e.target.closest ? e.target.closest('.kr-crate__sleeve') : null;
            hovered = sleeve && canHover && canHover.matches && sleeve.matches(':hover') ? sleeve : null;
        }, { passive: true });
        crate.addEventListener('pointercancel', function () { touched = false; }, { passive: true });
        crate.addEventListener('click', function (e) {
            var sleeve = e.target.closest ? e.target.closest('.kr-crate__sleeve') : null;
            var tap = touched, wasOut = sleeve !== null && sleeve === hovered;
            touched = false;
            hovered = null;
            // detail 0: a click made by a key or an assistive technology.
            if (!sleeve || !tap || e.detail === 0) return;
            if (wasOut || sleeve.classList.contains('is-out') || sleeve.matches(':focus-visible')) return;
            e.preventDefault();
            putBack();
            sleeve.classList.add('is-out');
            reveal(crate, sleeve);
        });
        document.addEventListener('pointerdown', function (e) {
            if (!e.target.closest || !e.target.closest('.kr-crate__sleeve')) putBack();
        }, { passive: true });
    }

    /* A sleeve reached with Tab lifts by :focus-visible. Where the crate
       scrolls, the browser brings only the sleeve's box at rest into view,
       and at times not all of that, so the lifted sleeve and its label
       could sit past the edge, cut off. They are shown as a tapped one is,
       once the browser's own scroll is done. */
    function initKeys(crate) {
        crate.addEventListener('focusin', function (e) {
            var sleeve = e.target.closest ? e.target.closest('.kr-crate__sleeve') : null;
            if (!sleeve) return;
            var keyed = false;
            try { keyed = sleeve.matches(':focus-visible'); } catch (err) {}
            if (!keyed) return;
            requestAnimationFrame(function () {
                if (document.activeElement === sleeve) reveal(crate, sleeve);
            });
        });
    }

    document.addEventListener('DOMContentLoaded', function () {
        var crate = document.getElementById('kr-crate');
        if (!crate) return;
        krFetchJson('data/topalbums.json').then(function (data) {
            var albums = (data && data.albums) || [];
            if (!albums.length) { crate.hidden = true; return; }
            // Filed back to front: the crate is browsed from the front, so
            // the most played sleeve is nearest the viewer.
            var filed = albums.slice().reverse();
            crate.style.setProperty('--kr-n', filed.length);
            crate.innerHTML = filed.map(function (a, i) {
                var name = krEscapeHtml(a.name), artist = krEscapeHtml(a.artist);
                var plays = krEscapeHtml(a.plays);
                return '<span class="kr-crate__slot" role="listitem">' +
                    '<a class="kr-crate__sleeve" href="' + krEscapeHtml(a.url) + '" target="_blank" rel="noopener noreferrer" style="--i:' + i + '" aria-label="' + name + ' by ' + artist + ', ' + plays + ' plays on Last.fm">' +
                    '<img src="' + krEscapeHtml(a.img) + '" alt="" loading="lazy" width="300" height="300"' +
                    ' onerror="this.closest(\'.kr-crate__slot\').remove()">' +
                    '<span class="kr-crate__label" aria-hidden="true"><span class="kr-crate__name">' + name + '</span>' +
                    '<span class="kr-crate__artist">' + artist + ' · ' + plays + ' plays</span></span>' +
                    '</a></span>';
            }).join('') + '<span class="kr-crate__board" aria-hidden="true"></span>';
            // Where the crate scrolls (a phone), it opens at the front.
            crate.scrollLeft = crate.scrollWidth;
            initTouch(crate);
            initKeys(crate);
            var count = document.getElementById('kr-crate-count');
            if (count) count.textContent = filed.length;
            var asOf = document.getElementById('kr-crate-asof');
            if (asOf && data.updated && typeof formatPostDate === 'function') {
                asOf.textContent = ' as of ' + formatPostDate(data.updated);
            }
        }).catch(function () { crate.hidden = true; });
    });
}());
