/**
 * bluesky-replies.js: the replies to my Bluesky post about a blog post,
 * shown with the post's comments.
 *
 * Purpose
 *   The comments under a post are giscus, which needs a GitHub account.
 *   This is the second door: every post is shared on Bluesky, and a reply
 *   to that Bluesky post shows up here, above the giscus frame. It draws
 *   one line of invitation with a "Reply on Bluesky" link, then the
 *   replies as a threaded list: who, when, the words, the likes. Replies
 *   to replies are nested LEVELS deep, with a link on to Bluesky past
 *   that. It shows words only: no avatars, pictures, videos or link
 *   cards, each of which would be another request to someone else's
 *   server, so a reply that has one says so and links to itself.
 *   A post with no replies shows only the invitation, and so does a
 *   request that fails.
 *
 *   Left on Bluesky, never drawn here: a reply the API marks blocked or
 *   not found, one that carries any moderation label (on the reply or on
 *   its author, their own "signed-in readers only" setting included), and
 *   one I have hidden from the thread (the threadgate's hiddenReplies).
 *
 * Loaded by
 *   renderPostEnd() in shared-components.js, and only when two things
 *   are true: data/bluesky.json (written by
 *   .github/scripts/refresh_bluesky.py) has an entry for this post, and
 *   the comments have come near the window, about as far ahead as a
 *   browser starts giscus's lazy frame. It leaves an empty
 *   .kr-bsky-replies carrying data-bsky-uri and data-bsky-url in the
 *   comments section, then adds this script, which fills every such slot
 *   it finds. Nothing from shared-components.js is needed.
 *
 * Exposes
 *   window.krBlueskyReplies
 *     .mount(slot, {uri, url})   build the slot and fetch its thread once;
 *                                returns a promise of the replies drawn
 *     .render(slot, data, url)   draw an app.bsky.feed.getPostThread
 *                                answer into a mounted slot; returns the
 *                                number of replies drawn
 *     .read(data)                the answer as {replies, more, total}, pure
 *
 * Design notes
 *   One request per page view: app.bsky.feed.getPostThread on Bluesky's
 *   public AppView, no key, no cookies, no referrer. The Refresh button
 *   in the comments heading, which remounts giscus, asks again.
 *
 *   Everything in the answer is someone else's text. Nothing from it is
 *   parsed as markup: every string goes in through textContent, links to
 *   a reply are built from the parts of its at:// URI after they match
 *   POST_URI, and a link inside a reply (a link facet) is kept only when
 *   its address parses as http or https. Where a link's words do not
 *   start with the host it leads to, the host is printed after it, so
 *   "mybank.example" cannot lead somewhere else unannounced. read() and
 *   render() take any value at all and never throw: a field of the wrong
 *   type drops that reply, or that link, and the rest is drawn.
 *
 *   Facets index the text in UTF-8 bytes, hence the TextEncoder; without
 *   one the text is drawn with no links.
 *
 *   The count line is the slot's one live region (role="status"). It is
 *   set when the replies arrive and again only if a refresh changes it.
 *
 *   Styles: style.css, section 10, "Replies from Bluesky".
 */
