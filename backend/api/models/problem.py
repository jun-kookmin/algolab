import os
import uuid
from django.db import models
from django.contrib.auth import get_user_model
from django.utils.translation import gettext_lazy as _
from django.core.exceptions import ValidationError

from .language import Language
from .soft_delete import SoftDeleteModel

user = get_user_model()

PROBLEM_TYPE = (
    ('PS', '솔루션'),
    ('PC', '체커'),
)

PROBLEM_LEVEL = (
    (1, '하'),
    (2, '중'),
    (3, '상'),
)

def validate_file_extension(value):
    ext = os.path.splitext(value.name)[1] # [0] returns path+filename
    valid_extensions = ['.pdf']
    if not ext.lower() in valid_extensions: 
        raise ValidationError('Unsupported file extension.')

class Problem(SoftDeleteModel):
    id = models.BigAutoField(
        primary_key=True,
        db_column='ProblemID',
        verbose_name=_('문제 고유 ID'),
    )
    uuid = models.UUIDField(
        default=uuid.uuid4,
        unique=True,
        db_index=True,
        editable=False,
        verbose_name=_('문제 UUID'),
    )

    maker = models.ForeignKey(
        user,
        related_name='Problem_user',
        verbose_name=_('출제자 유저 INDEX'),
        db_column='UserID',
        on_delete=models.CASCADE,
    )

    problem_name = models.CharField(
        verbose_name=_('문제이름'),
        db_column='ProblemName',
        max_length=50,
        default='생성중인 문제',
        db_index=True,
    )

    description = models.TextField(
        verbose_name=_('문제설명'),
        db_column='ProblemContent',
        blank=True,
        null=True,
        default=''
    )

    language = models.ManyToManyField(
        Language,
        related_name='problem_language',
        verbose_name=_('사용언어'),
        through='LanguageInProblem',
        through_fields=('problem', 'language'),
        blank=True,
    )

    type = models.CharField(
        verbose_name=_('문제타입'),
        db_column='ProblemType',
        max_length=2,
        choices=PROBLEM_TYPE,
        default='PS',
        db_index=True,
    )

    difficulty  = models.PositiveSmallIntegerField(
        verbose_name=_('난이도'),
        db_column='LEV',
        choices=PROBLEM_LEVEL,
        default=1,
        db_index=True,
    )

    created_date = models.DateTimeField(
        verbose_name=_('등록일'),
        db_column='CreateDate',
        auto_now_add=True,
    )

    update_date = models.DateTimeField(
        verbose_name=_('수정일'),
        db_column='UpdateDate',
        auto_now=True,
    )

    limit_time = models.PositiveIntegerField(
        verbose_name=_('제한시간(ms)'),
        db_column='LimitTime',
        help_text=_('밀리초 단위'),
    )

    limit_memory = models.PositiveIntegerField(
        verbose_name=_('제한메모리(MB)'),
        db_column='LimitMemory',
        help_text=_('메가바이트 단위'),
    )

    share = models.BooleanField(
        verbose_name=_('공유여부'),
        db_column='Share',
        default=False,
    )
    
    class Meta:
        db_table = 'problem'
        ordering = ['id', 'maker']
        verbose_name = _('문제: 문제')
        verbose_name_plural = _('문제: 문제')

    def __str__(self):
        return f'{self.id}_{self.problem_name}'


class ProblemTemplate(SoftDeleteModel):
    id = models.BigAutoField(
        primary_key=True,
        db_column='TemplateID',
        verbose_name=_('샘플코드 고유 INDEX'),
    )
    uuid = models.UUIDField(
        default=uuid.uuid4,
        unique=True,
        db_index=True,
        editable=False,
        verbose_name=_('샘플코드 UUID'),
    )

    problem = models.ForeignKey(
        Problem,
        related_name='ProblemTemplate_problem',
        verbose_name=_('문제 고유 INDEX'),
        db_column='ProblemID',
        on_delete=models.CASCADE,
    )

    template_name = models.CharField(
        verbose_name=_('샘플파일이름'),
        db_column='TemplateName',
        max_length=100,
        default='main.cpp',
    )

    template_content = models.TextField(
        verbose_name=_('파일내용'),
        db_column='TemplateContent',
    )

    class Meta:
        db_table = 'problem_template'
        ordering = ['problem', 'id']
        verbose_name = _('문제: 템플릿 코드')
        verbose_name_plural = _('문제: 템플릿 코드')

    def __str__(self):
        return f'{self.id}_({self.problem_id}, {self.template_name})'


