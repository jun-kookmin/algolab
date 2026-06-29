from django.contrib import admin
from ..models.language import Language
from .soft_delete import SoftDeleteAdmin


@admin.register(Language)
class LanguageAdmin(SoftDeleteAdmin):
    model = Language
    list_display = (
        'id', 'language_name', 'version',
        'build_command', 'grade_command',
        'additional_memory', 'additional_time'
    )
    search_fields = ('language_name', 'version')
    ordering = ('id',)
