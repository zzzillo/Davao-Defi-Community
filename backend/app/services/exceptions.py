"""Domain errors the service layer raises.

These describe what went wrong in the language of the problem - "that event
already has a recap" - not in the language of HTTP. Nothing here imports
FastAPI, and nothing here knows a status code.

That separation is what lets one service serve more than one caller. A router
turns RecapAlreadyExists into a 409; a seed script lets it surface as a
traceback; a future management command might catch it and skip the row. None of
them has to agree on how failure is reported.

This file appeared when Posts arrived. Events had exactly one such error and
carried it in its own module, which was the right size for one - a shared file
holding a single class is just indirection. Two modules with four between them
is the point where a common home starts paying.
"""


class ServiceError(Exception):
    """Base for every domain error raised by a service.

    Exists so a caller can say "any expected failure from this layer" in one
    except clause. Routers still catch the specific ones, because each maps to
    a different status code and a different message - but a background job that
    only wants to log and continue has something to hold onto.
    """


class InvalidEventTimeRange(ServiceError, ValueError):
    """An event would end before - or exactly when - it starts.

    Also a ValueError, which it was before this file existed. A caller that has
    never heard of this class still treats it as bad input, and the events
    router keeps catching it by the name it always used.
    """


class RecapAlreadyExists(ServiceError):
    """An event already has a recap post, and something tried to add a second.

    The database enforces this with a unique constraint; the service raises
    this so the answer can be a readable 409 rather than a driver error.
    """


class LinkedEventNotFound(ServiceError):
    """A post named an event id that does not exist.

    Distinct from "post not found": the post is fine, the thing it points at is
    not - so the answer is about the request body, not the URL.
    """


class PublishedPostNeedsImage(ServiceError):
    """Something tried to publish a post with an empty gallery.

    A recap is its photographs. Enforced in the schema when a post is created
    and in the service when one is updated, because a PATCH carrying only
    published=true has no images for a schema to look at - the stored row is
    the only place the answer lives.
    """


class SlugAlreadyExists(ServiceError):
    """A blog slug is taken, and the retry loop could not find a free variant.

    Only reachable when an official typed a slug by hand - a generated one
    walks base, base-2, base-3 and then falls back to a random token, so it
    always finds something. A hand-written slug is a specific request, and
    silently turning it into something else would be worse than refusing.
    """


class PublishedSlugImmutable(ServiceError):
    """Something tried to change the slug of a published article.

    A published URL is a promise: it is in a search index, in a pinned message,
    in somebody's bookmarks. Changing it breaks every one of those with no way
    to notify anyone, and without a redirect it becomes a 404.

    A conflict rather than bad input - the field is well formed, and the same
    request would succeed if the article were unpublished first. That is
    exactly what 409 means, and it is what the frontend needs in order to offer
    "unpublish, rename, republish" instead of highlighting the field.

    Lifting this properly means a blog_redirects table mapping old slugs to
    blog ids, so the old URL answers 301 instead of 404. Extension point: one
    lookup in get_blog_by_slug when the primary lookup misses.
    """


class PublishedBlogNeedsBody(ServiceError):
    """Something tried to publish an article with no content, or no excerpt.

    An empty article is a draft. The excerpt matters just as much: it is the
    card summary and the search-engine snippet, so publishing without one
    means the article appears in both places as a blank.

    Checked in the schema on create and in the service on update, because a
    PATCH carrying only published=true has nothing for a schema to look at.
    The service also re-checks after sanitising - "<p></p>" is a non-empty
    string that cleans down to nothing at all.
    """


class PartnerNameExists(ServiceError):
    """A partner with this name already exists, ignoring case.

    The database enforces it with a unique index on lower(name); the service
    raises this so the answer can be a readable 409 rather than a driver error.

    A conflict rather than bad input - the name is well formed, and the same
    request would have succeeded if that partner were not already listed. The
    frontend reacts differently to the two: 409 means "you already have this
    one", 422 means "fix what you typed".
    """
