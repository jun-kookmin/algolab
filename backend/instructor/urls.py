from django.conf import settings
from django.http import HttpResponseNotFound
from django.urls import re_path, include

from api import routers

from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView, SpectacularRedocView
from rest_framework.permissions import IsAdminUser
from instructor.views.api.problem import ProblemViewSet
from instructor.views.api.lecture.lecture import LectureViewSet
from instructor.views.api.lecture.homework import LectureSectionViewSet
from instructor.views.api.lecture.exam import LectureExamViewSet
from instructor.views.api.submission.exam import ExamSubmissionViewSet
from instructor.views.api.submission.homework import HomeworkSubmissionViewSet
from instructor.views.api.submission.submission import UnifiedSubmissionViewSet
from instructor.views.api.solve.exam import ExamSolveViewSet
from instructor.views.api.solve.homework import HomeworkSolveViewSet
from instructor.views.api.execution import ExecutionViewSet
from instructor.views.api.board import BoardViewSet, PostViewSet, PostReplyViewSet
from instructor.views.api.language import LanguageViewSet

from rest_framework_nested.routers import NestedSimpleRouter


router = routers.AppRouter()

router.register(r'lectures', LectureViewSet, basename='lectures')
lectures_router = NestedSimpleRouter(router, r'lectures', lookup='lectures')
lectures_router.register(r'homework', LectureSectionViewSet, basename='lecture-homeworks')
lectures_router.register(r'exams', LectureExamViewSet, basename='lecture-exams')
lectures_router.register(r'submissions/exam', ExamSubmissionViewSet, basename='submissions-exam')
lectures_router.register(r'submissions/homework', HomeworkSubmissionViewSet, basename='submissions-homework')
router.register(r'submissions', UnifiedSubmissionViewSet, basename='submissions')
router.register(r'problems', ProblemViewSet, basename='problems')
router.register(r'languages', LanguageViewSet, basename='languages')
router.register(r'solve/homework', HomeworkSolveViewSet, basename='solve-homework')
router.register(r'solve/exam', ExamSolveViewSet, basename='solve-exam')
router.register(r"execution", ExecutionViewSet, basename="execution")
router.register(r"posts", PostViewSet, basename="posts")
router.register(r"boards", BoardViewSet, basename="boards")
posts_router = NestedSimpleRouter(router, r'posts', lookup='post')
posts_router.register(r'replies', PostReplyViewSet, basename='post-replies')

# course_router = NestedSimpleRouter(router, r'course', lookup='course')
# course_router.register(r'student', views.api.course.StudentViewSet, basename='course-student')
# course_router.register(r'part', views.api.part.PartViewSet, basename='course-part')

# v1_api_info = openapi.Info(
#     title="Algolab API 문서",
#     default_version="v1",
#     description="Algolab API 문서화",
#     contact=openapi.Contact(email="admin@example.com"),
# )
# # noinspection PyTypeChecker
# v1_schema_view = get_schema_view(
#     v1_api_info,
#     # validators=["flex", "ssv"],
#     public=True,
#     # permission_classes=(
#     #     permissions.IsAdminUser,
#     # ),
#     # authentication_classes=(
#     #     authentication.SessionAuthentication,
#     # ),
# )

_cache_timeout = 0 if settings.DEBUG else 3600


def _block_instructor_api_root(request, *args, **kwargs):
    return HttpResponseNotFound()


urlpatterns = [
    re_path(r'^$', _block_instructor_api_root),
    re_path(r'^', include(router.urls)),
    re_path(r'^', include(lectures_router.urls)),
    re_path(r'^', include(posts_router.urls)),
    # 온라인 API 문서화
    re_path('schema/', SpectacularAPIView.as_view(permission_classes=[IsAdminUser]), name='schema'),
    re_path(
        'swagger/',
        SpectacularSwaggerView.as_view(url_name='schema', permission_classes=[IsAdminUser]),
        name='swagger-ui',
    ),
    re_path(
        'redoc/',
        SpectacularRedocView.as_view(url_name='schema', permission_classes=[IsAdminUser]),
        name='redoc',
    ),
]
