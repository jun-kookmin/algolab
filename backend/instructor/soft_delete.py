from __future__ import annotations

from api import models


def soft_delete_problem_checkers(checker_qs):
    checker_ids = list(checker_qs.values_list("id", flat=True))
    if checker_ids:
        models.LanguageInChecker.objects.filter(checker_id__in=checker_ids).delete()
    checker_qs.delete()


def soft_delete_section_problems(section_problem_qs):
    section_problem_ids = list(section_problem_qs.values_list("id", flat=True))
    if section_problem_ids:
        models.LanguageInSectionProblem.objects.filter(
            section_problem_id__in=section_problem_ids
        ).delete()
    section_problem_qs.delete()


def soft_delete_exam_problems(exam_problem_qs):
    exam_problem_qs.delete()


def soft_delete_problem(problem):
    soft_delete_problem_checkers(models.ProblemChecker.objects.filter(problem=problem))
    models.ProblemTemplate.objects.filter(problem=problem).delete()
    models.ProblemInOut.objects.filter(problem=problem).delete()
    models.LanguageInProblem.objects.filter(problem=problem).delete()
    soft_delete_section_problems(models.SectionProblem.objects.filter(problem=problem))
    soft_delete_exam_problems(models.ExamProblem.objects.filter(problem=problem))
    models.ProblemPost.objects.filter(problem=problem).delete()
    problem.delete()


def soft_delete_post(post):
    models.ProblemPost.objects.filter(post=post).delete()
    models.PostReply.objects.filter(post=post).delete()
    models.PostLecture.objects.filter(post=post).delete()
    post.delete()


def soft_delete_section(section):
    soft_delete_section_problems(models.SectionProblem.objects.filter(section=section))
    section.delete()


def soft_delete_exam(exam):
    soft_delete_exam_problems(models.ExamProblem.objects.filter(exam=exam))
    models.ExamUser.objects.filter(exam=exam).delete()
    exam.delete()


def soft_delete_lecture(lecture):
    section_qs = models.Section.objects.filter(lecture=lecture)
    section_ids = list(section_qs.values_list("id", flat=True))
    if section_ids:
        soft_delete_section_problems(
            models.SectionProblem.objects.filter(section_id__in=section_ids)
        )
    section_qs.delete()

    exam_qs = models.Exam.objects.filter(lecture=lecture)
    exam_ids = list(exam_qs.values_list("id", flat=True))
    if exam_ids:
        soft_delete_exam_problems(models.ExamProblem.objects.filter(exam_id__in=exam_ids))
        models.ExamUser.objects.filter(exam_id__in=exam_ids).delete()
    exam_qs.delete()

    models.StudentInLecture.objects.filter(lecture=lecture).delete()
    models.LanguageInLecture.objects.filter(lecture=lecture).delete()
    models.PostLecture.objects.filter(class_id=lecture).delete()
    lecture.delete()
