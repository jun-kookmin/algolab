import ast
import os
import uuid

from api.models import SectionProblem, ExamProblem
from backend.celery import app as celery_app


def _split_command(command_text: str):
    try:
        parts = ast.literal_eval(command_text)
        if isinstance(parts, (list, tuple)) and parts:
            return str(parts[0]), list(parts[1:])
    except Exception:
        pass
    return "", []


def _normalize_run_command(language: str, run_path: str, run_command, default_path: str, default_command):
    """
    실행 경로가 소스 파일명(main.py 등)으로 들어오는 잘못된 경우 기본 명령으로 보정한다.
    """
    lang = (language or "").lower().replace(" ", "")
    # Python 전용 경로 안전장치: main.py 같은 소스 파일명을 인터프리터로 실행하는 경우 방지
    if lang.startswith(("python", "py")):
        if isinstance(run_path, str):
            candidate = run_path.strip()
            base_name = os.path.basename(candidate).lower()
            if candidate.endswith(".py") and candidate == base_name:
                return default_path, default_command
            if candidate == base_name and not os.path.isabs(candidate) and candidate != default_path:
                return default_path, default_command
    return run_path, run_command


def _map_problem_type(problem_type: str): # PS / PC -> S / C 
    if problem_type and problem_type.upper().endswith("C"):
        return "C"
    return "S"


def _default_commands(lang_name: str):
    ln = (lang_name or "").lower()
    ln = ln.replace(" ", "")
    if ln.startswith(("python", "py")):
        return (
            "/usr/bin/python3",
            ["-m", "py_compile", "{compile_list}"],
            "/usr/bin/python3",
            ["main.py"],
        )
    if ln.startswith(("c++", "cpp")):
        return (
            "/usr/bin/g++",
            ["-O2", "-std=c++17", "-pipe", "-static", "-s", "-o", "main", "{compile_list}"],
            "./main",
            [],
        )
    if ln.startswith("c"):
        return (
            "/usr/bin/gcc",
            ["-O2", "-std=c11", "-pipe", "-static", "-s", "-o", "main", "{compile_list}"],
            "./main",
            [],
        )
    if ln.startswith("java"):
        return (
            "/usr/bin/javac",
            ["{compile_list}"],
            "/usr/bin/java",
            ["-Xmx512m", "Main"],
        )
    return "", [], "", []


def _coalesce_limit_value(given, fallback):
    return fallback if given is None else given


def enqueue_run(*, language, source, input_data=None, limit_time=None,
                limit_memory=None, runcommand=None, complie_command=None,
                additional_time=None, additional_memory=None):
    job_id = str(uuid.uuid4())
    builder_path, build_command = _split_command(complie_command or "")
    run_path, run_command = _split_command(runcommand or "")
    # 언어별 기본 명령이 비어 있으면 채워 넣는다.
    if (not builder_path) or (not build_command) or (not run_path) or (run_command is None) or (run_command == []):
        bp, bc, rp, rc = _default_commands(language)
        builder_path = builder_path or bp
        build_command = build_command or bc
        run_path = run_path or rp
        run_command = run_command or rc

    # 잘못 들어온 소스 경로(main.py) 형태의 run_path를 방어적으로 보정한다.
    run_path, run_command = _normalize_run_command(language, run_path, run_command, "/usr/bin/python3", ["main.py"])
    # code는 dict(파일명->소스) 또는 문자열을 지원
    if isinstance(source, dict):
        code_payload = source
    else:
        code_payload = {"main.py": source}
    payload = {
        "job_id": job_id,
        "code": code_payload,
        "language_info": {
            "language": language,
            "build_command": build_command,
            "builder_path": builder_path,
            "run_command": run_command,
            "run_path": run_path,
            "additional_time": additional_time,
            "additional_memory": additional_memory,
        },
        "input_data": input_data,
        "limit_time": limit_time,
        "limit_memory": limit_memory
    }
    celery_app.send_task("grade_server.run_submission", kwargs=payload)
    return job_id


def enqueue_exam(*, problem_id, limit_time, limit_memory, submission_uuid, problem_uuid=None, submission_id=None):
    if not submission_uuid:
        raise ValueError("submission_uuid is required for exam grading.")

    exam_problem = ExamProblem.objects.select_related("problem").get(id=problem_id)
    problem_type = _map_problem_type(getattr(exam_problem.problem, "type", "PS"))
    problem_pk = exam_problem.problem_id  # 실제 Problem pk

    payload = {
        "submission_uuid": submission_uuid,
        "problem_id": problem_pk,
        "problem_uuid": problem_uuid,
        "limit_time": _coalesce_limit_value(limit_time, exam_problem.problem.limit_time),
        "limit_memory": _coalesce_limit_value(limit_memory, exam_problem.problem.limit_memory),
        "problem_type": problem_type,
    }

    celery_app.send_task("grade_server.grade_submission", kwargs=payload)

    return submission_uuid


def enqueue_homework(*, section_problem_id, limit_time, limit_memory, submission_uuid, problem_uuid=None, submission_id=None):
    if not submission_uuid:
        raise ValueError("submission_uuid is required for homework grading.")

    section_problem = SectionProblem.objects.select_related("problem").get(id=section_problem_id)
    problem_type = _map_problem_type(getattr(section_problem.problem, "type", "PS"))

    payload = {
        "submission_uuid": submission_uuid,
        "problem_id": section_problem.problem.id,
        "problem_uuid": problem_uuid,
        "limit_time": _coalesce_limit_value(limit_time, section_problem.problem.limit_time),
        "limit_memory": _coalesce_limit_value(limit_memory, section_problem.problem.limit_memory),
        "problem_type": problem_type,
    }

    celery_app.send_task("grade_server.grade_submission", kwargs=payload)

    return submission_uuid
