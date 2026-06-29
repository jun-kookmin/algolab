from django.urls import path
from .views import ExternalOAuthLogin
from .external_oauth.adapter import oauth2_login

app_name = "accounts"

urlpatterns = [
    path("oauth/authorize/", oauth2_login, name="oauth_authorize"),
    path("oauth/callback/", ExternalOAuthLogin.as_view(), name="oauth_callback_legacy"),
]
