/**
 * The site's Leaflet base layer, for every page that draws a map
 * (map.html's photo map, about.html's journey). Load it after
 * /js/vendor/leaflet/leaflet.js.
 *
 * Esri's grey canvases: a quiet base in both themes, and no API key
 * (CARTO's basemaps started watermarking keyless tiles in 2026). The
 * tiles follow the site's theme: the dark canvas under the dark theme,
 * the light one otherwise, swapped when the reader flips the toggle.
 *
 * Globals: krMapTiles(map) adds the base layer to a Leaflet map and keeps
 * it in step with the theme; KR_MAP_TILES is the two layers' settings.
 */
var KR_MAP_TILES = {
    light: {
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}',
        attribution: 'Tiles &copy; <a href="https://www.esri.com/">Esri</a> &mdash; Esri, HERE, Garmin, &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    },
    dark: {
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
        attribution: 'Tiles &copy; <a href="https://www.esri.com/">Esri</a> &mdash; Esri, HERE, Garmin, &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }
};

function krMapTiles(map) {
    var current = null;
    function apply() {
        var theme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
        if (current) map.removeLayer(current);
        current = L.tileLayer(KR_MAP_TILES[theme].url, {
            attribution: KR_MAP_TILES[theme].attribution,
            maxZoom: 16
        }).addTo(map);
    }
    apply();
    // The toggle flips data-theme on its click; read it a moment after.
    // Another tab's change arrives through theme.js, which sets the same
    // attribute, so watch the attribute itself as well.
    document.addEventListener('click', function (e) {
        if (e.target.closest && e.target.closest('#theme-toggle')) setTimeout(apply, 60);
    });
    if ('MutationObserver' in window) {
        var last = document.documentElement.getAttribute('data-theme');
        new MutationObserver(function () {
            var now = document.documentElement.getAttribute('data-theme');
            if (now !== last) { last = now; apply(); }
        }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    }
    return { refresh: apply };
}
