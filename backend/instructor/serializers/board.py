from django.contrib.auth import get_user_model
from rest_framework import serializers

from api import models
from accounts.permissions import (
    user_can_open_submission_target,
    user_in_groups,
)
from variables.groups import GroupEnum

User = get_user_model()


def _can_edit_reply_for_request(reply, request) -> bool:
    if not request or request.user.is_anonymous:
        return False
    if reply.user_id == request.user.id:
        return True
    return user_in_groups(
        request.user,
        GroupEnum.ADMINISTRATOR.value,
    )

class UserSimpleSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username']


class UserNameOnlySerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['username']


class PostListSerializer(serializers.ModelSerializer):
    user = UserSimpleSerializer(read_only=True)
    user_id = serializers.IntegerField(read_only=True)
    problem_uuid = serializers.SerializerMethodField()
    problem_name = serializers.SerializerMethodField()
    is_exam_notice = serializers.SerializerMethodField()
    is_noticed = serializers.SerializerMethodField()
    board_uuid = serializers.UUIDField(source='board.uuid', read_only=True)
    can_edit = serializers.SerializerMethodField()
    can_open_submission = serializers.SerializerMethodField()

    class Meta:
        model = models.Post
        fields = [
            'uuid', 'board_uuid', 'title', 'user', 'created_date', 'updated_date',
            'user_id', 'problem_uuid', 'problem_name', 'is_noticed', 'can_edit', 'is_exam_notice',
            'can_open_submission',
        ]

    @staticmethod
    def _first_prefetched(obj, attr_name, related_name):
        prefetched = getattr(obj, attr_name, None)
        if prefetched is not None:
            return prefetched[0] if prefetched else None
        return obj.__getattribute__(related_name).first()

    def get_problem_uuid(self, obj):
        mapping = self._first_prefetched(obj, "prefetched_problem_posts", "ProblemPost_post")
        if mapping:
            return str(mapping.problem.uuid)
        return None

    def get_problem_name(self, obj):
        mapping = self._first_prefetched(obj, "prefetched_problem_posts", "ProblemPost_post")
        if mapping and mapping.problem:
            return mapping.problem.problem_name
        return None

    def get_is_exam_notice(self, obj):
        lectures = getattr(obj, "prefetched_post_lectures", None)
        if lectures is not None:
            return any(bool(lecture.is_noticed) for lecture in lectures)
        return obj.PostLecture_post.filter(is_delete=False, is_noticed=True).exists()
    
    def get_is_noticed(self, obj):
        request = self.context.get("request")
        class_uuid = None
        if request is not None:
            class_uuid = request.query_params.get("class_uuid")
        if not class_uuid:
            return bool(getattr(obj, "is_noticed", False))
        lecture = self._first_prefetched(obj, "prefetched_post_lectures", "PostLecture_post")
        if lecture is not None:
            return bool(lecture.is_noticed)
        return bool(getattr(obj, "is_noticed", False))
    
    def get_can_edit(self, obj):
        request = self.context.get('request')

        if not request or request.user.is_anonymous:
            return False
        
        if obj.user_id == request.user.id:
            return True

        return user_in_groups(
            request.user,
            GroupEnum.ADMINISTRATOR.value,
        )

    def get_can_open_submission(self, obj):
        request = self.context.get("request")
        if not request:
            return False
        return user_can_open_submission_target(request.user, getattr(obj, "user", None))


class PostStudentListSerializer(PostListSerializer):
    user = UserNameOnlySerializer(read_only=True)

    class Meta(PostListSerializer.Meta):
        fields = [
            'uuid',
            'title',
            'user',
            'user_id',
            'created_date',
            'updated_date',
            'problem_uuid',
            'problem_name',
            'is_noticed',
            'is_exam_notice',
            'can_open_submission',
        ]


class PostReplySimpleSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source='user.username', read_only=True)
    user_id = serializers.IntegerField(read_only=True)
    parent_uuid = serializers.SerializerMethodField()
    can_edit = serializers.SerializerMethodField()
    can_open_submission = serializers.SerializerMethodField()

    class Meta:
        model = models.PostReply
        fields = [
            'uuid',
            'reply_content',
            'user_name',
            'user_id',
            'parent_uuid',
            'reply_date',
            'can_edit',
            'can_open_submission',
        ]

    def get_parent_uuid(self, obj):
        if obj.parent_id is None:
            return None
        return str(obj.parent.uuid)

    def get_can_edit(self, obj):
        return _can_edit_reply_for_request(obj, self.context.get("request"))

    def get_can_open_submission(self, obj):
        request = self.context.get("request")
        if not request:
            return False
        return user_can_open_submission_target(request.user, getattr(obj, "user", None))

