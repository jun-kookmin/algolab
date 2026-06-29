
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.test import TestCase, override_settings
from django.urls import reverse
from django.utils import timezone

from api import models
from instructor.pending_cleanup import (
    AUTO_TIMEOUT_ERROR_MESSAGE,
    mark_stale_pending_submissions,
)
from instructor.serializers.problem import (
    ProblemCreateUpdateSerializer,
    ProblemPostPayloadSerializer,
)
from instructor.soft_delete import (
    soft_delete_exam,
    soft_delete_lecture,
    soft_delete_post,
    soft_delete_section,
)
from instructor.views.api.problem import ProblemViewSet
from variables.groups import GroupEnum


class ProblemMutationTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = get_user_model().objects.create_user(
            username="tester",
            password="password123",
        )
        cls.language = models.Language.objects.create(
            language_name="Python",
            version="3.13",
            build_command="python -m py_compile main.py",
            grade_command="python main.py",
            additional_memory="*1",
            additional_time="*1",
        )
        cls.java_language = models.Language.objects.create(
            language_name="Java",
            version="21",
            build_command="javac Main.java",
            grade_command="java Main",
            additional_memory="*1",
            additional_time="*1",
        )

    def _create_problem(self):
        problem = models.Problem.objects.create(
            maker=self.user,
            problem_name="soft-delete-test",
            description="desc",
            type="PS",
            difficulty=1,
            limit_time=1000,
            limit_memory=256,
            share=False,
        )
        models.LanguageInProblem.objects.create(problem=problem, language=self.language)
        return problem

    def _create_lecture(self):
        return models.Lecture.objects.create(
            instructor=self.user,
            lecture_name="Algo",
            description="desc",
            weeks=16,
        )

    def _create_student(self, username="student"):
        return get_user_model().objects.create_user(
            username=username,
            password="password123",
        )

    def _create_membership(self, lecture, student, student_code="STUDENT001"):
        return models.StudentInLecture.objects.create(
            lecture=lecture,
            student=student,
            student_code=student_code,
        )

    def test_problem_update_serializer_updates_difficulty(self):
        problem = self._create_problem()

        serializer = ProblemCreateUpdateSerializer(
            instance=problem,
            data={"difficulty": "HARD"},
            partial=True,
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)
        serializer.save()

        problem.refresh_from_db()
        self.assertEqual(problem.difficulty, 3)

    def test_problem_post_payload_serializer_normalizes_locked_primary_template_filenames(self):
        serializer = ProblemPostPayloadSerializer(
            data={
                "problemData": {
                    "title": "templated",
                    "description": "desc",
                    "type": "GENERAL",
                    "difficulty": "MEDIUM",
                    "limit_time": 1000,
                    "limit_memory": 256,
                    "share": False,
                    "languages": ["python", "java"],
                    "template_codes": [
                        {
                            "language": "python",
                            "files": [
                                {"filename": "solution.py", "content": "print('hi')"},
                                {"filename": "helper.py", "content": "# helper"},
                            ],
                        },
                        {
                            "language": "java",
                            "files": [
                                {"filename": "Solution.java", "content": "class Main {}"},
                                {"filename": "Util.java", "content": "class Util {}"},
                            ],
                        },
                    ],
                    "testcases": [
                        {
                            "input": {"index": 1, "content": "1"},
                            "output": {"index": 1, "content": "1"},
                        }
                    ],
                }
            }
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)
        templates = serializer.validated_data["problemData"]["template_codes"]

        self.assertEqual(templates[0]["files"][0]["filename"], "main.py")
        self.assertEqual(templates[0]["files"][1]["filename"], "helper.py")
        self.assertEqual(templates[1]["files"][0]["filename"], "Main.java")
        self.assertEqual(templates[1]["files"][1]["filename"], "Util.java")

    def test_problem_update_serializer_normalizes_locked_primary_template_filenames(self):
        problem = self._create_problem()

        serializer = ProblemCreateUpdateSerializer(
            instance=problem,
            data={
                "language": [self.language.pk, self.java_language.pk],
                "template_codes": [
                    {
                        "language": "python",
                        "files": [
                            {"filename": "solution.py", "content": "print('hi')"},
                            {"filename": "helper.py", "content": "# helper"},
                        ],
                    },
                    {
                        "language": "java",
                        "files": [
                            {"filename": "Solution.java", "content": "class Main {}"},
                            {"filename": "Util.java", "content": "class Util {}"},
                        ],
                    },
                ],
            },
            partial=True,
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)
        serializer.save()

        template_names = list(
            problem.ProblemTemplate_problem.order_by("id").values_list("template_name", flat=True)
        )
        self.assertEqual(
            template_names,
            ["main.py", "helper.py", "Main.java", "Util.java"],
        )

    def test_problem_post_payload_serializer_moves_locked_primary_template_to_first(self):
        serializer = ProblemPostPayloadSerializer(
            data={
                "problemData": {
                    "title": "templated",
                    "description": "desc",
                    "type": "GENERAL",
                    "difficulty": "MEDIUM",
                    "limit_time": 1000,
                    "limit_memory": 256,
                    "share": False,
                    "languages": ["java"],
                    "template_codes": [
                        {
                            "language": "java",
                            "files": [
                                {"filename": "Util.java", "content": "class Util {}"},
                                {"filename": "Main.java", "content": "class Main {}"},
                            ],
                        },
                    ],
                    "testcases": [
                        {
                            "input": {"index": 1, "content": "1"},
                            "output": {"index": 1, "content": "1"},
                        }
                    ],
                }
            }
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)
        templates = serializer.validated_data["problemData"]["template_codes"]
        self.assertEqual(templates[0]["files"][0]["filename"], "Main.java")
        self.assertEqual(templates[0]["files"][1]["filename"], "Util.java")

    def test_problem_destroy_soft_deletes_problem_and_related_rows(self):
        problem = self._create_problem()
        template = models.ProblemTemplate.objects.create(
            problem=problem,
            template_name="main.py",
            template_content="print('hi')",
        )
        testcase = models.ProblemInOut.objects.create(
            problem=problem,
            input_code="1",
            output_code="1",
        )
        checker = models.ProblemChecker.objects.create(
            problem=problem,
            name="checker.py",
            code="print('check')",
        )
        checker_language = models.LanguageInChecker.objects.create(
            checker=checker,
            language=self.language,
        )

        lecture = self._create_lecture()
        now = timezone.now()
        section = models.Section.objects.create(
            lecture=lecture,
            section_name="HW1",
            description="desc",
            week=1,
            share=False,
        )
        section_problem = models.SectionProblem.objects.create(
            section=section,
            problem=problem,
            start_date=now,
            due_date=now + timedelta(days=1),
        )
        exam = models.Exam.objects.create(
            lecture=lecture,
            exam_name="Midterm",
            week=1,
            due_date=now + timedelta(days=1),
            start_date=now,
            share=False,
            description="desc",
        )
        exam_problem = models.ExamProblem.objects.create(
            exam=exam,
            problem=problem,
        )
        board = models.Board.objects.create(
            board_name="QnA",
            description="desc",
        )
        post = models.Post.objects.create(
            board=board,
            user=self.user,
            title="question",
            content="body",
        )
        problem_post = models.ProblemPost.objects.create(
            post=post,
            problem=problem,
        )
        language_link = models.LanguageInProblem.all_objects.get(problem=problem, language=self.language)

        ProblemViewSet().perform_destroy(problem)

        problem.refresh_from_db()
        template.refresh_from_db()
        testcase.refresh_from_db()
        checker.refresh_from_db()
        checker_language.refresh_from_db()
        section_problem.refresh_from_db()
        exam_problem.refresh_from_db()
        problem_post.refresh_from_db()
        language_link.refresh_from_db()

        self.assertTrue(problem.is_delete)
        self.assertTrue(template.is_delete)
        self.assertTrue(testcase.is_delete)
        self.assertTrue(checker.is_delete)
        self.assertTrue(checker_language.is_delete)
        self.assertTrue(section_problem.is_delete)
        self.assertTrue(exam_problem.is_delete)
        self.assertTrue(problem_post.is_delete)
        self.assertTrue(language_link.is_delete)

    def test_problem_update_serializer_soft_deletes_checker_languages_when_checker_removed(self):
        problem = self._create_problem()
        checker = models.ProblemChecker.objects.create(
            problem=problem,
            name="checker.py",
            code="print('check')",
        )
        checker_language = models.LanguageInChecker.objects.create(
            checker=checker,
            language=self.language,
        )

        serializer = ProblemCreateUpdateSerializer(
            instance=problem,
            data={"checker_code": ""},
            partial=True,
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)
        serializer.save()

        checker.refresh_from_db()
        checker_language.refresh_from_db()

        self.assertTrue(checker.is_delete)
        self.assertTrue(checker_language.is_delete)

    def test_post_soft_delete_cascades_to_related_rows(self):
        problem = self._create_problem()
        lecture = self._create_lecture()
        board = models.Board.objects.create(board_name="QnA", description="desc")
        post = models.Post.objects.create(
            board=board,
            user=self.user,
            title="question",
            content="body",
        )
        reply = models.PostReply.objects.create(
            post=post,
            user=self.user,
            board=board,
            reply_content="reply",
        )
        problem_post = models.ProblemPost.objects.create(post=post, problem=problem)
        post_lecture = models.PostLecture.objects.create(class_id=lecture, post=post)

        soft_delete_post(post)

        post.refresh_from_db()
        reply.refresh_from_db()
        problem_post.refresh_from_db()
        post_lecture.refresh_from_db()

        self.assertTrue(post.is_delete)
        self.assertTrue(reply.is_delete)
        self.assertTrue(problem_post.is_delete)
        self.assertTrue(post_lecture.is_delete)

    def test_section_soft_delete_cascades_to_problem_links(self):
        problem = self._create_problem()
        lecture = self._create_lecture()
        now = timezone.now()
        section = models.Section.objects.create(
            lecture=lecture,
            section_name="HW1",
            description="desc",
            week=1,
            share=False,
        )
        section_problem = models.SectionProblem.objects.create(
            section=section,
            problem=problem,
            start_date=now,
            due_date=now + timedelta(days=1),
        )
        section_language = models.LanguageInSectionProblem.objects.create(
            section_problem=section_problem,
            language=self.language,
        )

        soft_delete_section(section)

        section.refresh_from_db()
        section_problem.refresh_from_db()
        section_language.refresh_from_db()

        self.assertTrue(section.is_delete)
        self.assertTrue(section_problem.is_delete)
        self.assertTrue(section_language.is_delete)

    def test_exam_soft_delete_cascades_to_problem_and_user_links(self):
        problem = self._create_problem()
        lecture = self._create_lecture()
        student = self._create_student()
        membership = self._create_membership(lecture, student)
        now = timezone.now()
        exam = models.Exam.objects.create(
            lecture=lecture,
            exam_name="Midterm",
            week=1,
            due_date=now + timedelta(days=1),
            start_date=now,
            share=False,
            description="desc",
        )
        exam_problem = models.ExamProblem.objects.create(exam=exam, problem=problem)
        exam_user = models.ExamUser.objects.create(
            exam=exam,
            lecture_user=membership,
            start_time=now,
            end_time=now + timedelta(hours=2),
        )

        soft_delete_exam(exam)

        exam.refresh_from_db()
        exam_problem.refresh_from_db()
        exam_user.refresh_from_db()

        self.assertTrue(exam.is_delete)
        self.assertTrue(exam_problem.is_delete)
        self.assertTrue(exam_user.is_delete)

    def test_lecture_soft_delete_cascades_to_descendants(self):
        problem = self._create_problem()
        lecture = self._create_lecture()
        student = self._create_student(username="student2")
        membership = self._create_membership(lecture, student, student_code="STUDENT002")
        lecture_language = models.LanguageInLecture.objects.create(
            lecture=lecture,
            language=self.language,
        )
        now = timezone.now()
        section = models.Section.objects.create(
            lecture=lecture,
            section_name="HW1",
            description="desc",
            week=1,
            share=False,
        )
        section_problem = models.SectionProblem.objects.create(
            section=section,
            problem=problem,
            start_date=now,
            due_date=now + timedelta(days=1),
        )
        section_language = models.LanguageInSectionProblem.objects.create(
            section_problem=section_problem,
            language=self.language,
        )
        exam = models.Exam.objects.create(
            lecture=lecture,
            exam_name="Final",
            week=2,
            due_date=now + timedelta(days=2),
            start_date=now,
            share=False,
            description="desc",
        )
        exam_problem = models.ExamProblem.objects.create(exam=exam, problem=problem)
        exam_user = models.ExamUser.objects.create(
            exam=exam,
            lecture_user=membership,
            start_time=now,
            end_time=now + timedelta(hours=2),
        )
        board = models.Board.objects.create(board_name="Notice", description="desc")
        post = models.Post.objects.create(
            board=board,
            user=self.user,
            title="notice",
            content="body",
        )
        post_lecture = models.PostLecture.objects.create(class_id=lecture, post=post)

        soft_delete_lecture(lecture)

        lecture.refresh_from_db()
        membership.refresh_from_db()
        lecture_language.refresh_from_db()
        section.refresh_from_db()
        section_problem.refresh_from_db()
        section_language.refresh_from_db()
        exam.refresh_from_db()
        exam_problem.refresh_from_db()
        exam_user.refresh_from_db()
        post_lecture.refresh_from_db()
        post.refresh_from_db()

        self.assertTrue(lecture.is_delete)
        self.assertTrue(membership.is_delete)
        self.assertTrue(lecture_language.is_delete)
        self.assertTrue(section.is_delete)
        self.assertTrue(section_problem.is_delete)
        self.assertTrue(section_language.is_delete)
        self.assertTrue(exam.is_delete)
        self.assertTrue(exam_problem.is_delete)
        self.assertTrue(exam_user.is_delete)
        self.assertTrue(post_lecture.is_delete)
        self.assertFalse(post.is_delete)


class ProblemAccessPolicyTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.admin_group, _ = Group.objects.get_or_create(name=str(GroupEnum.ADMINISTRATOR))
        cls.prof_group, _ = Group.objects.get_or_create(name=str(GroupEnum.PROFESSOR))
        cls.student_group, _ = Group.objects.get_or_create(name=str(GroupEnum.STUDENT))

        cls.owner = get_user_model().objects.create_user(
            username="owner",
            password="password123",
        )
        cls.owner.groups.add(cls.prof_group)

        cls.admin = get_user_model().objects.create_user(
            username="admin",
            password="password123",
        )
        cls.admin.groups.add(cls.admin_group)

        cls.student = get_user_model().objects.create_user(
            username="student",
            password="password123",
        )
        cls.student.groups.add(cls.student_group)

        cls.private_problem = models.Problem.objects.create(
            maker=cls.owner,
            problem_name="private problem",
            description="desc",
            type="PS",
            difficulty=1,
            limit_time=1000,
            limit_memory=256,
            share=False,
        )
        cls.public_problem = models.Problem.objects.create(
            maker=cls.owner,
            problem_name="public problem",
            description="desc",
            type="PS",
            difficulty=1,
            limit_time=1000,
            limit_memory=256,
            share=True,
        )

    def test_admin_list_includes_non_shared_problem(self):
        self.client.force_login(self.admin)

        response = self.client.get(reverse("problems-list"))

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        returned_uuids = {item["uuid"] for item in payload["data"]}
        self.assertIn(str(self.private_problem.uuid), returned_uuids)
        self.assertIn(str(self.public_problem.uuid), returned_uuids)

    def test_admin_can_retrieve_non_shared_problem(self):
        self.client.force_login(self.admin)

        response = self.client.get(
            reverse("problems-detail", kwargs={"uuid": self.private_problem.uuid})
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["uuid"], str(self.private_problem.uuid))
        self.assertFalse(response.json()["share"])

    def test_student_cannot_retrieve_non_shared_problem_without_access(self):
        self.client.force_login(self.student)

        response = self.client.get(
            reverse("problems-detail", kwargs={"uuid": self.private_problem.uuid})
        )

        self.assertEqual(response.status_code, 404)


class BoardAccessPolicyTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.admin_group, _ = Group.objects.get_or_create(name=str(GroupEnum.ADMINISTRATOR))
        cls.prof_group, _ = Group.objects.get_or_create(name=str(GroupEnum.PROFESSOR))
        cls.student_group, _ = Group.objects.get_or_create(name=str(GroupEnum.STUDENT))

        cls.professor = get_user_model().objects.create_user(
            username="board-professor",
            password="password123",
        )
        cls.professor.groups.add(cls.prof_group)

        cls.admin = get_user_model().objects.create_user(
            username="board-admin",
            password="password123",
        )
        cls.admin.groups.add(cls.admin_group)

        cls.student = get_user_model().objects.create_user(
            username="board-student",
            password="password123",
        )
        cls.student.groups.add(cls.student_group)

        cls.enrolled_student = get_user_model().objects.create_user(
            username="board-enrolled-student",
            password="password123",
        )
        cls.enrolled_student.groups.add(cls.student_group)

        cls.board = models.Board.objects.create(
            board_name="QnA",
            description="desc",
        )
        cls.private_problem = models.Problem.objects.create(
            maker=cls.professor,
            problem_name="private board problem",
            description="desc",
            type="PS",
            difficulty=1,
            limit_time=1000,
            limit_memory=256,
            share=False,
        )
        cls.problem_post = models.Post.objects.create(
            board=cls.board,
            user=cls.professor,
            title="private problem post",
            content="secret",
        )
        models.ProblemPost.objects.create(
            post=cls.problem_post,
            problem=cls.private_problem,
        )
        cls.problem_reply = models.PostReply.objects.create(
            post=cls.problem_post,
            user=cls.professor,
            board=cls.board,
            reply_content="professor reply",
        )

        cls.lecture = models.Lecture.objects.create(
            instructor=cls.professor,
            lecture_name="Algorithms",
            description="desc",
            weeks=16,
        )
        models.StudentInLecture.objects.create(
            lecture=cls.lecture,
            student=cls.enrolled_student,
            student_code="STUDENT010",
        )
        cls.lecture_post = models.Post.objects.create(
            board=cls.board,
            user=cls.professor,
            title="lecture notice",
            content="lecture secret",
        )
        models.PostLecture.objects.create(
            class_id=cls.lecture,
            post=cls.lecture_post,
            is_noticed=False,
        )

    def test_admin_can_retrieve_problem_linked_private_post(self):
        self.client.force_login(self.admin)

        response = self.client.get(f"/api/v1/instructor/posts/{self.problem_post.uuid}/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["uuid"], str(self.problem_post.uuid))

    def test_student_cannot_retrieve_problem_linked_private_post(self):
        self.client.force_login(self.student)

        response = self.client.get(f"/api/v1/instructor/posts/{self.problem_post.uuid}/")

        self.assertEqual(response.status_code, 404)

    def test_student_cannot_create_post_for_inaccessible_private_problem(self):
        self.client.force_login(self.student)

        response = self.client.post(
            "/api/v1/instructor/posts/",
            {
                "title": "blocked",
                "content": "blocked",
                "problem_uuid": str(self.private_problem.uuid),
            },
        )

        self.assertEqual(response.status_code, 404)

    def test_unenrolled_student_cannot_retrieve_lecture_post(self):
        self.client.force_login(self.student)

        response = self.client.get(f"/api/v1/instructor/posts/{self.lecture_post.uuid}/")

        self.assertEqual(response.status_code, 404)

    def test_enrolled_student_can_retrieve_lecture_post(self):
        self.client.force_login(self.enrolled_student)

        response = self.client.get(f"/api/v1/instructor/posts/{self.lecture_post.uuid}/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["uuid"], str(self.lecture_post.uuid))

    def test_enrolled_student_can_list_lecture_posts_by_class_uuid(self):
        self.client.force_login(self.enrolled_student)

        response = self.client.get(
            "/api/v1/instructor/posts/",
            {"page": 1, "size": 20, "class_uuid": str(self.lecture.uuid)},
        )

        self.assertEqual(response.status_code, 200)
        returned_uuids = {item["uuid"] for item in response.json()["data"]}
        self.assertIn(str(self.lecture_post.uuid), returned_uuids)

    def test_enrolled_student_can_list_posts(self):
        self.client.force_login(self.enrolled_student)

        response = self.client.get(
            "/api/v1/instructor/posts/",
            {"page": 1, "size": 20},
        )

        self.assertEqual(response.status_code, 200)
        returned_uuids = {item["uuid"] for item in response.json()["data"]}
        self.assertIn(str(self.lecture_post.uuid), returned_uuids)
        self.assertNotIn(str(self.problem_post.uuid), returned_uuids)

    def test_enrolled_student_can_list_posts_excluding_exam_notice(self):
        noticed_post = models.Post.objects.create(
            board=self.board,
            user=self.professor,
            title="exam notice",
            content="hidden",
        )
        models.PostLecture.objects.create(
            class_id=self.lecture,
            post=noticed_post,
            is_noticed=True,
        )
        self.client.force_login(self.enrolled_student)

        response = self.client.get(
            "/api/v1/instructor/posts/",
            {"page": 1, "size": 20, "exclude_exam_notice": "true"},
        )

        self.assertEqual(response.status_code, 200)
        returned_uuids = {item["uuid"] for item in response.json()["data"]}
        self.assertIn(str(self.lecture_post.uuid), returned_uuids)
        self.assertNotIn(str(noticed_post.uuid), returned_uuids)

    def test_student_cannot_reply_to_inaccessible_post(self):
        self.client.force_login(self.student)

        response = self.client.post(
            f"/api/v1/instructor/posts/{self.problem_post.uuid}/replies/",
            {"reply_content": "blocked"},
        )

        self.assertEqual(response.status_code, 404)

    def test_admin_sees_can_edit_for_other_users_reply_in_post_detail(self):
        self.client.force_login(self.admin)

        response = self.client.get(f"/api/v1/instructor/posts/{self.problem_post.uuid}/")

        self.assertEqual(response.status_code, 200)
        replies = response.json()["replies"]
        self.assertEqual(len(replies), 1)
        self.assertTrue(replies[0]["can_edit"])

    def test_admin_sees_can_edit_for_other_users_reply_in_reply_list(self):
        self.client.force_login(self.admin)

        response = self.client.get(
            f"/api/v1/instructor/posts/{self.problem_post.uuid}/replies/"
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        replies = payload["results"] if isinstance(payload, dict) else payload
        self.assertEqual(len(replies), 1)
        self.assertTrue(replies[0]["can_edit"])

    def test_board_professor_author_cannot_open_submission_from_post_payload(self):
        self.client.force_login(self.enrolled_student)

        list_response = self.client.get(
            "/api/v1/instructor/posts/",
            {"page": 1, "size": 20, "class_uuid": str(self.lecture.uuid)},
        )
        detail_response = self.client.get(f"/api/v1/instructor/posts/{self.lecture_post.uuid}/")
        replies_response = self.client.get(f"/api/v1/instructor/posts/{self.problem_post.uuid}/replies/")

        self.assertEqual(list_response.status_code, 200)
        self.assertEqual(detail_response.status_code, 200)
        self.assertEqual(replies_response.status_code, 404)

        lecture_post_payload = next(
            item for item in list_response.json()["data"]
            if item["uuid"] == str(self.lecture_post.uuid)
        )
        self.assertFalse(lecture_post_payload["can_open_submission"])
        self.assertFalse(detail_response.json()["can_open_submission"])

    def test_admin_can_open_professor_submission_from_post_payload(self):
        self.client.force_login(self.admin)

        list_response = self.client.get(
            "/api/v1/instructor/posts/",
            {"page": 1, "size": 20, "class_uuid": str(self.lecture.uuid)},
        )
        detail_response = self.client.get(f"/api/v1/instructor/posts/{self.lecture_post.uuid}/")
        replies_response = self.client.get(f"/api/v1/instructor/posts/{self.problem_post.uuid}/replies/")

        self.assertEqual(list_response.status_code, 200)
        self.assertEqual(detail_response.status_code, 200)
        self.assertEqual(replies_response.status_code, 200)

        lecture_post_payload = next(
            item for item in list_response.json()["data"]
            if item["uuid"] == str(self.lecture_post.uuid)
        )
        self.assertTrue(lecture_post_payload["can_open_submission"])
        self.assertTrue(detail_response.json()["can_open_submission"])
        reply_payload = replies_response.json()
        replies = reply_payload["results"] if isinstance(reply_payload, dict) else reply_payload
        self.assertEqual(len(replies), 1)
        self.assertTrue(replies[0]["can_open_submission"])

    def test_professor_can_open_professor_submission_from_post_payload(self):
        self.client.force_login(self.professor)

        list_response = self.client.get(
            "/api/v1/instructor/posts/",
            {"page": 1, "size": 20, "class_uuid": str(self.lecture.uuid)},
        )
        detail_response = self.client.get(f"/api/v1/instructor/posts/{self.lecture_post.uuid}/")
        replies_response = self.client.get(f"/api/v1/instructor/posts/{self.problem_post.uuid}/replies/")

        self.assertEqual(list_response.status_code, 200)
        self.assertEqual(detail_response.status_code, 200)
        self.assertEqual(replies_response.status_code, 200)

        lecture_post_payload = next(
            item for item in list_response.json()["data"]
            if item["uuid"] == str(self.lecture_post.uuid)
        )
        self.assertTrue(lecture_post_payload["can_open_submission"])
        self.assertTrue(detail_response.json()["can_open_submission"])
        reply_payload = replies_response.json()
        replies = reply_payload["results"] if isinstance(reply_payload, dict) else reply_payload
        self.assertEqual(len(replies), 1)
        self.assertTrue(replies[0]["can_open_submission"])

    def test_professor_can_open_admin_submission_from_post_payload(self):
        admin_post = models.Post.objects.create(
            board=self.board,
            user=self.admin,
            title="admin note",
            content="content",
        )
        models.PostLecture.objects.create(
            class_id=self.lecture,
            post=admin_post,
            is_noticed=False,
        )
        admin_reply = models.PostReply.objects.create(
            post=admin_post,
            user=self.admin,
            board=self.board,
            reply_content="admin reply",
        )
        self.client.force_login(self.professor)

        list_response = self.client.get(
            "/api/v1/instructor/posts/",
            {"page": 1, "size": 20, "class_uuid": str(self.lecture.uuid)},
        )
        detail_response = self.client.get(f"/api/v1/instructor/posts/{admin_post.uuid}/")
        replies_response = self.client.get(f"/api/v1/instructor/posts/{admin_post.uuid}/replies/")

        self.assertEqual(list_response.status_code, 200)
        self.assertEqual(detail_response.status_code, 200)
        self.assertEqual(replies_response.status_code, 200)

        admin_post_payload = next(
            item for item in list_response.json()["data"]
            if item["uuid"] == str(admin_post.uuid)
        )
        self.assertTrue(admin_post_payload["can_open_submission"])
        self.assertTrue(detail_response.json()["can_open_submission"])
        reply_payload = replies_response.json()
        replies = reply_payload["results"] if isinstance(reply_payload, dict) else reply_payload
        self.assertEqual(len(replies), 1)
        self.assertEqual(replies[0]["uuid"], str(admin_reply.uuid))
        self.assertTrue(replies[0]["can_open_submission"])

    def test_board_student_author_can_open_submission_from_post_payload(self):
        student_post = models.Post.objects.create(
            board=self.board,
            user=self.enrolled_student,
            title="student question",
            content="content",
        )
        models.PostLecture.objects.create(
            class_id=self.lecture,
            post=student_post,
            is_noticed=False,
        )
        student_reply = models.PostReply.objects.create(
            post=student_post,
            user=self.enrolled_student,
            board=self.board,
            reply_content="student reply",
        )
        self.client.force_login(self.enrolled_student)

        list_response = self.client.get(
            "/api/v1/instructor/posts/",
            {"page": 1, "size": 20, "class_uuid": str(self.lecture.uuid)},
        )
        detail_response = self.client.get(f"/api/v1/instructor/posts/{student_post.uuid}/")
        replies_response = self.client.get(f"/api/v1/instructor/posts/{student_post.uuid}/replies/")

        self.assertEqual(list_response.status_code, 200)
        self.assertEqual(detail_response.status_code, 200)
        self.assertEqual(replies_response.status_code, 200)

        student_post_payload = next(
            item for item in list_response.json()["data"]
            if item["uuid"] == str(student_post.uuid)
        )
        self.assertTrue(student_post_payload["can_open_submission"])
        self.assertTrue(detail_response.json()["can_open_submission"])
        reply_payload = replies_response.json()
        replies = reply_payload["results"] if isinstance(reply_payload, dict) else reply_payload
        self.assertEqual(len(replies), 1)
        self.assertEqual(replies[0]["uuid"], str(student_reply.uuid))
        self.assertTrue(replies[0]["can_open_submission"])

    def test_admin_can_update_other_users_reply(self):
        self.client.force_login(self.admin)

        response = self.client.put(
            f"/api/v1/instructor/posts/{self.problem_post.uuid}/replies/{self.problem_reply.uuid}/",
            {"reply_content": "edited by admin"},
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        self.problem_reply.refresh_from_db()
        self.assertEqual(self.problem_reply.reply_content, "edited by admin")

    def test_admin_can_delete_other_users_reply(self):
        self.client.force_login(self.admin)

        response = self.client.delete(
            f"/api/v1/instructor/posts/{self.problem_post.uuid}/replies/{self.problem_reply.uuid}/"
        )

        self.assertEqual(response.status_code, 204)
        self.problem_reply.refresh_from_db()
        self.assertTrue(self.problem_reply.is_delete)


class HomeworkAccessWindowTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.prof_group, _ = Group.objects.get_or_create(name=str(GroupEnum.PROFESSOR))
        cls.student_group, _ = Group.objects.get_or_create(name=str(GroupEnum.STUDENT))

        cls.professor = get_user_model().objects.create_user(
            username="homework-professor",
            password="password123",
        )
        cls.professor.groups.add(cls.prof_group)

        cls.student = get_user_model().objects.create_user(
            username="homework-student",
            password="password123",
        )
        cls.student.groups.add(cls.student_group)

        cls.language = models.Language.objects.create(
            language_name="C",
            version="17",
            build_command="gcc main.c -o main",
            grade_command="./main",
            additional_memory="*1",
            additional_time="*1",
        )
        cls.lecture = models.Lecture.objects.create(
            instructor=cls.professor,
            lecture_name="Homework Lecture",
            description="desc",
            weeks=16,
        )
        models.StudentInLecture.objects.create(
            lecture=cls.lecture,
            student=cls.student,
            student_code="STUDENT011",
        )
        cls.section = models.Section.objects.create(
            lecture=cls.lecture,
            section_name="HW1",
            description="desc",
            week=1,
            share=True,
        )
        cls.problem = models.Problem.objects.create(
            maker=cls.professor,
            problem_name="future homework problem",
            description="desc",
            type="PS",
            difficulty=1,
            limit_time=1000,
            limit_memory=128,
            share=True,
        )
        models.LanguageInProblem.objects.create(problem=cls.problem, language=cls.language)
        now = timezone.now()
        cls.future_section_problem = models.SectionProblem.objects.create(
            section=cls.section,
            problem=cls.problem,
            start_date=now + timedelta(hours=2),
            due_date=now + timedelta(days=1),
        )

    def test_student_cannot_open_homework_problem_before_start(self):
        self.client.force_login(self.student)

        response = self.client.get(
            f"/api/v1/instructor/solve/homework/problem/{self.future_section_problem.uuid}/"
        )

        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json()["detail"], "접근 가능 시간이 아닙니다.")

    def test_student_cannot_run_homework_before_start(self):
        self.client.force_login(self.student)

        response = self.client.post(
            "/api/v1/instructor/execution/run/",
            {
                "section_problem_uuid": str(self.future_section_problem.uuid),
                "language": "C",
                "code": {"main.c": "int main(){return 0;}"},
                "input_data": "",
            },
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json()["detail"], "접근 가능 시간이 아닙니다.")

    def test_student_cannot_submit_homework_before_start(self):
        self.client.force_login(self.student)

        response = self.client.post(
            "/api/v1/instructor/execution/grade/homework/",
            {
                "section_uuid": str(self.section.uuid),
                "section_problem_uuid": str(self.future_section_problem.uuid),
                "language": "C",
                "code": {"main.c": "int main(){return 0;}"},
            },
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json()["detail"], "접근 가능 시간이 아닙니다.")

    def test_professor_can_open_homework_problem_before_start(self):
        self.client.force_login(self.professor)

        response = self.client.get(
            f"/api/v1/instructor/solve/homework/problem/{self.future_section_problem.uuid}/"
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json()["section_problem_uuid"],
            str(self.future_section_problem.uuid),
        )


class HomeworkSectionOrderingTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.student_group, _ = Group.objects.get_or_create(name=str(GroupEnum.STUDENT))
        cls.prof_group, _ = Group.objects.get_or_create(name=str(GroupEnum.PROFESSOR))

        cls.professor = get_user_model().objects.create_user(
            username="section-order-professor",
            password="password123",
        )
        cls.professor.groups.add(cls.prof_group)

        cls.student = get_user_model().objects.create_user(
            username="section-order-student",
            password="password123",
        )
        cls.student.groups.add(cls.student_group)

        cls.lecture = models.Lecture.objects.create(
            instructor=cls.professor,
            lecture_name="Ordering Lecture",
            description="desc",
            weeks=16,
        )
        models.StudentInLecture.objects.create(
            lecture=cls.lecture,
            student=cls.student,
            student_code="STUDENT012",
        )

        cls.older_section = models.Section.objects.create(
            lecture=cls.lecture,
            section_name="Older Homework",
            description="old",
            week=1,
            share=True,
        )
        cls.newer_section = models.Section.objects.create(
            lecture=cls.lecture,
            section_name="Newer Homework",
            description="new",
            week=2,
            share=True,
        )

    def test_homework_list_returns_newest_section_first(self):
        self.client.force_login(self.student)

        response = self.client.get(f"/api/v1/instructor/lectures/{self.lecture.uuid}/homework/")

        self.assertEqual(response.status_code, 200)
        homeworks = response.json()["homeworks"]
        self.assertEqual(
            [item["title"] for item in homeworks],
            ["Newer Homework", "Older Homework"],
        )


class SubmissionTargetRoleRestrictionTests(TestCase):
    non_student_target_message = "학생 계정만 조회할 수 있습니다."

    @classmethod
    def setUpTestData(cls):
        cls.admin_group, _ = Group.objects.get_or_create(name=str(GroupEnum.ADMINISTRATOR))
        cls.prof_group, _ = Group.objects.get_or_create(name=str(GroupEnum.PROFESSOR))
        cls.student_group, _ = Group.objects.get_or_create(name=str(GroupEnum.STUDENT))

        cls.professor = get_user_model().objects.create_user(
            username="submission-professor",
            password="password123",
        )
        cls.professor.groups.add(cls.prof_group)

        cls.admin = get_user_model().objects.create_user(
            username="submission-admin",
            password="password123",
        )
        cls.admin.groups.add(cls.admin_group)

        cls.student = get_user_model().objects.create_user(
            username="submission-student",
            password="password123",
            first_name="길동",
            last_name="홍",
        )
        cls.student.groups.add(cls.student_group)

        cls.lecture = models.Lecture.objects.create(
            instructor=cls.professor,
            lecture_name="Submission Lecture",
            description="desc",
            weeks=16,
        )
        models.StudentInLecture.objects.create(
            lecture=cls.lecture,
            student=cls.student,
            student_code="STUDENT021",
        )

        cls.problem = models.Problem.objects.create(
            maker=cls.professor,
            problem_name="Submission Problem",
            description="desc",
            type="PS",
            difficulty=1,
            limit_time=1000,
            limit_memory=128,
            share=True,
        )
        now = timezone.now()
        cls.section = models.Section.objects.create(
            lecture=cls.lecture,
            section_name="HW",
            description="desc",
            week=1,
            share=True,
        )
        cls.section_problem = models.SectionProblem.objects.create(
            section=cls.section,
            problem=cls.problem,
            start_date=now - timedelta(days=1),
            due_date=now + timedelta(days=1),
        )
        cls.exam = models.Exam.objects.create(
            lecture=cls.lecture,
            exam_name="Midterm",
            week=1,
            start_date=now - timedelta(hours=1),
            due_date=now + timedelta(hours=1),
            share=True,
        )
        cls.exam_problem = models.ExamProblem.objects.create(
            exam=cls.exam,
            problem=cls.problem,
            score=100,
        )
        cls.homework_submission = models.ProblemSubmit.objects.create(
            user=cls.student,
            section=cls.section,
            section_problem=cls.section_problem,
            code="print('hello')",
            score=100,
            submission_time=now,
            execution_time=12.5,
            submission_count=1,
            judge_count=1,
            status="CORRECT",
            memory=32,
        )
        cls.exam_submission = models.ExamSubmit.objects.create(
            user=cls.student,
            exam=cls.exam,
            problem=cls.exam_problem,
            code="print('exam')",
            score=100,
            submission_time=now,
            ip="127.0.0.1",
            execution_time=8.0,
            submission_count=1,
            judge_count=1,
            status="CORRECT",
            memory=16,
        )

    def assert_non_student_target_blocked(self, url):
        response = self.client.get(url)
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json()["detail"], self.non_student_target_message)

    def test_student_cannot_view_professor_and_admin_unified_submissions(self):
        self.client.force_login(self.student)
        urls = [
            f"/api/v1/instructor/submissions/user/{self.professor.id}/",
            f"/api/v1/instructor/submissions/user/{self.admin.id}/",
            f"/api/v1/instructor/submissions/user/{self.professor.id}/code/{self.homework_submission.uuid}/",
            f"/api/v1/instructor/submissions/user/{self.admin.id}/code/{self.homework_submission.uuid}/",
        ]

        for url in urls:
            with self.subTest(url=url):
                self.assert_non_student_target_blocked(url)

    def test_admin_can_view_professor_and_admin_unified_submissions(self):
        self.client.force_login(self.admin)

        summary_urls = [
            f"/api/v1/instructor/submissions/user/{self.professor.id}/",
            f"/api/v1/instructor/submissions/user/{self.admin.id}/",
        ]
        code_urls = [
            f"/api/v1/instructor/submissions/user/{self.professor.id}/code/{self.homework_submission.uuid}/",
            f"/api/v1/instructor/submissions/user/{self.admin.id}/code/{self.homework_submission.uuid}/",
        ]

        for url in summary_urls:
            with self.subTest(url=url):
                response = self.client.get(url)
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.json(), [])

        for url in code_urls:
            with self.subTest(url=url):
                response = self.client.get(url)
                self.assertEqual(response.status_code, 404)

    def test_professor_can_view_professor_and_admin_unified_submissions(self):
        self.client.force_login(self.professor)

        professor_summary = self.client.get(
            f"/api/v1/instructor/submissions/user/{self.professor.id}/"
        )
        professor_code = self.client.get(
            f"/api/v1/instructor/submissions/user/{self.professor.id}/code/{self.homework_submission.uuid}/"
        )
        admin_summary = self.client.get(
            f"/api/v1/instructor/submissions/user/{self.admin.id}/"
        )
        admin_code = self.client.get(
            f"/api/v1/instructor/submissions/user/{self.admin.id}/code/{self.homework_submission.uuid}/"
        )

        self.assertEqual(professor_summary.status_code, 200)
        self.assertEqual(professor_summary.json(), [])
        self.assertEqual(professor_code.status_code, 404)
        self.assertEqual(admin_summary.status_code, 200)
        self.assertEqual(admin_summary.json(), [])
        self.assertEqual(admin_code.status_code, 404)

    def test_unified_submission_endpoints_allow_student_target(self):
        self.client.force_login(self.admin)
        summary_response = self.client.get(f"/api/v1/instructor/submissions/user/{self.student.id}/")
        code_response = self.client.get(
            f"/api/v1/instructor/submissions/user/{self.student.id}/code/{self.homework_submission.uuid}/"
        )

        self.assertEqual(summary_response.status_code, 200)
        self.assertEqual(code_response.status_code, 200)
        self.assertEqual(len(summary_response.json()), 2)
        self.assertEqual(code_response.json()["uuid"], str(self.homework_submission.uuid))

    def test_student_cannot_view_professor_and_admin_homework_submissions(self):
        self.client.force_login(self.student)
        urls = [
            f"/api/v1/instructor/lectures/{self.lecture.uuid}/submissions/homework/homework/{self.professor.id}/",
            f"/api/v1/instructor/lectures/{self.lecture.uuid}/submissions/homework/homework/{self.admin.id}/",
            f"/api/v1/instructor/lectures/{self.lecture.uuid}/submissions/homework/homework/{self.professor.id}/users/{self.section_problem.uuid}/",
            f"/api/v1/instructor/lectures/{self.lecture.uuid}/submissions/homework/homework/{self.admin.id}/users/{self.section_problem.uuid}/",
        ]

        for url in urls:
            with self.subTest(url=url):
                self.assert_non_student_target_blocked(url)

    def test_admin_can_view_professor_and_admin_homework_submissions(self):
        self.client.force_login(self.admin)

        detail_urls = [
            f"/api/v1/instructor/lectures/{self.lecture.uuid}/submissions/homework/homework/{self.professor.id}/",
            f"/api/v1/instructor/lectures/{self.lecture.uuid}/submissions/homework/homework/{self.admin.id}/",
        ]
        code_urls = [
            f"/api/v1/instructor/lectures/{self.lecture.uuid}/submissions/homework/homework/{self.professor.id}/users/{self.section_problem.uuid}/",
            f"/api/v1/instructor/lectures/{self.lecture.uuid}/submissions/homework/homework/{self.admin.id}/users/{self.section_problem.uuid}/",
        ]

        for url in detail_urls:
            with self.subTest(url=url):
                response = self.client.get(url)
                self.assertEqual(response.status_code, 404)

        for url in code_urls:
            with self.subTest(url=url):
                response = self.client.get(url)
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.json()["count"], 0)

    def test_homework_submission_endpoints_allow_student_target(self):
        self.client.force_login(self.admin)
        detail_response = self.client.get(
            f"/api/v1/instructor/lectures/{self.lecture.uuid}/submissions/homework/homework/{self.student.id}/"
        )
        code_response = self.client.get(
            f"/api/v1/instructor/lectures/{self.lecture.uuid}/submissions/homework/homework/{self.student.id}/users/{self.section_problem.uuid}/"
        )

        self.assertEqual(detail_response.status_code, 200)
        self.assertEqual(code_response.status_code, 200)
        self.assertEqual(detail_response.json()["user_id"], self.student.id)
        self.assertEqual(len(code_response.json()["results"]), 1)

    def test_student_cannot_view_professor_and_admin_exam_submissions(self):
        self.client.force_login(self.student)
        urls = [
            f"/api/v1/instructor/lectures/{self.lecture.uuid}/submissions/exam/exam/{self.professor.id}/",
            f"/api/v1/instructor/lectures/{self.lecture.uuid}/submissions/exam/exam/{self.admin.id}/",
            f"/api/v1/instructor/lectures/{self.lecture.uuid}/submissions/exam/exam/{self.professor.id}/users/{self.exam_problem.uuid}/",
            f"/api/v1/instructor/lectures/{self.lecture.uuid}/submissions/exam/exam/{self.admin.id}/users/{self.exam_problem.uuid}/",
        ]

        for url in urls:
            with self.subTest(url=url):
                self.assert_non_student_target_blocked(url)

    def test_admin_can_view_professor_and_admin_exam_submissions(self):
        self.client.force_login(self.admin)

        detail_urls = [
            f"/api/v1/instructor/lectures/{self.lecture.uuid}/submissions/exam/exam/{self.professor.id}/",
            f"/api/v1/instructor/lectures/{self.lecture.uuid}/submissions/exam/exam/{self.admin.id}/",
        ]
        code_urls = [
            f"/api/v1/instructor/lectures/{self.lecture.uuid}/submissions/exam/exam/{self.professor.id}/users/{self.exam_problem.uuid}/",
            f"/api/v1/instructor/lectures/{self.lecture.uuid}/submissions/exam/exam/{self.admin.id}/users/{self.exam_problem.uuid}/",
        ]

        for url in detail_urls:
            with self.subTest(url=url):
                response = self.client.get(url)
                self.assertEqual(response.status_code, 404)

        for url in code_urls:
            with self.subTest(url=url):
                response = self.client.get(url)
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.json()["count"], 0)

    def test_exam_submission_endpoints_allow_student_target(self):
        self.client.force_login(self.admin)
        detail_response = self.client.get(
            f"/api/v1/instructor/lectures/{self.lecture.uuid}/submissions/exam/exam/{self.student.id}/"
        )
        code_response = self.client.get(
            f"/api/v1/instructor/lectures/{self.lecture.uuid}/submissions/exam/exam/{self.student.id}/users/{self.exam_problem.uuid}/"
        )

        self.assertEqual(detail_response.status_code, 200)
        self.assertEqual(code_response.status_code, 200)
        self.assertEqual(detail_response.json()["user_id"], self.student.id)
        self.assertEqual(len(code_response.json()["results"]), 1)


