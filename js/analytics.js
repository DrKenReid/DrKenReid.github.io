/**
 * Google Analytics 4 for every page, loaded after the page rather than
 * ahead of it.
 *
 * Why deferred. The old per-page snippet put gtag.js, a large third-party
 * script the page does not need in order to render, in every <head> with
 * `async`, so it competed with the stylesheet, the hero photograph and
 * the site's own scripts for bandwidth and main-thread time in the first
 * moments of every visit. Counting a visit does not need to happen before
 * the reader can see the page. Here the page does one cheap thing early,
 * pushing the `config` command onto window.dataLayer (a plain array), and
 * gtag.js itself is only requested once the load event has fired and the
 * browser is idle (requestIdleCallback, or IDLE_MS where that API is
 * missing). gtag.js reads the queued commands when it arrives, so the
 * page_view still fires exactly once, stamped with the time the page was
 * opened (the `js` command below) rather than the time the library
 * turned up.
 *
 * Idempotent. krAnalytics() does nothing when window.gtag already exists:
 * a page that still carries the old inline snippet, a second copy of this
 * file, or a call made by hand cannot configure the property twice (which
 * would count every visit twice) or inject a second library.
 *
 * Where the configuration lives. GA_ID below is the one place the
 * measurement id is written for the pages; pages load this file with
 * `<script defer src="/js/analytics.js"></script>` (`../js/analytics.js`
 * from a post) in place of the snippet. No consent banner or opt-out is
 * applied here: the privacy policy (privacy.html) describes what is
 * collected and how to block it, and any change to that is a decision
 * about the site's policy, not about this loader.
 */
(function () {
    'use strict';

    /** The GA4 measurement id (Admin > Data streams in Google Analytics). */
    var GA_ID = 'G-PQK9NRXC9D';

    /** How long to wait for an idle moment after load before loading
        gtag.js anyway, so a busy page still gets counted. */
    var IDLE_MS = 2000;

    var GTAG_SRC = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;

    function inject() {
        // One library per document, even if the loader was started twice
        // before the first request went out.
        if (document.querySelector('script[src="' + GTAG_SRC + '"]')) return;
        var script = document.createElement('script');
        script.async = true;
        script.src = GTAG_SRC;
        document.head.appendChild(script);
    }

    function whenIdle() {
        if ('requestIdleCallback' in window) {
            window.requestIdleCallback(inject, { timeout: IDLE_MS });
        } else {
            window.setTimeout(inject, IDLE_MS);
        }
    }

    function krAnalytics() {
        if (typeof window.gtag === 'function') return;

        window.dataLayer = window.dataLayer || [];
        // gtag.js only accepts the Arguments object itself, not an array
        // copy of it, which is why this is not a rest-parameter function.
        window.gtag = function () { window.dataLayer.push(arguments); };
        window.gtag('js', new Date());
        window.gtag('config', GA_ID);

        if (document.readyState === 'complete') whenIdle();
        else window.addEventListener('load', whenIdle, { once: true });
    }

    window.krAnalytics = krAnalytics;
    krAnalytics();
}());
