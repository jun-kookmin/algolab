from .provider import ExternalOAuthProvider
from .adapter import oauth2_callback
from allauth.socialaccount.providers.oauth2.urls import default_urlpatterns
from django.urls import path

urlpatterns = default_urlpatterns(ExternalOAuthProvider) + [
    path("oauth/complete/", oauth2_callback),
]
