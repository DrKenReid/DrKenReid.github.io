/**
 * albums.js — "Top Albums" wall on the music page.
 * Renders data/topalbums.json (refreshed daily by the live-data
 * Action, 3-month Last.fm window) as an artwork grid.
 */
(function () {
    document.addEventListener('DOMContentLoaded', function () {
        var grid = document.getElementById('album-wall');
        if (!grid) return;
        grid.innerHTML = new Array(12).fill('<span class="album-wall-item kr-skeleton"></span>').join('');
        fetch('data/topalbums.json').then(function (r) { return r.json(); }).then(function (data) {
            var albums = (data && data.albums) || [];
            if (!albums.length) { grid.innerHTML = ''; return; }
            grid.innerHTML = albums.map(function (a) {
                var label = (a.name + ' — ' + a.artist).replace(/"/g, '&quot;');
                return '<a class="album-wall-item" href="' + a.url + '" target="_blank" rel="noopener noreferrer" title="' + label + '">' +
                    '<img src="' + a.img + '" alt="' + label + '" loading="lazy" width="300" height="300"' +
                    ' onerror="this.closest(\'.album-wall-item\').remove()">' +
                    '<span class="album-wall-meta"><span class="album-wall-name">' + a.name + '</span>' +
                    '<span class="album-wall-artist">' + a.artist + ' · ' + a.plays + ' plays</span></span>' +
                    '</a>';
            }).join('');
        }).catch(function () { grid.innerHTML = ''; });
    });
}());
