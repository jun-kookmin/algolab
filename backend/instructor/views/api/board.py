import logging

from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from drf_spectacular.utils import extend_schema, OpenApiParameter, OpenApiTypes, OpenApiExample
from django.shortcuts import get_object_or_404
from django.db import IntegrityError, transaction
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.exceptions import ValidationError as DRFValidationError


from api.models import Post, PostReply
from ...serializers import board as serializers
from ...filters.board import PostFilter
from api import models
from instructor.soft_delete import soft_delete_post
from ..pagination import CustomPagination
from ...permissions import IsAdminOrProfessor, IsOwnerOrAdmin
from django.db.models import Case, DateTimeField, Exists, F, OuterRef, Q, When
from accounts.permissions import user_in_groups
from variables.groups import GroupEnum

ADMIN = GroupEnum.ADMINISTRATOR.value
PROF = GroupEnum.PROFESSOR.value
STUDENT = GroupEnum.STUDENT.value
logger = logging.getLogger(__name__)


def _accessible_problem_queryset(user):
    if not getattr(user, "is_authenticated", False):
        return models.Problem.objects.none()

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


def _accessible_lecture_queryset(user):
    if not getattr(user, "is_authenticated", False):
        return models.Lecture.objects.none()

    if user_in_groups(user, ADMIN):
        return models.Lecture.objects.filter(is_delete=False)

    if user_in_groups(user, PROF):
        return models.Lecture.objects.filter(is_delete=False, instructor=user)

    if user_in_groups(user, STUDENT):
        return models.Lecture.objects.filter(
            is_delete=False,
            StudentInLecture_lecture__student=user,
            StudentInLecture_lecture__is_delete=False,
        )

    return models.Lecture.objects.none()


def _filter_posts_for_user(qs, user):
    if not getattr(user, "is_authenticated", False):
        return qs.none()

    if user_in_groups(user, ADMIN):
        return qs

    accessible_problem_ids = _accessible_problem_queryset(user).order_by().values("id")
    accessible_lecture_ids = _accessible_lecture_queryset(user).order_by().values("id")

    accessible_problem_post_ids = models.ProblemPost.objects.filter(
        is_delete=False,
        problem_id__in=accessible_problem_ids,
    ).values("post_id")
    accessible_lecture_post_ids = models.PostLecture.objects.filter(
        is_delete=False,
        class_id__in=accessible_lecture_ids,
    ).values("post_id")
    restricted_problem_post_ids = models.ProblemPost.objects.filter(
        is_delete=False,
    ).values("post_id")
    restricted_lecture_post_ids = models.PostLecture.objects.filter(
        is_delete=False,
    ).values("post_id")

    return qs.filter(
        Q(user=user)
        | Q(id__in=accessible_problem_post_ids)
        | Q(id__in=accessible_lecture_post_ids)
        | (~Q(id__in=restricted_problem_post_ids) & ~Q(id__in=restricted_lecture_post_ids))
    )


@extend_schema(tags=['board'])
class BoardViewSet(viewsets.ModelViewSet):
    http_method_names = ['get', 'post']
    serializer_class = serializers.BoardSerializer
    queryset = models.Board.objects.all()

    def get_permissions(self):
        return [IsAdminOrProfessor()]

    def get_queryset(self):
        return models.Board.objects.all().order_by("id")

    def create(self, request, *args, **kwargs):
        board_name = request.data.get("board_name") or request.data.get("name") or "게시판"
        description = request.data.get("description")
        board, created = models.Board.objects.get_or_create(
            id=1,
            defaults={"board_name": board_name, "description": description},
        )
        serializer = self.get_serializer(board)
        return Response(
            serializer.data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )

