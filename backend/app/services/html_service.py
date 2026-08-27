"""Turning authored HTML into HTML that is safe to publish.

Officials write event bodies in a rich-text editor, and whatever they paste
into it - from a website, a document, another CMS - arrives as markup nobody
here wrote. Rendering that on a public page is how an onerror= attribute inside
a pasted <img> ends up running in every visitor's browser. A <script> tag is
the famous case but not the dangerous one: browsers refuse to execute scripts
inserted through innerHTML, while event-handler attributes fire normally.

Cleaning happens on write, so what reaches the database is already safe. Every
consumer is then safe without having to remember anything - the public page, an
RSS feed, an email digest, a mobile client. A rule that must be re-applied at
each new call site is a rule that eventually gets missed, and the one place it
gets missed is the one that matters.

Not events-specific: Blogs and Partners will hand their bodies to the same
function.
"""

import html

import nh3

# What the editor can actually produce, and nothing beyond it.
#
# An allowlist rather than a blocklist. New dangerous markup appears constantly;
# new *safe* markup essentially never does. So anything unrecognised is dropped
# rather than permitted, and this list only ever needs revisiting when the
# editor itself grows a feature.
ALLOWED_TAGS = {
    "p",
    "br",
    "div",
    "span",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "strong",
    "b",
    "em",
    "i",
    "u",
    "s",
    "code",
    "pre",
    "blockquote",
    "hr",
    "ul",
    "ol",
    "li",
    "a",
    "img",
    # Added for Blogs. A caption belongs with its picture rather than floating
    # underneath as a stray paragraph, and an article that explains a fee
    # schedule wants a table.
    #
    # One allowlist, shared by every module, rather than a stricter one for
    # captions and a looser one for articles. Two allowlists is two things to
    # keep safe, and the second one gets read half as often. Letting a table
    # into an event description harms nobody.
    "figure",
    "figcaption",
    "table",
    "thead",
    "tbody",
    "tfoot",
    "tr",
    "th",
    "td",
    "caption",
}

# Attributes are allowlisted per tag, which is what keeps event handlers out.
# There is no "onerror" here and no way to add one, because anything not named
# is removed - the check is not "does this look like a handler".
ALLOWED_ATTRIBUTES = {
    "a": {"href", "title"},
    "img": {"src", "alt", "title", "width", "height"},
    # Narrowed to these two tags on purpose. A syntax highlighter needs to read
    # "language-python" off a code block, and that is the whole reason class is
    # allowed anywhere.
    #
    # class is not a script vector - nh3 would still strip an onerror beside
    # it - but it is a styling escape hatch, and an author who can attach any
    # class to any element can borrow the site's own layout classes and make a
    # paragraph look like a system notice. Restricted to the two tags that have
    # a reason to carry one.
    "pre": {"class"},
    "code": {"class"},
    # Real tables need to merge cells. Both are integers as far as HTML is
    # concerned, so neither can carry a URL or a handler.
    "th": {"colspan", "rowspan", "scope"},
    "td": {"colspan", "rowspan"},
}

# A link is also a way to execute code: javascript: runs, and data: can carry a
# whole HTML document. These three cover everything the editor offers.
ALLOWED_URL_SCHEMES = {"http", "https", "mailto"}

# Stamped onto every surviving link. noopener stops the opened page reaching
# back through window.opener; noreferrer keeps our URLs out of its logs.
LINK_REL = "noopener noreferrer nofollow"


def sanitize_html(html: str | None) -> str | None:
    """Strip anything unsafe from authored HTML, keeping the formatting.

    Returns None for content that is empty once cleaned, so a description of
    "<p></p>" is stored as no description at all rather than as markup that
    renders to nothing.
    """
    if html is None:
        return None

    cleaned = nh3.clean(
        html,
        tags=ALLOWED_TAGS,
        attributes=ALLOWED_ATTRIBUTES,
        url_schemes=ALLOWED_URL_SCHEMES,
        link_rel=LINK_REL,
    )

    # nh3 strips tags but keeps the text inside them, so "is this empty?" has
    # to be asked after cleaning. An untouched editor leaves "<p><br></p>"
    # behind, which is markup with nothing in it - that counts as no
    # description. A picture on its own still counts as one.
    text_only = nh3.clean(cleaned, tags=set()).strip()

    if not text_only and "<img" not in cleaned:
        return None

    return cleaned


def strip_html(text: str | None) -> str | None:
    """Reduce authored text to plain text, dropping every tag.

    For fields that are never rendered as markup: a blog excerpt, which appears
    as a card summary, inside a <meta name="description"> attribute, and in an
    RSS <description>.

    Escaping differs in each of those places, and a string that is safe in one
    is not automatically safe in the next. Storing no markup at all means none
    of them has to be reasoned about.

    Also guards a mistake nobody would notice: sanitize_html keeps <strong>, so
    an excerpt cleaned with it would look fine until a card rendered it as text
    and printed the tags, or rendered it as HTML and inherited a hazard the
    field never needed.

    Returns None for anything that is empty once stripped, matching
    sanitize_html, so "<p></p>" is stored as no excerpt rather than as blank
    markup.

    THE LOOP IS NOT DECORATION. nh3 always emits HTML-escaped text, so a single
    pass turns "Tom & Jerry" into "Tom &amp; Jerry" - which a card rendering it
    as text would print with the entity showing. Unescaping fixes that and
    creates a second problem: "&lt;script&gt;" unescapes into a real "<script>",
    so an author could hide markup behind entities and have this hand it back.

    Stripping and unescaping until the result stops changing settles both. The
    escaped-markup case collapses to nothing on the second pass; ordinary text
    reaches a fixed point immediately. Three passes is a bound, not a target -
    nothing observed needs more than two.
    """
    if text is None:
        return None

    current = text
    previous = None

    for _ in range(3):
        if current == previous:
            break

        previous = current
        current = html.unescape(nh3.clean(current, tags=set(), attributes={}))

    return current.strip() or None