(function () {
    'use strict';

    var API = 'https://public.api.bsky.app/xrpc/app.bsky.feed.getPostThread';
    var LEVELS = 2;             // replies, and replies to them
    var MAX_PER_LEVEL = 20;     // per list; the rest stay on Bluesky
    var MAX_TEXT = 3000;        // a post is 300 graphemes; this is a guard
    var MAX_FACETS = 40;

    var POST_URI = /^at:\/\/(did:[a-z]+:[A-Za-z0-9._:%-]+)\/app\.bsky\.feed\.post\/([A-Za-z0-9._~:-]+)$/;
    var POST_URL = /^https:\/\/bsky\.app\/profile\/[A-Za-z0-9._:%-]+\/post\/[A-Za-z0-9._~:-]+$/;
    var HANDLE = /^[A-Za-z0-9.-]{1,253}$/;
    var LANG = /^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/;
    var THREAD_VIEW = 'app.bsky.feed.defs#threadViewPost';
    var LINK_FACET = 'app.bsky.richtext.facet#link';
    // Control and formatting characters that hide or reorder text: taken
    // out of a display name, and out of a link's words before they are
    // compared with its host.
    var INVISIBLE = /[\u0000-\u001f\u007f-\u009f­​-‏‪-‮⁠-⁩﻿]/g;
    var DATE = { day: 'numeric', month: 'long', year: 'numeric' };

    var encoder = window.TextEncoder ? new window.TextEncoder() : null;
    var decoder = window.TextDecoder ? new window.TextDecoder() : null;

    function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
    function list(v) { return Array.isArray(v) ? v : []; }
    function str(v) { return typeof v === 'string' ? v : ''; }
    function whole(v) { return typeof v === 'number' && isFinite(v) && Math.floor(v) === v; }
    function count(v) { return whole(v) && v > 0 ? v : 0; }

    /** The bsky.app page of a post, from its at:// URI; '' when it is not one. */
    function permalink(uri) {
        var m = POST_URI.exec(str(uri));
        return m ? 'https://bsky.app/profile/' + m[1] + '/post/' + m[2] : '';
    }

    /** `uri` as an address a link may carry: http or https, no user:password. Else ''. */
    function httpHref(uri) {
        try {
            var u = new URL(str(uri));
            if (u.protocol !== 'http:' && u.protocol !== 'https:') return '';
            return u.username || u.password ? '' : u.href;
        } catch (e) {
            return '';
        }
    }

    function hostOf(href) {
        try { return new URL(href).hostname.replace(/^www\./, ''); } catch (e) { return ''; }
    }

    /** True when a link's own words begin with the host it leads to. */
    function namesHost(label, host) {
        var shown = label.replace(INVISIBLE, '').trim().toLowerCase()
            .replace(/^https?:\/\//, '').replace(/^www\./, '');
        if (shown.indexOf(host) !== 0) return false;
        var next = shown.charAt(host.length);
        return next === '' || '/:?#'.indexOf(next) !== -1;
    }

    /** The earlier of the two stamps that parse (a post can claim any time for itself). */
    function dateOf(created, indexed) {
        var c = new Date(str(created)), i = new Date(str(indexed));
        if (isNaN(c.getTime())) return isNaN(i.getTime()) ? null : i;
        return !isNaN(i.getTime()) && c > i ? i : c;
    }

    /** Any label on the reply or its author, unless it is a negation. */
    function labelled(post) {
        function live(label) { return !(isObj(label) && label.neg); }
        return list(post.labels).some(live) ||
            (isObj(post.author) && list(post.author.labels).some(live));
    }

    /** The replies the thread's author has hidden, as a set of at:// URIs. */
    function hiddenReplies(root) {
        var hidden = Object.create(null);
        var gate = isObj(root.post) && isObj(root.post.threadgate) ? root.post.threadgate.record : null;
        list(isObj(gate) ? gate.hiddenReplies : null).forEach(function(uri) {
            if (typeof uri === 'string') hidden[uri] = true;
        });
        return hidden;
    }

    /**
     * One reply as plain data, or null when it is not to be shown (see
     * the header). `level` is 1 for a reply to my post.
     */
    function replyOf(node, hidden, level) {
        if (!isObj(node) || node.$type !== THREAD_VIEW || !isObj(node.post)) return null;
        var post = node.post, record = post.record, author = post.author;
        var href = permalink(post.uri);
        if (!href || !isObj(record) || !isObj(author) || hidden[post.uri] || labelled(post)) return null;

        var text = str(record.text).slice(0, MAX_TEXT).replace(/\s+$/, '');
        var attached = isObj(record.embed);
        if (!text && !attached) return null;

        var handle = HANDLE.test(str(author.handle)) && author.handle !== 'handle.invalid' ? author.handle : '';
        var name = str(author.displayName).replace(INVISIBLE, '').replace(/\s+/g, ' ').trim().slice(0, 80);
        var lang = str(list(record.langs)[0]);
        var below = level < LEVELS ? repliesOf(node, hidden, level + 1) : { replies: [], more: count(post.replyCount) > 0 };
        return {
            href: href,
            name: name || (handle ? '@' + handle : 'Someone on Bluesky'),
            handle: name ? handle : '',
            when: dateOf(record.createdAt, post.indexedAt),
            text: text,
            facets: list(record.facets),
            lang: LANG.test(lang) ? lang : '',
            attached: attached,
            likes: count(post.likeCount),
            replies: below.replies,
            more: below.more
        };
    }

    /** The replies under `node`, oldest first, MAX_PER_LEVEL at most. */
    function repliesOf(node, hidden, level) {
        var replies = [];
        list(node.replies).forEach(function(child) {
            var reply = replyOf(child, hidden, level);
            if (reply) replies.push(reply);
        });
        replies.sort(function(a, b) {
            var ta = a.when ? a.when.getTime() : Infinity, tb = b.when ? b.when.getTime() : Infinity;
            return ta === tb ? 0 : ta < tb ? -1 : 1;
        });
        return { replies: replies.slice(0, MAX_PER_LEVEL), more: replies.length > MAX_PER_LEVEL };
    }

    function total(replies) {
        return replies.reduce(function(n, reply) { return n + 1 + total(reply.replies); }, 0);
    }

    /**
     * An app.bsky.feed.getPostThread answer as {replies, more, total}:
     * the replies to show, whether Bluesky has more at the top level, and
     * how many are shown at every level together. Any other value reads
     * as no replies.
     */
    function read(data) {
        var root = isObj(data) ? data.thread : null;
        if (!isObj(root) || root.$type !== THREAD_VIEW) return { replies: [], more: false, total: 0 };
        var top = repliesOf(root, hiddenReplies(root), 1);
        return { replies: top.replies, more: top.more, total: total(top.replies) };
    }

    /* ---- drawing ---- */

    function el(tag, cls, text) {
        var node = document.createElement(tag);
        if (cls) node.className = cls;
        if (text) node.textContent = text;
        return node;
    }

    function outLink(href, cls, text, rel) {
        var a = el('a', cls, text);
        a.href = href;
        a.target = '_blank';
        a.rel = rel || 'noopener noreferrer';
        return a;
    }

    /** A run of blank lines is one blank line. */
    function tidy(s) { return s.replace(/\n{3,}/g, '\n\n'); }

    /** The link facets that fit a text of `size` bytes, in order, none overlapping. */
    function linkSpans(facets, size) {
        var spans = [];
        list(facets).slice(0, MAX_FACETS).forEach(function(facet) {
            var index = isObj(facet) ? facet.index : null;
            if (!isObj(index)) return;
            var start = index.byteStart, end = index.byteEnd;
            if (!whole(start) || !whole(end) || start < 0 || end <= start || end > size) return;
            var href = '';
            list(facet.features).some(function(feature) {
                href = isObj(feature) && feature.$type === LINK_FACET ? httpHref(feature.uri) : '';
                return !!href;
            });
            if (href) spans.push({ start: start, end: end, href: href });
        });
        spans.sort(function(a, b) { return a.start - b.start; });
        var at = 0;
        return spans.filter(function(span) {
            if (span.start < at) return false;
            at = span.end;
            return true;
        });
    }

    /** A reply's words into `box`: text nodes, and an <a> over each link facet. */
    function fillText(box, text, facets) {
        var bytes = encoder && decoder ? encoder.encode(text) : null;
        var spans = bytes ? linkSpans(facets, bytes.length) : [];
        if (!spans.length) {
            box.textContent = tidy(text);
            return;
        }
        var at = 0;
        function plain(to) {
            if (to > at) box.appendChild(document.createTextNode(tidy(decoder.decode(bytes.subarray(at, to)))));
        }
        spans.forEach(function(span) {
            plain(span.start);
            var label = decoder.decode(bytes.subarray(span.start, span.end));
            box.appendChild(outLink(span.href, '', label, 'noopener noreferrer nofollow ugc'));
            var host = hostOf(span.href);
            if (host && !namesHost(label, host)) box.appendChild(document.createTextNode(' (' + host + ')'));
            at = span.end;
        });
        plain(bytes.length);
    }

    function replyEl(reply) {
        var item = el('div', 'kr-bsky-reply');
        item.setAttribute('role', 'listitem');

        var head = el('div', 'kr-bsky-reply__head');
        var author = outLink(reply.href, 'kr-bsky-reply__author');
        author.appendChild(el('bdi', 'kr-bsky-reply__name', reply.name));
        if (reply.handle) {
            author.appendChild(document.createTextNode(' '));
            author.appendChild(el('span', 'kr-bsky-reply__handle', '@' + reply.handle));
        }
        author.appendChild(el('span', 'kr-sr-only', ', the reply on Bluesky'));
        head.appendChild(author);
        if (reply.when) {
            var time = el('time', 'kr-bsky-reply__date', reply.when.toLocaleDateString('en-GB', DATE));
            time.setAttribute('datetime', reply.when.toISOString());
            head.appendChild(time);
        }
        item.appendChild(head);

        if (reply.text) {
            var text = el('div', 'kr-bsky-reply__text');
            text.setAttribute('dir', 'auto');
            if (reply.lang) text.setAttribute('lang', reply.lang);
            fillText(text, reply.text, reply.facets);
            item.appendChild(text);
        }

        if (reply.likes || reply.attached) {
            var meta = el('div', 'kr-bsky-reply__meta');
            if (reply.likes) meta.appendChild(el('span', '', reply.likes === 1 ? '1 like' : reply.likes + ' likes'));
            if (reply.attached) meta.appendChild(outLink(reply.href, 'kr-bsky-more', 'See what is attached on Bluesky'));
            item.appendChild(meta);
        }

        if (reply.replies.length) item.appendChild(threadEl(reply.replies, true));
        if (reply.more) item.appendChild(moreEl(reply.href, 'Continue this thread on Bluesky'));
        return item;
    }

    function threadEl(replies, nested) {
        var box = el('div', nested ? 'kr-bsky-thread kr-bsky-thread--nested' : 'kr-bsky-thread');
        box.setAttribute('role', 'list');
        if (!nested) box.setAttribute('aria-label', 'Replies from Bluesky');
        replies.forEach(function(reply) { box.appendChild(replyEl(reply)); });
        return box;
    }

    function moreEl(href, words) {
        var line = el('div', 'kr-bsky-reply__meta');
        line.appendChild(outLink(href, 'kr-bsky-more', words));
        return line;
    }

    /**
     * Draws a getPostThread answer into a mounted slot, in place of what
     * it showed before. `url` is my post's page on bsky.app, for the
     * "More replies" link when the list was cut short. Returns the number
     * of replies drawn; an answer of the wrong shape draws none.
     */
    function render(slot, data, url) {
        var status = slot && slot.querySelector ? slot.querySelector('.kr-bsky-count') : null;
        var host = status ? slot.querySelector('.kr-bsky-list') : null;
        if (!host) return 0;
        var thread;
        try {
            thread = read(data);
        } catch (e) {
            thread = { replies: [], more: false, total: 0 };
        }
        var words = !thread.total ? '' : thread.total === 1 ? '1 reply from Bluesky' : thread.total + ' replies from Bluesky';
        // Set only on a change: the line is a live region, and a refresh
        // that finds the same replies should say nothing.
        if (status.textContent !== words) status.textContent = words;
        host.textContent = '';
        if (thread.total) {
            host.appendChild(threadEl(thread.replies, false));
            if (thread.more && POST_URL.test(str(url))) host.appendChild(moreEl(url, 'More replies on Bluesky'));
        }
        return thread.total;
    }

    /**
     * Builds a slot (the invitation, the count line, the list) and asks
     * Bluesky for the thread once. `entry` is the post's record in
     * data/bluesky.json; one that is not a Bluesky post leaves the slot
     * empty, and an empty slot is not displayed.
     */
    function mount(slot, entry) {
        var uri = isObj(entry) ? str(entry.uri) : '', url = isObj(entry) ? str(entry.url) : '';
        if (!slot || slot.firstChild || !POST_URI.test(uri) || !POST_URL.test(url)) return Promise.resolve(0);

        var invite = el('div', 'kr-bsky-invite');
        invite.appendChild(el('span', 'kr-bsky-invite__text',
            'Two ways to respond: reply to my Bluesky post about this one and it shows up here, ' +
            'or comment with a GitHub account below.'));
        invite.appendChild(outLink(url, 'kr-btn kr-btn--ghost kr-btn--sm', 'Reply on Bluesky'));
        slot.appendChild(invite);

        var status = el('div', 'kr-label kr-bsky-count');
        status.setAttribute('role', 'status');
        slot.appendChild(status);
        slot.appendChild(el('div', 'kr-bsky-list'));

        function load(again) {
            if (!window.fetch) return Promise.resolve(0);
            return fetch(API + '?uri=' + encodeURIComponent(uri) + '&depth=' + LEVELS + '&parentHeight=0', {
                credentials: 'omit',
                referrerPolicy: 'no-referrer',
                cache: again ? 'reload' : 'default'
            }).then(function(response) {
                if (!response.ok) throw new Error('HTTP ' + response.status);
                return response.json();
            }).then(function(data) {
                return render(slot, data, url);
            }).catch(function() {
                // No error line: the invitation and its link stay, and
                // whatever was drawn before a failed refresh stays too.
                return 0;
            });
        }

        // The comments' own Refresh button remounts giscus; a reader who
        // presses it wants the newest replies from both doors.
        var section = slot.closest ? slot.closest('.giscus-comments') : null;
        var refresh = section ? section.querySelector('.kr-comments-refresh') : null;
        if (refresh) refresh.addEventListener('click', function() { load(true); });

        return load(false);
    }

    window.krBlueskyReplies = { mount: mount, render: render, read: read };

    Array.prototype.forEach.call(document.querySelectorAll('.kr-bsky-replies[data-bsky-uri]'), function(slot) {
        mount(slot, { uri: slot.getAttribute('data-bsky-uri'), url: slot.getAttribute('data-bsky-url') });
    });
})();
