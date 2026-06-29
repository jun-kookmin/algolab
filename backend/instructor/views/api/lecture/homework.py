from rest_framework import status, viewsets
from django.conf import settings
from django.core.cache import cache
from django.db import IntegrityError, transaction
from rest_framework.response import Response
from django.contrib.auth import get_user_model
from django.db.models import Count, Exists, Min, OuterRef, Prefetch, Q
from rest_framework.exceptions import ValidationError

from drf_spectacular.utils import extend_schema, OpenApiExample, OpenApiResponse

from api import models
from instructor.soft_delete import soft_delete_section
from ....serializers import homework as serializers
from django.shortcuts import get_object_or_404
from ....permissions import IsInstructorOfLecture, IsAttendStudent
from accounts.permissions import user_in_groups
from variables.groups import GroupEnum

user = get_user_model()
SOLVED_STATUSES = ("CORRECT", "AC", "SV")

@extend_schema(tags=['instructor/homework'])
class LectureSectionViewSet(viewsets.ModelViewSet):

    queryset = models.Section.objects.all()
    serializer_class = serializers.SectionCreateSerializer
    lookup_field = "uuid"
    lookup_url_kwarg = "uuid"

    serializer_map = {
        "list": serializers.SectionSerializer,
        "retrieve": serializers.ProblemInSectionSerializer,
        "create": serializers.SectionCreateSerializer,
        "update": serializers.SectionProblemUpdateSerializer,
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

    def get_serializer_class(self):
        if self._is_student(self.request.user):
            if self.action == "list":
                return serializers.SectionStudentSerializer
            if self.action == "retrieve":
                return serializers.ProblemInSectionStudentSerializer
        return self.serializer_map.get(self.action, super().get_serializer_class())

    def get_permissions(self):
        if self.action in {"create", "update", "partial_update", "destroy"}:
            return [IsInstructorOfLecture()]
        return [IsAttendStudent()]

    def _lecture_uuid(self, kwargs):
        return (
            kwargs.get("lectures_uuid")
            or kwargs.get("lectures_pk")
            or kwargs.get("lecture_pk")
        )

    def _cache_enabled(self) -> bool:
        return getattr(settings, "API_CACHE_ENABLED", True)

    def _cache_ttl(self) -> int:
        return int(getattr(settings, "API_CACHE_LIST_TTL", 20))

    def _cache_version_key(self, lecture_uuid: str) -> str:
        return f"homework-cache-ver:{lecture_uuid}"

    def _cache_version(self, lecture_uuid: str) -> int:
        if not self._cache_enabled():
            return 1
        try:
            value = cache.get(self._cache_version_key(lecture_uuid), 1)
            return int(value or 1)
        except Exception:
            return 1

    def _bump_cache_version(self, lecture_uuid: str) -> None:
        if not self._cache_enabled():
            return
        key = self._cache_version_key(lecture_uuid)
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

    # 강의 내부 섹션 목록 가져오기
    # GET /api/v1/instructor/lectures/{lid}/homework
    def list(self, request, lectures_pk=None, lectures_uuid=None, lecture_pk=None):
        lecture_uuid = self._lecture_uuid(self.kwargs)
        lecture = get_object_or_404(models.Lecture, uuid=lecture_uuid, is_delete=False)
        cache_ver = self._cache_version(lecture_uuid)

        if self._cache_enabled():
            key = f"homework-list:{lecture_uuid}:v{cache_ver}:{getattr(request.user, 'id', 'anon')}:{self._params_key(request)}"
            try:
                cached = cache.get(key)
            except Exception:
                cached = None
            if cached is not None:
                return Response(cached, headers={"X-Cache": "HIT"})

        sections = (
            models.Section.objects
            .filter(lecture=lecture, is_delete=False)
            .annotate(
                problem_count=Count(
                    "SectionProblem_section",
                    filter=Q(SectionProblem_section__is_delete=False),
                    distinct=True,
                )
            )
            .order_by("-id")
        )
        serializer = self.get_serializer(sections, many=True)
        payload = {"homeworks": serializer.data}
        if self._cache_enabled():
            try:
                cache.set(key, payload, timeout=self._cache_ttl())
            except Exception:
                pass
        return Response(payload, headers={"X-Cache": "MISS"})

    # 섹션 내부 문제 구성 가져오기
    # GET /api/v1/instructor/lectures/{lid}/homework/{hid}
    def retrieve(self, request, lectures_pk=None, lectures_uuid=None, lecture_pk=None, uuid=None):
        lecture_uuid = self._lecture_uuid(self.kwargs)
        lecture = get_object_or_404(models.Lecture, uuid=lecture_uuid, is_delete=False)
        section = get_object_or_404(models.Section, uuid=uuid, lecture=lecture, is_delete=False)
        cache_ver = self._cache_version(lecture_uuid)

        if self._cache_enabled():
            key = f"homework-detail:{lecture_uuid}:{uuid}:v{cache_ver}:{getattr(request.user, 'id', 'anon')}:{self._params_key(request)}"
            try:
                cached = cache.get(key)
            except Exception:
                cached = None
            if cached is not None:
                return Response(cached, headers={"X-Cache": "HIT"})

        section_problems = (
            models.SectionProblem.objects
            .filter(section=section, is_delete=False)
            .select_related("problem")
            .prefetch_related(
                Prefetch("language", queryset=models.Language.objects.only("id", "language_name"))
            )
            .only(
                "id",
                "uuid",
                "problem_id",
                "start_date",
                "due_date",
                "problem__id",
                "problem__uuid",
                "problem__problem_name",
            )
            .order_by("id")
        )

        if request.user.is_authenticated:
            base_submit_qs = models.ProblemSubmit.objects.filter(
                user_id=request.user.id,
                section_problem_id=OuterRef("pk"),
            )
            section_problems = section_problems.annotate(
                has_solved=Exists(base_submit_qs.filter(status__in=SOLVED_STATUSES)),
                has_attempt=Exists(base_submit_qs),
                attempt_count=Count(
                    "ProblemSubmit_sectionproblem",
                    filter=Q(
                        ProblemSubmit_sectionproblem__user_id=request.user.id,
                        ProblemSubmit_sectionproblem__is_late=False,
                    ),
                ),
                first_correct_attempt_count=Min(
                    "ProblemSubmit_sectionproblem__judge_count",
                    filter=Q(
                        ProblemSubmit_sectionproblem__user_id=request.user.id,
                        ProblemSubmit_sectionproblem__is_late=False,
                        ProblemSubmit_sectionproblem__status__in=SOLVED_STATUSES,
                    ),
                ),
                all_attempt_count=Count(
                    "ProblemSubmit_sectionproblem",
                    filter=Q(ProblemSubmit_sectionproblem__user_id=request.user.id),
                ),
                all_first_correct_attempt_count=Min(
                    "ProblemSubmit_sectionproblem__judge_count",
                    filter=Q(
                        ProblemSubmit_sectionproblem__user_id=request.user.id,
                        ProblemSubmit_sectionproblem__status__in=SOLVED_STATUSES,
                    ),
                ),
            )
        
        serializer = self.get_serializer(section_problems, many=True)
        if self._is_student(request.user):
            payload = {
                "problems": serializer.data
            }
        else:
            payload = {
                "section_uuid": str(section.uuid),
                "title" : section.section_name,
                "description" : section.description,
                "problems": serializer.data
            }
        if self._cache_enabled():
            try:
                cache.set(key, payload, timeout=self._cache_ttl())
            except Exception:
                pass
        return Response(payload, headers={"X-Cache": "MISS"})

    # 과제 섹션 생성 및 변경
    # PUT /api/v1/instructor/lectures/{lid}/homework/{hid}
    @extend_schema(
        responses={
            204: OpenApiResponse(description="No Content")
        },
        examples=[
            OpenApiExample(
                "Homework request example",
                description="id가 있으면 기존 문제 수정, problem_id가 있으면 새 문제 추가",
                value={
                    "problems": [
                        {
                            "id": 374,
                            "language": [3],
                            "start_date": "2025-09-01T00:00:00Z",
                            "end_date": "2025-09-05T00:00:00Z",
                        },
                        {
                            "problem_id": 5,
                            "language": [1, 3],
                            "start_date": "2025-09-01T00:00:00Z",
                            "end_date": "2025-09-03T00:00:00Z",
                        }
                    ]
                },
            )
        ],
    )
    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            instance = serializer.save()
        except IntegrityError as exc:
            raw_msg = str(exc)
            if "uniq_section_problem_window" in raw_msg:
                raise ValidationError(
                    "동일한 문제/시간 구간이 이미 존재합니다. 중복된 기간의 과제는 하나만 등록 가능합니다."
                ) from exc
            if "sectionproblem_due_gt_start" in raw_msg:
                raise ValidationError("과제 종료일은 시작일보다 늦어야 합니다.") from exc
            if "not null" in raw_msg.lower() and "due_date" in raw_msg:
                raise ValidationError("과제 종료일/시작일 값이 비어 있습니다. 다시 확인해 주세요.") from exc
            raise ValidationError(
                "과제 문제 저장 시 데이터 제약 조건을 위반했습니다. 입력 값을 확인해 주세요."
            ) from exc
        lecture_uuid = self._lecture_uuid(self.kwargs)
        if lecture_uuid:
            self._bump_cache_version(lecture_uuid)
        return Response(status=status.HTTP_204_NO_CONTENT)

    # 과제 섹션 삭제
    # DELETE /api/v1/instructor/lectures/{lid}/homework/{hid}
    @transaction.atomic
    def destroy(self, request, lectures_pk=None, lectures_uuid=None, lecture_pk=None, uuid=None):
        lecture_uuid = self._lecture_uuid(self.kwargs)
        lecture = get_object_or_404(models.Lecture, uuid=lecture_uuid, is_delete=False)
        section = get_object_or_404(models.Section, uuid=uuid, lecture=lecture)

        soft_delete_section(section)
        self._bump_cache_version(lecture_uuid)

        return Response(status=status.HTTP_204_NO_CONTENT)

    def perform_create(self, serializer):
        lecture_uuid = self._lecture_uuid(self.kwargs)
        lecture = get_object_or_404(models.Lecture, uuid=lecture_uuid, is_delete=False)
        try:
            serializer.save(lecture=lecture)
        except IntegrityError:
            raise ValidationError("이미 동일한 섹션 이름이 존재합니다.")
        if lecture_uuid:
            self._bump_cache_version(lecture_uuid)
