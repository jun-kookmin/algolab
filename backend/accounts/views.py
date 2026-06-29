import logging
import os
from urllib.parse import urlencode
from django.conf import settings

from allauth.socialaccount.providers.oauth2.client import OAuth2Client
from dj_rest_auth.app_settings import api_settings as rest_auth_settings
from dj_rest_auth.registration.views import SocialLoginView
from dj_rest_auth.views import LoginView, LogoutView, UserDetailsView
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from rest_framework.exceptions import NotFound
from rest_framework.views import APIView
from django.contrib.auth import get_user_model
from django.middleware.csrf import get_token, rotate_token
from django.shortcuts import redirect
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from rest_framework_simplejwt.settings import api_settings as jwt_api_settings
from rest_framework_simplejwt.tokens import RefreshToken

from .external_oauth.adapter import ExternalOAuth2Adapter
from .exam_logout import finish_active_exam_for_logout
from .external_oauth.utils import build_login_error_redirect, resolve_oauth_callback_url
from .models import UserSession
from .permissions import user_in_groups
from .serializers.custom_login import _get_request_session_key
from .session_control import (
    cleanup_stale_user_sessions,
    clear_user_session,
    get_user_session,
    rotate_user_session,
    touch_user_session,
    touch_user_session_presence,
)
from variables.groups import GroupEnum

logger = logging.getLogger(__name__)


class CustomOAuth2Client(OAuth2Client):
    def __init__(
        self,
        request,
        consumer_key,
        consumer_secret,
        access_token_method,
        access_token_url,
        callback_url,
        _scope,
        scope_delimiter=" ",
        headers=None,
        basic_auth=False,
    ):
        super().__init__(
            request,
            consumer_key,
            consumer_secret,
            access_token_method,
            access_token_url,
            callback_url,
            scope_delimiter,
            headers,
            basic_auth,
        )


class CsrfTokenView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]
    http_method_names = ["get", "head", "options"]

    def get(self, request, *args, **kwargs):
        rotate_token(request)
        token = get_token(request)
        response = Response({"csrfToken": token}, status=status.HTTP_200_OK)
        response["Cache-Control"] = "no-store"
        return response


@method_decorator(csrf_exempt, name="dispatch")
class SessionPingView(APIView):
    permission_classes = [IsAuthenticated]
    http_method_names = ["post", "options"]

    def post(self, request, *args, **kwargs):
        cleanup_stale_user_sessions()
        session_obj = get_user_session(request.user)
        touch_user_session(request.user, session_obj=session_obj)
        touch_user_session_presence(request.user, session_obj=session_obj)
        response = Response(status=status.HTTP_204_NO_CONTENT)
        response["Cache-Control"] = "no-store"
        return response


