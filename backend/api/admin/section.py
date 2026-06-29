from django.contrib import admin
from ..models import Section, SectionProblem
from .soft_delete import SoftDeleteAdmin


class SectionProblemInline(admin.TabularInline):
    model = SectionProblem
    extra = 0
    fields = ('id', 'uuid', 'problem', 'start_date', 'due_date')
    readonly_fields = ('id', 'uuid')
    autocomplete_fields = ('problem',)


@admin.register(Section)
class SectionAdmin(SoftDeleteAdmin):
    list_display = (
        'id', 'uuid', 'section_name', 'lecture', 'week', 'share',
    )
    list_filter = ('lecture', 'week', 'share')
    search_fields = ('section_name', 'lecture__lecture_name')
    ordering = ('-id',)
    list_select_related = ('lecture',)
    autocomplete_fields = ('lecture',)
    inlines = [SectionProblemInline]



@admin.register(SectionProblem)
class SectionProblemAdmin(SoftDeleteAdmin):
    list_display = ('id', 'uuid', 'section', 'problem', 'start_date', 'due_date')
    list_filter = ('section__lecture', 'section', 'start_date', 'due_date')
    search_fields = (
        'section__section_name',
        'section__lecture__lecture_name',
        'problem__problem_name'
    )
    ordering = ('-start_date',)
    list_select_related = ('section', 'section__lecture', 'problem')
    autocomplete_fields = ('section', 'problem')