# 게시글
@extend_schema(tags=['board'])
class PostViewSet(viewsets.ModelViewSet):
    http_method_names = ['get', 'post', 'put', 'delete']  
    pagination_class = CustomPagination
    lookup_field = "uuid"
    lookup_url_kwarg = "uuid"
    filter_backends = []
    filterset_class = PostFilter

    def _is_student_only(self, user):
        return bool(
            user
            and user_in_groups(user, GroupEnum.STUDENT.value)
            and not user_in_groups(
                user,
                GroupEnum.ADMINISTRATOR.value,
                GroupEnum.PROFESSOR.value,
            )
        )
    
    def get_permissions(self):

        # UPDATE / DELETE : 작성자 본인, 관리자만 가능
        if self.action in ["update", "destroy"]:
            return [IsOwnerOrAdmin()]

        # READ / CREATE : 로그인하면 가능
        return [IsAuthenticated()]

    def get_queryset(self):
        qs = (
            Post.objects.filter(is_delete=False)
            .select_related('board', 'user')
            .prefetch_related("user__groups")
        )
        qs = _filter_posts_for_user(qs, self.request.user)

        class_uuid = self.request.query_params.get("class_uuid")
        problem_uuid = self.request.query_params.get("problem_uuid")

        # 문제 UUID별 조회
        if problem_uuid:
            problem_post_ids = models.ProblemPost.objects.filter(
                is_delete=False,
                problem__uuid=problem_uuid,
            ).order_by().values("post_id")
            qs = qs.filter(id__in=problem_post_ids)

        # 분반 UUID 조회
        class_post_links = None
        if class_uuid:
            class_post_links = models.PostLecture.objects.filter(
                is_delete=False,
                class_id__uuid=class_uuid,
            ).order_by()
            qs = qs.filter(id__in=class_post_links.values("post_id"))

        # 제목
        title = self.request.query_params.get("title")
        if title:
            qs = qs.filter(title__icontains=title)

        author = self.request.query_params.get("author")
        if author:
            qs = qs.filter(user__username__icontains=author)

        search = self.request.query_params.get("search")
        if search:
            qs = qs.filter(
                Q(title__icontains=search) | Q(user__username__icontains=search)
            )

        # 공지 여부 조회
        is_noticed = self.request.query_params.get("is_noticed")
        if is_noticed is not None:
            if is_noticed.lower() == "true":
                if class_uuid:
                    noticed_post_ids = (class_post_links or models.PostLecture.objects.filter(
                        is_delete=False,
                        class_id__uuid=class_uuid,
                    ).order_by()).filter(is_noticed=True).values("post_id")
                    qs = qs.filter(id__in=noticed_post_ids)
                else:
                    qs = qs.filter(is_noticed=True)
            else:
                if class_uuid:
                    noticed_post_ids = (class_post_links or models.PostLecture.objects.filter(
                        is_delete=False,
                        class_id__uuid=class_uuid,
                    ).order_by()).filter(is_noticed=True).values("post_id")
                    qs = qs.exclude(id__in=noticed_post_ids)
                else:
                    qs = qs.filter(is_noticed=False)

        # 시험 공지 제외 필터 (분반별 공지 링크가 있는 게시글)
        exclude_exam_notice = self.request.query_params.get("exclude_exam_notice")
        if (
            exclude_exam_notice is not None
            and str(exclude_exam_notice).lower() in {"1", "true", "yes"}
        ):
            exam_notice_post_ids = models.PostLecture.objects.filter(
                is_delete=False,
                is_noticed=True,
            ).order_by().values("post_id")
            qs = qs.exclude(id__in=exam_notice_post_ids)

        if class_uuid:
            class_notice_links = models.PostLecture.objects.filter(
                is_delete=False,
                class_id__uuid=class_uuid,
                post_id=OuterRef("id"),
                is_noticed=True,
            )
            return qs.annotate(
                class_is_noticed=Exists(class_notice_links)
            ).annotate(
                list_order_date=Case(
                    When(class_is_noticed=True, then=F("updated_date")),
                    default=F("created_date"),
                    output_field=DateTimeField(),
                )
            ).order_by('-class_is_noticed', '-list_order_date', '-id')
        return qs.annotate(
            list_order_date=Case(
                When(is_noticed=True, then=F("updated_date")),
                default=F("created_date"),
                output_field=DateTimeField(),
            )
        ).order_by('-is_noticed', '-list_order_date', '-id')


    def get_serializer_class(self):
        if self.action == 'list':
            if self._is_student_only(self.request.user):
                return serializers.PostStudentListSerializer
            return serializers.PostListSerializer
        if self.action == 'retrieve':   # detail
            if self._is_student_only(self.request.user):
                return serializers.PostStudentDetailSerializer
            return serializers.PostDetailSerializer
        if self.action == 'create':
            return serializers.PostCreateSerializer
        if self.action == 'update':
            return serializers.PostUpdateSerializer
        return serializers.PostCreateSerializer
    
    @extend_schema(
        parameters=[
            OpenApiParameter(
                name='problem_uuid',
                type=OpenApiTypes.STR,
                location=OpenApiParameter.QUERY,
                description='특정 문제의 게시글만 조회 (선택사항, UUID)',
                required=False
            ),
            OpenApiParameter(
                name='class_uuid',
                type=OpenApiTypes.STR,
                location=OpenApiParameter.QUERY,
                description='특정 강의의 게시글만 조회 (선택사항, UUID)',
                required=False
            ),
            OpenApiParameter(
                name='is_noticed',
                type=OpenApiTypes.BOOL,
                location=OpenApiParameter.QUERY,
                description='공지 여부 (true/false) (선택사항)',
                required=False
            ),
            OpenApiParameter(name='title', type=str, description='게시글 제목 검색'),
        ]
    )
    def list(self, request, *args, **kwargs):
        """게시글 목록 조회 API"""
        try:
            return super().list(request, *args, **kwargs)
        except Exception:
            logger.exception(
                "Failed to list posts with params=%s for user_id=%s",
                dict(request.query_params),
                getattr(request.user, "id", None),
            )
            raise
    
    @extend_schema(
            description="게시글 상세 조회",
            examples=[
            OpenApiExample(
                'Post Detail Example',
                value={
                    "id": 2,
                    "board": 1,
                    "title": "게시글2",
                    "content": "게시글 내용",
                    "username": "STUDENT008",
                    "problem_id": 1,
                    "problem_name": "Python 예제문제1",
                    "created_date": "2025-11-18T22:13:41.469786+09:00",
                    "updated_date": "2025-11-18T22:13:41.469812+09:00",
                    "replies": [
                        {
                            "id": 5,
                            "reply_content": "답변 내용",
                            "user_name": "STUDENT010",
                            "reply_date": "2025-11-18T22:21:08.656016+09:00",
                            "can_edit": False
                        }
                    ],
                    "is_noticed": True,
                    "can_edit": False
                },
                response_only=True
            ),
        ]
    )
    # api/v1/instructor/posts/uuid
    def retrieve(self, request, *args, **kwargs):
        try:
            return super().retrieve(request, *args, **kwargs)
        except Exception:
            logger.exception(
                "Failed to retrieve post uuid=%s for user_id=%s",
                kwargs.get(self.lookup_url_kwarg or self.lookup_field),
                getattr(request.user, "id", None),
            )
            raise

    # 게시글 생성
    @extend_schema(description="게시글 생성")
    def create(self, request, *args, **kwargs):
        return super().create(request, *args, **kwargs)
    
    def perform_create(self, serializer):
        with transaction.atomic():
            post = serializer.save(user=self.request.user)

            data = getattr(serializer, "_create_post_meta", None)
            if not data:
                data = serializer.validated_data

            problem_uuid = data.get("problem_uuid")
            if problem_uuid:
                problem = get_object_or_404(
                    _accessible_problem_queryset(self.request.user),
                    uuid=problem_uuid,
                )
                try:
                    models.ProblemPost.objects.get_or_create(
                        post=post,
                        problem=problem,
                        is_delete=False,
                    )
                except IntegrityError:
                    existing = models.ProblemPost.objects.filter(
                        post=post,
                        problem=problem,
                        is_delete=False,
                    ).first()
                    if existing is None:
                        raise

            class_uuid = data.get("class_uuid")
            is_noticed = data.get("is_noticed", False)

            if isinstance(is_noticed, str):
                is_noticed = is_noticed.lower() == "true"

            if class_uuid:
                lecture = get_object_or_404(
                    _accessible_lecture_queryset(self.request.user),
                    uuid=class_uuid,
                )
                is_noticed = bool(is_noticed)
                try:
                    post_lecture, created = models.PostLecture.objects.get_or_create(
                        class_id=lecture,
                        post=post,
                        is_delete=False,
                        defaults={"is_noticed": is_noticed},
                    )
                except IntegrityError:
                    # 동일한 Post/강의 조합에 대한 동시 요청이 들어온 경우 발생할 수 있는 중복 생성 충돌 처리
                    post_lecture = models.PostLecture.objects.filter(
                        class_id=lecture,
                        post=post,
                        is_delete=False,
                    ).first()
                    if post_lecture is None:
                        post_lecture = models.PostLecture.all_objects.filter(
                            class_id=lecture,
                            post=post,
                        ).order_by("-id").first()
                        if post_lecture is None:
                            raise DRFValidationError(
                                "이미 등록된 공지를 처리하는 중입니다. 잠시 후 다시 시도해주세요."
                            )
                        if post_lecture.is_delete:
                            post_lecture.is_delete = False
                            post_lecture.save(update_fields=["is_delete"])
                    created = False
                if not created:
                    update_fields = []
                    if post_lecture.is_noticed != is_noticed:
                        post_lecture.is_noticed = is_noticed
                        update_fields.append("is_noticed")
                    if not post_lecture.is_delete:
                        if update_fields:
                            post_lecture.save(update_fields=update_fields)
                    else:
                        update_fields.append("is_delete")
                        post_lecture.save(update_fields=update_fields)

    def perform_update(self, serializer):
        serializer.save()

    # 게시글 삭제
    @extend_schema(description="게시글 삭제")
    @transaction.atomic
    def destroy(self, request, *args, **kwargs):
        post = self.get_object()
        soft_delete_post(post)
        return Response(status=status.HTTP_204_NO_CONTENT)