class VerifyPasswordView(APIView):
    permission_classes = [IsAuthenticated]
    http_method_names = ["post", "options"]

    def post(self, request, *args, **kwargs):
        password = str(request.data.get("password") or "")
        if not password:
            return Response(
                {"detail": "Password is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not request.user.has_usable_password():
            return Response(
                {"detail": "Password verification is not available for this account."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not request.user.check_password(password):
            return Response(
                {"detail": "Invalid password."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        response = Response(status=status.HTTP_204_NO_CONTENT)
        response["Cache-Control"] = "no-store"
        return response


class RegistrationConfirmEmailLandingView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]
    http_method_names = ["get", "head", "options"]

    def get(self, request, key=None, *args, **kwargs):
        return Response(
            {
                "detail": "이 링크는 API 검증용 링크입니다. verify-email 엔드포인트로 key를 전송하세요.",
                "key": key,
                "verify_endpoint": "/api/auth/registration/verify-email/",
            },
            status=status.HTTP_200_OK,
        )


class RegistrationEmailVerificationSentView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]
    http_method_names = ["get", "head", "options"]

    def get(self, request, *args, **kwargs):
        return Response(
            {
                "detail": "이메일 인증 링크가 발송되었습니다.",
            },
            status=status.HTTP_200_OK,
        )


class ExternalOAuthLogin(SocialLoginView):
    adapter_class = ExternalOAuth2Adapter
    callback_url = None
    client_class = CustomOAuth2Client
    http_method_names = ["get", "head", "options"]
    authentication_classes = []
    permission_classes = [AllowAny]
    
    @staticmethod
    def _build_redirect_url(base: str | None, include_replaced: bool) -> str:
        if not base:
            return "/"
        if not include_replaced:
            return base
        delim = "&" if "?" in base else "?"
        return f"{base}{delim}{urlencode({'replaced_existing_session': '1'})}"

    def get(self, request, *args, **kwargs):
        code = request.query_params.get("code")
        state = request.query_params.get("state")
        callback_url = resolve_oauth_callback_url(request)
        self.callback_url = callback_url

        if not code:
            logger.warning("OAuth callback called without code: %s", request.build_absolute_uri())
            return redirect(build_login_error_redirect("missing_code"))

        request.data["code"] = code
        if state:
            request.data["state"] = state
        try:
            self.request = request
            self.serializer = self.get_serializer(data=self.request.data)
            self.serializer.is_valid(raise_exception=True)

            user = self.serializer.validated_data.get("user")
            if user is not None:
                session_obj = UserSession.objects.get_or_create(user=user)[0]
                request_session_key = _get_request_session_key(request)
                existing_session_key = session_obj.session_key
                replaced_existing_session = bool(
                    session_obj.is_active
                    and existing_session_key
                    and (
                        not request_session_key
                        or str(existing_session_key) != str(request_session_key)
                    )
                )

                rotate_user_session(user, session_obj=session_obj)

            self.login()
            response = self.get_response()
            response.status_code = 302
            redirect_url = self._build_redirect_url(
                os.environ.get("OAUTH_REDIRECT_URI"),
                replaced_existing_session if user is not None else False,
            )
            response.headers["Location"] = redirect_url
            return response
        except Exception as exc:
            logger.exception(
                "OAuth login failed: callback_url=%s request_url=%s host=%s",
                callback_url,
                request.build_absolute_uri(),
                request.get_host(),
                exc_info=exc,
            )
            error_detail = "login_failed"
            if "Failed to exchange code for access token" in str(exc):
                error_detail = "token_exchange_failed"
            return redirect(build_login_error_redirect("oauth_login_failed", error_detail))


class CustomLogoutView(LogoutView):
    def _user_from_refresh_cookie(self, request):
        cookie_name = rest_auth_settings.JWT_AUTH_REFRESH_COOKIE
        refresh_cookie = request.COOKIES.get(cookie_name) if cookie_name else None
        if not refresh_cookie:
            return None
        try:
            refresh = RefreshToken(refresh_cookie)
            user_id = refresh.get(jwt_api_settings.USER_ID_CLAIM)
            if user_id is None:
                return None
            User = get_user_model()
            return User.objects.filter(**{jwt_api_settings.USER_ID_FIELD: user_id}).first()
        except Exception:
            return None

    def post(self, request, *args, **kwargs):
        target_user = request.user if (request.user and request.user.is_authenticated) else self._user_from_refresh_cookie(request)
        exam_identifier = (
            request.data.get("exam_id")
            or request.data.get("exam_uuid")
            or request.query_params.get("exam_id")
            or request.query_params.get("exam_uuid")
        )
        exam_finished_on_logout = False
        if target_user is not None and exam_identifier:
            try:
                exam_finished_on_logout = finish_active_exam_for_logout(target_user, exam_identifier)
            except Exception as exc:
                logger.exception("Failed to finish active exam on logout", exc_info=exc)
        try:
            response = super().post(request, *args, **kwargs)
        except Exception as exc:
            logger.exception("Logout failed", exc_info=exc)
            response = Response({"detail": "Successfully logged out."}, status=status.HTTP_200_OK)

        # Ensure JWT cookies are cleared even if the base logout failed.
        if rest_auth_settings.USE_JWT:
            try:
                from dj_rest_auth.jwt_auth import unset_jwt_cookies

                unset_jwt_cookies(response)
            except Exception as exc:
                logger.exception("Failed to unset JWT cookies on logout", exc_info=exc)

        csrf_cookie_name = getattr(settings, "CSRF_COOKIE_NAME", "csrftoken")
        csrf_cookie_path = getattr(settings, "CSRF_COOKIE_PATH", "/")
        csrf_cookie_domain = getattr(settings, "CSRF_COOKIE_DOMAIN", None) or None
        try:
            response.set_cookie(
                csrf_cookie_name,
                value="",
                max_age=0,
                path=csrf_cookie_path,
                domain=csrf_cookie_domain,
                secure=getattr(settings, "CSRF_COOKIE_SECURE", False),
                httponly=getattr(settings, "CSRF_COOKIE_HTTPONLY", False),
                samesite=getattr(settings, "CSRF_COOKIE_SAMESITE", "Lax"),
            )
        except Exception as exc:
            logger.exception("Failed to clear CSRF cookie via set_cookie", exc_info=exc)
            try:
                response.delete_cookie(
                    csrf_cookie_name,
                    path=csrf_cookie_path,
                    domain=csrf_cookie_domain,
                )
            except Exception as fallback_exc:
                logger.exception("Failed to clear CSRF cookie via delete_cookie", exc_info=fallback_exc)

        if target_user is not None:
            try:
                clear_user_session(target_user)
            except Exception as exc:
                logger.exception("Failed to clear user session on logout", exc_info=exc)
        if isinstance(response.data, dict):
            response.data["exam_finished_on_logout"] = bool(exam_finished_on_logout)
        return response


class CustomLoginView(LoginView):
    permission_classes = [AllowAny]

    def finalize_response(self, request, response, *args, **kwargs):
        response = super().finalize_response(request, response, *args, **kwargs)
        if isinstance(response.data, dict):
            response.data["replaced_existing_session"] = bool(
                getattr(request, "_replaced_existing_session", False)
            )
        return response


class ReadOnlyUserDetailsView(UserDetailsView):
    """
    /api/auth/user/ 조회 전용
    학번(username)/이름(first_name, last_name) 수정 권한 x
    """
    permission_classes = [IsAuthenticated]
    http_method_names = ["get", "head", "options"]
    _trusted_client_header = "HTTP_X_ALGOLAB_CLIENT"
    _trusted_client_value = "web"

    def _is_student(self, user) -> bool:
        return bool(user and user.is_authenticated and user_in_groups(user, GroupEnum.STUDENT.value))

    def _is_trusted_client_request(self, request) -> bool:
        value = str(request.META.get(self._trusted_client_header, "")).strip().lower()
        return value == self._trusted_client_value

    def get(self, request, *args, **kwargs):
        # 학생 계정은 프론트 앱 요청(전용 헤더)으로만 접근 허용
        if self._is_student(request.user) and not self._is_trusted_client_request(request):
            raise NotFound()
        return super().get(request, *args, **kwargs)
