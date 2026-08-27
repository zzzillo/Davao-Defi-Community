"""Turning a human title into the string that goes in a URL.

Every function here is pure: same input, same output, no database, no clock, no
randomness. That is deliberate and it is the reason this is its own module.

Slug generation has two halves, and only one of them is hard to reason about:

- "what should this title look like in a URL" - pure text, dozens of awkward
  cases (accents, emoji, CJK, punctuation, a title that is 400 characters long)
- "is that string already taken" - a query, a race, a retry loop

Keeping the first half in here means it can be exercised against a list of nasty
inputs without a database in play. The second half lives in blog_service, where
the session is.

Sits beside html_service for the same reason: both are pure transforms that a
service calls on the way in. Neither touches persistence, so neither belongs in
the module that owns a table.
"""

import re
import unicodedata
from collections.abc import Iterator

# The shape of a finished slug: lowercase alphanumerics in groups, joined by
# single hyphens, with no hyphen at either end. "understanding-web3" passes;
# "-web3", "web3-", "web--3" and "Web3" all fail.
#
# Used to validate a slug an official typed by hand. Anything this module
# generates satisfies it by construction.
SLUG_PATTERN = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")

# The column is String(220). A generated base stops at 200 - the same cap as
# the title it comes from - which leaves twenty characters for a collision
# suffix. The longest suffix this module produces is nine ("-" plus an eight
# character token), so the headroom is never close to being used.
MAX_BASE_LENGTH = 200
SLUG_MAX_LENGTH = 220

# Words that must never become a slug, because a URL containing one would be
# ambiguous with a route.
#
# Precautionary rather than a fix for a live collision: the public article
# route is /blog/<slug> and the admin routes are /admin/blogs/new and
# /admin/blogs/edit/<id>, so nothing overlaps today. It costs three lines to
# make sure a future /blogs/new public route cannot be shadowed by an article
# somebody titled "New".
RESERVED_SLUGS = frozenset({"new", "edit", "admin", "api", "draft", "drafts"})


def slugify(value: str, *, max_length: int = MAX_BASE_LENGTH) -> str:
    """Reduce a title to a URL-safe slug. May return "" - callers must handle it.

    "Understanding Web3 - A Primer!" becomes "understanding-web3-a-primer".

    Idempotent: feeding it a slug returns that slug unchanged, which is what
    lets the same function clean up a value an official typed by hand.

    The empty result is not an edge case to be waved at. A title written
    entirely in Chinese, Japanese, Korean, Thai, or emoji has no ASCII in it at
    all, and this returns "". Callers fall back to fallback_slug().
    """
    # NFKD splits an accented character into its base letter plus a combining
    # mark, so "cafe" survives and the accent is dropped rather than the whole
    # letter. Encoding to ASCII with errors="ignore" is what removes the marks
    # - and everything else outside ASCII along with them.
    decomposed = unicodedata.normalize("NFKD", value)
    ascii_only = decomposed.encode("ascii", "ignore").decode("ascii")

    # One rule for every remaining character: keep letters and digits, and turn
    # any run of anything else into a single hyphen. Spaces, em dashes, slashes
    # and exclamation marks all take the same path, so there is no list of
    # punctuation to keep up to date.
    hyphenated = re.sub(r"[^a-z0-9]+", "-", ascii_only.lower()).strip("-")

    return _truncate_on_word_boundary(hyphenated, max_length)


def _truncate_on_word_boundary(slug: str, max_length: int) -> str:
    """Cut a slug to length without leaving half a word at the end.

    "understanding-decentralised-fin" reads like a mistake; dropping the
    partial word gives "understanding-decentralised", which reads like a
    choice.

    The guard exists for a title that is one enormous word: rather than trim
    away almost everything to reach a boundary that is not there, take the hard
    cut. Losing half a word beats losing the whole slug.
    """
    if len(slug) <= max_length:
        return slug

    cut = slug[:max_length]

    if "-" in cut:
        trimmed = cut.rsplit("-", 1)[0]

        if len(trimmed) >= max_length // 2:
            return trimmed

    return cut.rstrip("-")


def is_valid_slug(value: str) -> bool:
    """Whether a hand-written slug is well formed and not reserved."""
    return bool(SLUG_PATTERN.fullmatch(value)) and value not in RESERVED_SLUGS


def fallback_slug(token: str) -> str:
    """A slug for a title that reduced to nothing.

    The caller supplies the token - usually the first characters of the row's
    UUID - so this function stays deterministic and testable. Randomness that
    lives inside a pure function is randomness nobody can write a test around.
    """
    return f"blog-{slugify(token) or 'untitled'}"


def numbered_variants(base: str, *, attempts: int) -> Iterator[str]:
    """base, base-2, base-3, ... - the sequence tried when a slug is taken.

    Starts at 2 because "the second thing called X" is what a reader expects
    from "-2"; a first article ending in "-1" looks like a mistake.

    A generator rather than a list, so the caller stops querying the moment one
    is free. Bounded by `attempts` because an unbounded loop against a database
    is a way to turn one bad title into a hundred round trips - past the bound
    the caller appends a random token instead and moves on.
    """
    yield base

    for suffix in range(2, attempts + 1):
        yield _suffixed(base, str(suffix))


def with_token(base: str, token: str) -> str:
    """base-a3f91c2d - the last resort when the numbered variants run out."""
    return _suffixed(base, token)


def _suffixed(base: str, suffix: str) -> str:
    """Append "-suffix", shortening the base first if the column would overflow.

    Defensive: a base generated here is capped at 200 and the longest suffix is
    eight characters, so the trim never fires today. It fires the day somebody
    raises MAX_BASE_LENGTH and forgets this exists.
    """
    room = SLUG_MAX_LENGTH - len(suffix) - 1

    return f"{base[:room].rstrip('-')}-{suffix}"
