from django.contrib.auth import get_user_model

from api import models

from rest_framework import serializers

from .language import LanguageSimpleSerializer
from ..constants import normalize_language_name

User = get_user_model()


class CurrentCourseDefault():
    requires_context = True

    def __call__(self, serializer_field):
        kwargs = serializer_field.context['view'].kwargs
        return (
            kwargs.get("course_uuid")
            or kwargs.get("course_pk")
            or kwargs.get("course_id")
            or kwargs.get("pk")
        )


class CurrentInstructorDefault():
    requires_context = True

    def __call__(self, serializer_field):
        return User.objects.get(username='1998546') #serializer_field.context['request'].user


class CourseSerializer(serializers.ModelSerializer):
    class LegacyCourseLanguagePKField(serializers.PrimaryKeyRelatedField):
        """과거 클라이언트에서 언어 인덱스(0~3) 또는 별칭을 보내도 DB PK로 매핑."""

        def to_internal_value(self, data):
            if isinstance(data, bool):
                return super().to_internal_value(data)

            if data is None or (isinstance(data, str) and not data.strip()):
                return None

            legacy_name = normalize_language_name(data)
            if legacy_name is not None:
                language = models.Language.objects.filter(
                    language_name__iexact=legacy_name,
                    is_delete=False,
                ).first()
                if language is not None:
                    data = language.pk

            return super().to_internal_value(data)

    language_id = LegacyCourseLanguagePKField(write_only=True, many=True, queryset=models.Language.objects.all())
    language = LanguageSimpleSerializer(many=True, read_only=True)#, source='language')
    instructor = serializers.HiddenField(required=False, default=CurrentInstructorDefault())
    student_count = serializers.IntegerField(source='student.count', read_only=True)

    class Meta:
        model = models.Course
        fields = ['uuid', 'instructor', 'name', 'language', 'student_count', 'language_id',
                  'start_date', 'end_date', 'created_date', 'is_delete', 'is_open']
        read_only_fields = ['created_date']

    def create(self, validated_data):
        language = validated_data.pop('language_id')
        validated_data.setdefault('language', language)

        return super(CourseSerializer, self).create(validated_data)

    def update(self, instance, validated_data):
        language = validated_data.pop('language_id')

        if language is None:
            return super(CourseSerializer, self).update(instance, validated_data)

        old_language_ids = set(
            models.LanguageInCourse.objects
            .filter(course=instance, is_delete=False)
            .values_list("language_id", flat=True)
        )
        new_language_set = set(language)
        normalized_new = {getattr(item, "id", item) for item in new_language_set}
        normalized_new = {item for item in normalized_new if item}

        remove_ids = old_language_ids - set(normalized_new)
        if remove_ids:
            models.LanguageInCourse.objects.filter(
                course=instance,
                language_id__in=remove_ids,
                is_delete=False,
            ).delete()
        validated_data.setdefault('language', language)

        return super(CourseSerializer, self).update(instance, validated_data)


class SimpleStudentInCourseSerializer(serializers.ModelSerializer):
    id = serializers.ListSerializer(child=serializers.IntegerField())
    is_delete = serializers.BooleanField(default=False)

    class Meta:
        model = models.StudentInCourse
        fields = ['id', 'is_delete']


class StudentInCourseSerializer(serializers.ModelSerializer):
    name = serializers.SerializerMethodField()
    username = serializers.CharField(source='student.username')
    # students = UserSerializer(source='student', read_only=True)

    class Meta:
        model = models.StudentInCourse
        fields = ['id', 'name', 'username']
        # read_only_fields = ['id', ]

    def get_name(self, obj):
        student = getattr(obj, "student", None)
        if not student:
            return ""
        last_name = getattr(student, "last_name", "") or ""
        first_name = getattr(student, "first_name", "") or ""
        full = f"{last_name}{first_name}"
        return "".join(full.split())