@override_settings(PENDING_SUBMISSION_MAX_AGE_DAYS=7)
class PendingCleanupTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = get_user_model().objects.create_user(
            username="pending-cleanup-user",
            password="password123",
        )
        cls.problem = models.Problem.objects.create(
            maker=cls.user,
            problem_name="pending-cleanup-problem",
            description="desc",
            type="PS",
            difficulty=1,
            limit_time=1000,
            limit_memory=256,
            share=False,
        )
        cls.lecture = models.Lecture.objects.create(
            instructor=cls.user,
            lecture_name="Algo",
            description="desc",
            weeks=16,
        )
        now = timezone.now()
        cls.section = models.Section.objects.create(
            lecture=cls.lecture,
            section_name="HW",
            description="desc",
            week=1,
            share=True,
        )
        cls.section_problem = models.SectionProblem.objects.create(
            section=cls.section,
            problem=cls.problem,
            start_date=now - timedelta(days=2),
            due_date=now + timedelta(days=2),
        )
        cls.exam = models.Exam.objects.create(
            lecture=cls.lecture,
            exam_name="Midterm",
            week=1,
            start_date=now - timedelta(days=2),
            due_date=now + timedelta(days=2),
            share=True,
        )
        cls.exam_problem = models.ExamProblem.objects.create(
            exam=cls.exam,
            problem=cls.problem,
            score=100,
        )

    def test_marks_recent_pending_and_immediately_cleans_reverted_results(self):
        now = timezone.now()
        stale_threshold = now - timedelta(minutes=30)
        recent_window_start = now - timedelta(days=7)

        recent_homework = models.ProblemSubmit.objects.create(
            user=self.user,
            section=self.section,
            section_problem=self.section_problem,
            code="print('recent-homework')",
            score=None,
            submission_time=now - timedelta(days=1),
            execution_time=None,
            submission_count=1,
            judge_count=1,
            status="PENDING",
            memory=None,
        )
        old_homework = models.ProblemSubmit.objects.create(
            user=self.user,
            section=self.section,
            section_problem=self.section_problem,
            code="print('old-homework')",
            score=None,
            submission_time=now - timedelta(days=8),
            execution_time=None,
            submission_count=1,
            judge_count=1,
            status="PENDING",
            memory=None,
        )
        fresh_homework = models.ProblemSubmit.objects.create(
            user=self.user,
            section=self.section,
            section_problem=self.section_problem,
            code="print('fresh-homework')",
            score=None,
            submission_time=now - timedelta(minutes=10),
            execution_time=None,
            submission_count=1,
            judge_count=1,
            status="PENDING",
            memory=None,
        )
        reverted_homework = models.ProblemSubmit.objects.create(
            user=self.user,
            section=self.section,
            section_problem=self.section_problem,
            code="print('reverted-homework')",
            score=0,
            submission_time=now - timedelta(minutes=10),
            execution_time=0,
            submission_count=1,
            judge_count=1,
            status="PENDING",
            memory=0,
            error_message="",
        )

        recent_exam = models.ExamSubmit.objects.create(
            user=self.user,
            exam=self.exam,
            problem=self.exam_problem,
            code="print('recent-exam')",
            score=None,
            submission_time=now - timedelta(days=2),
            ip="127.0.0.1",
            execution_time=None,
            submission_count=1,
            judge_count=1,
            status="PD",
            memory=None,
        )
        old_exam = models.ExamSubmit.objects.create(
            user=self.user,
            exam=self.exam,
            problem=self.exam_problem,
            code="print('old-exam')",
            score=None,
            submission_time=now - timedelta(days=9),
            ip="127.0.0.1",
            execution_time=None,
            submission_count=1,
            judge_count=1,
            status="PENDING",
            memory=None,
        )
        fresh_exam = models.ExamSubmit.objects.create(
            user=self.user,
            exam=self.exam,
            problem=self.exam_problem,
            code="print('fresh-exam')",
            score=None,
            submission_time=now - timedelta(minutes=5),
            ip="127.0.0.1",
            execution_time=None,
            submission_count=1,
            judge_count=1,
            status="PENDING",
            memory=None,
        )
        reverted_exam = models.ExamSubmit.objects.create(
            user=self.user,
            exam=self.exam,
            problem=self.exam_problem,
            code="print('reverted-exam')",
            score=0,
            submission_time=now - timedelta(minutes=5),
            ip="127.0.0.1",
            execution_time=0,
            submission_count=1,
            judge_count=1,
            status="PENDING",
            memory=0,
            error_message="",
        )

        homework_count, exam_count, used_threshold = mark_stale_pending_submissions(
            threshold=stale_threshold,
            window_start=recent_window_start,
        )

        self.assertEqual(homework_count, 2)
        self.assertEqual(exam_count, 2)
        self.assertEqual(used_threshold, stale_threshold)

        recent_homework.refresh_from_db()
        old_homework.refresh_from_db()
        fresh_homework.refresh_from_db()
        reverted_homework.refresh_from_db()
        recent_exam.refresh_from_db()
        old_exam.refresh_from_db()
        fresh_exam.refresh_from_db()
        reverted_exam.refresh_from_db()

        self.assertEqual(recent_homework.status, "SE")
        self.assertEqual(recent_homework.error_message, AUTO_TIMEOUT_ERROR_MESSAGE)
        self.assertEqual(old_homework.status, "PENDING")
        self.assertEqual(fresh_homework.status, "PENDING")
        self.assertEqual(reverted_homework.status, "SE")
        self.assertEqual(reverted_homework.error_message, AUTO_TIMEOUT_ERROR_MESSAGE)

        self.assertEqual(recent_exam.status, "SE")
        self.assertEqual(recent_exam.error_message, AUTO_TIMEOUT_ERROR_MESSAGE)
        self.assertEqual(old_exam.status, "PENDING")
        self.assertEqual(fresh_exam.status, "PENDING")
        self.assertEqual(reverted_exam.status, "SE")
        self.assertEqual(reverted_exam.error_message, AUTO_TIMEOUT_ERROR_MESSAGE)
