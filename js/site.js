/**
 * site.js
 *
 * The behaviour every page needs, with no library behind it. This replaces
 * the parts of js/default-assets/active.js that used to depend on jQuery,
 * Bootstrap and the ClassyNav / jarallax / scrollUp plugins bundled in
 * js/alime.bundle.js:
 *
 *   1. Primary navigation (a drop-in replacement for the ClassyNav plugin)
 *   2. Sticky header
 *   3. Parallax hero backgrounds (.jarallax)
 *   4. Scroll-to-top control (#scrollUp)
 *   5. href="#" click guard
 *
 * Safe to load on every page: each piece is a no-op when the markup it
 * drives is absent. The class names below mirror what the stylesheet
 * expects (breakpoint-on / breakpoint-off, menu-on, has-down,
 * cn-dropdown-item, dd-trigger, #scrollUp), plus two this file adds for
 * the header's states: .sticky and .kr-menu-open on .main-header-area.
 *
 * The header markup is injected by shared-components.js, which calls
 * window.krInitNav() as soon as it exists. The DOMContentLoaded fallback
 * below covers any page that builds the header another way; krInitNav() is
 * idempotent, so calling it twice is harmless.
 *
 * The page preloader that used to be section 1 is gone: it hid a page that
 * was already readable behind a spinner. No rule styles its markup any
 * more, so a copy left in an older draft is an empty div, and
 * generate_post_head.py strips it at publish.
 */
