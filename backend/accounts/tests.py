
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone

from api import models
from accounts.exam_logout import finish_active_exam_for_logout


class ExamLogoutTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        User = get_user_model()
        cls.instructor = User.objects.create_user(
            username="professor",
            password="password123",
        )
        cls.student = User.objects.create_user(
            username="student",
            password="password123",
        )
        cls.lecture = models.Lecture.objects.create(
            instructor=cls.instructor,
            lecture_name="Algo",
            description="desc",
            weeks=16,
        )
        cls.membership = models.StudentInLecture.objects.create(
            lecture=cls.lecture,
            student=cls.student,
            student_code="STUDENT001",
        )
        now = timezone.now()
        cls.exam = models.Exam.objects.create(
            lecture=cls.lecture,
            exam_name="Midterm",
            week=1,
            due_date=now + timedelta(hours=1),
            start_date=now - timedelta(minutes=10),
            share=False,
            description="desc",
        )

    def test_finish_active_exam_for_logout_marks_exam_finished_by_user(self):
        exam_user = models.ExamUser.objects.create(
            exam=self.exam,
            lecture_user=self.membership,
            start_time=timezone.now() - timedelta(minutes=5),
            end_time=timezone.now() + timedelta(hours=1),
            saved_code="print('hi')",
        )

        finished = finish_active_exam_for_logout(self.student, str(self.exam.id))

        exam_user.refresh_from_db()
        self.assertTrue(finished)
        self.assertTrue(exam_user.finished_by_user)
        self.assertIsNotNone(exam_user.finished_at)

    def test_finish_active_exam_for_logout_ignores_already_finished_exam(self):
        finished_at = timezone.now() - timedelta(minutes=1)
        exam_user = models.ExamUser.objects.create(
            exam=self.exam,
            lecture_user=self.membership,
            start_time=timezone.now() - timedelta(minutes=20),
            end_time=timezone.now() + timedelta(hours=1),
            saved_code="print('hi')",
            finished_at=finished_at,
            finished_by_user=False,
        )

        finished = finish_active_exam_for_logout(self.student, str(self.exam.id))

        exam_user.refresh_from_db()
        self.assertFalse(finished)
        self.assertFalse(exam_user.finished_by_user)
        self.assertEqual(exam_user.finished_at, finished_at)
