from django.apps import AppConfig


class ApiConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'api'

    def ready(self):
        # 시그널 리시버 등록을 위한 import (side effect)
        from . import signals  # noqa: F401
