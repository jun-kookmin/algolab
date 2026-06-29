from django.utils import timezone
from dj_rest_auth.app_settings import api_settings as rest_auth_settings
from dj_rest_auth.jwt_auth import set_jwt_access_cookie, set_jwt_refresh_cookie
from rest_framework import serializers, status
from rest_framework.permissions import AllowAny
from rest_framework_simplejwt.exceptions import InvalidToken
from rest_framework_simplejwt.settings import api_settings as jwt_api_settings
from rest_framework_simplejwt.views import TokenRefreshView

from .jwt import SingleSessionTokenRefreshSerializer


class CookieSingleSessionTokenRefreshSerializer(SingleSessionTokenRefreshSerializer):
    refresh = serializers.CharField(required=False, help_text="Will override cookie.")

    def extract_refresh_token(self):
        request = self.context["request"]
        if "refresh" in request.data and request.data["refresh"] != "":
            return request.data["refresh"]

        cookie_name = rest_auth_settings.JWT_AUTH_REFRESH_COOKIE
        if cookie_name and cookie_name in request.COOKIES:
            return request.COOKIES.get(cookie_name)
        raise InvalidToken("No valid refresh token found.")

    def validate(self, attrs):
        attrs["refresh"] = self.extract_refresh_token()
        return super().validate(attrs)


class SingleSessionTokenRefreshView(TokenRefreshView):
    permission_classes = [AllowAny]

    serializer_class = CookieSingleSessionTokenRefreshSerializer

    def finalize_response(self, request, response, *args, **kwargs):
        if response.status_code == status.HTTP_200_OK and "access" in response.data:
            set_jwt_access_cookie(response, response.data["access"])
            response.data["access_expiration"] = (
                timezone.now() + jwt_api_settings.ACCESS_TOKEN_LIFETIME
            )
        if response.status_code == status.HTTP_200_OK and "refresh" in response.data:
            set_jwt_refresh_cookie(response, response.data["refresh"])
            if rest_auth_settings.JWT_AUTH_HTTPONLY:
                del response.data["refresh"]
            else:
                response.data["refresh_expiration"] = (
                    timezone.now() + jwt_api_settings.REFRESH_TOKEN_LIFETIME
                )
        return super().finalize_response(request, response, *args, **kwargs)
