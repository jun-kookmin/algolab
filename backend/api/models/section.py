import uuid
from django.db import models
from django.db.models import Q, F
from django.utils.translation import gettext_lazy as _
from .lecture import Lecture
from .problem import Problem
from .language import Language
from .soft_delete import SoftDeleteModel


class Section(SoftDeleteModel):
    id = models.BigAutoField(
        primary_key=True,
        db_column='SectionID',
        verbose_name=_('섹션 고유 INDEX'),
    )
    uuid = models.UUIDField(
        default=uuid.uuid4,
        unique=True,
        db_index=True,
        editable=False,
        verbose_name=_('섹션 UUID'),
    )
    lecture = models.ForeignKey(
        Lecture,
        related_name='Section_lecture',
        verbose_name=_('클래스 고유 INDEX'),
        db_column='LectureID',
        on_delete=models.CASCADE,
    )
    section_name = models.CharField(
        verbose_name=_('과제 이름'),
        db_column='SectionName',
        max_length=100,
    )
    description = models.TextField(
        verbose_name=_('과제 설명'),
        db_column='Description',
        null=True,
        blank=True,
    )
    week = models.IntegerField(
        verbose_name=_('과제주차'),
        db_column='Week',
    )
    share = models.BooleanField(
        verbose_name=_('공유 여부'),
        db_column='Share',
        default=False,
    )
    class Meta:
        db_table = 'section'
        ordering = ['id', 'section_name']
        verbose_name = _('강의: 섹션')
        verbose_name_plural = _('강의: 섹션')
        indexes = [
            models.Index(fields=['lecture', 'week']),
            models.Index(fields=['share']),
        ]
        constraints = [
            models.CheckConstraint(check=Q(week__gte=1), name='section_week_gte_1'),
            models.UniqueConstraint(fields=['lecture', 'section_name', 'is_delete'], name='uniq_section_per_lecture'),
        ]

    def __str__(self):
        return f'{self.id}_{self.section_name}'


class SectionProblem(SoftDeleteModel):
    id = models.BigAutoField(
        primary_key=True,
        db_column='SectionProblemID',
        verbose_name=_('과제문제 고유 INDEX'),
    )
    uuid = models.UUIDField(
        default=uuid.uuid4,
        unique=True,
        db_index=True,
        editable=False,
        verbose_name=_('과제문제 UUID'),
    )
    problem = models.ForeignKey(
        Problem,
        related_name='SectionProblem_problem',
        verbose_name=_('문제 고유 INDEX'),
        db_column='ProblemID',
        on_delete=models.CASCADE,
    )
    section = models.ForeignKey(
        Section,
        related_name='SectionProblem_section',
        verbose_name=_('섹션 고유 INDEX'),
        db_column='SectionID',
        on_delete=models.CASCADE,
    )

    language = models.ManyToManyField(
        Language,
        through='LanguageInSectionProblem',
        related_name='section_problems',
        blank=True,
    )
    
    score = models.IntegerField(
        verbose_name=_('점수'),
        db_column='Score',
        null=True,
        blank=True,
    )

    start_date = models.DateTimeField(
        verbose_name=_('시작기간'),
        db_column='StartDate',
    )
    due_date = models.DateTimeField(
        verbose_name=_('마감기한'),
        db_column='DueDate',
    )
    class Meta:
        db_table = 'section_problem'
        ordering = ['-start_date']
        verbose_name = _('과제문제: 과제문제')
        verbose_name_plural = _('과제문제: 과제문제')
        indexes = [
            models.Index(fields=['section', '-start_date']),
            models.Index(fields=['problem']),
            models.Index(fields=['start_date', 'due_date']),
        ]
        constraints = [
            models.CheckConstraint(check=Q(due_date__gt=F('start_date')),
                                   name='sectionproblem_due_gt_start'),
            models.UniqueConstraint(fields=['section', 'problem', 'start_date', 'due_date', 'is_delete'],
                                    name='uniq_section_problem_window'),
        ]

    def __str__(self):
        return f'{self.id}_({self.section_id}, {self.problem_id})'

class LanguageInSectionProblem(SoftDeleteModel):
    section_problem = models.ForeignKey(
        SectionProblem,
        related_name='language_links',
        verbose_name=_('과제 문제'),
        db_column='sectionProblem',
        null=True,
        on_delete=models.SET_NULL,
    )
    language = models.ForeignKey(
        Language,
        related_name='language_links',
        verbose_name=_('언어'),
        db_column='language',
        null=True,
        on_delete=models.SET_NULL,
    )

    class Meta:
        db_table = 'LANGUAGE_IN_SECTIONPROBLEM'
        ordering = ['section_problem', 'language'] 
        unique_together = [('section_problem', 'language', 'is_delete')]
