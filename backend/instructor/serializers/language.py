from django.contrib.auth import get_user_model

from api import models

from rest_framework import serializers

User = get_user_model()


class LanguageSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.Language
        fields = ['id', 'language_name', 'compile_command', 'run_command', 'limit_time_exp', 'limit_memory_exp']


class LanguageSimpleSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.Language
        fields = ['id', 'language_name']
        read_only_fields = ['name']
