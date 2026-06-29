from rest_framework import parsers, status, viewsets
from django.conf import settings
from django.core.cache import cache
from django.utils import timezone
import uuid as uuid_lib
from rest_framework.decorators import action
from rest_framework.response import Response
from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Q, Count, F, Prefetch, CharField
from django.db.models.functions import Concat
import csv
import io

from drf_spectacular.utils import extend_schema
from rest_framework.parsers import JSONParser

from api import models
from instructor.soft_delete import soft_delete_lecture
from ....serializers import lecture as serializers
# from instructor.views.pagination import CustomPagination
from ... import mixins
from django.shortcuts import get_object_or_404
from django.http import Http404
from rest_framework.exceptions import ValidationError
from ....permissions import IsInstructorOfLecture, IsAttendStudent, IsAdminOrProfessor
from accounts.permissions import user_in_groups
from variables.groups import GroupEnum
from rest_framework.permissions import IsAuthenticated
from ...pagination import CustomPagination

user = get_user_model()


def get_user_role(user, request):
    if user_in_groups(user, GroupEnum.ADMINISTRATOR.value):
        return GroupEnum.ADMINISTRATOR.value.lower()
    if user_in_groups(user, GroupEnum.PROFESSOR.value):
        return GroupEnum.PROFESSOR.value.lower()
    if user_in_groups(user, GroupEnum.STUDENT.value):
        return GroupEnum.STUDENT.value.lower()
    group = getattr(user, "group", None)
    if group:
        return str(group).lower()
    user_group = user.groups.first()
    return user_group.name.lower() if user_group else None


