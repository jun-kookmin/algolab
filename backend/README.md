# Algolab Backend

## 한국어

Django REST Framework 기반 Algolab API 서버입니다. 인증, 강의, 문제, 제출, 결과 조회 API를 제공하며, 채점 실행은 Celery task boundary 뒤의 비공개 외부 worker가 처리하는 구조입니다.

## English

This is the Django REST Framework API server for Algolab. It provides authentication, course, problem, submission, and result lookup APIs. Grading execution is delegated across a Celery task boundary to a private external worker.
