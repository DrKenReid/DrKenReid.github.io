/**
 * albums.js — the record crate on the music page.
 *
 * Renders data/topalbums.json (refreshed weekly by the lastfm-refresh
 * Action, 3-month Last.fm window) as sleeves stood in a crate, most
 * played at the front. Hover or focus a sleeve and it lifts out with
 * its label; the rest stay filed. The crate is CSS: each sleeve is an
 * absolutely placed link with its index in --i, and the front board is
 * a sibling that sits above the sleeves' lower edges.
 */
(function () {
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
                return '<a class="kr-crate__sleeve" role="listitem" href="' + krEscapeHtml(a.url) + '" target="_blank" rel="noopener noreferrer" style="--i:' + i + '" aria-label="' + name + ' — ' + artist + ', ' + plays + ' plays on Last.fm">' +
                    '<img src="' + krEscapeHtml(a.img) + '" alt="" loading="lazy" width="300" height="300"' +
                    ' onerror="this.closest(\'.kr-crate__sleeve\').remove()">' +
                    '<span class="kr-crate__label" aria-hidden="true"><span class="kr-crate__name">' + name + '</span>' +
                    '<span class="kr-crate__artist">' + artist + ' · ' + plays + ' plays</span></span>' +
                    '</a>';
            }).join('') + '<span class="kr-crate__board" aria-hidden="true"></span>';
            var count = document.getElementById('kr-crate-count');
            if (count) count.textContent = filed.length;
        }).catch(function () { crate.hidden = true; });
    });
}());
