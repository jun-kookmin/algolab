from django.contrib import admin
from ..models import (
    ProblemSubmit, LanguageInProblemSubmit,
    ExamSubmit, LanguageInExamSubmit
)
from .soft_delete import SoftDeleteAdmin


class LanguageInProblemSubmitInline(admin.TabularInline):
    model = LanguageInProblemSubmit
    extra = 0
    fields = ('id', 'language')
    readonly_fields = ('id',)
    autocomplete_fields = ('language',)


class LanguageInExamSubmitInline(admin.TabularInline):
    model = LanguageInExamSubmit
    extra = 0
    fields = ('id', 'language')
    readonly_fields = ('id',)
    autocomplete_fields = ('language',)


@admin.register(ProblemSubmit)
class ProblemSubmitAdmin(SoftDeleteAdmin):
    list_display = (
        'id', 'uuid', 'user', 'section', 'section_problem',
        'language_list',
        'submission_time', 'status', 'score',
        'execution_time', 'memory', 'is_late',
        'submission_count', 'judge_count',
    )
    list_filter = (
        'section__lecture', 'section', 'status', 'submission_time', 'is_late'
    )
    search_fields = (
        'user__username',
        'section__section_name',
        'section_problem__section__section_name',
        'section_problem__problem__problem_name',
        'error_message'
    )
    date_hierarchy = 'submission_time'
    ordering = ('-submission_time', '-id')
    autocomplete_fields = ('user', 'section', 'section_problem')
    list_select_related = (
        'user',
        'section',
        'section_problem', 'section_problem__section',
        'section_problem__problem'
    )

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        return qs.prefetch_related('language')

    def language_list(self, obj):
        return ", ".join(l.language_name for l in obj.language.all())
    language_list.short_description = 'language'

@admin.register(LanguageInProblemSubmit)
class LanguageInProblemSubmitAdmin(SoftDeleteAdmin):
    list_display = ('id', 'problem_submit', 'language')
    list_filter = ('problem_submit', 'language')
    search_fields = (
        'problem_submit__id',
        'problem_submit__user__username',
        'problem_submit__section__section_name',
        'language__language_name',
    )
    ordering = ('problem_submit', 'language')
    autocomplete_fields = ('problem_submit', 'language')
    list_select_related = ('problem_submit', 'language')

@admin.register(ExamSubmit)
class ExamSubmitAdmin(SoftDeleteAdmin):
    list_display = (
        'id', 'uuid', 'user', 'exam', 'problem', 'ip',
        'language_list',
        'submission_time', 'status', 'score',
        'execution_time', 'memory',
        'submission_count', 'judge_count',
    )
    list_filter = ('exam', 'exam__lecture', 'status', 'submission_time')
    search_fields = (
        'user__username',
        'exam__exam_name',
        'problem__exam__exam_name',
        'problem__problem__problem_name',
        'ip', 'error_message'
    )
    date_hierarchy = 'submission_time'
    ordering = ('-submission_time', '-id')
    autocomplete_fields = ('user', 'exam', 'problem')
    list_select_related = (
        'user',
        'exam', 'exam__lecture',
        'problem', 'problem__problem'
    )

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        return qs.prefetch_related('language')

    def language_list(self, obj):
        return ", ".join(l.language_name for l in obj.language.all())
    language_list.short_description = 'language'

@admin.register(LanguageInExamSubmit)
class LanguageInExamSubmitAdmin(SoftDeleteAdmin):
    list_display = ('exam_submit', 'language')
    list_filter = ('language',)
    search_fields = (
        'exam_submit__user__username',
        'exam_submit__exam__exam_name',
        'exam_submit__problem__problem__problem_name',
        'language__language_name'
    )
    ordering = ('exam_submit', 'language')
    autocomplete_fields = ('exam_submit', 'language')
    list_select_related = ('exam_submit', 'language')
