import uuid
from django.db import models
from django.contrib.auth import get_user_model
from django.utils.translation import gettext_lazy as _

from .language import Language
from .soft_delete import SoftDeleteModel

user = get_user_model()

ROLE_TYPE = (
    ('student', '학생'),
    ('professor', '교수'),
    ('admin', '관리자'),
)

class Lecture(SoftDeleteModel):
    id = models.BigAutoField(
        primary_key=True,
        db_column='LectureID',
        verbose_name=_('클래스 고유 INDEX'),
    )
    uuid = models.UUIDField(
        default=uuid.uuid4,
        unique=True,
        db_index=True,
        editable=False,
        verbose_name=_('클래스 UUID'),
    )

    instructor = models.ForeignKey(
        user,
        related_name='Lecture_user',
        verbose_name=_('담당교수 고유 INDEX'),
        db_column='UserId',
        on_delete=models.CASCADE,
    )

    lecture_name = models.CharField(
        verbose_name=_('클래스이름'),
        db_column='Name',
        max_length=100,
        db_index=True,
    )

    description = models.TextField(
        verbose_name=_('클래스 및 강의 설명'),
        db_column='Description',
        blank=True,
        null=True,
        default=''
    )

    weeks = models.IntegerField(
        verbose_name=_('강의 차수'),
        db_column='WeekCount',
        default=16,
    )

    lecture_language = models.ManyToManyField(
        Language,
        related_name='lecture_language_language',
        verbose_name=_('클래스 기본 언어'),
        blank=True,
        through='LanguageInLecture',
        through_fields=('lecture', 'language'),
    )

    start_date = models.DateTimeField(
        verbose_name=_('시작기간'),
        db_column='StartDate',
        null=True,
        blank=True,
    )

    end_date = models.DateTimeField(
        verbose_name=_('종료기간'),
        db_column='EndDate',
        null=True,
        blank=True,
    )

    curriculum_locked = models.BooleanField(
        verbose_name=_('커리큘럼 접근 제한'),
        db_column='CurriculumLocked',
        default=False,
    )

    created_date = models.DateTimeField(
        verbose_name=_('생성일'),
        db_column='CDT',
        auto_now=True,
    )

    class Meta:
        db_table = 'lecture'
        ordering = ['id', 'instructor']
        verbose_name = _('수업: 수업')
        verbose_name_plural = _('수업: 수업')
        indexes = [
            models.Index(fields=['instructor', 'is_delete'], name='lecture_inst_del_idx'),
            models.Index(fields=['start_date', 'is_delete'], name='lecture_start_del_idx'),
            models.Index(fields=['end_date', 'is_delete'], name='lecture_end_del_idx'),
        ]

    def __str__(self):
        return f"{self.id}_({self.lecture_name})"


class StudentInLecture(SoftDeleteModel):
    lecture = models.ForeignKey(
        Lecture,
        related_name='StudentInLecture_lecture',
        verbose_name=_('수업'),
        db_column='lecture',
        on_delete=models.CASCADE,
    )

    uuid = models.UUIDField(
        default=uuid.uuid4,
        unique=True,
        db_index=True,
        editable=False,
        verbose_name=_('수업참여 UUID'),
    )

    student = models.ForeignKey(
        user,
        related_name='StudentInLecture_user',
        verbose_name=_('학생'),
        db_column='student',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )

    role = models.CharField(
        verbose_name=_('권한 및 역할'),
        db_column='role',
        choices=ROLE_TYPE,
        default='student',
        max_length=50,
    )

    student_code = models.CharField(
        verbose_name=_('학번'),
        db_column='StudentID',
        max_length=50,
    )

    class Meta:
        db_table = 'STUDENT_IN_LECTURE'
        ordering = ['lecture', 'student']
        unique_together = [('lecture', 'student')]
        verbose_name = _('수업: 참여학생')
        verbose_name_plural = _('수업: 참여학생')
        indexes = [
            models.Index(fields=['lecture', 'is_delete'], name='sil_lecture_del_idx'),
            models.Index(fields=['lecture', 'student_code'], name='sil_lecture_code_idx'),
        ]

    #def __str__(self):
    #    return f"({self.lecture_id}, {self.student_id})"


class LanguageInLecture(SoftDeleteModel):
    lecture = models.ForeignKey(
        Lecture,
        related_name='LanguageInLecture_lecture',
        verbose_name=_('수업'),
        db_column='lecture',
        null=True,
        on_delete=models.SET_NULL,
    )

    language = models.ForeignKey(
        Language,
        related_name='LanguageInLecture_language',
        verbose_name=_('언어'),
        db_column='language',
        null=True,
        on_delete=models.SET_NULL,
    )

    class Meta:
        db_table = 'LANGUAGE_IN_LECTURE'
        ordering = ['lecture', 'language']
        unique_together = [('lecture', 'language', 'is_delete')]
        verbose_name = _('수업: 사용언어')
        verbose_name_plural = _('수업: 사용언어')

    def __str__(self):
        return f"({self.lecture_id}, {self.language_id})"
