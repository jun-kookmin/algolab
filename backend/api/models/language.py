from django.db import models
from django.utils.translation import gettext_lazy as _

from .soft_delete import SoftDeleteModel


class Language(SoftDeleteModel):
    id = models.BigAutoField(
        primary_key=True,
        db_column='Seq',
        verbose_name=_('language 고유 INDEX'),
    )
    
    language_name = models.CharField(
        verbose_name=_('언어이름'),
        db_column='language_name',
        max_length=100,
    )
    
    version = models.CharField(
        verbose_name=_('버전'),
        db_column='version',
        max_length=100,
    )

    build_command = models.TextField(
        verbose_name=_('빌드명령어'),
        db_column='build_command',
    )
    
    grade_command = models.TextField(
        verbose_name=_('채점명령어'),
        db_column='grade_command',
    )
    
    # *2 등의 방식으로 eval 된다.
    additional_memory = models.CharField(
        verbose_name=_('추가메모리'),
        db_column='additional_memory',
        max_length=50,
    )
    
    # *2 등의 방식으로 eval 된다.
    additional_time = models.CharField(
        verbose_name=_('추가시간'),
        db_column='additional_time',
        max_length=50,
    )

    def __str__(self):
        return '{}_({})'.format(self.id, self.language_name)

    class Meta:
        db_table = 'language'
        ordering = ['id', 'language_name',]
        verbose_name = _('언어: 언어')
        verbose_name_plural = _('언어: 언어')
