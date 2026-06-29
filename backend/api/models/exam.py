import uuid
from django.db import models
from django.contrib.auth import get_user_model
from django.utils.translation import gettext_lazy as _

from .lecture import Lecture, StudentInLecture
from .problem import Problem
from .soft_delete import SoftDeleteModel

user = get_user_model()


class Exam(SoftDeleteModel):
    id = models.BigAutoField(
        primary_key=True,
        db_column='ExamID',
        verbose_name=_('시험 고유 INDEX'),
    )
    uuid = models.UUIDField(
        default=uuid.uuid4,
        unique=True,
        db_index=True,
        editable=False,
        verbose_name=_('시험 UUID'),
    )
    lecture = models.ForeignKey(
        Lecture,
        related_name='Exam_lecture',
        verbose_name=_('클래스 고유 INDEX'),
        db_column='LectureID',
        on_delete=models.CASCADE,
    )

    exam_name = models.CharField(
        verbose_name=_('시험 이름'),
        db_column='ExamName',
        max_length=255,
    )

    week = models.IntegerField(
        verbose_name=_('시험 주차'),
        db_column='Week',
    )

    due_date = models.DateTimeField(
        verbose_name=_('마감기한'),
        db_column='DueDate',
    )

    start_date = models.DateTimeField(
        verbose_name=_('시작기간'),
        db_column='StartDate',
    )

    share = models.BooleanField(
        verbose_name=_('공유여부'),
        db_column='Share',
        default=False,
    )

    description = models.TextField(
        verbose_name=_('시험 설명'),
        db_column='Description',
        null=True,
        blank=True,
    )

    def __str__(self):
        return f'{self.id}_({self.exam_name}, {self.lecture_id})'

    class Meta:
        db_table = 'exam'
        ordering = ['id', 'exam_name', 'lecture']
        verbose_name = _('시험: 시험')
        verbose_name_plural = _('시험: 시험')


class ExamUser(SoftDeleteModel):
    id = models.BigAutoField(
        primary_key=True,
        db_column='ExamUserID',
        verbose_name=_('시험인원 고유 INDEX'),
    )
    uuid = models.UUIDField(
        default=uuid.uuid4,
        unique=True,
        db_index=True,
        editable=False,
        verbose_name=_('시험인원 UUID'),
    )

    exam = models.ForeignKey(
        Exam,
        related_name='ExamUser_exam',
        verbose_name=_('시험 고유 INDEX'),
        db_column='ExamID',
        on_delete=models.CASCADE,
    )

    lecture_user = models.ForeignKey(
        StudentInLecture,
        related_name='ExamUser_StudentInLecture',
        verbose_name=_('클래스 인원 고유 INDEX'),
        db_column='LectureUserID',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )

    start_time = models.DateTimeField(
        verbose_name=_('시험시작 시간'),
        db_column='StartTime',
    )

    end_time = models.DateTimeField(
        verbose_name=_('시험종료 시간'),
        db_column='EndTime',
    )

    finished_at = models.DateTimeField(
        verbose_name=_('시험 종료 시간'),
        db_column='FinishedAt',
        null=True,
        blank=True,
    )

    finished_by_user = models.BooleanField(
        verbose_name=_('사용자 종료 여부'),
        db_column='FinishedByUser',
        default=False,
    )

    saved_code = models.TextField(
        verbose_name=_('중간 저장 코드'),
        db_column='SavedCode',
        blank=True,
        null=True,
    )

    def __str__(self):
        return f'{self.id}_({self.exam_id}, {self.lecture_user_id})'

    class Meta:
        db_table = 'exam_user'
        ordering = ['id', 'exam']
        verbose_name = _('시험인원: 시험인원')
        verbose_name_plural = _('시험인원: 시험인원')
        constraints = [
            models.UniqueConstraint(
                fields=['exam', 'lecture_user'],
                name='uniq_exam_user',
            ),
        ]


class ExamProblem(SoftDeleteModel):
    id = models.BigAutoField(
        primary_key=True,
        db_column='ExamProblemID',
        verbose_name=_('시험문제 고유 INDEX'),
    )
    uuid = models.UUIDField(
        default=uuid.uuid4,
        unique=True,
        db_index=True,
        editable=False,
        verbose_name=_('시험문제 UUID'),
    )

    exam = models.ForeignKey(
        Exam,
        related_name='ExamProblem_exam',
        verbose_name=_('시험 고유 INDEX'),
        db_column='ExamID',
        on_delete=models.CASCADE,
    )

    problem = models.ForeignKey(
        Problem,
        related_name='ExamProblem_problem',
        verbose_name=_('문제 고유 INDEX'),
        db_column='ProblemID',
        on_delete=models.CASCADE,
    )

    score = models.IntegerField(
        verbose_name=_('점수'),
        db_column='Score',
        null=True,
        blank=True,
    )

    def __str__(self):
        return f'{self.id}_({self.exam_id}, {self.problem_id})'

    class Meta:
        db_table = 'exam_problem'
        ordering = ['id', 'exam']
        verbose_name = _('시험문제: 시험문제')
        verbose_name_plural = _('시험문제: 시험문제')
