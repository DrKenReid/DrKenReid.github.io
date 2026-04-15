import json
import re
from datetime import datetime
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
POSTS_PATH = ROOT / 'data' / 'posts.json'
BLOG_DIR = ROOT / 'blog'


def estimate_reading_minutes(post):
    text = f"{post.get('title', '')} {post.get('excerpt', '')}".strip()
    word_count = len(text.split()) if text else 0
    return max(1, (word_count + 219) // 220)


def format_post_date(date_str):
    date_value = datetime.strptime(date_str, '%Y-%m-%d')
    return f'{date_value.day} {date_value.strftime("%B %Y")}'


def build_related_posts(posts, current_post):
    current_tags = set(current_post.get('tags', []))
    current_url = current_post.get('url', '')

    ranked = []
    for post in posts:
        if post.get('url') == current_url:
            continue
        shared_tags = len(current_tags.intersection(post.get('tags', [])))
        ranked.append((shared_tags, post.get('date', ''), post))

    ranked.sort(key=lambda item: (item[0], item[1]), reverse=True)

    related = [post for shared, _, post in ranked if shared > 0][:3]
    if len(related) < 3:
        for _, _, post in ranked:
            if post in related:
                continue
            related.append(post)
            if len(related) == 3:
                break
    return related


def build_related_html(related_posts):
    cards = []
    for post in related_posts:
        tags_html = ''.join(
            f'<span class="blog-tag">{tag}</span>' for tag in post.get('tags', [])
        )
        image_src = '../' + post.get('image', 'img/bg-img/2.png')
        href = post.get('url', '').replace('blog/', '')
        card = (
            '            <div class="col-12 col-md-6 col-lg-4 mb-30">\n'
            f'              <a href="{href}" class="blog-card">\n'
            f'                <div class="blog-card-img"><img src="{image_src}" alt="{post.get("title", "")}" loading="lazy"></div>\n'
            '                <div class="blog-card-body">\n'
            f'                  <div class="blog-card-date">{format_post_date(post.get("date", "1970-01-01"))} · {estimate_reading_minutes(post)} min read</div>\n'
            f'                  <h4 class="blog-card-title">{post.get("title", "")}</h4>\n'
            f'                  <p class="blog-card-excerpt">{post.get("excerpt", "")}</p>\n'
            f'                  <div class="blog-card-tags">{tags_html}</div>\n'
            '                </div>\n'
            '              </a>\n'
            '            </div>'
        )
        cards.append(card)

    return (
        '        <div class="related-posts">\n'
        '          <h2>Related posts</h2>\n'
        '          <div class="row related-posts-grid">\n'
        + '\n'.join(cards)
        + '\n          </div>\n'
        '        </div>'
    )


def update_post_file(post, related_html):
    file_path = ROOT / post['url']
    content = file_path.read_text(encoding='utf-8')

    content = content.replace('        <div id="related-posts-section"></div>', related_html)
    content = content.replace('  <script src="../js/posts-data.js"></script>\n', '')
    content = content.replace("  <script>renderRelatedPosts('related-posts-section');renderFooter('footer-section');</script>", "  <script>renderFooter('footer-section');</script>")

    file_path.write_text(content, encoding='utf-8')


def main():
    posts = json.loads(POSTS_PATH.read_text(encoding='utf-8'))
    for post in posts:
        related_html = build_related_html(build_related_posts(posts, post))
        update_post_file(post, related_html)
        print(f'Updated related posts for {post["url"]}')


if __name__ == '__main__':
    main()