import os
import logging
from datetime import timedelta

from django.conf import settings
from django.core.cache import cache
from django.db.models import Q
from django.utils import timezone

from api import models

logger = logging.getLogger(__name__)

PENDING_STATUSES = ("PENDING", "PD")
AUTO_TIMEOUT_ERROR_PREFIX = "[AUTO_PENDING_TIMEOUT]"
AUTO_TIMEOUT_ERROR_MESSAGE = (
    f"{AUTO_TIMEOUT_ERROR_PREFIX} "
    "채점 결과를 일정 시간 내에 받지 못해 에러(SE)로 자동 처리되었습니다."
)


def _write_heartbeat(message: str):
    path = getattr(settings, "PENDING_SUBMISSION_CRON_HEARTBEAT_PATH", "/tmp/pending_cleanup.log")
    try:
        with open(path, "a", encoding="utf-8") as fp:
            fp.write(f"{timezone.now().isoformat()} {message}\n")
    except Exception as exc:
        logger.warning("[pending_cleanup_cron] heartbeat write failed: %s", exc)


def get_stale_pending_timeout_minutes() -> int:
    try:
        configured = getattr(settings, "PENDING_SUBMISSION_TIMEOUT_MINUTES", None)
        if configured is None:
            configured = os.getenv("PENDING_SUBMISSION_TIMEOUT_MINUTES", "15")
        return max(1, int(configured))
    except (TypeError, ValueError):
        return 15


def get_stale_pending_threshold(now=None, timeout_minutes=None):
    current = now or timezone.now()
    timeout_value = (
        max(1, int(timeout_minutes))
        if timeout_minutes is not None
        else get_stale_pending_timeout_minutes()
    )
    return current - timedelta(minutes=timeout_value)


def get_stale_pending_max_age_days() -> int:
    try:
        configured = getattr(settings, "PENDING_SUBMISSION_MAX_AGE_DAYS", None)
        if configured is None:
            configured = os.getenv("PENDING_SUBMISSION_MAX_AGE_DAYS", "7")
        return max(1, int(configured))
    except (TypeError, ValueError):
        return 7


def get_stale_pending_window_start(now=None, max_age_days=None):
    current = now or timezone.now()
    max_age_value = (
        max(1, int(max_age_days))
        if max_age_days is not None
        else get_stale_pending_max_age_days()
    )
    return current - timedelta(days=max_age_value)


def is_auto_timeout_submission(submission) -> bool:
    status = str(getattr(submission, "status", "") or "").upper()
    error_message = str(getattr(submission, "error_message", "") or "")
    return status == "SE" and error_message.startswith(AUTO_TIMEOUT_ERROR_PREFIX)


def _graded_result_footprint_q() -> Q:
    return (
        Q(score__isnull=False) |
        Q(execution_time__isnull=False) |
        Q(memory__isnull=False) |
        Q(error_message__isnull=False)
    )


def _get_stale_pending_queryset(model, *, threshold=None, window_start=None):
    stale_threshold = threshold or get_stale_pending_threshold()
    recent_window_start = window_start or get_stale_pending_window_start()
    return model.objects.filter(
        status__in=PENDING_STATUSES,
        submission_time__gte=recent_window_start,
    ).filter(
        Q(submission_time__lt=stale_threshold) | _graded_result_footprint_q()
    )


def mark_stale_pending_submissions(*, threshold=None, window_start=None):
    stale_threshold = threshold or get_stale_pending_threshold()
    update_kwargs = {
        "status": "SE",
        "score": 0,
        "execution_time": 0,
        "memory": 0,
        "error_message": AUTO_TIMEOUT_ERROR_MESSAGE,
    }

    homework_count = _get_stale_pending_queryset(
        models.ProblemSubmit,
        threshold=stale_threshold,
        window_start=window_start,
    ).update(**update_kwargs)

    exam_count = _get_stale_pending_queryset(
        models.ExamSubmit,
        threshold=stale_threshold,
        window_start=window_start,
    ).update(**update_kwargs)

    return homework_count, exam_count, stale_threshold


def run_stale_pending_cleanup_job():
    lock_key = "pending-cleanup-cron-lock"
    lock_timeout = max(
        30,
        int(getattr(settings, "PENDING_SUBMISSION_CRON_LOCK_TIMEOUT_SECONDS", 240)),
    )
    if not cache.add(lock_key, "1", timeout=lock_timeout):
        _write_heartbeat("skip lock-held")
        logger.info("[pending_cleanup_cron] skip: another worker already running")
        return

    try:
        stale_threshold = get_stale_pending_threshold()
        recent_window_start = get_stale_pending_window_start()
        homework_count, exam_count, _ = mark_stale_pending_submissions(
            threshold=stale_threshold,
            window_start=recent_window_start,
        )
        _write_heartbeat(
            "run "
            f"homework={homework_count} "
            f"exam={exam_count} "
            f"window_start={recent_window_start.isoformat()} "
            f"threshold={stale_threshold.isoformat()}"
        )
        logger.info(
            "[pending_cleanup_cron] homework=%s exam=%s window_start=%s threshold=%s",
            homework_count,
            exam_count,
            recent_window_start.isoformat(),
            stale_threshold.isoformat(),
        )
    finally:
        cache.delete(lock_key)
