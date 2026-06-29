import uuid
from django.db import models
from django.contrib.auth import get_user_model
from django.utils.translation import gettext_lazy as _

from .section import SectionProblem, Section
from .exam import Exam, ExamProblem 
from .language import Language
from .soft_delete import SoftDeleteModel

user = get_user_model()

class ProblemSubmit(SoftDeleteModel):
    id = models.BigAutoField(
        primary_key=True,
        db_column='SolveID',
        verbose_name=_('풀이 고유 INDEX'),
    )
    uuid = models.UUIDField(
        default=uuid.uuid4,
        unique=True,
        db_index=True,
        editable=False,
        verbose_name=_('풀이 UUID'),
    )
    
    user = models.ForeignKey(
        user,
        related_name='ProblemSubmit_submit',
        verbose_name=_('유저 INDEX'),
        db_column='UserId',
        on_delete=models.CASCADE,
    )
    
    section = models.ForeignKey(
        Section,
        related_name='ProblemSubmit_section',
        verbose_name=_('섹션 고유 INDEX'),
        db_column='SectionID',
        on_delete=models.CASCADE,
    )
    
    section_problem = models.ForeignKey(
        SectionProblem,
        related_name='ProblemSubmit_sectionproblem',
        verbose_name=_('과제문제 고유 INDEX'),
        db_column='SectionProblemID',
        on_delete=models.CASCADE,
    )
    
    code = models.TextField(
        verbose_name=_('풀이코드'),
        db_column='Code',
    )
    
    score = models.IntegerField(
        verbose_name=_('점수'),
        db_column='Score',
        null=True,
        blank=True,
    )
    
    language = models.ManyToManyField(
        Language,
        verbose_name=_('풀이언어'),
        through='LanguageInProblemSubmit',
        through_fields=('problem_submit', 'language'),
        blank=True,
    )
    
    submission_time = models.DateTimeField(
        verbose_name=_('제출시간'),
        db_column='SubmissionTime',
    )
    # null
    execution_time = models.FloatField(
        verbose_name=_('실행시간'),
        db_column='ExecutionTime',
        null=True,
        blank=True,
    )
    # null
    error_message = models.TextField(
        verbose_name=_('오류내용'),
        db_column='ErrorMessage',
        null=True,
        blank=True,
    )
    
    submission_count = models.IntegerField(
        verbose_name=_('제출횟수'),
        db_column='SubmissionCount',
    )
    
    judge_count = models.IntegerField(
        verbose_name=_('채점횟수'),
        db_column='JudgeCount',
    )
    
    status = models.TextField(
        verbose_name=_('채점상태'),
        db_column='Status',
    )

    like_count = models.PositiveIntegerField(
        verbose_name=_('좋아요 수'),
        db_column='LikeCount',
        default=0,
    )

    view_count = models.PositiveIntegerField(
        verbose_name=_('조회수'),
        db_column='ViewCount',
        default=0,
    )
    
    memory = models.IntegerField(
        verbose_name=_('메모리'),
        db_column='Memory',
        null=True,
        blank=True,
    )

    is_late = models.BooleanField(
        verbose_name=_('지각 제출 여부'),
        db_column='IsLate',
        default=False,
    )

    def __str__(self):
        return '{}_({})'.format(self.id, self.section_problem.id)

    class Meta:
        db_table = 'problem_submit'
        ordering = ['id', 'user']
        verbose_name = _('과제풀이: 과제풀이')
        verbose_name_plural = _('과제풀이: 과제풀이')
        indexes = [
            models.Index(fields=['user', 'section', 'section_problem'], name='ps_user_sec_sp_idx'),
            models.Index(fields=['section_problem', 'user'], name='ps_sp_user_idx'),
            models.Index(fields=['section_problem', 'user', '-submission_time', '-id'], name='ps_sp_user_time_idx'),
        ]

class LanguageInProblemSubmit(SoftDeleteModel):
    problem_submit = models.ForeignKey(
        ProblemSubmit,
        related_name='LanguageInProblemSubmit_problemsubmit',
        verbose_name=_('과제풀이'),
        db_column='PROB_SUBMIT',
        on_delete=models.CASCADE,
    )
    
    language = models.ForeignKey(
        Language,
        related_name='LanguageInProblemSubmit_language',
        verbose_name=_('언어'),
        db_column='LANG',
        on_delete=models.CASCADE,
    )
    
    class Meta:
        db_table = 'LANGUAGE_IN_PROBLEMSUBMIT'
        ordering = ['id']
        unique_together = [('problem_submit', 'language', 'is_delete'),]
        verbose_name = _('과제풀이: 사용언어')
        verbose_name_plural = _('과제풀이: 사용언어')
        
