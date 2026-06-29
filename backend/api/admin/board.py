from django.contrib import admin
from ..models.board import Board, Post, ProblemPost, PostReply, PostLecture
from .soft_delete import SoftDeleteAdmin


class ProblemPostInline(admin.TabularInline):
    model = ProblemPost
    extra = 0
    fields = ('id', 'uuid', 'problem')
    readonly_fields = ('id', 'uuid')
    autocomplete_fields = ('problem',)


class PostReplyInline(admin.TabularInline):
    model = PostReply
    extra = 0
    fields = ('id', 'uuid', 'user', 'board', 'reply_content', 'reply_date')
    readonly_fields = ('id', 'uuid', 'reply_date')
    autocomplete_fields = ('user', 'board')


class PostLectureInline(admin.TabularInline):
    model = PostLecture
    extra = 0
    fields = ('id', 'uuid', 'class_id', 'is_noticed')
    readonly_fields = ('id', 'uuid')
    autocomplete_fields = ('class_id',)


@admin.register(Board)
class BoardAdmin(SoftDeleteAdmin):
    list_display = ('id', 'uuid', 'board_name', 'description')
    search_fields = ('board_name', 'description')
    ordering = ('id', 'board_name')


@admin.register(Post)
class PostAdmin(SoftDeleteAdmin):
    list_display = (
        'id', 'uuid', 'title', 'board', 'user',
        'created_date', 'updated_date',
        'reply_count', 'problem_count', 'lecture_count'
    )
    list_filter = ('board', 'created_date', 'updated_date')
    search_fields = ('title', 'content', 'user__username', 'board__board_name')
    date_hierarchy = 'created_date'
    ordering = ('-created_date', '-id')
    autocomplete_fields = ('board', 'user')
    list_select_related = ('board', 'user')
    inlines = [ProblemPostInline, PostReplyInline, PostLectureInline]

    @admin.display(description='답변 수')
    def reply_count(self, obj: Post):
        return obj.PostReply_post.count()

    @admin.display(description='문제 연결 수')
    def problem_count(self, obj: Post):
        return obj.ProblemPost_post.count()

    @admin.display(description='분반 연결 수')
    def lecture_count(self, obj: Post):
        return obj.PostLecture_post.count()


@admin.register(ProblemPost)
class ProblemPostAdmin(SoftDeleteAdmin):
    list_display = ('id', 'uuid', 'post', 'problem')
    list_filter = ('post__board',)
    search_fields = ('post__title', 'problem__problem_name')
    ordering = ('id',)
    autocomplete_fields = ('post', 'problem')
    list_select_related = ('post', 'problem')


@admin.register(PostReply)
class PostReplyAdmin(SoftDeleteAdmin):
    list_display = ('id', 'uuid', 'post', 'user', 'board', 'short_reply', 'reply_date')
    list_filter = ('board', 'reply_date')
    search_fields = ('post__title', 'user__username', 'reply_content')
    date_hierarchy = 'reply_date'
    ordering = ('-reply_date',)
    autocomplete_fields = ('post', 'user', 'board')
    list_select_related = ('post', 'user', 'board')

    @admin.display(description='답변(미리보기)')
    def short_reply(self, obj):
        return (obj.reply_content[:50] + '…') if len(obj.reply_content) > 50 else obj.reply_content


@admin.register(PostLecture)
class PostLectureAdmin(SoftDeleteAdmin):
    list_display = ('id', 'uuid', 'class_id', 'post', 'is_noticed')
    list_filter = ('is_noticed', 'class_id')
    search_fields = ('class_id__lecture_name', 'post__title')
    ordering = ('id',)
    autocomplete_fields = ('class_id', 'post')
    list_select_related = ('class_id', 'post')
