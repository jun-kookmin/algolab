import logging
import os
from time import monotonic

import requests
from allauth.socialaccount.models import SocialToken
from django.conf import settings
from django.core.cache import cache

logger = logging.getLogger(__name__)

OAUTH_PROFILE_URL = os.getenv(
    "OAUTH_PROFILE_URL",
    "https://oauth.example.com/api/v1/account/profile/me/",
)
OAUTH_PROVIDER = "external_oauth"
CACHE_TTL_SECONDS = int(getattr(settings, "OAUTH_TOKEN_CACHE_TTL", 900))
REQUEST_TIMEOUT_SECONDS = float(getattr(settings, "OAUTH_TOKEN_TIMEOUT", 0.6))
_CACHE_UNAVAILABLE_UNTIL = 0.0
_REQUEST_CACHE_SENTINEL = object()


def _cache_failure_cooldown_seconds() -> float:
    try:
        return float(getattr(settings, "REDIS_FAILURE_COOLDOWN_SECONDS", 30))
    except (TypeError, ValueError):
        return 30.0


def _cache_in_cooldown() -> bool:
    return monotonic() < _CACHE_UNAVAILABLE_UNTIL


def _mark_cache_unavailable(operation: str, key: str, exc: Exception) -> None:
    global _CACHE_UNAVAILABLE_UNTIL
    now = monotonic()
    should_log = now >= _CACHE_UNAVAILABLE_UNTIL
    _CACHE_UNAVAILABLE_UNTIL = now + _cache_failure_cooldown_seconds()
    if should_log:
        logger.warning(
            "cache backend unavailable for %.1fs after %s failed for key=%s: %s",
            _cache_failure_cooldown_seconds(),
            operation,
            key,
            exc,
        )


def _cache_get(key, default=None):
    if _cache_in_cooldown():
        return default
    try:
        return cache.get(key, default)
    except Exception as exc:
        _mark_cache_unavailable("cache.get", key, exc)
        return default


def _cache_set(key, value, timeout) -> None:
    if _cache_in_cooldown():
        return
    try:
        cache.set(key, value, timeout)
    except Exception as exc:
        _mark_cache_unavailable("cache.set", key, exc)


def is_oauth_session_valid(user) -> bool:
    request_cached = getattr(user, "_cached_oauth_session_valid", _REQUEST_CACHE_SENTINEL)
    if request_cached is not _REQUEST_CACHE_SENTINEL:
        return bool(request_cached)

    # Local password-based accounts (including admin) are not governed by ExternalOAuth token validity.
    if getattr(user, "is_superuser", False) or getattr(user, "is_staff", False):
        user._cached_oauth_session_valid = True
        return True
    if hasattr(user, "has_usable_password") and user.has_usable_password():
        user._cached_oauth_session_valid = True
        return True

    cache_key = f"oauth:token-active:{user.pk}"
    cached = _cache_get(cache_key)
    if cached is not None:
        user._cached_oauth_session_valid = bool(cached)
        return bool(cached)

    token = (
        SocialToken.objects
        .select_related("account")
        .filter(account__user=user, account__provider=OAUTH_PROVIDER)
        .order_by("-account_id", "-id")
        .first()
    )
    if token is None:
        _cache_set(cache_key, True, CACHE_TTL_SECONDS)
        user._cached_oauth_session_valid = True
        return True

    if not token.token:
        _cache_set(cache_key, True, CACHE_TTL_SECONDS)
        user._cached_oauth_session_valid = True
        return True

    try:
        resp = requests.get(
            OAUTH_PROFILE_URL,
            headers={"Authorization": f"Bearer {token.token}"},
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        is_valid = resp.status_code not in (401, 403)
        _cache_set(cache_key, is_valid, CACHE_TTL_SECONDS)
        user._cached_oauth_session_valid = is_valid
        return is_valid
    except requests.RequestException as exc:
        # Fail-open on network issues to avoid global auth outage.
        logger.warning("external_oauth token check failed for user %s: %s", user.pk, exc)
        _cache_set(cache_key, True, CACHE_TTL_SECONDS)
        user._cached_oauth_session_valid = True
        return True
