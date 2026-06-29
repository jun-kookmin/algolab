from django.contrib.auth import get_user_model
from dj_rest_auth.jwt_auth import JWTCookieAuthentication
from django.utils import timezone
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.exceptions import InvalidToken
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer, TokenRefreshSerializer
from rest_framework_simplejwt.settings import api_settings as jwt_api_settings
from rest_framework_simplejwt.tokens import RefreshToken

from .oauth_guard import is_oauth_session_valid
from .session_control import (
    cleanup_stale_user_sessions,
    clear_user_session,
    get_user_session,
    get_user_session_presence_timestamp,
    get_user_session_key,
    has_active_user_session,
    is_user_session_expired,
    is_user_session_presence_expired,
    touch_user_session_presence,
    touch_user_session,
)

SESSION_CLAIM = "ssk"


class SingleSessionTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token[SESSION_CLAIM] = get_user_session_key(user)
        return token


class SingleSessionJWTCookieAuthentication(JWTCookieAuthentication):
    def authenticate(self, request):
        try:
            return super().authenticate(request)
        except AuthenticationFailed:
            # Allow unauthenticated access on auth endpoints even if stale cookies exist.
            if request.path.startswith("/api/auth/login/") or request.path.startswith("/api/auth/token/refresh/"):
                return None
            raise

    def get_user(self, validated_token):
        cleanup_stale_user_sessions()
        user = super().get_user(validated_token)
        session_obj = get_user_session(user)
        now = timezone.now()
        if not is_oauth_session_valid(user):
            clear_user_session(user)
            raise AuthenticationFailed("계정 세션이 만료되었습니다. 다시 로그인해 주세요.", code="oauth_session_expired")

        token_session_key = str(validated_token.get(SESSION_CLAIM, ""))
        current_session_key = str(session_obj.session_key)
        is_active = has_active_user_session(user, session_obj=session_obj)
        last_seen_ts = get_user_session_presence_timestamp(user, session_obj=session_obj)
        if not is_active or not token_session_key or token_session_key != current_session_key:
            raise AuthenticationFailed("다른 기기에서 접속이 확인되어 현재 세션이 만료되었습니다.", code="session_expired")
        if is_user_session_presence_expired(
            user,
            session_obj=session_obj,
            now=now,
            last_seen_ts=last_seen_ts,
        ):
            clear_user_session(user)
            raise AuthenticationFailed("브라우저 세션이 종료되었습니다. 다시 로그인해 주세요.", code="session_presence_expired")
        if is_user_session_expired(user, session_obj=session_obj, now=now):
            clear_user_session(user)
            raise AuthenticationFailed("세션이 만료되었습니다. 다시 로그인해 주세요.", code="session_idle_expired")
        touch_user_session(user, session_obj=session_obj, now=now)
        touch_user_session_presence(
            user,
            session_obj=session_obj,
            now=now,
            last_seen_ts=last_seen_ts,
        )
        return user


class SingleSessionTokenRefreshSerializer(TokenRefreshSerializer):
    def validate(self, attrs):
        cleanup_stale_user_sessions()
        refresh = RefreshToken(attrs["refresh"])
        user_id = refresh.get(jwt_api_settings.USER_ID_CLAIM)
        token_session_key = str(refresh.get(SESSION_CLAIM, ""))
        if user_id is None:
            raise InvalidToken("Invalid refresh token.")

        user_lookup = {jwt_api_settings.USER_ID_FIELD: user_id}
        User = get_user_model()
        try:
            user = User.objects.get(**user_lookup)
        except User.DoesNotExist:
            raise InvalidToken("User not found.")

        session_obj = get_user_session(user)
        now = timezone.now()
        last_seen_ts = get_user_session_presence_timestamp(user, session_obj=session_obj)
        if not is_oauth_session_valid(user):
            clear_user_session(user)
            raise InvalidToken("External account session expired.", "oauth_session_expired")

        current_session_key = str(session_obj.session_key)
        is_active = has_active_user_session(user, session_obj=session_obj)
        if not is_active or not token_session_key or token_session_key != current_session_key:
            raise InvalidToken("Session expired by another login.", "session_expired")
        if is_user_session_presence_expired(
            user,
            session_obj=session_obj,
            now=now,
            last_seen_ts=last_seen_ts,
        ):
            clear_user_session(user)
            raise InvalidToken("브라우저 세션이 종료되었습니다.", "session_presence_expired")
        if is_user_session_expired(user, session_obj=session_obj, now=now):
            clear_user_session(user)
            raise InvalidToken("세션이 만료되었습니다.", "session_idle_expired")
        touch_user_session(user, session_obj=session_obj, now=now)
        touch_user_session_presence(
            user,
            session_obj=session_obj,
            now=now,
            last_seen_ts=last_seen_ts,
        )

        return super().validate(attrs)