(function () {
    'use strict';

    // Kept in step with the plugin defaults the site used to run on, so
    // nothing shifts visually: ClassyNav's breakpoint (991) and dropdown
    // speed (500ms), scrollUp's trigger distance (300px), and the jarallax
    // speed active.js passed in (0.5).
    var NAV_BREAKPOINT = 991;
    var DROPDOWN_SPEED = 500;
    var SCROLLUP_AT = 300;
    var PARALLAX_SPEED = 0.5;

    var reduceMotion = !!(window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    var canAnimate = typeof Element !== 'undefined' &&
        typeof Element.prototype.animate === 'function';

    function ready(fn) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', fn);
        } else {
            fn();
        }
    }

    // One rAF-coalesced callback per scroll/resize storm.
    function throttled(fn) {
        var queued = false;
        return function () {
            if (queued) return;
            queued = true;
            window.requestAnimationFrame(function () {
                queued = false;
                fn();
            });
        };
    }

    function isActivationKey(e) {
        return e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar';
    }

    // Make a non-button element behave like one for mouse and keyboard.
    // A real <button> needs only the click listener: it already turns
    // Enter and Space into a click, and a keydown handler as well would
    // run the action twice.
    function clickable(el, handler) {
        el.addEventListener('click', handler);
        if (el.tagName === 'BUTTON') return;
        el.setAttribute('role', 'button');
        el.setAttribute('tabindex', '0');
        el.addEventListener('keydown', function (e) {
            if (!isActivationKey(e)) return;
            e.preventDefault();
            handler(e);
        });
    }

    // ------------------------------------------------------------------
    // 1. Primary navigation
    // ------------------------------------------------------------------
    // Replaces ClassyNav 1.1.0. The stylesheet drives every visual state, so
    // this reproduces the plugin's DOM contract:
    //
    //   .classy-nav-container  gets breakpoint-on (<=991px) / breakpoint-off
    //   .classy-menu           gets menu-on while the off-canvas menu is open
    //   .navbarToggler         gets active while the off-canvas menu is open
    //   .main-header-area      gets kr-menu-open at the same time (the bar
    //                          turns solid behind the open menu)
    //   li with a submenu      gets has-down (+ cn-dropdown-item / megamenu-item)
    //                          and a trailing <span class="dd-trigger">
    //   li.has-down            gets active and kr-sub-open while its submenu
    //                          is open
    //
    // KEYBOARD
    //   The menu button (.classy-navbar-toggler, a <button>) and every
    //   dd-trigger work with Enter and Space. On a desktop a dropdown opens
    //   when focus enters its parent item: the stylesheet only opens them on
    //   :hover, and visibility:hidden keeps their links out of the Tab order.
    //
    // THE PHONE MENU'S FOCUS CONTRACT (breakpoint-on, 991px and under)
    //   Closed: the panel is visibility:hidden (style.css, "Header and
    //     chrome"), so none of its links is a Tab stop; the bar's own
    //     controls (wordmark, theme toggle, menu button) are all that Tab
    //     reaches before the page.
    //   Opening: focus moves to the first link in the menu, and everything
    //     outside the header (the skip link, <main>, the footer, anything
    //     else under <body>) is made inert, so Tab cycles through the
    //     header alone and a screen reader cannot wander into the page
    //     under the menu. Elements that were already inert are left as
    //     they were and stay inert afterwards.
    //   Closing: the menu button again, Escape, a tap outside the menu,
    //     crossing to the desktop layout, or the palette opening from the
    //     menu's Search item. Every one of them lifts the inert and returns
    //     focus to the menu button, except crossing to desktop (the button
    //     is hidden there) and a page restored from the back/forward cache
    //     with the menu still open (nothing had focus to return).
    //   Submenus: at this width the whole Hobbies row opens its submenu
    //     (its link goes nowhere, href="#") and carries aria-expanded; its
    //     dd-trigger is only the chevron. Blog's link goes to the blog, so
    //     its dd-trigger stays the separate, focusable toggle.
    //
    // window.krNavMenu = { open(), close(opts), isOpen() } for other chrome
    // (the command palette) that must take over from the menu.

    var subCounter = 0;

    // Direct child submenu of a nav item, if any.
    function childSubmenu(li) {
        for (var c = li.firstElementChild; c; c = c.nextElementSibling) {
            if (c.tagName === 'UL' || c.classList.contains('megamenu')) return c;
        }
        return null;
    }

    // A nav item's own link, if it is a placeholder (href="#") that exists
    // only to open its submenu.
    function placeholderLink(li) {
        var a = li.firstElementChild;
        return a && a.tagName === 'A' && a.getAttribute('href') === '#' ? a : null;
    }

    // Height animation standing in for jQuery's slideToggle().
    function slide(el, open, speed) {
        var start = el.getBoundingClientRect().height;
        if (el.krAnim) {
            el.krAnim.cancel();
            el.krAnim = null;
        }
        if (reduceMotion || !canAnimate) {
            el.style.display = open ? 'block' : '';
            return;
        }
        if (open) el.style.display = 'block';
        var end = open ? el.scrollHeight : 0;
        el.style.overflow = 'hidden';
        var anim = el.animate(
            [{ height: start + 'px' }, { height: end + 'px' }],
            { duration: speed, easing: 'ease' }
        );
        el.krAnim = anim;
        anim.onfinish = function () {
            el.krAnim = null;
            el.style.overflow = '';
            if (!open) el.style.display = '';
        };
        anim.oncancel = function () {
            el.style.overflow = '';
        };
    }

    // Makes every element outside `keep` inert: its siblings, its
    // parent's siblings and so on up to <body>. Returns a function that
    // undoes exactly that, leaving anything that was already inert alone.
    function inertAround(keep) {
        var changed = [];
        for (var node = keep; node && node.parentElement && node !== document.body;
            node = node.parentElement) {
            var sibling = node.parentElement.firstElementChild;
            for (; sibling; sibling = sibling.nextElementSibling) {
                if (sibling === node || sibling.hasAttribute('inert') ||
                    /^(SCRIPT|STYLE|LINK|TEMPLATE|NOSCRIPT)$/.test(sibling.tagName)) continue;
                sibling.setAttribute('inert', '');
                changed.push(sibling);
            }
        }
        return function () {
            for (var i = 0; i < changed.length; i++) changed[i].removeAttribute('inert');
            changed = [];
        };
    }

    function initNav() {
        var nav = document.getElementById('alimeNav');
        if (!nav || nav.getAttribute('data-kr-nav') === '1') return;

        var container = nav.closest ? nav.closest('.classy-nav-container') : null;
        if (!container) container = document.querySelector('.classy-nav-container');
        var menu = nav.querySelector('.classy-menu');
        if (!container || !menu) return;

        nav.setAttribute('data-kr-nav', '1');

        var header = nav.closest('.header-area') || nav;
        var bar = nav.closest('.main-header-area');
        var toggler = nav.querySelector('.classy-navbar-toggler');
        var burger = nav.querySelector('.navbarToggler');
        var releaseInert = null;

        if (!menu.id) menu.id = 'kr-primary-menu';

        // --- mark the items that own a submenu ---
        var topItems = nav.querySelectorAll('.classynav > ul > li');
        var i;
        for (i = 0; i < topItems.length; i++) {
            if (topItems[i].querySelector('.dropdown')) {
                topItems[i].classList.add('cn-dropdown-item');
            }
            if (topItems[i].querySelector('.megamenu')) {
                topItems[i].classList.add('megamenu-item');
            }
        }

        var links = nav.querySelectorAll('.classynav ul li a');
        for (i = 0; i < links.length; i++) {
            var link = links[i];
            var sub = link.nextElementSibling;
            var li = link.parentNode;
            if (!sub || !li || li.tagName !== 'LI') continue;
            if (li.querySelector('.dd-trigger')) continue;

            li.classList.add('has-down');
            if (!sub.id) sub.id = 'kr-submenu-' + (++subCounter);

            var trigger = document.createElement('span');
            trigger.className = 'dd-trigger';
            if (placeholderLink(li)) {
                // The row itself is the control (see the focus contract);
                // a second Tab stop saying the same thing would be noise.
                trigger.setAttribute('aria-hidden', 'true');
            } else {
                trigger.setAttribute('role', 'button');
                trigger.setAttribute('tabindex', '0');
                trigger.setAttribute('aria-expanded', 'false');
                trigger.setAttribute('aria-controls', sub.id);
                trigger.setAttribute('aria-label',
                    (link.textContent || 'Submenu').trim() + ' submenu');
            }
            li.appendChild(trigger);
        }

        // Megamenus get their own arrow from the stylesheet (ClassyNav did
        // the same), so they must not carry has-down as well.
        var megas = nav.querySelectorAll('.megamenu-item');
        for (i = 0; i < megas.length; i++) megas[i].classList.remove('has-down');

        // "active" does double duty: it marks the current page on desktop and
        // the open submenu on mobile. Remember which items were active on
        // arrival so the page marker survives opening and closing a submenu.
        var owners = nav.querySelectorAll('.classynav li.has-down');
        for (i = 0; i < owners.length; i++) {
            owners[i].setAttribute('data-kr-page-active',
                owners[i].classList.contains('active') ? '1' : '0');
        }

        function isDesktop() {
            return container.classList.contains('breakpoint-off');
        }

        function isOpen() {
            return menu.classList.contains('menu-on');
        }

        function toggleSubmenu(li, force) {
            var sub = childSubmenu(li);
            if (!sub) return;
            var open = typeof force === 'boolean'
                ? force
                : !li.classList.contains('kr-sub-open');

            li.classList.toggle('kr-sub-open', open);
            li.classList.toggle('active',
                open || li.getAttribute('data-kr-page-active') === '1');

            var trigger = li.querySelector('.dd-trigger');
            if (trigger && trigger.hasAttribute('aria-expanded')) {
                trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
            }
            var row = placeholderLink(li);
            if (row && row.hasAttribute('aria-expanded')) {
                row.setAttribute('aria-expanded', open ? 'true' : 'false');
            }
            slide(sub, open, DROPDOWN_SPEED);
        }

        function closeAllSubmenus() {
            var open = nav.querySelectorAll('.classynav li.kr-sub-open');
            for (var k = 0; k < open.length; k++) toggleSubmenu(open[k], false);
        }

        // Placeholder rows are buttons at phone width and plain (inert)
        // links on a desktop, where hover and focus open their dropdowns.
        function applyRowRoles(desktop) {
            var owners = nav.querySelectorAll('.classynav li.has-down');
            for (var k = 0; k < owners.length; k++) {
                var row = placeholderLink(owners[k]);
                var sub = childSubmenu(owners[k]);
                if (!row || !sub) continue;
                if (desktop) {
                    row.removeAttribute('role');
                    row.removeAttribute('aria-expanded');
                    row.removeAttribute('aria-controls');
                } else {
                    row.setAttribute('role', 'button');
                    row.setAttribute('aria-controls', sub.id);
                    row.setAttribute('aria-expanded',
                        owners[k].classList.contains('kr-sub-open') ? 'true' : 'false');
                }
            }
        }

        /**
         * Opens or closes the phone menu. opts.returnFocus (default true)
         * sends focus back to the menu button on close; see the contract
         * above for the two paths that pass false.
         */
        function setMenu(open, opts) {
            if (open === isOpen()) return;
            menu.classList.toggle('menu-on', open);
            if (bar) bar.classList.toggle('kr-menu-open', open);
            if (burger) burger.classList.toggle('active', open);
            if (toggler) {
                toggler.setAttribute('aria-expanded', open ? 'true' : 'false');
                toggler.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
            }
            if (open) {
                releaseInert = inertAround(header);
                // The panel is visible from this frame on (its visibility
                // has no delay on the way in), so the link can take focus
                // now; preventScroll because the panel is still sliding in.
                // The header's CSS keeps visibility out of the links'
                // transitions, but a link that ever transitions it again
                // (a `transition: all` anywhere up the cascade) refuses
                // focus for that one frame, so it is asked again on the
                // next rather than the menu opening with nothing focused.
                var first = menu.querySelector('.classynav a[href]');
                if (first) {
                    first.focus({ preventScroll: true });
                    if (document.activeElement !== first) {
                        window.requestAnimationFrame(function () {
                            if (isOpen()) first.focus({ preventScroll: true });
                        });
                    }
                }
                return;
            }
            if (releaseInert) releaseInert();
            releaseInert = null;
            var returnFocus = !opts || opts.returnFocus !== false;
            if (returnFocus && toggler && !isDesktop()) toggler.focus({ preventScroll: true });
        }

        // --- the menu button ---
        if (toggler) {
            toggler.setAttribute('aria-controls', menu.id);
            toggler.setAttribute('aria-expanded', 'false');
            toggler.setAttribute('aria-label', 'Open menu');
            clickable(toggler, function () {
                setMenu(!isOpen());
            });
        }

        // --- submenu triggers and placeholder rows (delegated: renderHeader
        //     adds recent-post items to the Blog dropdown after this runs) ---
        function triggerFrom(target) {
            return target && target.closest ? target.closest('.dd-trigger') : null;
        }
        function rowFrom(target) {
            if (isDesktop() || !target || !target.closest) return null;
            var a = target.closest('.classynav li.has-down > a[href="#"]');
            return a && childSubmenu(a.parentNode) ? a : null;
        }
        nav.addEventListener('click', function (e) {
            var trigger = triggerFrom(e.target);
            var row = trigger ? null : rowFrom(e.target);
            if (!trigger && !row) return;
            e.preventDefault();
            toggleSubmenu((trigger || row).parentNode);
        });
        nav.addEventListener('keydown', function (e) {
            if (!isActivationKey(e)) return;
            var trigger = triggerFrom(e.target);
            if (trigger) {
                e.preventDefault();
                toggleSubmenu(trigger.parentNode);
                return;
            }
            // Enter on a link already fires the click above; a role=button
            // row also has to answer Space, which a link ignores.
            if (e.key !== 'Enter' && rowFrom(e.target)) {
                e.preventDefault();
                toggleSubmenu(e.target.parentNode);
            }
        });

        // --- Escape closes the off-canvas menu ---
        document.addEventListener('keydown', function (e) {
            if (e.key !== 'Escape' && e.key !== 'Esc') return;
            if (!isOpen()) return;
            setMenu(false);
        });

        // --- a tap outside the open menu closes it ---
        // The dimmed page beside the panel is what most people tap first.
        // The menu button toggles by itself, and the theme toggle is a
        // header control the reader may want while the menu is open, so a
        // tap on either is not "outside".
        document.addEventListener('click', function (e) {
            if (!isOpen()) return;
            var t = e.target;
            if (!t || !t.closest) return;
            if (t.closest('.classy-menu, .classy-navbar-toggler, #theme-toggle')) return;
            setMenu(false);
        });

        // --- a page restored from the back/forward cache ---
        // Tapping a menu link leaves the menu open as the page unloads;
        // coming Back would otherwise restore it open over an inert page.
        window.addEventListener('pageshow', function (e) {
            if (e.persisted && isOpen()) setMenu(false, { returnFocus: false });
        });

        // --- desktop: open a dropdown when focus enters its parent item ---
        // The stylesheet only reveals dropdowns on :hover, and
        // visibility:hidden keeps their links out of the tab order, so
        // without this a keyboard user can never reach them.
        var focusOpened = null;

        function hideFocusDropdown() {
            if (!focusOpened) return;
            focusOpened.style.removeProperty('opacity');
            focusOpened.style.removeProperty('visibility');
            focusOpened.style.removeProperty('top');
            focusOpened = null;
        }

        function showFocusDropdown(sub) {
            if (focusOpened === sub) return;
            hideFocusDropdown();
            sub.style.setProperty('opacity', '1');
            sub.style.setProperty('visibility', 'visible');
            sub.style.setProperty('top', '100%');
            focusOpened = sub;
        }

        nav.addEventListener('focusin', function (e) {
            if (!isDesktop()) return;
            var item = e.target.closest
                ? e.target.closest('.classynav > ul > li')
                : null;
            if (!item) {
                hideFocusDropdown();
                return;
            }
            var sub = childSubmenu(item);
            if (sub && sub.classList.contains('dropdown')) {
                showFocusDropdown(sub);
            } else {
                hideFocusDropdown();
            }
        });
        nav.addEventListener('focusout', function (e) {
            if (!nav.contains(e.relatedTarget)) hideFocusDropdown();
        });

        // --- breakpoint tracking ---
        var wasDesktop = null;

        function applyBreakpoint() {
            var desktop = window.innerWidth > NAV_BREAKPOINT;
            container.classList.toggle('breakpoint-on', !desktop);
            container.classList.toggle('breakpoint-off', desktop);
            if (wasDesktop === desktop) return;
            wasDesktop = desktop;
            // Crossing the breakpoint drops any mobile-only state, so a
            // submenu opened on a phone-width viewport does not leave the
            // desktop bar showing a stray current-page marker.
            if (desktop) {
                setMenu(false, { returnFocus: false });
                closeAllSubmenus();
            } else {
                hideFocusDropdown();
            }
            applyRowRoles(desktop);
        }

        applyBreakpoint();
        window.addEventListener('resize', throttled(applyBreakpoint));

        window.krNavMenu = {
            open: function () { if (!isDesktop()) setMenu(true); },
            close: function (opts) { setMenu(false, opts); },
            isOpen: isOpen
        };
    }

    window.krInitNav = initNav;

    // ------------------------------------------------------------------
    // 2. Sticky header
    // ------------------------------------------------------------------
    // .sticky on .main-header-area as soon as the page leaves the top: the
    // bar trades its scrim for a frosted surface (style.css, "Header and
    // chrome"). The header is injected after this file runs, so the element
    // is looked up lazily and re-looked-up if it is ever replaced.

    function initSticky() {
        var header = null;

        function apply() {
            if (!header || !header.isConnected) {
                header = document.querySelector('.main-header-area');
            }
            if (!header) return;
            header.classList.toggle('sticky', window.pageYOffset > 0);
        }

        apply();
        window.addEventListener('scroll', throttled(apply), { passive: true });
    }

    // ------------------------------------------------------------------
    // 3. Parallax hero backgrounds
    // ------------------------------------------------------------------
    // Stands in for jarallax 1.10.6 at speed 0.5, which is all the site used
    // it for, and lands the background in the same place the plugin did:
    // a clipped layer behind the section (z-index -100, below the
    // .bg-overlay ::after at -1) whose top edge sits at
    // sectionTop * speed, so the picture drifts at half scroll speed.
    // The layer is taller than the section by the same amount jarallax
    // used, height + (viewport - height) * (1 - speed), which is what gives
    // it room to drift.
    //
    // Unlike the plugin this uses an absolutely positioned layer instead of
    // a position:fixed one, so ordinary overflow:hidden does the clipping
    // and no <style> element full of clip rectangles has to be maintained.
    //
    // The section keeps its own background-image, so the hero still shows
    // the right picture if this never runs.

    function initParallax(root) {
        var items = (root || document).querySelectorAll('.jarallax');
        if (!items.length || reduceMotion) return;

        var layers = [];

        for (var i = 0; i < items.length; i++) {
            var el = items[i];
            if (el.getAttribute('data-kr-parallax') === '1') continue;

            var image = window.getComputedStyle(el).backgroundImage;
            if (!image || image === 'none') continue;
            el.setAttribute('data-kr-parallax', '1');

            var clip = document.createElement('div');
            clip.className = 'kr-parallax-clip';
            clip.setAttribute('aria-hidden', 'true');
            clip.style.cssText = 'position:absolute;top:0;left:0;width:100%;' +
                'height:100%;overflow:hidden;pointer-events:none;z-index:-100;';

            var img = document.createElement('div');
            img.style.cssText = 'position:absolute;top:0;left:0;width:100%;' +
                'background-position:50% 50%;background-size:cover;' +
                'background-repeat:no-repeat;will-change:transform;';
            img.style.backgroundImage = image;

            clip.appendChild(img);
            el.appendChild(clip);
            layers.push({ el: el, img: img });
        }

        if (!layers.length) return;

        function apply() {
            var wndH = window.innerHeight;
            for (var j = 0; j < layers.length; j++) {
                var el = layers[j].el;
                var img = layers[j].img;
                var rect = el.getBoundingClientRect();
                // Off screen: leave the layer where it is, exactly as
                // jarallax did, and skip the layout work.
                if (rect.bottom < 0 || rect.top > wndH) continue;

                var height = rect.height + (wndH - rect.height) * (1 - PARALLAX_SPEED);
                var top = rect.top * PARALLAX_SPEED;
                // Never let the drift expose an edge: the layer has to stay
                // over whatever part of the section is actually on screen.
                top = Math.min(top, Math.max(rect.top, 0));
                top = Math.max(top, Math.min(rect.bottom, wndH) - height);

                img.style.height = height + 'px';
                img.style.transform =
                    'translate3d(0, ' + (top - rect.top) + 'px, 0)';
            }
        }

        apply();
        var onChange = throttled(apply);
        window.addEventListener('scroll', onChange, { passive: true });
        window.addEventListener('resize', onChange);
        window.addEventListener('load', apply);
    }

    // ------------------------------------------------------------------
    // 4. Scroll-to-top
    // ------------------------------------------------------------------
    // Same element the scrollUp plugin built (#scrollUp is already styled in
    // style.css), minus the inline positioning the plugin duplicated and
    // plus the accessible name the icon-only control was missing.

    function initScrollUp() {
        if (document.getElementById('scrollUp')) return;

        var btn = document.createElement('a');
        btn.id = 'scrollUp';
        btn.href = '#top';
        btn.setAttribute('aria-label', 'Scroll to top');
        btn.innerHTML = '<i class="arrow_carrot-up" aria-hidden="true"></i>';
        btn.style.display = 'none';
        document.body.appendChild(btn);

        var shown = false;

        function apply() {
            var want = window.pageYOffset > SCROLLUP_AT;
            if (want === shown) return;
            shown = want;
            if (!canAnimate || reduceMotion) {
                btn.style.display = want ? 'block' : 'none';
                return;
            }
            if (want) {
                btn.style.display = 'block';
                // Animated rather than set inline, so the stylesheet keeps
                // control of opacity (the share modal hides #scrollUp that way).
                btn.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200 });
            } else {
                btn.animate([{ opacity: 1 }, { opacity: 0 }],
                    { duration: 200 }).onfinish = function () {
                        if (!shown) btn.style.display = 'none';
                    };
            }
        }

        btn.addEventListener('click', function (e) {
            e.preventDefault();
            try {
                window.scrollTo({
                    top: 0,
                    behavior: reduceMotion ? 'auto' : 'smooth'
                });
            } catch (err) {
                window.scrollTo(0, 0);
            }
        });

        apply();
        window.addEventListener('scroll', throttled(apply), { passive: true });
    }

    // ------------------------------------------------------------------
    // 5. href="#" click guard
    // ------------------------------------------------------------------
    // Delegated, so it also covers the injected nav's placeholder parents.

    function initHashGuard() {
        document.addEventListener('click', function (e) {
            var a = e.target && e.target.closest ? e.target.closest('a[href="#"]') : null;
            if (a) e.preventDefault();
        });
    }

    // ------------------------------------------------------------------

    initHashGuard();
    initSticky();

    ready(function () {
        initNav();
        initParallax();
        initScrollUp();
    });
}());
