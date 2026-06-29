from django.contrib import admin
from django.contrib.auth import get_user_model
from ..models import (
    Problem, ProblemTemplate, ProblemInOut,
    ProblemChecker, LanguageInChecker, LanguageInProblem
)
from .soft_delete import SoftDeleteAdmin

User = get_user_model()


class ProblemTemplateInline(admin.TabularInline):
    model = ProblemTemplate
    extra = 0
    fields = ('id', 'uuid', 'template_name', 'template_content')
    readonly_fields = ('id', 'uuid')


class ProblemInOutInline(admin.TabularInline):
    model = ProblemInOut
    extra = 1
    fields = ('id', 'uuid', 'input_code', 'output_code')
    readonly_fields = ('id', 'uuid')
    show_change_link = True

class ProblemCheckerInline(admin.TabularInline):
    model = ProblemChecker
    extra = 0
    fields = ('id', 'uuid', 'name', 'code')
    readonly_fields = ('id', 'uuid')
    show_change_link = True


class LanguageInProblemInline(admin.TabularInline):
    model = LanguageInProblem
    extra = 0
    fields = ('id', 'language')
    readonly_fields = ('id',)
    autocomplete_fields = ('language',)


class LanguageInCheckerInline(admin.TabularInline):
    model = LanguageInChecker
    extra = 0
    fields = ('id', 'language')
    readonly_fields = ('id',)
    autocomplete_fields = ('language',)


@admin.register(Problem)
class ProblemAdmin(SoftDeleteAdmin):
    list_display = (
        'id', 'uuid', 'problem_name', 'maker', 'type', 'difficulty', 'share',
        'limit_time', 'limit_memory', 'created_date', 'update_date',
    )
    list_filter = ('type', 'difficulty', 'created_date', 'update_date')
    search_fields = (
        'problem_name', 'description',
        'maker__username',
    )
    ordering = ('-id',)
    date_hierarchy = 'created_date'
    autocomplete_fields = ('maker',)
    list_select_related = ('maker',)
    fieldsets = (
        ('기본 정보', {'fields': ('maker', 'problem_name', 'share','description')}),
        ('문제 설정', {'fields': ('type', 'difficulty', 'limit_time', 'limit_memory')}),
        ('파일/메타', {'fields': ('created_date', 'update_date')}),
    )
    readonly_fields = ('created_date', 'update_date')
    inlines = [
        ProblemTemplateInline,
        ProblemInOutInline,
        ProblemCheckerInline,
        LanguageInProblemInline,
    ]

@admin.register(ProblemTemplate)
class ProblemTemplateAdmin(SoftDeleteAdmin):
    list_display = ('id', 'uuid', 'problem', 'template_name')
    list_filter = ('problem',)
    search_fields = ('problem__problem_name', 'template_name', 'template_content')
    ordering = ('problem', 'id')
    autocomplete_fields = ('problem',)
    list_select_related = ('problem',)


@admin.register(ProblemInOut)
class ProblemInOutAdmin(SoftDeleteAdmin):
    list_display = ('id', 'uuid', 'problem')
    list_filter = ('problem',)
    search_fields = ('problem__problem_name', 'input_code', 'output_code')
    ordering = ('problem', 'id')
    autocomplete_fields = ('problem',)
    list_select_related = ('problem',)


@admin.register(ProblemChecker)
class ProblemCheckerAdmin(SoftDeleteAdmin):
    list_display = ('id', 'uuid', 'problem', 'name')
    list_filter = ('problem',)
    search_fields = ('problem__problem_name', 'name', 'code')
    ordering = ('problem', 'id')
    autocomplete_fields = ('problem',)
    list_select_related = ('problem',)
    inlines = [LanguageInCheckerInline]


@admin.register(LanguageInProblem)
class LanguageInProblemAdmin(SoftDeleteAdmin):
    list_display = ('problem', 'language')
    list_filter = ('problem', 'language')
    search_fields = ('problem__problem_name', 'language__language_name')
    ordering = ('problem', 'language')
    autocomplete_fields = ('problem', 'language')
    list_select_related = ('problem', 'language')


@admin.register(LanguageInChecker)
class LanguageInCheckerAdmin(SoftDeleteAdmin):
    list_display = ('checker', 'language')
    list_filter = ('checker', 'language')
    search_fields = ('checker__name', 'checker__problem__problem_name', 'language__language_name')
    ordering = ('checker', 'language')
    autocomplete_fields = ('checker', 'language')
    list_select_related = ('checker', 'language')
