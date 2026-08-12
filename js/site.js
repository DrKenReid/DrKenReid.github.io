/**
 * site.js
 *
 * The behaviour every page needs, with no library behind it. This replaces
 * the parts of js/default-assets/active.js that used to depend on jQuery,
 * Bootstrap and the ClassyNav / jarallax / scrollUp plugins bundled in
 * js/alime.bundle.js:
 *
 *   1. Preloader dismissal
 *   2. Primary navigation (a drop-in replacement for the ClassyNav plugin)
 *   3. Sticky header
 *   4. Parallax hero backgrounds (.jarallax)
 *   5. Scroll-to-top control (#scrollUp)
 *   6. href="#" click guard
 *
 * Safe to load on every page: each piece is a no-op when the markup it
 * drives is absent. Nothing here touches style.css, so the class names and
 * DOM shape below deliberately mirror what the stylesheet already expects
 * (breakpoint-on / breakpoint-off, menu-on, has-down, cn-dropdown-item,
 * dd-trigger, #scrollUp).
 *
 * The header markup is injected by shared-components.js, which calls
 * window.krInitNav() as soon as it exists. The DOMContentLoaded fallback
 * below covers any page that builds the header another way; krInitNav() is
 * idempotent, so calling it twice is harmless.
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
    function clickable(el, handler) {
        el.addEventListener('click', handler);
        el.addEventListener('keydown', function (e) {
            if (!isActivationKey(e)) return;
            e.preventDefault();
            handler(e);
        });
    }

    // ------------------------------------------------------------------
    // 1. Preloader
    // ------------------------------------------------------------------
    // Dismissed on DOM ready rather than window 'load', so content is not
    // hidden behind it while images finish downloading. style.css also has
    // a keyframe failsafe at 4s in case this never runs.

    function initPreloader() {
        var el = document.getElementById('preloader');
        if (!el) return;

        function remove() {
            if (el.parentNode) el.parentNode.removeChild(el);
        }

        if (reduceMotion || !canAnimate) {
            remove();
            return;
        }
        el.animate([{ opacity: 1 }, { opacity: 0 }],
            { duration: 400, easing: 'linear', fill: 'forwards' }).onfinish = remove;
        // If the animation never fires (background tab, animation API
        // quirks) the preloader must still not sit on top of the page.
        setTimeout(remove, 1500);
    }

    // ------------------------------------------------------------------
    // 2. Primary navigation
    // ------------------------------------------------------------------
    // Replaces ClassyNav 1.1.0. The stylesheet drives every visual state, so
    // this only has to reproduce the plugin's DOM contract:
    //
    //   .classy-nav-container  gets breakpoint-on (<=991px) / breakpoint-off
    //   .classy-menu           gets menu-on while the off-canvas menu is open
    //   .navbarToggler         gets active while the off-canvas menu is open
    //   li with a submenu      gets has-down (+ cn-dropdown-item / megamenu-item)
    //                          and a trailing <span class="dd-trigger">
    //   li.has-down            gets active while its submenu is open
    //
    // On top of that it adds the keyboard support the plugin never had:
    // the toggler, the close icon and every dd-trigger are reachable by Tab
    // and operated with Enter/Space, Escape closes the off-canvas menu, and
    // on desktop a dropdown opens when focus enters its parent item (the
    // stylesheet only opens them on :hover, which left the submenus
    // unreachable without a mouse).

    var subCounter = 0;

    // Direct child submenu of a nav item, if any.
    function childSubmenu(li) {
        for (var c = li.firstElementChild; c; c = c.nextElementSibling) {
            if (c.tagName === 'UL' || c.classList.contains('megamenu')) return c;
        }
        return null;
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

    function initNav() {
        var nav = document.getElementById('alimeNav');
        if (!nav || nav.getAttribute('data-kr-nav') === '1') return;

        var container = nav.closest ? nav.closest('.classy-nav-container') : null;
        if (!container) container = document.querySelector('.classy-nav-container');
        var menu = nav.querySelector('.classy-menu');
        if (!container || !menu) return;

        nav.setAttribute('data-kr-nav', '1');

        var toggler = nav.querySelector('.classy-navbar-toggler');
        var burger = nav.querySelector('.navbarToggler');
        var closeIcon = nav.querySelector('.classycloseIcon');

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
            trigger.setAttribute('role', 'button');
            trigger.setAttribute('tabindex', '0');
            trigger.setAttribute('aria-expanded', 'false');
            trigger.setAttribute('aria-controls', sub.id);
            trigger.setAttribute('aria-label',
                (link.textContent || 'Submenu').trim() + ' submenu');
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
            if (trigger) trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
            slide(sub, open, DROPDOWN_SPEED);
        }

        function closeAllSubmenus() {
            var open = nav.querySelectorAll('.classynav li.kr-sub-open');
            for (var k = 0; k < open.length; k++) toggleSubmenu(open[k], false);
        }

        function setMenu(open) {
            menu.classList.toggle('menu-on', open);
            if (burger) burger.classList.toggle('active', open);
            if (toggler) {
                toggler.setAttribute('aria-expanded', open ? 'true' : 'false');
                toggler.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
            }
        }

        // --- off-canvas toggle + close icon ---
        if (toggler) {
            toggler.setAttribute('role', 'button');
            toggler.setAttribute('tabindex', '0');
            toggler.setAttribute('aria-controls', menu.id);
            toggler.setAttribute('aria-expanded', 'false');
            toggler.setAttribute('aria-label', 'Open menu');
            clickable(toggler, function () {
                setMenu(!menu.classList.contains('menu-on'));
            });
        }
        if (closeIcon) {
            closeIcon.setAttribute('role', 'button');
            closeIcon.setAttribute('tabindex', '0');
            closeIcon.setAttribute('aria-label', 'Close menu');
            clickable(closeIcon, function () {
                setMenu(false);
                if (toggler) toggler.focus();
            });
        }

        // --- submenu triggers (delegated: renderHeader adds recent-post
        //     items to the Blog dropdown after this runs) ---
        function triggerFrom(target) {
            return target && target.closest ? target.closest('.dd-trigger') : null;
        }
        nav.addEventListener('click', function (e) {
            var trigger = triggerFrom(e.target);
            if (!trigger) return;
            e.preventDefault();
            toggleSubmenu(trigger.parentNode);
        });
        nav.addEventListener('keydown', function (e) {
            if (!isActivationKey(e)) return;
            var trigger = triggerFrom(e.target);
            if (!trigger) return;
            e.preventDefault();
            toggleSubmenu(trigger.parentNode);
        });

        // --- Escape closes the off-canvas menu ---
        document.addEventListener('keydown', function (e) {
            if (e.key !== 'Escape' && e.key !== 'Esc') return;
            if (!menu.classList.contains('menu-on')) return;
            setMenu(false);
            if (toggler) toggler.focus();
        });

        // --- a tap outside the open menu closes it ---
        // On a phone the menu covers part of the page, and the close icon is
        // a small target in the corner; tapping the page is what most people
        // try first. The toggler is excluded because its own handler already
        // toggles, and a tap on it would otherwise close and reopen.
        document.addEventListener('click', function (e) {
            if (!menu.classList.contains('menu-on')) return;
            var t = e.target;
            if (!t || !t.closest) return;
            if (t.closest('.classy-menu') || t.closest('.classy-navbar-toggler')) return;
            setMenu(false);
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
                setMenu(false);
                closeAllSubmenus();
            } else {
                hideFocusDropdown();
            }
        }

        applyBreakpoint();
        window.addEventListener('resize', throttled(applyBreakpoint));
    }

    window.krInitNav = initNav;

    // ------------------------------------------------------------------
    // 3. Sticky header
    // ------------------------------------------------------------------
    // The header is injected after this file runs, so the element is looked
    // up lazily and re-looked-up if it is ever replaced.

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
    // 4. Parallax hero backgrounds
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
    // 5. Scroll-to-top
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
    // 6. href="#" click guard
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
        initPreloader();
        initNav();
        initParallax();
        initScrollUp();
    });
}());
