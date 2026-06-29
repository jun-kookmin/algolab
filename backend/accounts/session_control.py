import logging
import uuid
from datetime import timedelta
from time import monotonic

from django.conf import settings
from django.core.cache import cache
from django.db.models import Q
from django.utils import timezone
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken

from .models import UserSession

logger = logging.getLogger(__name__)

_SESSION_PRESENCE_CACHE_PREFIX = "accounts-user-session-presence"
_SESSION_PRESENCE_CLEANUP_CACHE_KEY = "accounts-user-session-presence-cleanup"
_CACHE_UNAVAILABLE_UNTIL = 0.0


def get_user_session(user) -> UserSession:
    cached = getattr(user, "_algolab_user_session_obj", None)
    if cached is not None:
        return cached
    session_obj, _ = UserSession.objects.get_or_create(user=user)
    user._algolab_user_session_obj = session_obj
    return session_obj


def get_user_session_key(user) -> str:
    session_obj = get_user_session(user)
    return str(session_obj.session_key)


def has_active_user_session(user, session_obj: UserSession | None = None) -> bool:
    if session_obj is None:
        session_obj = get_user_session(user)
    return bool(session_obj.is_active)


def _idle_timeout_minutes() -> int:
    try:
        return int(getattr(settings, "SINGLE_SESSION_IDLE_TIMEOUT_MINUTES", 0))
    except (TypeError, ValueError):
        return 0


def _presence_timeout_seconds() -> int:
    try:
        return int(getattr(settings, "SINGLE_SESSION_PRESENCE_TIMEOUT_SECONDS", 0))
    except (TypeError, ValueError):
        return 0


def _presence_cache_ttl_seconds(timeout_seconds: int) -> int:
    return max(timeout_seconds * 2, timeout_seconds + 30)


def _presence_cleanup_interval_seconds() -> int:
    try:
        return int(getattr(settings, "SINGLE_SESSION_PRESENCE_CLEANUP_INTERVAL_SECONDS", 15))
    except (TypeError, ValueError):
        return 15


def _session_touch_interval_seconds() -> int:
    try:
        return int(getattr(settings, "SINGLE_SESSION_TOUCH_INTERVAL_SECONDS", 30))
    except (TypeError, ValueError):
        return 30


def _presence_touch_interval_seconds() -> int:
    try:
        return int(getattr(settings, "SINGLE_SESSION_PRESENCE_TOUCH_INTERVAL_SECONDS", 15))
    except (TypeError, ValueError):
        return 15


def _presence_cache_key(user_id: int, session_key) -> str:
    return f"{_SESSION_PRESENCE_CACHE_PREFIX}:{user_id}:{session_key}"


def _parse_presence_timestamp(value) -> float | None:
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def get_user_session_presence_timestamp(user, session_obj: UserSession | None = None) -> float | None:
    timeout = _presence_timeout_seconds()
    if timeout <= 0:
        return None
    if session_obj is None:
        session_obj = get_user_session(user)
    return _parse_presence_timestamp(
        _cache_get(_presence_cache_key(user.id, session_obj.session_key))
    )


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


def _cache_set(key, value, timeout=None) -> bool:
    if _cache_in_cooldown():
        return False
    try:
        cache.set(key, value, timeout=timeout)
        return True
    except Exception as exc:
        _mark_cache_unavailable("cache.set", key, exc)
        return False


def _cache_add(key, value, timeout=None, default_on_error: bool = True) -> bool:
    if _cache_in_cooldown():
        return default_on_error
    try:
        return bool(cache.add(key, value, timeout=timeout))
    except Exception as exc:
        _mark_cache_unavailable("cache.add", key, exc)
        return default_on_error


def _cache_delete(key) -> bool:
    if _cache_in_cooldown():
        return False
    try:
        cache.delete(key)
        return True
    except Exception as exc:
        _mark_cache_unavailable("cache.delete", key, exc)
        return False


def is_user_session_expired(user, session_obj: UserSession | None = None, now=None) -> bool:
    timeout = _idle_timeout_minutes()
    if timeout <= 0:
        return False
    if session_obj is None:
        session_obj = get_user_session(user)
    last = session_obj.updated_at or session_obj.created_at
    if last is None:
        return False
    current_time = now or timezone.now()
    return current_time - last > timedelta(minutes=timeout)


