from django.core.management.base import BaseCommand

from api import models
from instructor.pending_cleanup import (
    _get_stale_pending_queryset,
    get_stale_pending_max_age_days,
    get_stale_pending_timeout_minutes,
    get_stale_pending_threshold,
    get_stale_pending_window_start,
    mark_stale_pending_submissions,
)


class Command(BaseCommand):
    help = "오래된 PENDING/PD 제출을 SE로 자동 전환합니다."

    def add_arguments(self, parser):
        parser.add_argument(
            "--timeout-minutes",
            type=int,
            default=get_stale_pending_timeout_minutes(),
            help="이 시간보다 오래된 PENDING/PD 제출을 SE로 처리합니다.",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="실제 갱신 없이 대상 개수만 출력합니다.",
        )
        parser.add_argument(
            "--max-age-days",
            type=int,
            default=get_stale_pending_max_age_days(),
            help="이 일수보다 오래된 제출은 자동 처리 대상에서 제외합니다.",
        )

    def handle(self, *args, **options):
        threshold = get_stale_pending_threshold(
            timeout_minutes=options["timeout_minutes"]
        )
        window_start = get_stale_pending_window_start(
            max_age_days=options["max_age_days"]
        )

        if options["dry_run"]:
            homework_count = _get_stale_pending_queryset(
                models.ProblemSubmit,
                threshold=threshold,
                window_start=window_start,
            ).count()
            exam_count = _get_stale_pending_queryset(
                models.ExamSubmit,
                threshold=threshold,
                window_start=window_start,
            ).count()
            self.stdout.write(
                "[dry-run] "
                f"window_start={window_start.isoformat()} "
                f"threshold={threshold.isoformat()} "
                f"homework={homework_count} exam={exam_count}"
            )
            return

        homework_count, exam_count, used_threshold = mark_stale_pending_submissions(
            threshold=threshold,
            window_start=window_start,
        )
        self.stdout.write(
            self.style.SUCCESS(
                "stale pending submissions marked as SE: "
                f"window_start={window_start.isoformat()}, "
                f"homework={homework_count}, exam={exam_count}, "
                f"threshold={used_threshold.isoformat()}"
            )
        )
