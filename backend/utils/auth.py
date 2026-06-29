from functools import wraps
from typing import Iterable, Optional

from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework import status


def is_authenticated(request: Request) -> bool:
    """
    DRF Request 기준으로 유저가 인증된 상태인지 반환.
    Django Allauth / dj-rest-auth 환경에서도 동일하게 동작.
    """
    user = getattr(request, "user", None)
    return bool(user and user.is_authenticated)


def authenticated_only(
        allow: Optional[Iterable[str]] = None
):
    """
    DRF function view에 붙이는 decorator.

    - 기본: 모든 HTTP method에 대해 인증 필요
    - allow_unauthenticated_methods 로 일부 메서드(GET 등)만 비인증 허용 가능.

    예:
        @authenticated_only()  # 모든 method 인증 필요
        @authenticated_only(allow_unauthenticated_methods=['GET'])  # GET만 비인증 허용
    """
    allow = {
        m.upper() for m in (allow or [])
    }

    def decorator(view_func):
        @wraps(view_func)
        def _wrapped_view(request: Request, *args, **kwargs):
            method = request.method.upper()
            user = getattr(request, "user", None)
            is_auth = bool(user and user.is_authenticated)

            # 이 메서드는 비인증 허용 목록에 있는가?
            if method in allow:
                # 인증되었든 아니든 그냥 통과
                return view_func(request, *args, **kwargs)

            # 그 외 메서드는 인증 필요
            if not is_auth:
                return Response(
                    {"detail": "Authentication credentials were not provided."},
                    status=status.HTTP_401_UNAUTHORIZED,
                )

            return view_func(request, *args, **kwargs)

        return _wrapped_view

    return decorator