def is_user_session_presence_expired(
    user,
    session_obj: UserSession | None = None,
    now=None,
    last_seen_ts: float | None = None,
) -> bool:
    timeout = _presence_timeout_seconds()
    if timeout <= 0:
        return False
    if session_obj is None:
        session_obj = get_user_session(user)
    if not session_obj.is_active:
        return False
    current_time = now or timezone.now()
    if last_seen_ts is None:
        last_seen_ts = get_user_session_presence_timestamp(user, session_obj=session_obj)
    if last_seen_ts is not None:
        return (current_time.timestamp() - last_seen_ts) > timeout
    last = session_obj.updated_at or session_obj.created_at
    if last is None:
        return False
    return current_time - last > timedelta(seconds=timeout)


def touch_user_session(user, session_obj: UserSession | None = None, now=None) -> None:
    if session_obj is None:
        session_obj = get_user_session(user)
    if not session_obj.is_active:
        return
    current_time = now or timezone.now()
    last = session_obj.updated_at or session_obj.created_at
    touch_interval = _session_touch_interval_seconds()
    if (
        touch_interval > 0
        and last is not None
        and current_time - last < timedelta(seconds=touch_interval)
    ):
        return
    session_obj.updated_at = current_time
    session_obj.save(update_fields=["updated_at"])


def touch_user_session_presence(
    user,
    session_obj: UserSession | None = None,
    now=None,
    last_seen_ts: float | None = None,
) -> None:
    timeout = _presence_timeout_seconds()
    if timeout <= 0:
        return
    if session_obj is None:
        session_obj = get_user_session(user)
    if not session_obj.is_active:
        return
    current_time = now or timezone.now()
    touch_interval = _presence_touch_interval_seconds()
    if last_seen_ts is None:
        last_seen_ts = get_user_session_presence_timestamp(user, session_obj=session_obj)
    if (
        touch_interval > 0
        and last_seen_ts is not None
        and (current_time.timestamp() - last_seen_ts) < touch_interval
    ):
        return
    _cache_set(
        _presence_cache_key(user.id, session_obj.session_key),
        current_time.timestamp(),
        timeout=_presence_cache_ttl_seconds(timeout),
    )


def cleanup_stale_user_sessions(force: bool = False) -> int:
    timeout = _presence_timeout_seconds()
    if timeout <= 0:
        return 0

    cleanup_interval = _presence_cleanup_interval_seconds()
    if not force and cleanup_interval > 0:
        if not _cache_add(
            _SESSION_PRESENCE_CLEANUP_CACHE_KEY,
            "1",
            timeout=cleanup_interval,
            default_on_error=False,
        ):
            return 0

    threshold = timezone.now() - timedelta(seconds=timeout)
    stale_sessions = list(
        UserSession.objects.select_related("user").filter(
            is_active=True,
        ).filter(
            Q(updated_at__lt=threshold) |
            Q(updated_at__isnull=True, created_at__lt=threshold)
        )[:200]
    )

    expired_count = 0
    for session_obj in stale_sessions:
        clear_user_session(session_obj.user)
        expired_count += 1
    return expired_count


def rotate_user_session(user, session_obj: UserSession | None = None) -> str:
    if session_obj is None:
        session_obj = get_user_session(user)
    old_session_key = session_obj.session_key
    if old_session_key:
        _cache_delete(_presence_cache_key(user.id, old_session_key))
    session_obj.session_key = uuid.uuid4()
    session_obj.is_active = True
    session_obj.save(update_fields=["session_key", "is_active", "updated_at"])
    user._algolab_user_session_obj = session_obj
    touch_user_session_presence(user, session_obj=session_obj)
    return str(session_obj.session_key)


def clear_user_session(user) -> None:
    session_obj = get_user_session(user)
    old_session_key = session_obj.session_key
    if old_session_key:
        _cache_delete(_presence_cache_key(user.id, old_session_key))
    session_obj.session_key = uuid.uuid4()
    session_obj.is_active = False
    session_obj.save(update_fields=["session_key", "is_active", "updated_at"])
    user._algolab_user_session_obj = session_obj
    _cache_delete(_presence_cache_key(user.id, session_obj.session_key))
    revoke_user_refresh_tokens(user)


def revoke_user_refresh_tokens(user) -> None:
    tokens = OutstandingToken.objects.filter(user=user)
    for token in tokens:
        BlacklistedToken.objects.get_or_create(token=token)