# 답변
@extend_schema(tags=['board'])
class PostReplyViewSet(viewsets.ModelViewSet):

    http_method_names = ['get', 'post', 'put', 'delete']
    lookup_field = "uuid"
    lookup_url_kwarg = "pk"

    def get_permissions(self):
        if self.action in ["update", "destroy"]:
            return [IsOwnerOrAdmin()]
        return [IsAuthenticated()]

    def get_queryset(self):
        qs = (
            PostReply.objects.filter(is_delete=False)
            .select_related('post', 'user', 'board', 'parent')
            .prefetch_related("user__groups")
        )

        post_pk = self.kwargs.get("post_pk")
        if not post_pk:
            post_pk = (
                self.kwargs.get("post_uuid")
                or self.kwargs.get("post_id")
                or self.kwargs.get("post")
            )

        if not post_pk:
            raise DRFValidationError("post_pk가 필요합니다.")

        post = get_object_or_404(
            _filter_posts_for_user(
                Post.objects.filter(is_delete=False).select_related("board", "user"),
                self.request.user,
            ),
            uuid=post_pk,
        )
        qs = qs.filter(post=post)

        return qs

    def get_serializer_class(self):
        if self.action in ['list', 'retrieve']:
            return serializers.PostReplySimpleSerializer
        if self.action == 'create':
            return serializers.PostReplyCreateSerializer
        if self.action == 'update':
            return serializers.PostReplyUpdateSerializer
        return serializers.PostReplyCreateSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        reply = serializer.instance
        data = serializers.PostReplySimpleSerializer(
            reply, context={"request": request}
        ).data
        return Response(data, status=status.HTTP_201_CREATED)

    def perform_create(self, serializer):
        post_pk = (
            self.kwargs.get("post_pk")
            or self.kwargs.get("post_uuid")
            or self.kwargs.get("post_id")
            or self.kwargs.get("post")
        )
        if not post_pk:
            raise serializers.ValidationError("post_pk가 필요합니다.")
        post = get_object_or_404(
            _filter_posts_for_user(
                models.Post.objects.filter(is_delete=False).select_related("board", "user"),
                self.request.user,
            ),
            uuid=post_pk,
        )

        parent_uuid = serializer.validated_data.pop("parent_uuid", None)
        parent_reply = None
        if parent_uuid is not None:
            parent_reply = get_object_or_404(
                PostReply.objects.filter(
                    is_delete=False,
                    post=post,
                ).select_related("parent"),
                uuid=parent_uuid,
            )
            if parent_reply.parent_id is not None:
                raise DRFValidationError("대댓글은 1단계까지만 작성할 수 있습니다.")

        serializer.save(
            user=self.request.user,
            post=post,
            board=post.board,
            parent=parent_reply,
        )

    def perform_update(self, serializer):
        serializer.save()

    @transaction.atomic
    def destroy(self, request, *args, **kwargs):
        reply = self.get_object()
        PostReply.objects.filter(
            Q(id=reply.id) | Q(parent_id=reply.id),
            is_delete=False,
        ).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
