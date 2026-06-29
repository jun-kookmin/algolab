from __future__ import annotations

from django.db import transaction
from django.shortcuts import get_object_or_404
from django.contrib.auth import get_user_model
from django.conf import settings
from django.core.cache import cache
from django.db.models import Count, Q

from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.filters import OrderingFilter
from rest_framework.response import Response

from drf_spectacular.utils import (
    extend_schema,
    OpenApiResponse,
    OpenApiTypes,
    OpenApiExample,
    )

from api import models
from instructor.soft_delete import soft_delete_exam, soft_delete_exam_problems

from ....serializers import exam as sz
from ....constants import language_index
from ...pagination import examPagination
from ....permissions import IsInstructorOfLecture, IsAttendStudent
from accounts.permissions import user_in_groups
from variables.groups import GroupEnum

user = get_user_model()


@extend_schema(
    tags=['exam'],
        description="특정 시험 상세 조회",
        responses={
            200: OpenApiResponse(
                response=OpenApiTypes.OBJECT,
                examples=[
                    OpenApiExample(
                        "성공 예시",
                        value={
                            "exam_id": 1,
                            "title": "중간고사",
                            "start_date": "2025-10-01T09:00:00+09:00",
                            "due_date": "2025-10-01T11:00:00+09:00",
                            "problems": [
                                {
                                    "id": 10,
                                    "title": "Python 예제문제1",
                                    "language": [0, 2],
                                    "score": 100,
                                },
                                {
                                    "id": 11,
                                    "title": "C++ 예제문제2",
                                    "language": [1],
                                    "score": 80,
                                },
                            ],
                        },
                    )
                ],
            )
        },
    )
