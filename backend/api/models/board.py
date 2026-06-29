import uuid
from django.db import models
from django.contrib.auth import get_user_model
from django.utils.translation import gettext_lazy as _
from .problem import Problem
from .lecture import Lecture
from .soft_delete import SoftDeleteModel

user = get_user_model()


class Board(SoftDeleteModel):
    id = models.BigAutoField(
        primary_key=True,
        db_column='BoardID',
        verbose_name=_('게시판 고유 INDEX'),
    )
    uuid = models.UUIDField(
        default=uuid.uuid4,
        unique=True,
        db_index=True,
        editable=False,
        verbose_name=_('게시판 UUID'),
    )

    board_name = models.CharField(
        verbose_name=_('게시판 이름'),
        db_column='BoardName',
        max_length=100,
    )

    description = models.TextField(
        verbose_name=_('게시판 설명'),
        db_column='Description',
        null=True,
        blank=True,
    )

    def __str__(self):
        return f'{self.id}_({self.board_name})'

    class Meta:
        db_table = 'board'
        ordering = ['id', 'board_name']
        verbose_name = _('게시판: 게시판')
        verbose_name_plural = _('게시판: 게시판')


class Post(SoftDeleteModel):
    id = models.BigAutoField(
        primary_key=True,
        db_column='PostID',
        verbose_name=_('게시글 고유 INDEX'),
    )
    uuid = models.UUIDField(
        default=uuid.uuid4,
        unique=True,
        db_index=True,
        editable=False,
        verbose_name=_('게시글 UUID'),
    )

    board = models.ForeignKey(
        Board,
        related_name='post_board',
        verbose_name=_('게시판 고유 INDEX'),
        db_column='BoardID',
        on_delete=models.CASCADE,
    )

    user = models.ForeignKey(
        user,
        related_name='post_user',
        verbose_name=_('작성 유저 INDEX'),
        db_column='UserID',
        on_delete=models.CASCADE,
    )

    title = models.CharField(
        verbose_name=_('게시글 제목'),
        db_column='Title',
        max_length=255,
    )

    content = models.TextField(
        verbose_name=_('게시글 내용'),
        db_column='Content',
    )

    is_noticed = models.BooleanField(
        verbose_name=_('공지사항 여부'),
        db_column='isNoticed',
        default=False,
    )

    created_date = models.DateTimeField(
        verbose_name=_('업로드 날짜'),
        db_column='created_date',
        auto_now_add=True,
    )

    updated_date = models.DateTimeField(
        verbose_name=_('수정 날짜'),
        db_column='updated_date',
        auto_now=True,
    )

    def __str__(self):
        return f'{self.id}_({self.title})'

    class Meta:
        db_table = 'post'
        ordering = ['-is_noticed', '-created_date', 'title']
        verbose_name = _('게시글: 게시글')
        verbose_name_plural = _('게시글: 게시글')
        indexes = [
            models.Index(fields=['is_delete', 'id'], name='post_del_id_idx'),
            models.Index(fields=['board', 'is_delete', '-created_date'], name='post_board_del_ct_idx'),
            models.Index(fields=['board', 'is_delete', 'is_noticed', '-created_date'], name='post_board_notice_ct_idx'),
        ]


class ProblemPost(SoftDeleteModel):
    id = models.BigAutoField(
        primary_key=True,
        db_column='ID',
        verbose_name=_('질문게시글 고유 INDEX'),
    )
    uuid = models.UUIDField(
        default=uuid.uuid4,
        unique=True,
        db_index=True,
        editable=False,
        verbose_name=_('질문게시글 UUID'),
    )

    post = models.ForeignKey(
        Post,
        related_name='ProblemPost_post',
        verbose_name=_('게시글'),
        db_column='PostID',
        on_delete=models.CASCADE,
    )

    problem = models.ForeignKey(
        Problem,
        related_name='ProblemPost_problem',
        verbose_name=_('문제'),
        db_column='ProblemID',
        on_delete=models.CASCADE,
    )

    def __str__(self):
        return f'({self.post_id}, {self.problem_id})'

    class Meta:
        db_table = 'problem_post'
        constraints = [
            models.UniqueConstraint(fields=['post', 'problem', 'is_delete'], name='unique_post_problem')
        ]
        ordering = ['id', 'post', 'problem']
        verbose_name = _('질문게시글: 질문게시글')
        verbose_name_plural = _('질문게시글: 질문게시글')


