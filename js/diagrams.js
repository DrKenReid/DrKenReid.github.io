/**
 * diagrams.js: the hover cards and Save as PNG buttons on a post's
 * diagrams, and the phone labels on its stacked tables.
 *
 * Purpose
 *   A diagram (.kr-diagram, style.css section 11 "Diagrams") is HTML whose
 *   nodes may hold a .kr-diagram__detail. This makes every such node
 *   focusable, gives it the detail as its aria-describedby, and shows the
 *   detail in a card above the node on hover, keyboard focus or a tap.
 *   The detail stays in the page (hidden by CSS once the diagram is
 *   .is-live), so a screen reader hears it with the node and the card can
 *   be aria-hidden. Without this file the details print under their
 *   nodes, and nothing is lost but the cards.
 *
 *   Linked parts: a node with data-part="x" owns every other element in
 *   its diagram with the same data-part (the shapes of a drawn map). While
 *   the node is active its parts get .is-lit, and hovering or tapping a
 *   part shows the node's card beside that part. Parts are never
 *   focusable: the keyboard reaches them through their node.
 *
 * Loaded by
 *   initDiagrams() in shared-components.js, which adds this script only
 *   when the page has a .kr-diagram, a chart marked data-kr-export or a
 *   table.kr-table--stack, so pages without one never fetch it. Needs
 *   krEscapeHtml and siteRootPrefix from shared-components.js. Save as PNG
 *   loads js/kr-export.js on the first press.
 *
 * Exposes
 *   Nothing. It runs once when it loads.
 *
 * Design notes
 *   Same rules as the ratings dot plot card (initDotplots): Escape or
 *   leaving the node puts the card away; on a touch screen a tap shows
 *   it, and a second tap on the same node or part, or a tap elsewhere,
 *   hides it. The card is a .kr-offstage, so it leaves the
 *   accessibility tree when hidden. It lived in shared-components.js
 *   until the page script budgets (perf_budget.py) showed every page
 *   paying for it, and initDiagramExport and initStackTables followed it
 *   here for the same reason.
 */