class LectureExamViewSet(viewsets.ModelViewSet):
    pagination_class = examPagination
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    ordering_fields = ["id", "exam_name", "created_date"]
    ordering = ["id"]
    lookup_field = "uuid"
    lookup_url_kwarg = "uuid"

    serializer_class = sz.ExamSerializer
    serializer_action_map = {
        "list": sz.ExamSerializer,
        "retrieve": sz.ExamDetailSerializer,
        "create": sz.ExamSectionCreateSerializer,
        "update": sz.ExamDetailSerializer,
        "partial_update": sz.ExamDetailSerializer,
    }

    def _is_privileged(self, user):
        return bool(
            user
            and user_in_groups(
                user,
                GroupEnum.ADMINISTRATOR.value,
                GroupEnum.PROFESSOR.value,
            )
        )

    def _is_student(self, user):
        return bool(
            user
            and user_in_groups(user, GroupEnum.STUDENT.value)
            and not self._is_privileged(user)
        )

    def _role_cache_key(self, user) -> str:
        return "student" if self._is_student(user) else "staff"

    def get_serializer_class(self):
        if self.action == "list" and self._is_student(self.request.user):
            return sz.ExamStudentListSerializer
        return self.serializer_action_map.get(self.action, self.serializer_class)

    def get_permissions(self):
        if self.action in {"create", "update", "partial_update", "destroy", "update_problems"}:
            return [IsInstructorOfLecture()]
        return [IsAttendStudent()]

    def _lecture_pk(self, kwargs):
        return (
            kwargs.get("lectures_uuid")
            or kwargs.get("lecture_uuid")
            or kwargs.get("lecture_pk")
            or kwargs.get("lectures_pk")
        )

    def _get_lecture(self, lecture_uuid):
        return get_object_or_404(models.Lecture, uuid=lecture_uuid, is_delete=False)

    def _cache_enabled(self) -> bool:
        return getattr(settings, "API_CACHE_ENABLED", True)

    def _cache_ttl(self) -> int:
        return int(getattr(settings, "API_CACHE_LIST_TTL", 20))

    def _cache_version_key(self, lecture_pk: str) -> str:
        return f"exam-cache-ver:{lecture_pk}"

    def _cache_version(self, lecture_pk: str) -> int:
        if not self._cache_enabled():
            return 1
        try:
            value = cache.get(self._cache_version_key(lecture_pk), 1)
            return int(value or 1)
        except Exception:
            return 1

    def _bump_cache_version(self, lecture_pk: str) -> None:
        if not self._cache_enabled():
            return
        key = self._cache_version_key(lecture_pk)
        try:
            current = int(cache.get(key, 1) or 1)
            cache.set(key, current + 1, timeout=None)
        except Exception:
            pass

    def _params_key(self, request) -> str:
        params = []
        for key in sorted(request.query_params.keys()):
            for val in request.query_params.getlist(key):
                params.append(f"{key}={val}")
        return "&".join(params)

    def get_queryset(self):
        lecture_pk = self._lecture_pk(self.kwargs)
        qs = models.Exam.objects.select_related("lecture")
        if lecture_pk:
            lecture = self._get_lecture(lecture_pk)
            qs = qs.filter(lecture=lecture)
        if self.action == "list":
            qs = qs.annotate(
                problem_count=Count(
                    "ExamProblem_exam",
                    filter=Q(ExamProblem_exam__is_delete=False),
                    distinct=True,
                )
            )
        return qs

    def perform_create(self, serializer):
        lecture_pk = self._lecture_pk(self.kwargs)
        lecture = self._get_lecture(lecture_pk)
        serializer.save(lecture=lecture)
        
    def create(self, request, *args, **kwargs):
        lecture_pk = self._lecture_pk(kwargs)
        lecture = self._get_lecture(lecture_pk)

        serializer = sz.ExamSectionCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        exam = serializer.save(lecture=lecture)

        response_data = {
            "exam_uuid": str(exam.uuid),
            "title": exam.exam_name,
            "start_date": exam.start_date,
            "due_date": exam.due_date,
            "problems": []
        }
        self._bump_cache_version(lecture_pk)
        return Response(response_data, status=status.HTTP_201_CREATED)    

    # GET api/v1/instructor/lectures/{lecture_pk}/exams/
    def list(self, request, *args, **kwargs):
        lecture_pk = self._lecture_pk(kwargs)
        self._get_lecture(lecture_pk)
        cache_ver = self._cache_version(lecture_pk)

        if self._cache_enabled():
            key = (
                f"exam-list:{lecture_pk}:v{cache_ver}:"
                f"{getattr(request.user, 'id', 'anon')}:{self._role_cache_key(request.user)}:"
                f"{self._params_key(request)}"
            )
            try:
                cached = cache.get(key)
            except Exception:
                cached = None
            if cached is not None:
                return Response(cached, headers={"X-Cache": "HIT"})

        queryset = self.filter_queryset(self.get_queryset())
        page = self.paginate_queryset(queryset)
        ser = self.get_serializer(page, many=True)
        resp = self.get_paginated_response(ser.data)
        payload = resp.data
        if self._cache_enabled():
            try:
                cache.set(key, payload, timeout=self._cache_ttl())
            except Exception:
                pass
        return Response(payload, headers={"X-Cache": "MISS"})

    # GET api/v1/instructor/lectures/{lecture_pk}/exams/{pk}
    def retrieve(self, request, *args, **kwargs):
        lecture_pk = self._lecture_pk(kwargs)
        lecture = self._get_lecture(lecture_pk)
        cache_ver = self._cache_version(lecture_pk)
        exam = get_object_or_404(
            models.Exam.objects.select_related("lecture"),
            uuid=kwargs.get(self.lookup_url_kwarg),
            lecture=lecture,
        )

        if self._cache_enabled():
            key = (
                f"exam-detail:{lecture_pk}:{exam.uuid}:v{cache_ver}:"
                f"{getattr(request.user, 'id', 'anon')}:{self._role_cache_key(request.user)}:"
                f"{self._params_key(request)}"
            )
            try:
                cached = cache.get(key)
            except Exception:
                cached = None
            if cached is not None:
                return Response(cached, headers={"X-Cache": "HIT"})

        exam_title = getattr(exam, "exam_name", "")
        eps = (
            models.ExamProblem.objects
            .select_related("problem")
            .prefetch_related("problem__language")
            .filter(exam=exam)
            .order_by("id")
        )

        problems = []
        for ep in eps:
            p = ep.problem
            if self._is_student(request.user):
                problems.append({
                    "exam_problem_uuid": str(ep.uuid),
                })
                continue

            lang_names = [lang.language_name for lang in p.language.all()]
            lang_idxs = [
                language_index(name)
                for name in lang_names
                if language_index(name) is not None
            ]
            problems.append({
                "exam_problem_uuid": str(ep.uuid),
                "problem_uuid" : str(p.uuid),
                "title": p.problem_name,
                "language": lang_idxs,
                "score": ep.score or 100,
            })

        payload = {
            "exam_uuid": str(exam.uuid),
            "title": exam_title,
            "start_date": exam.start_date,
            "due_date": exam.due_date,
            "problems": problems,
        }
        if self._cache_enabled():
            try:
                cache.set(key, payload, timeout=self._cache_ttl())
            except Exception:
                pass
        return Response(payload, status=status.HTTP_200_OK, headers={"X-Cache": "MISS"})

    # DELETE api/v1/instructor/lectures/{lid}/exams/{pk}
    @transaction.atomic
    def destroy(self, request, *args, **kwargs):
        lecture_pk = self._lecture_pk(kwargs)
        lecture = self._get_lecture(lecture_pk)
        exam = get_object_or_404(models.Exam, uuid=kwargs.get(self.lookup_url_kwarg), lecture=lecture)
        soft_delete_exam(exam)
        self._bump_cache_version(lecture_pk)
        return Response(status=status.HTTP_204_NO_CONTENT)
    
    # POST /api/v1/instructor/lectures/{lid}/exams/{eid}/problems/    
    @action(detail=True, methods=["post", "put"], url_path="problems")
    @transaction.atomic
    def update_problems(self, request, *args, **kwargs):
        lecture_pk = self._lecture_pk(kwargs)
        lecture = self._get_lecture(lecture_pk)
        exam_uuid = kwargs.get(self.lookup_url_kwarg)

        exam = get_object_or_404(models.Exam, uuid=exam_uuid, lecture=lecture)

        serializer = sz.ExamProblemCreateSerializer(data=request.data, many=True)
        serializer.is_valid(raise_exception=True)

        requested_problem_ids = [item["problem"].id for item in serializer.validated_data]

        results = []
        for item in serializer.validated_data:
            problem_obj = item["problem"]
            score = item.get("score", 100)

            ep, created = models.ExamProblem.objects.get_or_create(
                exam=exam,
                problem=problem_obj,
                defaults={"score": score},
            )
            if not created and ep.score != score:
                ep.score = score
                ep.save(update_fields=["score"])

            results.append({
                "exam_problem_uuid": str(ep.uuid),                 
                "problem_uuid": str(problem_obj.uuid),  
                "title": problem_obj.problem_name,
                "score": ep.score,
            })

        soft_delete_exam_problems(
            models.ExamProblem.objects.filter(exam=exam).exclude(
                problem_id__in=requested_problem_ids
            )
        )
        self._bump_cache_version(lecture_pk)

        return Response({
            "exam_id": exam.id,
            "results": results,
        }, status=status.HTTP_200_OK)

    def perform_update(self, serializer):
        instance = serializer.save()
        lecture_pk = self._lecture_pk(self.kwargs)
        if lecture_pk:
            self._bump_cache_version(lecture_pk)
        return instance
