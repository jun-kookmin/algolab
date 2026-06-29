import os

# Application definition

INSTALLED_APPS = [
    ## ADMIN CUSTOM
    'jazzmin',

    ## APPs
    'api',
    'instructor',
    'accounts',

    ## DJANGO DEFAULT
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',

    ## API
    'rest_framework',
    'drf_spectacular',
    'django_filters',
    'django_crontab',
    'django_rq',
    'corsheaders',

    ## django-allauth
    'allauth',
    'allauth.account',
    'allauth.socialaccount',
    'accounts.external_oauth',

    'rest_framework.authtoken',
    'rest_framework_simplejwt',
    'rest_framework_simplejwt.token_blacklist',

    'dj_rest_auth',
]

SITE_ID = 1

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "allauth.account.middleware.AccountMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "backend.middleware.api_query_metrics.ApiQueryMetricsMiddleware",
]

ACCOUNT_LOGIN_METHODS = {'username'}
ACCOUNT_SIGNUP_FIELDS = ['username*', 'password1*', 'password2*']
ACCOUNT_UNIQUE_EMAIL = False
ACCOUNT_EMAIL_VERIFICATION = "none"
ACCOUNT_USER_MODEL_EMAIL_FIELD = None
LOGIN_REDIRECT_URL = os.environ.get('OAUTH_REDIRECT_URI')
ACCOUNT_LOGOUT_ON_GET = True

SOCIALACCOUNT_AUTO_SIGNUP = True
SOCIALACCOUNT_LOGIN_ON_GET = True
SOCIALACCOUNT_LOGOUT_ON_GET = True
SOCIALACCOUNT_PROVIDERS = {
    "external_oauth": {
        "APP": {
            "client_id":  os.environ.get('OAUTH_CLIENT_ID'),
            "secret": os.environ.get('OAUTH_CLIENT_SECRET'),
        },
        "callback_uri": os.environ.get('OAUTH_CALLBACK_URL')
    }
}
SOCIALACCOUNT_ADAPTER = 'accounts.adapter.AlgolabSocialAccountAdapter'
