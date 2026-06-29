from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from api import models
from django.contrib.auth import get_user_model
from django.db.models import Value, IntegerField
from django.db.models.functions import Length, Coalesce
from ....constants import language_index
from ....permissions import IsSelfOrPrivileged
from accounts.permissions import (
    user_can_open_submission_target,
    user_in_groups,
    user_is_student_only,
)
from variables.groups import GroupEnum

user = get_user_model()


class UnifiedSubmissionViewSet(viewsets.ViewSet):
    non_student_target_message = "학생 계정만 조회할 수 있습니다."

    def _display_name(self, user_obj):
        if not user_obj:
            return ""
        try:
            full_name = user_obj.get_full_name()
        except Exception:
            full_name = ""
        full_name = (full_name or "").strip()
        if full_name:
            return full_name
        return getattr(user_obj, "username", "") or ""

    def _is_student_only(self, user):
        return user_is_student_only(user)

    def _get_target_user(self, user_id):
        return (
            user.objects
            .prefetch_related("groups")
            .filter(id=user_id)
            .first()
        )

    def _validate_target_user(self, request, user_obj):
        if user_obj is None:
            return Response({"detail": "해당 유저가 존재하지 않습니다."}, status=404)
        if not user_can_open_submission_target(request.user, user_obj):
            return Response({"detail": self.non_student_target_message}, status=403)
        return None

    def get_permissions(self):
        if self.action == "get_user_submissions":
            return [IsAuthenticated()]
        return [IsSelfOrPrivileged()]

    def _can_view_submission_code(self, request, user_id) -> bool:
        if not getattr(request.user, "is_authenticated", False):
            return False
        if user_in_groups(
            request.user,
            GroupEnum.ADMINISTRATOR.value,
            GroupEnum.PROFESSOR.value,
        ):
            return True
        return str(request.user.id) == str(user_id)

    @action(detail=False, methods=["get"], url_path="user/(?P<user_id>[^/.]+)")
    def get_user_submissions(self, request, user_id=None):
        target_user = self._get_target_user(user_id)
        invalid_target_response = self._validate_target_user(request, target_user)
        if invalid_target_response is not None:
            return invalid_target_response

        requested_include_code = str(request.query_params.get("include_code", "")).lower() in {
            "1",
            "true",
            "yes",
        }
        include_code = requested_include_code and self._can_view_submission_code(request, user_id)
        student_only = self._is_student_only(request.user)
        code_length_expr = Coalesce(Length("code"), Value(0), output_field=IntegerField())

        exam_fields = [
            "uuid",
            "score",
            "submission_time",
            "status",
            "execution_time",
            "memory",
            "submission_count",
            "judge_count",
            "problem_id",
            "problem__uuid",
            "problem__problem__uuid",
            "problem__problem__problem_name",
        ]
        if include_code:
            exam_fields.append("code")

        exam_submits = (
            models.ExamSubmit.objects
            .select_related("problem__problem")
            .prefetch_related("language")
            .filter(user_id=user_id)
            .only(*exam_fields)
            .annotate(code_length=code_length_expr)
        )

        exam_rows = []
        for e in exam_submits:
            row = {
                "uuid": str(e.uuid),
                "username": getattr(target_user, "username", "") or "",
                "student_number": getattr(target_user, "username", "") or "",
                "display_name": self._display_name(target_user),
                "title": e.problem.problem.problem_name,
                "score": e.score,
                "attempt_count": e.submission_count,
                "status": e.status,
                "language": [language_index(l.language_name) for l in e.language.all() if language_index(l.language_name) is not None],
                "execution_time": e.execution_time,
                "submission_time": e.submission_time,
                "memory": e.memory,
                "code_length": int(getattr(e, "code_length", 0) or 0),
            }
            if not student_only:
                row["problem_uuid"] = str(e.problem.problem.uuid)
                row["exam_problem_uuid"] = str(e.problem.uuid)
                row["ju_count"] = e.judge_count
            else:
                row["problem_uuid"] = str(e.problem.problem.uuid)
                row["exam_problem_uuid"] = str(e.problem.uuid)
            if include_code:
                row["code"] = e.code
            exam_rows.append(row)

        hw_fields = [
            "uuid",
            "score",
            "submission_time",
            "status",
            "execution_time",
            "memory",
            "submission_count",
            "judge_count",
            "section_problem_id",
            "section_problem__uuid",
            "section_problem__problem__uuid",
            "section_problem__problem__problem_name",
        ]
        if include_code:
            hw_fields.append("code")

        hw_submits = (
            models.ProblemSubmit.objects
            .select_related("section_problem__problem")
            .prefetch_related("language")
            .filter(user_id=user_id)
            .only(*hw_fields)
            .annotate(code_length=code_length_expr)
        )

        hw_rows = []
        for h in hw_submits:
            row = {
                "uuid": str(h.uuid),
                "username": getattr(target_user, "username", "") or "",
                "student_number": getattr(target_user, "username", "") or "",
                "display_name": self._display_name(target_user),
                "title": h.section_problem.problem.problem_name,
                "score": h.score,
                "attempt_count": h.submission_count,
                "status": h.status,
                "language": [language_index(l.language_name) for l in h.language.all() if language_index(l.language_name) is not None],
                "execution_time": h.execution_time,
                "submission_time": h.submission_time,
                "memory": h.memory,
                "code_length": int(getattr(h, "code_length", 0) or 0),
            }
            if not student_only:
                row["problem_uuid"] = str(h.section_problem.problem.uuid)
                row["section_problem_uuid"] = str(h.section_problem.uuid)
                row["ju_count"] = h.judge_count
            if include_code:
                row["code"] = h.code
            hw_rows.append(row)

        rows = exam_rows + hw_rows
        rows.sort(key=lambda x: x["submission_time"], reverse=True)

        return Response(rows)

    @action(detail=False, methods=["get"], url_path="user/(?P<user_id>[^/.]+)/code/(?P<submission_uuid>[^/.]+)")
    def get_user_submission_code(self, request, user_id=None, submission_uuid=None):
        if not user_id or not submission_uuid:
            return Response({"detail": "invalid request"}, status=400)

        target_user = self._get_target_user(user_id)
        invalid_target_response = self._validate_target_user(request, target_user)
        if invalid_target_response is not None:
            return invalid_target_response

        exam = (
            models.ExamSubmit.objects
            .select_related("problem__problem")
            .prefetch_related("language")
            .filter(uuid=submission_uuid, user_id=user_id)
            .first()
        )
        if exam:
            payload = {
                "uuid": str(exam.uuid),
                "code": exam.code,
                "language": [language_index(l.language_name) for l in exam.language.all() if language_index(l.language_name) is not None],
                "execution_time": exam.execution_time,
                "submission_time": exam.submission_time,
                "memory": exam.memory,
                "score": exam.score,
                "code_length": len(exam.code.encode("utf-8")) if exam.code else 0,
            }
            if not self._is_student_only(request.user):
                payload["kind"] = "exam"
                payload["status"] = exam.status
            return Response(payload)

        hw = (
            models.ProblemSubmit.objects
            .select_related("section_problem__problem")
            .prefetch_related("language")
            .filter(uuid=submission_uuid, user_id=user_id)
            .first()
        )
        if hw:
            payload = {
                "uuid": str(hw.uuid),
                "code": hw.code,
                "language": [language_index(l.language_name) for l in hw.language.all() if language_index(l.language_name) is not None],
                "execution_time": hw.execution_time,
                "submission_time": hw.submission_time,
                "memory": hw.memory,
                "score": hw.score,
                "code_length": len(hw.code.encode("utf-8")) if hw.code else 0,
            }
            if not self._is_student_only(request.user):
                payload["kind"] = "homework"
                payload["status"] = hw.status
            return Response(payload)

        return Response({"detail": "제출 내역이 없습니다."}, status=404)
