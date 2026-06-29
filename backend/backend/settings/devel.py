import os
from dotenv import load_dotenv
from . import BASE_DIR
from .base import *
from .apps import *
from .restframework import *

load_dotenv(os.path.join(BASE_DIR, ".env"))

# devel 모듈을 직접 사용하더라도 디버그 기능이 켜지지 않도록 기본값을 비활성화한다.
DEBUG = False
ALLOWED_HOSTS = ['*']

if DEBUG:
    INSTALLED_APPS = INSTALLED_APPS + [
        'debug_toolbar',
    ]

    MIDDLEWARE += [
        'debug_toolbar.middleware.DebugToolbarMiddleware',
    ]

    INTERNAL_IPS = [
        '127.0.0.1',
    ]

    DEBUG_TOOLBAR_CONFIG = {
        'RESULTS_CACHE_SIZE': 3,
        'SHOW_COLLAPSED': True,
        'SQL_WARNING_THRESHOLD': 100,
    }

API_QUERY_METRICS_ENABLED = False

CORS_ALLOWED_ORIGINS = [
    # local
    'http://localhost:3000', 
    'http://127.0.0.1:3000',
]
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
CORS_ALLOW_CREDENTIALS = True
CSRF_COOKIE_DOMAIN = None
#SECURE_CROSS_ORIGIN_OPENER_POLICY = None
#SECURE_CROSS_ORIGIN_EMBEDDER_POLICY = None
#CELERY_BROKER_URL = 'redis://localhost:6379'  # os.environ.get('CELERY_BROKER_URL')