class ExamSubmit(SoftDeleteModel):
    id = models.BigAutoField(
        primary_key=True,
        db_column='SubmitID',
        verbose_name=_('풀이 고유 INDEX'),
    )
    uuid = models.UUIDField(
        default=uuid.uuid4,
        unique=True,
        db_index=True,
        editable=False,
        verbose_name=_('시험 풀이 UUID'),
    )
    
    user = models.ForeignKey(
        user,
        related_name='ExamSubmit_user',
        verbose_name=_('유저 INDEX'),
        db_column='UserId',
        on_delete=models.CASCADE,
    )
    
    exam = models.ForeignKey(
        Exam,
        related_name='ExamSubmit_exam',
        verbose_name=_('시험 고유 INDEX'),
        db_column='ExamID',
        on_delete=models.CASCADE,
    )
    
    problem = models.ForeignKey(
        ExamProblem,
        related_name='ExamSubmit_problem',
        verbose_name=_('문제 고유 INDEX'),
        db_column='ProblemID',
        on_delete=models.CASCADE,
    )
    
    code = models.TextField(
        verbose_name=_('풀이코드'),
        db_column='Code',
    )
    
    score = models.IntegerField(
        verbose_name=_('점수'),
        db_column='Score',
        null=True,
        blank=True,
    )
    
    language = models.ManyToManyField(
        Language,
        verbose_name=_('풀이언어'),
        db_column='ExamSubmitLanguage',
        through='LanguageInExamSubmit',
        through_fields=('exam_submit', 'language'),
        blank=True,
    )
    
    submission_time = models.DateTimeField(
        verbose_name=_('제출시간'),
        db_column='SubmissionTime',
    )
    
    ip = models.CharField(
        verbose_name=_('회원별 고유 IP'),
        db_column='IP',
        max_length=100,
    )
    
    execution_time = models.FloatField(
        verbose_name=_('실행시간'),
        db_column='ExecutionTime',
        null=True,
        blank=True,
    )
    
    error_message = models.TextField(
        verbose_name=_('오류내용'),
        db_column='ErrorMessage',
        null=True,
        blank=True,
    )
    
    submission_count = models.IntegerField(
        verbose_name=_('제출 횟수'),
        db_column='SubmissionCount',
    )
    
    judge_count = models.IntegerField(
        verbose_name=_('채점 횟수'),
        db_column='JudgeCount',
    )
    
    status = models.TextField(
        verbose_name=_('채점 상태'),
        db_column='Status',
    )

    like_count = models.PositiveIntegerField(
        verbose_name=_('좋아요 수'),
        db_column='LikeCount',
        default=0,
    )

    view_count = models.PositiveIntegerField(
        verbose_name=_('조회수'),
        db_column='ViewCount',
        default=0,
    )
    
    memory = models.IntegerField(
        verbose_name=_('메모리'),
        db_column='Memory',
        null=True,
        blank=True,
    )

    class Meta:
        db_table = 'exam_submit'
        ordering = ['id']
        verbose_name = _('시험풀이: 시험풀이')
        verbose_name_plural = _('시험풀이: 시험풀이')
        indexes = [
            models.Index(fields=['user', 'exam', 'problem'], name='es_user_exam_pb_idx'),
            models.Index(fields=['problem', 'user', 'exam'], name='es_pb_user_exam_idx'),
            models.Index(fields=['problem', 'user', '-submission_time', '-id'], name='es_pb_user_time_idx'),
        ]


class LanguageInExamSubmit(SoftDeleteModel):
    exam_submit = models.ForeignKey(
        ExamSubmit,
        related_name='LanguageInExamSubmit_examsubmit',
        verbose_name=_('시험풀이'),
        db_column='EXAM-SUB',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
    )
    
    language = models.ForeignKey(
        Language,
        related_name='LanguageInExamSubmit_language',
        verbose_name=_('언어'),
        db_column='LANG',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
    )


    class Meta:
        db_table = 'LANGUAGE_IN_EXAMSUBMIT'
        ordering = ['id']
        unique_together = [('exam_submit', 'language', 'is_delete'),]
        verbose_name = _('시험풀이: 사용언어')
        verbose_name_plural = _('시험풀이: 사용언어')
