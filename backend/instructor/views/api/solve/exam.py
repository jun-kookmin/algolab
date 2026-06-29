from __future__ import annotations

import hashlib
from django.conf import settings
from django.core.cache import cache
from django.db import transaction, IntegrityError
from django.db.models import Prefetch, Q
from django.shortcuts import get_object_or_404
from django.contrib.auth import get_user_model
from django.utils import timezone

from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from drf_spectacular.utils import extend_schema

from api import models
from accounts.permissions import user_in_groups
from variables.groups import GroupEnum
from instructor.serializers.problem import (
    ProblemSolveSerializer,
    ProblemSolveInstructorSerializer,
    ProblemListPublicSerializer,
    ProblemListSerializer,
)
from ....permissions import IsExamParticipantOrInstructor

user = get_user_model()
ADMIN = GroupEnum.ADMINISTRATOR.value
PROF = GroupEnum.PROFESSOR.value


@extend_schema(tags=['instructor/exam/solve'])
class ExamSolveViewSet(viewsets.GenericViewSet):
    queryset = models.Exam.objects.filter() # is_delete=False
    permission_classes = [IsExamParticipantOrInstructor]

    def _resolve_exam(self, pk):
        exam_qs = models.Exam.objects.select_related("lecture")
        if pk and str(pk).isdigit():
            return get_object_or_404(exam_qs, pk=pk)
        return get_object_or_404(exam_qs, uuid=pk)

    def _get_student_in_lecture(self, exam, user_obj):
        if not user_obj or user_obj.is_anonymous:
            return None
        return (
            models.StudentInLecture.objects
            .select_related("student")
            .filter(lecture=exam.lecture, student=user_obj, is_delete=False)
            .first()
        )

    def _get_exam_user(self, exam, user_obj):
        sil = self._get_student_in_lecture(exam, user_obj)
        if not sil:
            return None
        qs = models.ExamUser.objects.filter(exam=exam, lecture_user=sil)
        finished = qs.filter(finished_at__isnull=False).order_by("-finished_at", "-id").first()
        return finished or qs.order_by("-id").first()

    def _get_or_create_exam_user(self, exam, user_obj):
        sil = self._get_student_in_lecture(exam, user_obj)
        if not sil:
            return None
        defaults = {
            "start_time": timezone.now(),
            "end_time": getattr(exam, "due_date", None) or timezone.now(),
            "saved_code": "",
        }
        qs = models.ExamUser.objects.filter(exam=exam, lecture_user=sil)
        finished = qs.filter(finished_at__isnull=False).order_by("-finished_at", "-id").first()
        existing = finished or qs.order_by("-id").first()
        if existing:
            return existing
        try:
            with transaction.atomic():
                return models.ExamUser.objects.create(
                    exam=exam,
                    lecture_user=sil,
                    **defaults,
                )
        except IntegrityError:
            return (
                models.ExamUser.objects
                .filter(exam=exam, lecture_user=sil)
                .order_by("-id")
                .first()
            )

    def _refresh_entry_time_if_needed(self, exam, exam_user, user_obj):
        if self._is_privileged(user_obj):
            return
        if not exam_user or exam_user.finished_at or exam_user.finished_by_user:
            return
        exam_start = getattr(exam, "start_date", None)
        if not exam_start:
            return
        if exam_user.start_time <= exam_start:
            exam_user.start_time = timezone.now()
            exam_user.save(update_fields=["start_time"])

    def _sync_end_time_if_needed(self, exam, exam_user):
        if not exam_user:
            return
        if exam_user.finished_at:
            return
        due_date = getattr(exam, "due_date", None)
        if due_date and exam_user.end_time != due_date:
            exam_user.end_time = due_date
            exam_user.save(update_fields=["end_time"])

    def _is_finished(self, exam_user):
        return bool(exam_user and exam_user.finished_at)

    def _is_privileged(self, user_obj):
        return bool(user_obj and user_in_groups(user_obj, ADMIN, PROF))

    def _cache_enabled(self) -> bool:
        return bool(getattr(settings, "API_CACHE_ENABLED", True))

    def _problem_cache_ttl(self) -> int:
        return int(getattr(settings, "API_CACHE_LIST_TTL", 30))

    def _problem_cache_key(
        self,
        exam_uuid: str,
        raw_ids: list[str],
        compact: bool = False,
        access_scope: str = "student",
    ) -> str:
        normalized = ",".join(sorted({str(v).strip().lower() for v in raw_ids if str(v).strip()}))
        digest = hashlib.md5(normalized.encode()).hexdigest()
        mode = "compact" if compact else "full"
        return f"solve-exam-problem:v3:{exam_uuid}:{mode}:{access_scope}:{digest}"

    def _problem_cache_payload(self, exam_problems, compact: bool = False, access_scope: str = "student"):
        payload = []
        if compact:
            serializer = ProblemListSerializer if access_scope == "staff" else ProblemListPublicSerializer
        else:
            serializer = ProblemSolveInstructorSerializer if access_scope == "staff" else ProblemSolveSerializer

        for ep in exam_problems:
            data = serializer(ep.problem).data
            data["exam_problem_uuid"] = str(ep.uuid)
            payload.append(data)
        return payload

    def _build_exam_problem_queryset(self, exam, int_ids: list[int], uuid_ids: list[str]):
        qs = (
            models.ExamProblem.objects
            .filter(exam=exam)
            .select_related("problem")
        )
        if int_ids and uuid_ids:
            return qs.filter(Q(id__in=int_ids) | Q(uuid__in=uuid_ids))
        if int_ids:
            return qs.filter(id__in=int_ids)
        return qs.filter(uuid__in=uuid_ids)

    def _is_before_start(self, exam, user_obj):
        if self._is_privileged(user_obj):
            return False
        start_date = getattr(exam, "start_date", None)
        return bool(start_date and timezone.now() < start_date)

    def _is_lecture_closed(self, exam, user_obj):
        if self._is_privileged(user_obj):
            return False
        end_date = getattr(exam.lecture, "end_date", None)
        return bool(end_date and timezone.now() > end_date)

    def _auto_finish_if_expired(self, exam, exam_user, user_obj):
        if not exam_user or self._is_privileged(user_obj):
            return
        due_date = getattr(exam, "due_date", None)
        if due_date and timezone.now() > due_date and not exam_user.finished_at:
            models.ExamUser.objects.filter(
                exam=exam,
                lecture_user=exam_user.lecture_user,
                finished_at__isnull=True,
            ).update(finished_at=due_date, end_time=due_date, finished_by_user=False)

    def _reopen_if_extended(self, exam, exam_user, user_obj):
        if not exam_user or self._is_privileged(user_obj):
            return
        if exam_user.finished_by_user:
            return
        due_date = getattr(exam, "due_date", None)
        if (
            due_date
            and timezone.now() < due_date
            and exam_user.finished_at
            and exam_user.end_time
            and exam_user.end_time < due_date
            and exam_user.finished_at >= exam_user.end_time
        ):
            models.ExamUser.objects.filter(
                exam=exam,
                lecture_user=exam_user.lecture_user,
                finished_at__isnull=False,
                end_time__lt=due_date,
            ).update(finished_at=None, end_time=due_date)

    def _is_effectively_finished(self, exam, exam_user, user_obj):
        if not exam_user:
            return False
        if self._is_privileged(user_obj):
            return False
        if not exam_user.finished_at:
            return False
        if exam_user.end_time and exam_user.finished_at < exam_user.end_time:
            return True
        due_date = getattr(exam, "due_date", None)
        if (
            due_date
            and timezone.now() < due_date
            and exam_user.end_time
            and exam_user.end_time < due_date
        ):
            return False
        return True

    def _is_finished_by_user(self, exam_user, user_obj):
        if not exam_user:
            return False
        if self._is_privileged(user_obj):
            return False
        return bool(exam_user.finished_by_user)

    # POST /api/v1/instructor/solve/exam/{exam_id}/start/
    @action(detail=True, methods=["post"], url_path="start")
    def start_exam(self, request, pk=None):
        exam = self._resolve_exam(pk)
        if self._is_lecture_closed(exam, request.user):
            return Response({"detail": "강의가 종료되었습니다."}, status=status.HTTP_403_FORBIDDEN)
        if self._is_before_start(exam, request.user):
            return Response({"detail": "접근 가능 시간이 아닙니다."}, status=status.HTTP_403_FORBIDDEN)
        exam_user = self._get_or_create_exam_user(exam, request.user)
        self._refresh_entry_time_if_needed(exam, exam_user, request.user)
        self._sync_end_time_if_needed(exam, exam_user)
        self._reopen_if_extended(exam, exam_user, request.user)
        self._auto_finish_if_expired(exam, exam_user, request.user)
        if self._is_finished_by_user(exam_user, request.user):
            return Response(
                {"detail": "시험을 종료하여 다시 접근할 수 없습니다."},
                status=status.HTTP_403_FORBIDDEN,
            )
        if self._is_effectively_finished(exam, exam_user, request.user):
            return Response({"detail": "시험이 종료되었습니다."}, status=status.HTTP_403_FORBIDDEN)
        if exam_user is None:
            return Response({"started": False, "finished": False}, status=status.HTTP_200_OK)
        return Response({"started": True, "finished": False}, status=status.HTTP_200_OK)

    # POST /api/v1/instructor/solve/exam/{exam_id}/finish/
    @action(detail=True, methods=["post"], url_path="finish")
    def finish_exam(self, request, pk=None):
        exam = self._resolve_exam(pk)
        exam_user = self._get_or_create_exam_user(exam, request.user)
        self._sync_end_time_if_needed(exam, exam_user)
        if exam_user is None:
            return Response({"detail": "응시 정보가 없습니다."}, status=status.HTTP_400_BAD_REQUEST)
        update_fields = []
        if not exam_user.finished_at:
            finished_at = timezone.now()
            exam_user.finished_at = finished_at
            update_fields.append("finished_at")
        if not exam_user.finished_by_user:
            exam_user.finished_by_user = True
            update_fields.append("finished_by_user")
        if update_fields:
            exam_user.save(update_fields=update_fields)
        return Response(
            {"finished": True, "finished_at": exam_user.finished_at},
            status=status.HTTP_200_OK,
        )

    # GET /api/v1/instructor/solve/exam/{exam_id}/status/
    @action(detail=True, methods=["get"], url_path="status")
    def exam_status(self, request, pk=None):
        exam = self._resolve_exam(pk)
        not_started = self._is_before_start(exam, request.user)
        exam_user = self._get_exam_user(exam, request.user)
        self._sync_end_time_if_needed(exam, exam_user)
        self._reopen_if_extended(exam, exam_user, request.user)
        self._auto_finish_if_expired(exam, exam_user, request.user)
        start_date = getattr(exam, "start_date", None)
        due_date = getattr(exam, "due_date", None)
        remaining_seconds = None
        if due_date:
            remaining_seconds = max(0, int((due_date - timezone.now()).total_seconds()))
        if exam_user is None:
            return Response({
                "started": False,
                "finished": False,
                "finished_by_user": False,
                "not_started": not_started,
                "start_date": start_date,
                "due_date": due_date,
                "server_time": timezone.now(),
                "remaining_seconds": remaining_seconds,
            }, status=status.HTTP_200_OK)
        is_finished = self._is_effectively_finished(exam, exam_user, request.user)
        return Response(
            {
                "started": True,
                "finished": is_finished,
                "finished_at": exam_user.finished_at if is_finished else None,
                "finished_by_user": bool(exam_user.finished_by_user) if is_finished else False,
                "not_started": not_started,
                "start_date": start_date,
                "due_date": due_date,
                "server_time": timezone.now(),
                "remaining_seconds": remaining_seconds,
            },
            status=status.HTTP_200_OK,
        )

    # POST /api/v1/instructor/solve/exam/{exam_id}/unlock/
    @action(detail=True, methods=["post"], url_path="unlock")
    def unlock_exam(self, request, pk=None):
        if not self._is_privileged(request.user):
            return Response({"detail": "권한이 없습니다."}, status=status.HTTP_403_FORBIDDEN)
        exam = self._resolve_exam(pk)
        user_id = request.data.get("user_id") or request.data.get("student_id")
        if not user_id:
            return Response({"detail": "user_id가 필요합니다."}, status=status.HTTP_400_BAD_REQUEST)
        sil = (
            models.StudentInLecture.objects
            .select_related("student")
            .filter(lecture=exam.lecture, student__id=user_id, is_delete=False)
            .first()
        )
        if not sil:
            return Response({"detail": "학생 정보를 찾을 수 없습니다."}, status=status.HTTP_404_NOT_FOUND)
        exam_user = (
            models.ExamUser.objects
            .filter(exam=exam, lecture_user=sil)
            .order_by("-id")
            .first()
        )
        if not exam_user:
            return Response({"detail": "응시 정보가 없습니다."}, status=status.HTTP_404_NOT_FOUND)

        exam_user.finished_by_user = False
        exam_user.finished_at = None
        due_date = getattr(exam, "due_date", None)
        if due_date:
            exam_user.end_time = due_date
        exam_user.save(update_fields=["finished_by_user", "finished_at", "end_time"])
        return Response({"unlocked": True, "user_id": str(user_id)}, status=status.HTTP_200_OK)

    # GET /api/v1/instructor/solve/exam/{exam_id}/problem/?ids=1,2,3
    @action(detail=True, methods=["get"], url_path="problem")
    def problems_solve(self, request, pk=None):
        exam = self._resolve_exam(pk)
        if self._is_lecture_closed(exam, request.user):
            return Response({"detail": "강의가 종료되었습니다."}, status=status.HTTP_403_FORBIDDEN)
        if self._is_before_start(exam, request.user):
            return Response({"detail": "접근 가능 시간이 아닙니다."}, status=status.HTTP_403_FORBIDDEN)
        exam_user = self._get_or_create_exam_user(exam, request.user)
        self._sync_end_time_if_needed(exam, exam_user)
        self._reopen_if_extended(exam, exam_user, request.user)
        self._auto_finish_if_expired(exam, exam_user, request.user)
        if self._is_finished_by_user(exam_user, request.user):
            return Response(
                {"detail": "시험을 종료하여 다시 접근할 수 없습니다."},
                status=status.HTTP_403_FORBIDDEN,
            )
        if self._is_effectively_finished(exam, exam_user, request.user):
            return Response({"detail": "시험이 종료되었습니다."}, status=status.HTTP_403_FORBIDDEN)
        ids_param = request.query_params.get("ids")
        if not ids_param:
            return Response({"detail": "ids required"}, status=status.HTTP_400_BAD_REQUEST)

        raw_ids = [i.strip() for i in ids_param.split(",") if i.strip()]
        int_ids = []
        uuid_ids = []
        for item in raw_ids:
            if item.isdigit():
                int_ids.append(int(item))
            else:
                uuid_ids.append(item)

        if not int_ids and not uuid_ids:
            return Response([], status=status.HTTP_200_OK)

        compact_param = request.query_params.get("compact")
        fields_param = request.query_params.get("fields")
        compact = (
            str(compact_param).lower() in {"1", "true", "yes"}
            or str(fields_param).lower() in {"compact", "summary", "list"}
        )

        access_scope = "staff" if self._is_privileged(request.user) else "student"
        cache_key = self._problem_cache_key(str(exam.uuid), raw_ids, compact, access_scope)
        if self._cache_enabled():
            try:
                cached = cache.get(cache_key)
            except Exception:
                cached = None
            if cached is not None:
                return Response(cached, status=status.HTTP_200_OK, headers={"X-Cache": "HIT"})

        if compact:
            prefetch_qs = [
                Prefetch(
                    "problem__language",
                    queryset=models.Language.objects.only("id", "language_name"),
                )
            ]
        else:
            prefetch_qs = [
                Prefetch(
                    "problem__language",
                    queryset=models.Language.objects.only("id", "language_name"),
                ),
                Prefetch(
                    "problem__ProblemTemplate_problem",
                    queryset=models.ProblemTemplate.objects.only(
                        "id", "problem_id", "template_name", "template_content"
                    ),
                ),
            ]
            if self._is_privileged(request.user):
                prefetch_qs.append(
                    Prefetch(
                        "problem__ProblemChecker_problem",
                        queryset=models.ProblemChecker.objects.only(
                            "id", "problem_id", "code"
                        ),
                    )
                )

        exam_problems = list(
            self._build_exam_problem_queryset(exam, int_ids, uuid_ids)
            .prefetch_related(*prefetch_qs)
            .order_by("id")
        )
        if not exam_problems:
            return Response([], status=status.HTTP_200_OK)

        payload = self._problem_cache_payload(exam_problems, compact=compact, access_scope=access_scope)

        if self._cache_enabled():
            try:
                cache.set(cache_key, payload, timeout=self._problem_cache_ttl())
            except Exception:
                pass

        return Response(payload, status=status.HTTP_200_OK, headers={"X-Cache": "MISS"})
