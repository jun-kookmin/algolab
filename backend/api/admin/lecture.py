from django.contrib import admin
from ..models import Lecture, StudentInLecture, LanguageInLecture
from .soft_delete import SoftDeleteAdmin


class StudentInLectureInline(admin.TabularInline):
    model = StudentInLecture
    extra = 0
    fields = ('id', 'uuid', 'student', 'role', 'student_code')
    readonly_fields = ('id', 'uuid')
    autocomplete_fields = ('student',)


class LanguageInLectureInline(admin.TabularInline):
    model = LanguageInLecture
    extra = 0
    fields = ('id', 'language')
    readonly_fields = ('id',)
    autocomplete_fields = ('language',)


@admin.register(Lecture)
class LectureAdmin(SoftDeleteAdmin):
    list_display = ('id', 'uuid', 'lecture_name', 'instructor', 'weeks', 'start_date', 'end_date')
    list_filter = ('weeks', 'start_date', 'end_date')
    search_fields = ('lecture_name', 'instructor__username')
    ordering = ('-id',)
    autocomplete_fields = ('instructor',)
    inlines = [StudentInLectureInline, LanguageInLectureInline]



@admin.register(StudentInLecture)
class StudentInLectureAdmin(SoftDeleteAdmin):
    list_display = ('lecture', 'uuid', 'student', 'role', 'student_code')
    list_filter = ('role',)
    search_fields = ('lecture__lecture_name', 'student__username')
    show_full_result_count = False
    autocomplete_fields = ('lecture', 'student')
    list_select_related = ('lecture', 'student')


@admin.register(LanguageInLecture)
class LanguageInLectureAdmin(SoftDeleteAdmin):
    list_display = ('lecture', 'language')
    list_filter = ('lecture', 'language')
    search_fields = ('lecture__lecture_name', 'language__language_name')
    autocomplete_fields = ('lecture', 'language')
    list_select_related = ('lecture', 'language')
