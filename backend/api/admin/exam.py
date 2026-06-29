from django.contrib import admin
from ..models.exam import Exam, ExamUser, ExamProblem
from .soft_delete import SoftDeleteAdmin


class ExamProblemInline(admin.TabularInline):
    model = ExamProblem
    extra = 0
    fields = ('id', 'uuid', 'problem', 'score')
    readonly_fields = ('id', 'uuid')
    autocomplete_fields = ('problem',)


class ExamUserInline(admin.TabularInline):
    model = ExamUser
    extra = 0
    fields = ('id', 'uuid', 'lecture_user', 'start_time', 'end_time', 'saved_code')
    readonly_fields = ('id', 'uuid')
    autocomplete_fields = ('lecture_user',)


@admin.register(Exam)
class ExamAdmin(SoftDeleteAdmin):
    list_display = ('id', 'uuid', 'exam_name', 'lecture', 'week', 'start_date', 'due_date', 'share')
    list_filter = ('lecture', 'week', 'share')
    search_fields = ('exam_name', 'lecture__lecture_name')
    ordering = ('-id',)
    date_hierarchy = 'start_date'
    autocomplete_fields = ('lecture',)
    inlines = [ExamProblemInline, ExamUserInline]


@admin.register(ExamUser)
class ExamUserAdmin(SoftDeleteAdmin):
    list_display = ('id', 'exam', 'lecture_user', 'start_time', 'end_time')
    list_filter = ('exam',)
    search_fields = ('exam__exam_name', 'lecture_user__student__username')
    ordering = ('-id',)
    autocomplete_fields = ('exam', 'lecture_user')
    list_select_related = ('exam', 'lecture_user')


@admin.register(ExamProblem)
class ExamProblemAdmin(SoftDeleteAdmin):
    list_display = ('id', 'exam', 'problem', 'score')
    list_filter = ('exam', 'problem')
    search_fields = ('exam__exam_name', 'problem__problem_name')
    ordering = ('-id',)
    autocomplete_fields = ('exam', 'problem')
    list_select_related = ('exam', 'problem')
