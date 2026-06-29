from django.conf import settings
from django.urls import re_path, include

from api import routers


router = routers.AppRouter()
# router.register(r'test', views.api.TestViewSet, basename='test')

_cache_timeout = 0 if settings.DEBUG else 3600
urlpatterns = [
    re_path(r'^', include(router.urls)),
]