class PostDetailSerializer(serializers.ModelSerializer):
    user_id = serializers.IntegerField(read_only=True)
    username = serializers.CharField(source='user.username', read_only=True)
    problem_uuid = serializers.SerializerMethodField()
    problem_name = serializers.SerializerMethodField()
    is_noticed = serializers.SerializerMethodField()
    replies = serializers.SerializerMethodField()
    board_uuid = serializers.UUIDField(source='board.uuid', read_only=True)
    can_edit = serializers.SerializerMethodField()
    can_open_submission = serializers.SerializerMethodField()

    class Meta:
        model = models.Post
        fields = [
            'uuid', 'board_uuid', 'title', 'content', 'user_id', 'username', 'problem_uuid', 'problem_name',
            'created_date', 'updated_date', 'replies', 'is_noticed','can_edit', 'can_open_submission',
        ]

    @staticmethod
    def _first_prefetched(obj, attr_name, related_name):
        prefetched = getattr(obj, attr_name, None)
        if prefetched is not None:
            return prefetched[0] if prefetched else None
        return obj.__getattribute__(related_name).first()
    
    def get_problem_uuid(self, obj):
        mapping = self._first_prefetched(obj, "prefetched_problem_posts", "ProblemPost_post")
        if mapping:
            return str(mapping.problem.uuid)
        return None

    def get_problem_name(self, obj):
        mapping = self._first_prefetched(obj, "prefetched_problem_posts", "ProblemPost_post")
        if mapping and mapping.problem:
            return mapping.problem.problem_name
        return None
    
    def get_is_noticed(self, obj):
        lecture = self._first_prefetched(obj, "prefetched_post_lectures", "PostLecture_post")
        if lecture is not None:
            return bool(lecture.is_noticed)
        return bool(getattr(obj, "is_noticed", False))
    
    def get_replies(self, obj):
        request = self.context.get("request")
        if request is not None:
            no_replies = str(request.query_params.get("no_replies", "")).lower() in {"1", "true", "yes"}
            if no_replies:
                return []
        replies = getattr(obj, "prefetched_replies", None)
        if replies is None:
            replies = list(
                obj.PostReply_post
                .filter(is_delete=False)
                .select_related("user", "parent")
                .prefetch_related("user__groups")
                .only(
                    "id",
                    "uuid",
                    "reply_content",
                    "reply_date",
                    "user_id",
                    "user__username",
                    "parent_id",
                    "parent__uuid",
                )
                .order_by("-reply_date", "-id")
            )
        return PostReplySimpleSerializer(
            replies,
            many=True,
            context={"request": request},
        ).data
    
    def get_can_edit(self, obj):
        request = self.context.get('request')
        if not request:
            return False
        if obj.user_id == request.user.id:
            return True

        return user_in_groups(
            request.user,
            GroupEnum.ADMINISTRATOR.value,
        )

    def get_can_open_submission(self, obj):
        request = self.context.get("request")
        if not request:
            return False
        return user_can_open_submission_target(request.user, getattr(obj, "user", None))


class PostStudentDetailSerializer(PostDetailSerializer):
    class Meta(PostDetailSerializer.Meta):
        fields = [
            'uuid',
            'title',
            'content',
            'user_id',
            'username',
            'problem_uuid',
            'problem_name',
            'created_date',
            'updated_date',
            'replies',
            'is_noticed',
            'can_edit',
            'can_open_submission',
        ]
    

class PostCreateSerializer(serializers.ModelSerializer):
    board_uuid = serializers.CharField(write_only=True, required=False, allow_blank=True)
    problem_uuid = serializers.UUIDField(required=False, write_only=True)
    class_uuid = serializers.UUIDField(required=False, write_only=True)
    is_noticed = serializers.BooleanField(required=False, default=False, write_only=True)

    class Meta:
        model = models.Post
        fields = ['board_uuid', 'title', 'content', 'problem_uuid', 'class_uuid', 'is_noticed']

    def create(self, validated_data):
        request = self.context['request']

        validated_data.pop('board_uuid', None)
        problem_uuid = validated_data.pop('problem_uuid', None)
        class_uuid = validated_data.pop('class_uuid', None)
        is_noticed = validated_data.pop('is_noticed', False)

        if is_noticed and not user_in_groups(
            request.user,
            GroupEnum.ADMINISTRATOR.value,
            GroupEnum.PROFESSOR.value,
        ):
            raise serializers.ValidationError("공지글 작성 권한이 없습니다.")

        # 게시판은 id=1 고정 (없으면 자동 생성)
        board, _created = models.Board.objects.get_or_create(
            id=1,
            defaults={"board_name": "게시판", "description": ""},
        )

        # Post 생성
        user = validated_data.pop("user", request.user)
        post = models.Post.objects.create(
            board=board,
            user=user,
            is_noticed=bool(is_noticed),
            **validated_data,
        )

        self._create_post_meta = {
            "problem_uuid": str(problem_uuid) if problem_uuid else None,
            "class_uuid": str(class_uuid) if class_uuid else None,
            "is_noticed": bool(is_noticed),
        }

        return post

class PostUpdateSerializer(serializers.ModelSerializer):
    uuid = serializers.UUIDField(read_only=True)
    class Meta:
        model = models.Post
        fields = ['uuid', 'title', 'content', 'is_noticed']

    def validate(self, attrs):
        request = self.context['request']
        post = self.instance

        if post.user != request.user and not user_in_groups(
            request.user,
            GroupEnum.ADMINISTRATOR.value,
        ):
            raise serializers.ValidationError("게시글을 수정할 권한이 없습니다.")
        if "is_noticed" in attrs:
            if not user_in_groups(
                request.user,
                GroupEnum.ADMINISTRATOR.value,
                GroupEnum.PROFESSOR.value,
            ):
                raise serializers.ValidationError("공지글 수정 권한이 없습니다.")
        return attrs

class PostReplyCreateSerializer(serializers.ModelSerializer):
    parent_uuid = serializers.UUIDField(required=False, allow_null=True, write_only=True)

    class Meta:
        model = models.PostReply
        fields = ['reply_content', 'parent_uuid']


class PostReplyUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.PostReply
        fields = ['reply_content']

    def validate(self, attrs):
        request = self.context['request']
        reply = self.instance

        if reply.is_delete:
            raise serializers.ValidationError("삭제된 댓글은 수정할 수 없습니다.")

        if not _can_edit_reply_for_request(reply, request):
            raise serializers.ValidationError("수정 권한이 없습니다.")

        return attrs


class BoardSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.Board
        fields = ["id", "uuid", "board_name", "description"]
