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
