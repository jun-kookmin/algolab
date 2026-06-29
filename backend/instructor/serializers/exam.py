from django.contrib.auth import get_user_model
from rest_framework import serializers

from api import models

User = get_user_model()


class ExamSerializer(serializers.ModelSerializer):
    problem_count = serializers.SerializerMethodField()
    uuid = serializers.UUIDField(read_only=True)
    
    class Meta:
        model = models.Exam
        fields = ['uuid', 'exam_name', 'description', 'problem_count', 'start_date', 'due_date']
    # 문제 수 
    def get_problem_count(self, obj):
        annotated_count = getattr(obj, "problem_count", None)
        if annotated_count is not None:
            return annotated_count
        return obj.ExamProblem_exam.count()


class ExamStudentListSerializer(ExamSerializer):
    class Meta(ExamSerializer.Meta):
        fields = ['uuid', 'exam_name', 'description', 'start_date', 'due_date']


class ExamDetailSerializer(serializers.ModelSerializer):
    exam_name = serializers.CharField()
    uuid = serializers.UUIDField(read_only=True)
    lecture_uuid = serializers.UUIDField(source="lecture.uuid", read_only=True)
    
    class Meta:
        model = models.Exam
        fields = ['uuid', 'lecture_uuid', 'exam_name', 'description', 'week', 'start_date', 'due_date', 'share']

class ExamProblemCreateSerializer(serializers.Serializer):
    problem = serializers.SlugRelatedField(
        slug_field="uuid",
        queryset=models.Problem.objects.all()
    )
    score = serializers.IntegerField(required=False, default=100)

class ExamSectionCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.Exam
        fields = ['exam_name', 'description', 'week', 'start_date', 'due_date', 'share']

class ExamProblemItemSerializer(serializers.Serializer):
    problem = serializers.SlugRelatedField(
        slug_field="uuid",
        queryset=models.Problem.objects.all()
    )
    score = serializers.IntegerField(required=False, default=0, min_value=0)


class ExamProblemSyncSerializer(serializers.Serializer):
    problems = ExamProblemItemSerializer(many=True)


class ExamProblemUpdateSerializer(serializers.Serializer):
    problems = ExamProblemItemSerializer(many=True)
