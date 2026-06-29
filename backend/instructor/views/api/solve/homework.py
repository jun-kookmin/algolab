from rest_framework import status, viewsets
from rest_framework.response import Response
from django.contrib.auth import get_user_model
from rest_framework.decorators import action
from django.utils import timezone

from drf_spectacular.utils import extend_schema

from api import models
from instructor.serializers.problem import ProblemSolveSerializer, ProblemSolveInstructorSerializer
from django.shortcuts import get_object_or_404
from ....permissions import IsSectionProblemParticipantOrInstructor
from accounts.permissions import user_in_groups
from variables.groups import GroupEnum

user = get_user_model()
ADMIN = GroupEnum.ADMINISTRATOR.value
PROF = GroupEnum.PROFESSOR.value

@extend_schema(tags=['instructor/solve/homework'])
class HomeworkSolveViewSet(viewsets.GenericViewSet):
    permission_classes = [IsSectionProblemParticipantOrInstructor]

    def _is_privileged(self, user_obj):
        return bool(user_obj and user_in_groups(user_obj, ADMIN, PROF))

    def _is_before_start(self, section_problem, user_obj):
        if self._is_privileged(user_obj):
            return False
        start_date = getattr(section_problem, "start_date", None)
        return bool(start_date and timezone.now() < start_date)

    def _is_lecture_closed(self, lecture, user_obj):
        if self._is_privileged(user_obj):
            return False
        end_date = getattr(lecture, "end_date", None)
        return bool(end_date and timezone.now() > end_date)

    # GET /api/v1/instructor/solve/homework/problem/{section_problem_id}/
    @extend_schema(responses=ProblemSolveSerializer)
    @action(detail=False, methods=["get"], url_path=r"problem/(?P<section_problem_id>[^/.]+)")
    def get_homework_problem(self, request, section_problem_id=None):
        prefetches = [
            "problem__language",
            "problem__ProblemTemplate_problem",
        ]
        if self._is_privileged(request.user):
            prefetches.append("problem__ProblemChecker_problem")

        qs = (
            models.SectionProblem.objects
            .select_related("problem", "section", "section__lecture")
            .prefetch_related(*prefetches)
            .filter(is_delete=False, section__lecture__is_delete=False)
        )
        if section_problem_id and section_problem_id.isdigit():
            sp = get_object_or_404(qs, pk=section_problem_id)
        else:
            sp = get_object_or_404(qs, uuid=section_problem_id)
        if self._is_before_start(sp, request.user):
            return Response({"detail": "접근 가능 시간이 아닙니다."}, status=status.HTTP_403_FORBIDDEN)
        problem_serializer = (
            ProblemSolveInstructorSerializer if self._is_privileged(request.user) else ProblemSolveSerializer
        )
        payload = problem_serializer(sp.problem).data
        payload["section_problem_uuid"] = str(sp.uuid)
        payload["section_problem_id"] = str(sp.id)
        payload["due_date"] = sp.due_date.isoformat() if sp.due_date else None
        payload["start_date"] = sp.start_date.isoformat() if getattr(sp, "start_date", None) else None
        payload["server_time"] = timezone.now()
        return Response(payload, status=status.HTTP_200_OK)
