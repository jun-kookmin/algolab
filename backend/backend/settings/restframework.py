import datetime

REST_FRAMEWORK = {
    'PAGE_SIZE': 5,
    'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema',
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'DEFAULT_PARSER_CLASSES': (
        'rest_framework.parsers.JSONParser',
        'rest_framework.parsers.FormParser',
        'rest_framework.parsers.MultiPartParser'
    ),
    'DEFAULT_AUTHENTICATION_CLASSES': (
        # 'rest_framework.authentication.SessionAuthentication', # CSRF 전용 현 JWT 기반이므로 미사용
        'accounts.jwt.SingleSessionJWTCookieAuthentication',
        'rest_framework.authentication.BasicAuthentication',
    ),
    'DEFAULT_RENDERER_CLASSES': (
        'rest_framework.renderers.JSONRenderer',
    ),
    'DEFAULT_PERMISSION_CLASSES': ['rest_framework.permissions.IsAdminUser'],

    'DEFAULT_FILTER_BACKENDS': ['django_filters.rest_framework.DjangoFilterBackend'],

    'SEARCH_PARAM': 'filter[search]',
    'TEST_REQUEST_DEFAULT_FORMAT': 'vnd.api+json'
}

REST_AUTH = {
    'USE_JWT': True,
    'LOGIN_SERIALIZER': 'accounts.serializers.custom_login.CustomLoginSerializer',
    'JWT_TOKEN_CLAIMS_SERIALIZER': 'accounts.jwt.SingleSessionTokenObtainPairSerializer',
    'JWT_AUTH_COOKIE': 'algolab-access-token',
    'JWT_AUTH_REFRESH_COOKIE': 'algolab-refresh-token',
    'JWT_AUTH_HEADER_PREFIX': 'Bearer',
    'JWT_AUTH_SAMESITE': 'None',
    'JWT_AUTH_SECURE': True,
    'JWT_AUTH_HTTPONLY': True,
    'JWT_AUTH_COOKIE_USE_CSRF': True,
    'JWT_AUTH_COOKIE_ENFORCE_CSRF_ON_UNAUTHENTICATED': True,
    'REGISTER_SERIALIZER': 'accounts.serializers.CustomRegisterSerializer.CustomRegisterSerializer',
    'USER_DETAILS_SERIALIZER': 'accounts.serializers.CustomUserDetailsSerializer.CustomUserDetailsSerializer'
}

# Token 시간 관리
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': datetime.timedelta(hours=3),
    'REFRESH_TOKEN_LIFETIME': datetime.timedelta(days=7),
    'TOKEN_REFRESH_SERIALIZER': 'accounts.jwt.SingleSessionTokenRefreshSerializer',
}