@extend_schema(tags=['instructor-lecture'])
class LectureViewSet(mixins.ResponseMixin, viewsets.ModelViewSet):
    queryset = models.Lecture.objects.select_related(
        'instructor',
    ).all()

    parser_classes = (parsers.MultiPartParser, JSONParser)
    serializer_class = serializers.LectureSerializer
    pagination_class = CustomPagination
    # filter_backends = [DjangoFilterBackend, OrderingFilter]
    # filterset_class = LectureFilter
    # ordering_fields = ['name', 'created_date', 'start_date']
    lookup_field = 'uuid'
    lookup_url_kwarg = 'uuid'

    def get_serializer_class(self):
        role = get_user_role(self.request.user, self.request)
        if self.action == "list":
            if role == "student":
                return serializers.LectureListStudentSerializer
            return serializers.LectureListCompactSerializer
        if self.action == "retrieve":
            if role == "student":
                return serializers.LectureStudentDetailSerializer
        return super().get_serializer_class()

    def _parse_members_payload(self, request):
        """
        JSON 본문 또는 업로드된 CSV 파일을 멤버 리스트로 변환한다.
        CSV 헤더는 student_id / student_code / username / 학번 / id 중 하나를 지원한다.
        """
        # 업로드된 파일이 하나라도 있으면 CSV로 간주
        file_obj = None
        if request.FILES:
            # 일반적으로 'file' 또는 'upload' 필드를 사용하지만, 첫 번째 파일을 사용해도 무방
            first_key = next(iter(request.FILES.keys()))
            file_obj = request.FILES.get("file") or request.FILES.get("upload") or request.FILES[first_key]
        if not file_obj:
            # replace 플래그는 별도로 처리하고, serializer에는 전달하지 않도록 제거
            payload = dict(request.data)
            payload.pop("replace", None)
            return payload, False

        raw = file_obj.read()
        decoded = None
        for enc in ("utf-8-sig", "cp949"):
            try:
                decoded = raw.decode(enc)
                break
            except Exception:
                continue
        if decoded is None:
            raise ValidationError("CSV 파일을 읽을 수 없습니다.")

        reader = csv.DictReader(io.StringIO(decoded))
        members = []
        for row in reader:
            normalized = { (k or "").strip().lower(): v for k, v in row.items() }
            sid = (
                normalized.get("student_id")
                or normalized.get("student_code")
                or normalized.get("username")
                or normalized.get("학번")
                or normalized.get("id")
                or normalized.get("user_id")
            )
            if sid is None:
                continue
            sid_str = str(sid).strip()
            if sid_str:
                members.append({"student_id": sid_str})

        if not members:
            raise ValidationError("CSV에서 학번을 찾을 수 없습니다.")

        return {"members": members}, True

    def get_queryset(self):
        qs = super().get_queryset().filter(is_delete=False)
        current_user = self.request.user
        role = get_user_role(current_user, self.request)

        if role == "administrator":
            pass 
        elif role == "professor":
            qs = qs.filter(instructor=current_user)
        elif role == "student":
            qs = qs.filter(
                StudentInLecture_lecture__student=current_user,
                StudentInLecture_lecture__is_delete=False
            ).distinct()
        else:
            qs = qs.none()

        lang_link_qs = (
            models.LanguageInLecture.objects
            .filter(is_delete=False)
            .select_related("language")
        )
        qs = qs.prefetch_related(
            Prefetch(
                "LanguageInLecture_lecture",
                queryset=lang_link_qs,
                to_attr="prefetched_lang_links",
            )
        )
        return qs.annotate(
            section_count=Count(
                'Section_lecture',
                filter=Q(Section_lecture__is_delete=False),
                distinct=True
            ),
            problem_count=Count(
                'Section_lecture__SectionProblem_section',
                filter=Q(Section_lecture__SectionProblem_section__is_delete=False),
                distinct=True
            )
        )
    
    def get_permissions(self):
        # PATCH 요청은 DRF에서 `partial_update` 액션으로 처리된다.
        # 기존 조건은 `partial_update`를 빠뜨려 PATCH가 IsAuthenticated()로 내려가
        # 수강생도 자신이 수강 중인 강의 메타데이터를 수정할 수 있었어서 함께 묶는다.
        # if self.action in ["update", "destroy", "manage_members", "manage_member_detail"]:
        if self.action in ["update", "partial_update", "destroy", "manage_members", "manage_member_detail"]:
            return [IsInstructorOfLecture()]

        if self.action == "create":
            return [IsAdminOrProfessor()]

        if self.action == "retrieve":
            return [IsAttendStudent()]

        if self.action == "list":
            return [IsAuthenticated()]

        return [IsAuthenticated()]

    def _cache_enabled(self) -> bool:
        return getattr(settings, "API_CACHE_ENABLED", True)

    def _cache_ttl(self) -> int:
        return int(getattr(settings, "API_CACHE_LIST_TTL", 20))

    def _cache_version_key(self) -> str:
        return "lecture-list-cache-ver"

    def _cache_version(self) -> int:
        if not self._cache_enabled():
            return 1
        try:
            value = cache.get(self._cache_version_key(), 1)
            return int(value or 1)
        except Exception:
            return 1

    def _bump_cache_version(self) -> None:
        if not self._cache_enabled():
            return
        try:
            current = int(cache.get(self._cache_version_key(), 1) or 1)
            cache.set(self._cache_version_key(), current + 1, timeout=None)
        except Exception:
            pass

    def _params_key(self, request) -> str:
        params = []
        for key in sorted(request.query_params.keys()):
            for val in request.query_params.getlist(key):
                params.append(f"{key}={val}")
        return "&".join(params)

    def _invalidate_members_cache(self, lecture_uuid, request):
        if not self._cache_enabled():
            return
        if not lecture_uuid:
            return
        user_key = getattr(request.user, "id", "anon")
        base_prefix = f"lecture-members:{lecture_uuid}:{user_key}:"
        try:
            cache.delete_pattern(f"{base_prefix}*")
        except Exception:
            params_key = self._params_key(request)
            exact_key = f"{base_prefix}{params_key}"
            try:
                cache.delete(exact_key)
            except Exception:
                pass

    def _cache_key(self, request, suffix: str) -> str:
        user_id = getattr(request.user, "id", "anon")
        return f"lecture-{suffix}:v{self._cache_version()}:{user_id}:{self._params_key(request)}"

    @extend_schema(description="강의 생성")
    def create(self, request, *args, **kwargs):
        response = super().create(request, *args, **kwargs)
        if response.status_code in {status.HTTP_200_OK, status.HTTP_201_CREATED}:
            self._bump_cache_version()
        return response

    def perform_update(self, serializer):
        instance = serializer.save()
        self._bump_cache_version()
        return instance

    @extend_schema(description="강의 삭제")
    @transaction.atomic
    def destroy(self, request, *args, **kwargs):
        lecture_uuid = kwargs.get(self.lookup_url_kwarg)
        lecture = get_object_or_404(
            models.Lecture,
            uuid=lecture_uuid,
            is_delete=False,
        )
        soft_delete_lecture(lecture)

        self._bump_cache_version()
        return Response(status=status.HTTP_204_NO_CONTENT)


    # GET /api/v1/instructor/lectures
    def list(self, request, *args, **kwargs):
        if self._cache_enabled():
            key = self._cache_key(request, "list")
            try:
                cached = cache.get(key)
            except Exception:
                cached = None
            if cached is not None:
                return Response(cached, headers={"X-Cache": "HIT"})

        queryset = self.get_queryset()
        status_filter = request.query_params.get("status", "").lower()
        now = timezone.now()

        if status_filter in {"current", "active"}:
            queryset = queryset.filter(start_date__lte=now, end_date__gte=now)
        elif status_filter == "done":
            queryset = queryset.filter(end_date__lt=now).order_by("-end_date")

        wants_all = str(request.query_params.get("all", "")).lower() in {"1", "true", "yes"}
        if wants_all:
            serializer = self.get_serializer(queryset, many=True)
            payload_count = len(serializer.data)
            payload = {
                "total": payload_count,
                "size": payload_count,
                "data": serializer.data
            }
        else:
            page = self.paginate_queryset(queryset)
            if page is not None:
                serializer = self.get_serializer(page, many=True)
                resp = self.get_paginated_response(serializer.data)
                payload = resp.data
            else:
                serializer = self.get_serializer(queryset, many=True)
                count = queryset.count()
                payload = {
                    "total": count,
                    "size": count,
                    "data": serializer.data
                }

        if self._cache_enabled():
            try:
                cache.set(key, payload, timeout=self._cache_ttl())
            except Exception:
                pass
        return Response(payload, headers={"X-Cache": "MISS"})

    # GET /api/v1/instructor/lectures/{lid}
    def retrieve(self, request, *args, **kwargs):
        if self._cache_enabled():
            lecture_uuid = kwargs.get(self.lookup_url_kwarg)
            key = f"lecture-detail:{lecture_uuid}:{getattr(request.user, 'id', 'anon')}:{self._params_key(request)}"
            try:
                cached = cache.get(key)
            except Exception:
                cached = None
            if cached is not None:
                return Response(cached, headers={"X-Cache": "HIT"})

        instance = self.get_object()
        serializer = self.get_serializer(instance)
        payload = serializer.data
        if self._cache_enabled():
            try:
                cache.set(key, payload, timeout=self._cache_ttl())
            except Exception:
                pass
        return Response(payload, headers={"X-Cache": "MISS"})

    # /api/v1/instructor/lectures/{lid}/members/
    @extend_schema(
        request={
            "application/json": {
                "type": "object",
                "properties": {
                    "members": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "student_id": {
                                    "type": "string",
                                    "example": "STUDENT001"
                                }
                            },
                            "required": ["student_id"]
                        }
                    }
                },
                "required": ["members"]
            }
        },
        description="""
            - GET: 멤버 목록 조회 (200 Ok)
            - POST: 멤버 추가 (201 Created, 실패 시 404 not_found_users)
            - PUT: 멤버 갱신 (204 No Content, 실패 시 404 not_found_users)
        """,
        responses={
            200: {
                "type": "object",
                "properties": {
                    "total": {"type": "integer", "example": 2},
                    "page": {"type": "integer", "example": 1},
                    "size": {"type": "integer", "example": 10},
                    "members": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "user_id": {"type": "integer", "example": 1001},
                                "name": {"type": "string", "example": "Student A"},
                                "role": {"type": "string", "example": "PROFESSOR"},
                                "joined_at": {
                                    "type": "string",
                                    "format": "date-time",
                                    "example": "2025-07-20T15:30:00Z"
                                },
                            }
                        }
                    }
                }
            },
            404: {
                "type": "object",
                "properties": {
                    "not_found_users": {
                        "type": "array",
                        "items": {"type": "string", "example": "STUDENT002"}
                    }
                }
            },
            204: None,  # no content
        },
        methods=['PUT', 'GET', 'POST'],
    )
    @action(detail=True, methods=['get', 'put', 'post'], url_path='members')
    def manage_members(self, request, uuid=None):
        lecture = get_object_or_404(models.Lecture, uuid=uuid, is_delete=False)
        queryset = (
            models.StudentInLecture.objects
            .select_related('student')
            .filter(lecture=lecture, is_delete=False)
            .only(
                "id",
                "uuid",
                "role",
                "student_code",
                "is_delete",
                "student__id",
                "student__first_name",
                "student__last_name",
            )
        )

        if request.method == 'GET':
            if self._cache_enabled():
                key = f"lecture-members:{uuid}:{getattr(request.user, 'id', 'anon')}:{self._params_key(request)}"
                try:
                    cached = cache.get(key)
                except Exception:
                    cached = None
                if cached is not None:
                    return Response(cached, headers={"X-Cache": "HIT"})

            data = list(
                queryset
                .annotate(
                    user_id=F("student_id"),
                    full_name=Concat(
                        F("student__last_name"),
                        F("student__first_name"),
                        output_field=CharField(),
                    ),
                )
                .values(
                    "uuid",
                    "role",
                    "student_code",
                    "is_delete",
                    "user_id",
                    "full_name",
                )
            )
            count = len(data)
            payload = {
                'total': count,
                'size': count,
                'data': data
            }
            if self._cache_enabled():
                try:
                    cache.set(key, payload, timeout=self._cache_ttl())
                except Exception:
                    pass
            return Response(payload, headers={"X-Cache": "MISS"})

        elif request.method == 'PUT':
            payload, file_mode = self._parse_members_payload(request)
            file_mode = file_mode or bool(request.FILES)
            replace_flag = str(
                request.query_params.get("replace")
                or request.data.get("replace")
                or ""
            ).lower() in ("1", "true", "yes", "y")
            serializer = serializers.MembersRequestSerializer(data=payload)
            serializer.is_valid(raise_exception=True)
            new_members = serializer.validated_data["members"]
            not_found_users = []

            with transaction.atomic():
                if replace_flag:
                    models.StudentInLecture.objects.filter(
                        lecture=lecture,
                        is_delete=False
                    ).update(is_delete=True)

                for member_data in new_members:
                    serializer = serializers.MemberAddSerializer(
                        data=member_data, context={'lecture': lecture}
                    )
                    try:
                        serializer.is_valid(raise_exception=True)
                        serializer.save()
                    except ValidationError:
                        not_found_users.append(member_data.get("student_id"))

                    if not_found_users:
                        return Response(
                            {"not_found_users": not_found_users},
                            status=404
                        )
            self._invalidate_members_cache(uuid, request)

            return Response(status=status.HTTP_204_NO_CONTENT)

        elif request.method == 'POST':
            payload, _ = self._parse_members_payload(request)
            serializer = serializers.MembersRequestSerializer(data=payload)
            serializer.is_valid(raise_exception=True)
            new_members = serializer.validated_data["members"]
            not_found_users = []

            with transaction.atomic():
                for member_data in new_members:
                    add_serializer = serializers.MemberAddSerializer(
                        data=member_data, context={'lecture': lecture}
                    )
                    try:
                        add_serializer.is_valid(raise_exception=True)
                        add_serializer.save()
                    except ValidationError:
                        not_found_users.append(member_data.get("student_id"))

            if not_found_users:
                return Response({"not_found_users": not_found_users}, status=404)
            self._invalidate_members_cache(uuid, request)
            return Response(status=status.HTTP_201_CREATED)

    # /api/v1/instructor/lectures/{lid}/members/{uid}
    @extend_schema(
        responses={
            200: {
                "type": "object",
                "properties": {
                    "user_id": {"type": "integer", "example": 1001},
                    "name": {"type": "string", "example": "Student A"},
                    "role": {"type": "string", "example": "PROFESSOR"},
                    "joined_at": {
                        "type": "string",
                        "format": "date-time",
                        "example": "2025-07-20T15:30:00Z"
                    },
                    "last_submission_at": {
                        "type": "string",
                        "format": "date-time",
                        "example": "2025-07-21T12:00:00Z"
                    }
                }
            },
            404: None
        },
        description="""
            - GET: 멤버 조회 (200 응답, 실패시 404)
            - DELETE: 멤버 삭제 (204 No Content)
        """,
    )
    @action(detail=True, methods=['get', 'delete'],
            url_path='members/(?P<student_id>[^/.]+)', url_name='get-member')
    def manage_member_detail(self, request, uuid=None, student_id=None):
        lecture = get_object_or_404(models.Lecture, uuid=uuid, is_delete=False)
        member_qs = models.StudentInLecture.objects.select_related('student').filter(
            lecture=lecture,
            is_delete=False
        )

        member = None
        if student_id is not None:
            # 1) numeric user id
            if str(student_id).isdigit():
                member = member_qs.filter(student_id=int(student_id)).first()

            # 2) uuid (StudentInLecture uuid)
            if member is None:
                try:
                    uuid_lib.UUID(str(student_id))
                    member = member_qs.filter(uuid=student_id).first()
                except (ValueError, TypeError):
                    pass

            # 3) student_code fallback
            if member is None:
                member = member_qs.filter(student_code=str(student_id)).first()

        if member is None:
            raise Http404

        if request.method == 'GET':
            serializer = serializers.LectureMemberDetailSerializer(member)
            return Response(serializer.data)

        elif request.method == 'DELETE':
            member.is_delete = True
            member.save(update_fields=["is_delete"])
            self._invalidate_members_cache(uuid, request)
            return Response(status=status.HTTP_204_NO_CONTENT)