class PostReply(SoftDeleteModel):
    id = models.BigAutoField(
        primary_key=True,
        db_column='ReplayId',
        verbose_name=_('답변 고유 INDEX'),
    )
    uuid = models.UUIDField(
        default=uuid.uuid4,
        unique=True,
        db_index=True,
        editable=False,
        verbose_name=_('답변 UUID'),
    )

    post = models.ForeignKey(
        Post,
        related_name='PostReply_post',
        verbose_name=_('질문글 고유 INDEX'),
        db_column='PostID',
        on_delete=models.CASCADE,
    )

    user = models.ForeignKey(
        user,
        related_name='PostReply_user',
        verbose_name=_('답변유저 INDEX'),
        db_column='UserId',
        on_delete=models.CASCADE,
    )

    board = models.ForeignKey(
        Board,
        related_name='PostReply_board',
        verbose_name=_('게시판 고유 INDEX'),
        db_column='BoardID',
        on_delete=models.CASCADE,
    )

    parent = models.ForeignKey(
        'self',
        related_name='children',
        verbose_name=_('부모 답변 INDEX'),
        db_column='ParentReplyId',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
    )

    reply_content = models.TextField(
        verbose_name=_('답변 내용'),
        db_column='ReplyContent',
    )

    reply_date = models.DateTimeField(
        verbose_name=_('답변 날짜'),
        db_column='ReplyDate',
        auto_now_add=True,
    )

    def __str__(self):
        return f'{self.id}_({self.post_id}, {self.user_id})'

    class Meta:
        db_table = 'post_reply'
        ordering = ['-reply_date']
        verbose_name = _('게시글답변: 게시글답변')
        verbose_name_plural = _('게시글답변: 게시글답변')
        indexes = [
            models.Index(fields=['post', 'is_delete', '-reply_date'], name='pr_post_del_rd_idx'),
        ]


class PostLecture(SoftDeleteModel):
    id = models.BigAutoField(
        primary_key=True,
        db_column='ID',
        verbose_name=_('분반별 게시글 고유 INDEX'),
    )
    uuid = models.UUIDField(
        default=uuid.uuid4,
        unique=True,
        db_index=True,
        editable=False,
        verbose_name=_('분반별 게시글 UUID'),
    )

    class_id = models.ForeignKey(
        Lecture,
        related_name='PostLecture_lecture',
        verbose_name=_('클래스 고유 INDEX'),
        db_column='ClassID',
        on_delete=models.CASCADE,
    )

    post = models.ForeignKey(
        Post,
        related_name='PostLecture_post',
        verbose_name=_('게시글 고유 INDEX'),
        db_column='PostID',
        on_delete=models.CASCADE,
    )

    is_noticed = models.BooleanField(
        verbose_name=_('공지사항 여부'),
        db_column='isNoticed',
        default=False,
    )

    def __str__(self):
        return f'({self.class_id_id}, {self.post_id})'

    class Meta:
        db_table = 'post_lecture'
        constraints = [
            models.UniqueConstraint(fields=['post', 'class_id', 'is_delete'], name='unique_post_class')
        ]
        ordering = ['id', 'is_noticed', 'post']
        verbose_name = _('분반별 게시글: 분반별 게시글')
        verbose_name_plural = _('분반별 게시글: 분반별 게시글')
        indexes = [
            models.Index(fields=['class_id', 'is_noticed', 'post'], name='pl_class_notice_p_idx'),
        ]
