"""
URL configuration for backend project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include, re_path
from django.conf import settings
from accounts.jwt_refresh import SingleSessionTokenRefreshView
from accounts.views import (
    CsrfTokenView,
    CustomLoginView,
    CustomLogoutView,
    ExternalOAuthLogin,
    ReadOnlyUserDetailsView,
    RegistrationConfirmEmailLandingView,
    RegistrationEmailVerificationSentView,
    SessionPingView,
    VerifyPasswordView,
)

urlpatterns = [
    re_path('api/v1/', include('api.urls')),
    re_path('api/v1/instructor/', include('instructor.urls')),
    re_path('admin/', admin.site.urls),

    re_path(r'api/auth/login/?$', CustomLoginView.as_view(), name='rest_login'),
    re_path(r'api/auth/logout/?$', CustomLogoutView.as_view(), name='rest_logout'),
    re_path(r'api/auth/csrf/?$', CsrfTokenView.as_view(), name='auth_csrf'),
    re_path(r'api/auth/session/ping/?$', SessionPingView.as_view(), name='auth_session_ping'),
    re_path(r'api/auth/verify-password/?$', VerifyPasswordView.as_view(), name='auth_verify_password'),
    re_path(r'api/auth/user/?$', ReadOnlyUserDetailsView.as_view(), name='rest_user_details_readonly'),
    re_path(r'api/auth/token/refresh/?$', SingleSessionTokenRefreshView.as_view(), name='auth_token_refresh'),
    re_path(
        r'api/auth/registration/account-confirm-email/(?P<key>[-:\w]+)/?$',
        RegistrationConfirmEmailLandingView.as_view(),
        name='account_confirm_email',
    ),
    re_path(
        r'api/auth/registration/account-email-verification-sent/?$',
        RegistrationEmailVerificationSentView.as_view(),
        name='account_email_verification_sent',
    ),
    re_path('api/auth/', include('dj_rest_auth.urls')),
    re_path('api/auth/registration/', include('dj_rest_auth.registration.urls')),
    re_path(r'api/token/refresh/?$', SingleSessionTokenRefreshView.as_view(), name='token_refresh'),
    re_path('accounts/', include('accounts.urls')),

    path('oauth/complete/', ExternalOAuthLogin.as_view(), name='oauth_complete'),
]

if settings.DEBUG:
    import debug_toolbar

    urlpatterns += [
        re_path(r'^__debug__/', include(debug_toolbar.urls)),
    ]