class ProblemInOut(SoftDeleteModel):
    id = models.BigAutoField(
        primary_key=True,
        db_column='InOutID',
        verbose_name=_('입출력 고유 INDEX'),
    )
    uuid = models.UUIDField(
        default=uuid.uuid4,
        unique=True,
        db_index=True,
        editable=False,
        verbose_name=_('입출력 UUID'),
    )

    problem = models.ForeignKey(
        Problem,
        related_name='ProblemInOut_problem',
        verbose_name=_('문제 고유 INDEX'),
        db_column='ProblemID',
        on_delete=models.CASCADE,
    )

    input_code = models.TextField(
        verbose_name=_('입력'),
        db_column='Input',
    )

    output_code = models.TextField(
        verbose_name=_('출력'),
        db_column='Output',
    )

    def __str__(self):
        return f'{self.id}_({self.problem_id})'

    class Meta:
        db_table = 'problem_inout'
        ordering = ['id', 'problem']
        verbose_name = _('문제입출력: 문제입출력')
        verbose_name_plural = _('문제입출력: 문제입출력')


class ProblemChecker(SoftDeleteModel):
    id = models.BigAutoField(
        primary_key=True,
        db_column='CheckerID',
        verbose_name=_('체커코드 고유 INDEX'),
    )
    uuid = models.UUIDField(
        default=uuid.uuid4,
        unique=True,
        db_index=True,
        editable=False,
        verbose_name=_('체커코드 UUID'),
    )

    problem = models.ForeignKey(
        Problem,
        related_name='ProblemChecker_problem',
        verbose_name=_('문제 고유 ID'),
        db_column='ProblemID',
        on_delete=models.CASCADE,
    )

    name = models.CharField(
        verbose_name=_('체커 코드 이름'),
        db_column='CheckerName',
        max_length=20
    )

    code = models.TextField(
        verbose_name=_('체커 코드 내용'),
        db_column='CheckerCode'
    )

    checker_language = models.ManyToManyField(
        Language,
        related_name='checker_language',
        verbose_name=_('체커 사용 언어'),
        blank=True,
        through='LanguageInChecker',
        through_fields=('checker', 'language'),
    )

    def __str__(self):
        return f'{self.id}_({self.problem_id})'

    class Meta:
        db_table = 'problem_checker'
        ordering = ['id', 'problem']
        verbose_name = _('체커코드: 체커코드')
        verbose_name_plural = _('체커코드: 체커코드')


class LanguageInChecker(SoftDeleteModel):
    checker = models.ForeignKey(
        ProblemChecker,
        related_name='LanguageInChecker_checker',
        verbose_name=_('체커'),
        db_column='CheckerLang',
        on_delete=models.CASCADE,
        null=True,
    )

    language = models.ForeignKey(
        Language,
        related_name='LanguageInChecker_language',
        verbose_name=_('언어'),
        db_column='CheckkerLang',
        on_delete=models.CASCADE,
        null=True,
    )

    class Meta:
        db_table = 'LANGUAGE_IN_CHECKER'
        ordering = ['checker', 'language']
        unique_together = [('checker', 'language', 'is_delete')]
        verbose_name = _('체커: 사용언어')
        verbose_name_plural = _('체커: 사용언어')


class LanguageInProblem(SoftDeleteModel):
    problem = models.ForeignKey(
        Problem,
        related_name='LanguageInProblem_problem',
        verbose_name=_('문제'),
        db_column='PROB',
        null=True,
        on_delete=models.SET_NULL,
    )

    language = models.ForeignKey(
        Language,
        related_name='LanguageInProblem_language',
        verbose_name=_('언어'),
        db_column='LANG',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
    )

    class Meta:
        db_table = 'LANGUAGE_IN_PROBLEM'
        ordering = ['id', 'problem']
        unique_together = [('problem', 'language', 'is_delete')]
        verbose_name = _('문제: 사용언어')
        verbose_name_plural = _('문제: 사용언어')
