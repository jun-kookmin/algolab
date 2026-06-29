from __future__ import annotations
import os
from django.db import connection, transaction
from django.db.models import Q
from django.db.models.functions import Collate
from django.utils.text import slugify
from django.core.files.storage import default_storage
from rest_framework import status, parsers, viewsets
from rest_framework.response import Response
from drf_spectacular.utils import extend_schema

from api import models
from instructor.serializers import problem as sz
from instructor.views.pagination import CustomPagination
from instructor.filters.problem import ProblemFilter
from instructor.soft_delete import soft_delete_problem
from instructor.constants import (
    TYPE_MAP_IN,
    DIFFICULTY_MAP_IN,
    normalize_language_name,
)
from .. import mixins
from ...permissions import IsAdminOrProfessor, IsProblemOwnerOrAdmin
from accounts.permissions import user_in_groups
from variables.groups import GroupEnum
from rest_framework import filters
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.permissions import IsAuthenticated

ADMIN = GroupEnum.ADMINISTRATOR.value
PROF = GroupEnum.PROFESSOR.value
STUDENT = GroupEnum.STUDENT.value


@extend_schema(tags=["instructor/problem"])
class ProblemViewSet(mixins.ResponseMixin, viewsets.ModelViewSet):
    lookup_field = "uuid"
    lookup_url_kwarg = "uuid"
    parser_classes = (
        parsers.MultiPartParser,
        parsers.FormParser,
        parsers.JSONParser,
    )
    pagination_class = CustomPagination
    ordering_fields = ["problem_name", "difficulty", "created_date"]
    search_fields = ["problem_name", "description"]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter, DjangoFilterBackend]
    filterset_class = ProblemFilter

    def _is_privileged(self, user_obj):
        return bool(user_obj and user_in_groups(user_obj, ADMIN, PROF))

    def get_permissions(self):
        if self.action in {"list", "create"}:
            return [IsAdminOrProfessor()]
        if self.action in {"update", "partial_update", "destroy"}:
            return [IsProblemOwnerOrAdmin()]
        return [IsAuthenticated()]

    def _list_access_filters(self, user):
        if user_in_groups(user, ADMIN):
            return models.Problem.objects.all()

        if user_in_groups(user, PROF):
            section_access = models.SectionProblem.objects.filter(
                is_delete=False,
                section__is_delete=False,
                section__lecture__is_delete=False,
                section__lecture__instructor=user,
            )
            exam_access = models.ExamProblem.objects.filter(
                is_delete=False,
                exam__is_delete=False,
                exam__lecture__is_delete=False,
                exam__lecture__instructor=user,
            )
            return models.Problem.objects.filter(
                Q(maker=user)
                | Q(share=True)
                | Q(id__in=section_access.values("problem_id"))
                | Q(id__in=exam_access.values("problem_id"))
            )

        if user_in_groups(user, STUDENT):
            section_access = models.SectionProblem.objects.filter(
                is_delete=False,
                section__is_delete=False,
                section__lecture__is_delete=False,
                section__lecture__StudentInLecture_lecture__is_delete=False,
                section__lecture__StudentInLecture_lecture__student=user,
            )
            exam_access = models.ExamProblem.objects.filter(
                is_delete=False,
                exam__is_delete=False,
                exam__lecture__is_delete=False,
                exam__lecture__StudentInLecture_lecture__is_delete=False,
                exam__lecture__StudentInLecture_lecture__student=user,
            )
            return models.Problem.objects.filter(
                Q(maker=user)
                | Q(share=True)
                | Q(id__in=section_access.values("problem_id"))
                | Q(id__in=exam_access.values("problem_id"))
            )

        return models.Problem.objects.filter(Q(maker=user) | Q(share=True))

    def _accessible_queryset(self, user):
        if not user or not user.is_authenticated:
            return models.Problem.objects.filter(share=True)

        if user_in_groups(user, ADMIN):
            # 관리자는 공유 여부와 관계없이 모든 문제를 조회할 수 있다.
            return models.Problem.objects.all()

        return self._list_access_filters(user).distinct()

    def get_queryset(self):
        user = self.request.user
        is_privileged = self._is_privileged(user)
        lite_retrieve = (
            self.action == "retrieve"
            and str(self.request.query_params.get("lite", "")).lower() in {"1", "true", "yes"}
        )
        qs = self._accessible_queryset(user)

        if self.action == "retrieve":
            prefetches = ["language"]
            if not lite_retrieve:
                prefetches.append("ProblemTemplate_problem")
            if is_privileged and not lite_retrieve:
                prefetches.append("ProblemChecker_problem")
                prefetches.append("ProblemInOut_problem")
            return (
                qs
                .select_related("maker")
                .prefetch_related(*prefetches)
            )

        if self.action == "list":
            ordering = ["difficulty", "problem_name"]
            if connection.vendor == "postgresql":
                ordering = [
                    "difficulty",
                    Collate("problem_name", "ko-KR-x-icu"),
                ]
            list_fields = [
                "id",
                "uuid",
                "maker_id",
                "maker__username",
                "maker__first_name",
                "maker__last_name",
                "problem_name",
                "difficulty",
                "type",
            ]
            if is_privileged:
                list_fields.append("share")

            return (
                qs.select_related("maker")
                .prefetch_related("language")
                .only(*list_fields)
                .order_by(*ordering)
            )

        return (
            qs.select_related("maker")
            .prefetch_related(
                "language",
                "ProblemTemplate_problem",
            )
        )

    serializer_action_map = {
        "list": sz.ProblemListSerializer,
        "retrieve": sz.ProblemDetailSerializer,
        "update": sz.ProblemCreateUpdateSerializer,
        "partial_update": sz.ProblemCreateUpdateSerializer,
    }

    def get_serializer_class(self):
        if self.action == "list":
            return (
                sz.ProblemListSerializer
                if self._is_privileged(self.request.user)
                else sz.ProblemListPublicSerializer
            )
        if self.action == "retrieve":
            if str(self.request.query_params.get("lite", "")).lower() in {"1", "true", "yes"}:
                return sz.ProblemPreviewSerializer
            return (
                sz.ProblemDetailSerializer
                if self._is_privileged(self.request.user)
                else sz.ProblemSolveSerializer
            )
        return self.serializer_action_map.get(
            self.action,
            sz.ProblemSolveSerializer,
        )

    # POST /api/v1/instructor/problems
    @transaction.atomic

    def create(self, request, *args, **kwargs):
        payload_ser = sz.ProblemPostPayloadSerializer(data=request.data)
        payload_ser.is_valid(raise_exception=True)
        pd = payload_ser.validated_data["problemData"]

        problem = models.Problem.objects.create(
            maker=request.user,
            problem_name=pd["title"],
            description=pd["description"],
            type=TYPE_MAP_IN[pd["type"]],
            difficulty=DIFFICULTY_MAP_IN[pd["difficulty"]],
            limit_time=pd["limit_time"],
            limit_memory=pd["limit_memory"],
            share=pd.get("share", False),
        )

        # 언어 값은 0/1/2/3, "c", "cpp", "python", "java",
        # "C++" 같은 표기, 또는 문자열 인덱스를 모두 받아 정규화한다.
        lang_names = []
        for item in pd.get("languages", []):
            name = normalize_language_name(item)
            if name is not None:
                lang_names.append(name)
        # 중복/빈 값은 제거
        lang_names = list(dict.fromkeys(lang_names))
        langs = list(models.Language.objects.filter(language_name__in=lang_names))
        problem.language.set(langs)

        for block in pd["template_codes"]:
            key = block["language"]
            db_name = normalize_language_name(key)
            if not db_name:
                continue
            lang_obj = models.Language.objects.filter(
                language_name=db_name
            ).first()
            if not lang_obj:
                continue
            for f in block["files"]:
                models.ProblemTemplate.objects.create(
                    problem=problem,
                    template_name=f["filename"],
                    template_content=f["content"],
                )

        checker = (pd.get("checker_code") or "").strip()
        if problem.type == "PC" and checker:
            models.ProblemChecker.objects.create(
                problem=problem, name="checker.py", code=checker
            )

        for tc in pd.get("testcases", []):
            inp = tc.get("input")
            out = tc.get("output")
            if not inp and not out:
                continue
            if inp is None:
                in_txt = ""
            else:
                in_txt = inp.get("content", "")
            if out is None:
                out_txt = ""
            else:
                out_txt = out.get("content", "")
            models.ProblemInOut.objects.create(
                problem=problem,
                input_code=in_txt,
                output_code=out_txt,
                # index는 DB 컬럼이 별도 없고 id 기반 관리
            )

        pdf_files = []
        for k in request.FILES.keys():
            if k.lower().endswith("pdffile") or "pdffile" in k.lower():
                pdf_files.extend(request.FILES.getlist(k))
        if pdf_files:
            up = pdf_files[0]
            base = slugify(os.path.splitext(up.name)[0]) or f"problem-{problem.id}"
            filename = f"{problem.id}-{base}.pdf"
            rel_path = os.path.join("uploads", "problems", filename).replace(
                "\\", "/"
            )
            saved_path = default_storage.save(rel_path, up)
            problem.pdf_path = "/" + saved_path.replace("\\", "/")
            problem.save(update_fields=["pdf_path"])

        data = sz.ProblemDetailSerializer(problem).data
        return Response(data, status=status.HTTP_201_CREATED)

    # PATCH /api/v1/instructor/problems/{id}
    @transaction.atomic
    def partial_update(self, request, *args, **kwargs):
        return super().partial_update(request, *args, **kwargs)

    # PUT /api/v1/instructor/problems/{id}
    @transaction.atomic
    def update(self, request, *args, **kwargs):
        return super().update(request, *args, **kwargs)

    # DELETE /api/v1/instructor/problems/{id}
    @transaction.atomic
    def destroy(self, request, *args, **kwargs):
        return super().destroy(request, *args, **kwargs)

    def perform_update(self, serializer):
        instance = serializer.save()
        return instance

    def perform_destroy(self, instance):
        soft_delete_problem(instance)
