import os

from allauth.socialaccount import app_settings
from allauth.socialaccount.adapter import get_adapter
from allauth.socialaccount.providers.oauth2.views import (
    OAuth2Adapter,
    OAuth2CallbackView,
    OAuth2LoginView,
)

from .utils import resolve_oauth_callback_url


class ExternalOAuth2Adapter(OAuth2Adapter):
    provider_id = "external_oauth"
    authorize_url = os.getenv(
        "OAUTH_AUTHORIZE_URL",
        "https://oauth.example.com/oauth/authorize/",
    )
    access_token_url = os.getenv(
        "OAUTH_TOKEN_URL",
        "https://oauth.example.com/oauth/token/",
    )
    profile_url = os.getenv(
        "OAUTH_PROFILE_URL",
        "https://oauth.example.com/api/v1/account/profile/me/",
    )

    settings = app_settings.PROVIDERS.get(provider_id, {})

    def complete_login(self, request, app, token, **kwargs):
        headers = {"Authorization": f"Bearer {token.token}"}
        resp = (
            get_adapter()
            .get_requests_session()
            .get(self.profile_url, headers=headers)
        )
        resp.raise_for_status()
        extra_data = resp.json()

        return self.get_provider().sociallogin_from_response(request, extra_data)

    def get_callback_url(self, request, app=None):
        return resolve_oauth_callback_url(request)


oauth2_login = OAuth2LoginView.adapter_view(ExternalOAuth2Adapter)
oauth2_callback = OAuth2CallbackView.adapter_view(ExternalOAuth2Adapter)