(function () {
    'use strict';

    function initDiagrams() {
        var diagrams = document.querySelectorAll('.kr-diagram');
        if (!diagrams.length) return;
        var touch = window.matchMedia ? window.matchMedia('(hover: none)') : { matches: false };
        var seq = 0;

        // The node's own words: its text without the sub line, the detail
        // and the number, wherever they sit in it (a bar's value is inside
        // its fill).
        function nodeTitle(node) {
            var copy = node.cloneNode(true);
            Array.prototype.forEach.call(copy.querySelectorAll('.kr-diagram__sub, .kr-diagram__detail, .kr-diagram__num'), function(el) {
                el.parentNode.removeChild(el);
            });
            return copy.textContent.replace(/\s+/g, ' ').trim();
        }

        Array.prototype.forEach.call(diagrams, function(diagram) {
            if (diagram.classList.contains('is-live')) return;
            var card = document.createElement('div');
            card.className = 'kr-diagram__card kr-offstage';
            card.setAttribute('aria-hidden', 'true');
            diagram.appendChild(card);
            var active = null, tapped = null, hideTimer = null;
            var parts = diagram.querySelectorAll('[data-part]:not(.kr-diagram__node)');

            function light(node) {
                var name = node ? node.getAttribute('data-part') : null;
                Array.prototype.forEach.call(parts, function(el) {
                    el.classList.toggle('is-lit', !!name && el.getAttribute('data-part') === name);
                });
            }
            // anchor: what the card sits beside (the node, or the part that
            // was hovered).
            function show(node, anchor) {
                clearTimeout(hideTimer);
                if (active && active !== node) active.classList.remove('is-active');
                active = node;
                node.classList.add('is-active');
                diagram.classList.add('has-active');
                light(node);
                var detail = node.querySelector('.kr-diagram__detail');
                card.innerHTML = '<p class="kr-diagram__card-title">' + krEscapeHtml(nodeTitle(node)) + '</p>' +
                    '<p>' + krEscapeHtml(detail ? detail.textContent.replace(/\s+/g, ' ').trim() : '') + '</p>';
                card.classList.add('is-visible');
                // Above the node, centred on it and kept inside the diagram;
                // below it when there is no room above. A bar chart's card
                // sits over the bar itself, and may rise above the chart
                // while it stays on screen.
                var bars = diagram.classList.contains('kr-diagram--bars');
                var target = anchor || (bars && node.querySelector('.kr-bars__fill')) || node;
                var box = diagram.getBoundingClientRect(), r = target.getBoundingClientRect();
                var w = card.offsetWidth, h = card.offsetHeight;
                var left = Math.max(0, Math.min(r.left + r.width / 2 - box.left - w / 2, box.width - w));
                var top = r.top - box.top - h - 8;
                if (bars ? r.top - h - 8 < 0 : top < 0) top = r.bottom - box.top + 8;
                card.style.left = left + 'px';
                card.style.top = top + 'px';
            }
            function hide() {
                clearTimeout(hideTimer);
                tapped = null;
                card.classList.remove('is-visible');
                diagram.classList.remove('has-active');
                if (active) active.classList.remove('is-active');
                active = null;
                light(null);
            }
            function scheduleHide() {
                if (tapped) return;
                clearTimeout(hideTimer);
                hideTimer = setTimeout(hide, 150);
            }

            Array.prototype.forEach.call(diagram.querySelectorAll('.kr-diagram__node'), function(node) {
                var detail = node.querySelector('.kr-diagram__detail');
                if (!detail) return;
                if (!detail.id) detail.id = 'kr-diagram-detail-' + (++seq);
                node.setAttribute('aria-describedby', detail.id);
                if (!node.hasAttribute('tabindex')) node.setAttribute('tabindex', '0');
                node.addEventListener('mouseenter', function() { if (!touch.matches) show(node); });
                node.addEventListener('mouseleave', scheduleHide);
                node.addEventListener('focus', function() {
                    var kb = true;
                    try { kb = node.matches(':focus-visible'); } catch (e) {}
                    if (!touch.matches || kb) show(node);
                });
                node.addEventListener('blur', scheduleHide);
                node.addEventListener('click', function() {
                    if (!touch.matches) return;
                    if (tapped === node) { hide(); return; }
                    show(node);
                    tapped = node;
                });
            });
            Array.prototype.forEach.call(parts, function(el) {
                var node = diagram.querySelector('.kr-diagram__node[data-part="' + el.getAttribute('data-part') + '"]');
                if (!node || !node.querySelector('.kr-diagram__detail')) return;
                el.addEventListener('mouseenter', function() { if (!touch.matches) show(node, el); });
                el.addEventListener('mouseleave', scheduleHide);
                el.addEventListener('click', function() {
                    if (!touch.matches) return;
                    if (tapped === el) { hide(); return; }
                    show(node, el);
                    tapped = el;
                });
            });
            document.addEventListener('click', function(e) {
                if (tapped && !tapped.contains(e.target)) hide();
            });
            document.addEventListener('keydown', function(e) {
                if ((e.key === 'Escape' || e.key === 'Esc') && card.classList.contains('is-visible')) hide();
            });
            diagram.classList.add('is-live');
        });
    }

    /**
     * A table marked .kr-table--stack becomes a card per row on a phone
     * (style.css §11, "Stacked on a phone"). The cards need each column's
     * name beside its value, so this copies the last header row's names
     * onto the body cells as data-label (a colspan cell takes the first
     * name it spans; a header's data-short, when it has one, stands in for
     * a long name) and marks the table .kr-table--labelled, which is what
     * the stylesheet waits for: a table this never reached keeps scrolling
     * sideways instead of losing its headings.
     */
    function initStackTables() {
        var tables = document.querySelectorAll('.blog-post table.kr-table--stack');
        Array.prototype.forEach.call(tables, function(table) {
            var head = table.tHead && table.tHead.rows[table.tHead.rows.length - 1];
            if (!head) return;
            var names = [];
            Array.prototype.forEach.call(head.cells, function(th) {
                var name = th.getAttribute('data-short') || th.textContent.trim();
                for (var i = 0; i < (th.colSpan || 1); i++) names.push(name);
            });
            Array.prototype.forEach.call(table.tBodies, function(body) {
                Array.prototype.forEach.call(body.rows, function(row) {
                    var col = 0;
                    Array.prototype.forEach.call(row.cells, function(cell) {
                        if (names[col]) cell.setAttribute('data-label', names[col]);
                        col += cell.colSpan || 1;
                    });
                });
            });
            table.classList.add('kr-table--labelled');
        });
    }

    /* Every diagram gets a button in its corner that saves it as a PNG with
       the page's address under it (js/kr-export.js does the drawing, and
       says how). A diagram is a .kr-diagram, or anything a post marks with
       data-kr-export (a hand-built flow chart); data-kr-export="name" names
       the file. The drawing code loads on the first press. */
    var KR_EXPORT_SELECTOR = '.kr-diagram, [data-kr-export]';
    var KR_EXPORT_VERSION = '20261019a';
    var krExportLoading = null;

    /** Loads js/kr-export.js once; resolves with window.krExport. */
    function krLoadExport() {
        if (window.krExport) return Promise.resolve(window.krExport);
        if (krExportLoading) return krExportLoading;
        krExportLoading = new Promise(function(ok, fail) {
            var sc = document.createElement('script');
            sc.src = siteRootPrefix() + 'js/kr-export.js?v=' + KR_EXPORT_VERSION;
            sc.onload = function() { ok(window.krExport); };
            sc.onerror = function() { krExportLoading = null; fail(new Error('load')); };
            document.head.appendChild(sc);
        });
        return krExportLoading;
    }

    /** The file label for a diagram: its data-kr-export value, else its title or caption. */
    function krExportLabel(host) {
        var named = host.getAttribute('data-kr-export');
        if (named) return named;
        var fig = host.closest('figure');
        var title = host.querySelector('[id$="-title"], .kr-diagram__title, figcaption')
            || (fig && fig.querySelector('figcaption'));
        return title ? title.textContent.split('.')[0] : '';
    }

    function initDiagramExport() {
        var hosts = document.querySelectorAll(KR_EXPORT_SELECTOR);
        if (!hosts.length || !window.HTMLCanvasElement) return;
        var status = document.createElement('div');
        status.className = 'sr-only';
        status.setAttribute('role', 'status');
        document.body.appendChild(status);
        function say(text) {
            status.textContent = '';
            setTimeout(function() { status.textContent = text; }, 50);
        }
        Array.prototype.forEach.call(hosts, function(host) {
            if (host.querySelector(':scope > .kr-export-btn')) return;
            host.classList.add('kr-export-host');
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'kr-export-btn';
            btn.title = 'Save as PNG';
            btn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 4h2v8.17l3.59-3.58L18 10l-6 6-6-6 1.41-1.41L11 12.17V4zM5 18h14v2H5z"/></svg>' + '<span class="sr-only">Save this diagram as a PNG</span>';
            host.appendChild(btn);
            btn.addEventListener('click', function() {
                if (btn.classList.contains('is-busy')) return;
                btn.classList.add('is-busy');
                krLoadExport().then(function(ex) {
                    return ex.png(host, krExportLabel(host));
                }).then(function() {
                    say('Diagram saved as a PNG');
                }, function() {
                    say('This browser could not save the diagram');
                }).then(function() {
                    btn.classList.remove('is-busy');
                });
            });
        });
    }

    if (document.querySelector('.kr-diagram')) initDiagrams();
    initStackTables();
    initDiagramExport();
})();
