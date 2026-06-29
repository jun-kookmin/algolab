from django.contrib.auth import get_user_model

from api import models

from rest_framework import serializers

from .problem import SimpleProblemSerializer, ProblemInPartSerializer
from .account import UserSerializer

User = get_user_model()


class CurrentCourseDefault():
    requires_context = True

    def __call__(self, serializer_field):
        return serializer_field.context['view'].kwargs['uuid']


class SimplePartSerializer(serializers.ModelSerializer):
    course_uuid = serializers.HiddenField(write_only=True, required=False, default=CurrentCourseDefault())
    # problem_cnt = serializers.IntegerField(read_only=True)
    problem_count = serializers.IntegerField(source='problem.count', read_only=True)

    class Meta:
        model = models.Part
        fields = ['uuid', 'name', 'type', 'order', 'problem_count',
                  'open_date', 'start_date', 'end_date', 'created_date', 'is_delete', 'is_open', 'course_uuid']

    def create(self, validated_data):
        course_uuid = validated_data.pop('course_uuid')
        course = models.Course.objects.get(uuid=course_uuid)
        validated_data.setdefault('course', course)

        return super(SimplePartSerializer, self).create(validated_data)


class PartSerializer(serializers.ModelSerializer):
    course_uuid = serializers.HiddenField(write_only=True, required=False, default=CurrentCourseDefault())
    problem_count = serializers.IntegerField(source='problem.count', read_only=True)
    problems = ProblemInPartSerializer(source='probleminpart_set', many=True, read_only=True)
    problem_uuids = serializers.SlugRelatedField(many=True, queryset=models.Problem.objects.all(), write_only=True,
                                   allow_null=True, allow_empty=True, required=False, slug_field='uuid')

    def create(self, validated_data):
        course_uuid = validated_data.pop('course_uuid')
        course = models.Course.objects.get(uuid=course_uuid)
        validated_data.setdefault('course', course)
        validated_data.setdefault('problem', validated_data.pop('problem_uuids'))

        return super(PartSerializer, self).create(validated_data)
    class Meta:
        model = models.Part
        fields = ['uuid', 'name', 'type', 'order', 'problem_count',
                  'open_date', 'start_date', 'end_date', 'created_date',
                  'is_delete', 'is_open', 'problems', 'problem_uuids', 'course_uuid']


class CurriculumPartSerializer(serializers.ModelSerializer):
    problem = SimpleProblemSerializer(many=True, read_only=True)

    class Meta:
        model = models.Part
        fields = ['id', 'name', 'type', 'open_date', 'start_date', 'end_date', 'created_date', 'is_delete',
                  'problem']


class StudentInPartSerializer(serializers.ModelSerializer):
    student_ids = serializers.PrimaryKeyRelatedField(write_only=True, many=True,
                                                     queryset=models.StudentInPart.objects.all())
    students = UserSerializer(source='student', read_only=True)

    class Meta:
        model = models.StudentInCourse
        fields = ['id', 'students', 'student_ids']
        read_only_fields = ['id', ]
