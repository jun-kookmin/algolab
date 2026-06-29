from dj_rest_auth.serializers import LoginSerializer
from dj_rest_auth.app_settings import api_settings as rest_auth_settings
from rest_framework_simplejwt.tokens import RefreshToken

from accounts.session_control import rotate_user_session
from accounts.models import UserSession
from accounts.jwt import SESSION_CLAIM


def _get_request_session_key(request):
    if request is None:
        return None
    cookie_name = rest_auth_settings.JWT_AUTH_REFRESH_COOKIE
    if not cookie_name:
        return None
    raw_refresh = request.COOKIES.get(cookie_name)
    if not raw_refresh:
        return None
    try:
        token = RefreshToken(raw_refresh)
    except Exception:
        return None
    claim = token.get(SESSION_CLAIM)
    return str(claim) if claim else None


class CustomLoginSerializer(LoginSerializer):
    def validate(self, attrs):
        data = super().validate(attrs)
        user = data.get("user")
        if user is not None:
            request = self.context.get("request")
            session_obj, _ = UserSession.objects.get_or_create(user=user)
            had_active_session = session_obj.is_active

            request_session_key = _get_request_session_key(request)
            existing_session_key = session_obj.session_key
            replaced_existing_session = bool(
                had_active_session
                and existing_session_key
                and (
                    not request_session_key
                    or str(existing_session_key) != str(request_session_key)
                )
            )
            if request is not None:
                request._replaced_existing_session = replaced_existing_session
            # Last-login-wins: rotate session key on every successful login.
            rotate_user_session(user, session_obj=session_obj)
        return data
