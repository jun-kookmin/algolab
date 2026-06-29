import os
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from django.urls import reverse


def resolve_oauth_callback_url(request=None) -> str:
    configured = (os.environ.get("OAUTH_CALLBACK_URL") or "").strip()
    if configured:
        return configured

    callback_path = reverse("oauth_complete")
    if request is None:
        return callback_path
    return request.build_absolute_uri(callback_path)


def build_login_error_redirect(error_code: str, detail: str | None = None) -> str:
    base = "/login"
    parsed = urlsplit(base)
    query = dict(parse_qsl(parsed.query, keep_blank_values=True))
    query["oauth_error"] = error_code
    if detail:
        query["oauth_error_detail"] = detail
    return urlunsplit(
        (parsed.scheme, parsed.netloc, parsed.path, urlencode(query), parsed.fragment)
    )
