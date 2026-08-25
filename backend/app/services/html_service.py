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
}

# Attributes are allowlisted per tag, which is what keeps event handlers out.
# There is no "onerror" here and no way to add one, because anything not named
# is removed - the check is not "does this look like a handler".
ALLOWED_ATTRIBUTES = {
    "a": {"href", "title"},
    "img": {"src", "alt", "title", "width", "height"},
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
