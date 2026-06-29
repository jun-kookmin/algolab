// app/community/posts/[postid]/page.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Btn } from "@/components/assets/Btn";
import { MarkdownViewer } from "@/components/markdown/MarkdownBoardViewer";
import {
    PostDetail,
    useGetPostDetail,
} from "@/hooks/board/Get/useGetPostDetail";
import {
    PostReply,
    useGetPostReplies,
} from "@/hooks/board/Get/useGetPostReplies";
import { useAuth } from "@/hooks/auth/AuthGuardProvider";
import { usePostReply } from "@/hooks/board/Post/usePostReply";
import { toast } from "react-toastify";
import DeleteModal from "@/components/class/DeleteModal";
import { useDeleteReply } from "@/hooks/board/Delete/useDeleteReply";
import { usePutReply } from "@/hooks/board/Put/usePutReply";
import { useDeletePost } from "@/hooks/board/Delete/useDeletePost";

// 댓글 타입 (API 맞춰서 변환)
type Comment = {
    id: string;
    parentId: string | null;
    author: string;
    authorUserId?: number;
    canOpenSubmission?: boolean;
    content: string;
    createdAt: string;
    canEdit: boolean;
};

type CommentBranch = Comment & {
    children: Comment[];
};

const TrashIcon: string = "/assets/icon/Icon_TrashCan(Red).svg";

const toTimeValue = (value?: string) => {
    const parsed = value ? new Date(value).getTime() : Number.NaN;
    return Number.isFinite(parsed) ? parsed : 0;
};

const sortDescByCreatedAt = (left: Comment, right: Comment) =>
    toTimeValue(right.createdAt) - toTimeValue(left.createdAt);

const sortAscByCreatedAt = (left: Comment, right: Comment) =>
    toTimeValue(left.createdAt) - toTimeValue(right.createdAt);

const buildCommentTree = (source: Comment[]): CommentBranch[] => {
    const topLevel = source
        .filter((comment) => !comment.parentId)
        .sort(sortDescByCreatedAt);

    const childrenMap = new Map<string, Comment[]>();

    source
        .filter((comment) => comment.parentId)
        .forEach((comment) => {
            const parentId = comment.parentId as string;
            const current = childrenMap.get(parentId) ?? [];
            current.push(comment);
            childrenMap.set(parentId, current);
        });

    childrenMap.forEach((items) => items.sort(sortAscByCreatedAt));

    return topLevel.map((comment) => ({
        ...comment,
        children: childrenMap.get(comment.id) ?? [],
    }));
};

const collectReplyBranchIds = (source: Comment[], rootId: string) => {
    const collected = new Set<string>([rootId]);
    let changed = true;

    while (changed) {
        changed = false;
        source.forEach((comment) => {
            if (comment.parentId && collected.has(comment.parentId) && !collected.has(comment.id)) {
                collected.add(comment.id);
                changed = true;
            }
        });
    }

    return collected;
};

export default function PostDetailClient({
    initialPost,
    initialReplies,
}: {
    initialPost?: PostDetail;
    initialReplies?: PostReply[];
}) {
    const params = useParams<{ postid: string }>();
    const router = useRouter();
    const searchParams = useSearchParams();
    const postid = params.postid;

    const { me } = useAuth();
    const viewerId = typeof me?.pk === "number" ? me.pk : null;
    const defaultAuthorName = me?.username ?? "user";
    const viewerGroup = (me?.group ?? "").toLowerCase();
    const viewerCanOpenOwnSubmission =
        viewerId != null &&
        ["administrator", "professor", "student"].includes(viewerGroup);

    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [selectedCommentId, setSelectedCommentId] = useState<string | null>(null);

    const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
    const [editValue, setEditValue] = useState("");
    const [replyingToId, setReplyingToId] = useState<string | null>(null);
    const [replyValue, setReplyValue] = useState("");

    // 🔹 게시글 삭제용 모달 상태
    const [postDeleteOpen, setPostDeleteOpen] = useState(false);

    // 게시글 상세 API 호출
    const {
        data: post,
        isLoading,
        error,
    } = useGetPostDetail(postid, {
        params: { no_replies: 1 },
        initialData: initialPost,
        staleTime: 300_000,
        refetchOnWindowFocus: false,
    });

    const canOpenSubmissionPage = (
        targetUserId?: number,
        canOpenSubmission?: boolean
    ) =>
        Boolean(
            targetUserId != null &&
            viewerId != null &&
            canOpenSubmission
        );

    const buildSubmissionHref = (targetUserId?: number, name?: string) => {
        if (targetUserId == null) return "";
        const params = new URLSearchParams();
        const normalizedName = name?.trim() ?? "";
        if (normalizedName) {
            params.set("name", normalizedName);
        }
        const query = params.toString();
        return query
            ? `/submission/${targetUserId}?${query}`
            : `/submission/${targetUserId}`;
    };

    const submissionHref = buildSubmissionHref(post?.user_id, post?.username);

    const { data: repliesData, isLoading: isRepliesLoading } = useGetPostReplies(
        postid,
        {
            staleTime: 300_000,
            refetchOnWindowFocus: false,
            initialData: initialReplies,
        }
    );

    // 댓글 작성 훅
    const { mutate: postReply, isPending: isReplyPending } = usePostReply();

    // 댓글삭제 훅
    const { mutate: deleteReply } = useDeleteReply();

    const { mutate: putReply } = usePutReply();

    const { mutate: deletePost, isPending: isPostDeleting } = useDeletePost();

    // 댓글 상태 (API에서 가져온 값 + 새로 작성한 댓글)
    const [comments, setComments] = useState<Comment[]>([]);
    const [newComment, setNewComment] = useState("");
    const [isSubmittingComment, setIsSubmittingComment] = useState(false);
    const commentSubmitLockedRef = useRef(false);

    useEffect(() => {
        setComments([]);
        setNewComment("");
        setIsSubmittingComment(false);
        commentSubmitLockedRef.current = false;
        setEditingCommentId(null);
        setEditValue("");
        setReplyingToId(null);
        setReplyValue("");
    }, [postid]);

    // 댓글 목록 API 응답을 화면용 Comment로 변환
    useEffect(() => {
        if (!repliesData) return;
        const mapped: Comment[] = repliesData.map((r: any) => ({
            id: r.id,
            parentId: r.parent_uuid ?? null,
            author: r.user_name,
            authorUserId:
                typeof r.user_id === "number"
                    ? r.user_id
                    : undefined,
            canOpenSubmission: Boolean(r.can_open_submission),
            content: r.reply_content,
            createdAt: r.reply_date,
            canEdit: r.can_edit,
        }));
        setComments(mapped);
    }, [repliesData]);

    const commentTree = useMemo(() => buildCommentTree(comments), [comments]);

    const handleSubmitComment = () => {
        const content = newComment.trim();
        if (!content || !post || commentSubmitLockedRef.current) return;

        commentSubmitLockedRef.current = true;
        setIsSubmittingComment(true);
        setNewComment("");

        // 낙관적 UI 업데이트용 임시 댓글
        const tempComment: Comment = {
            id: `temp-${Date.now()}`,
            parentId: null,
            author: defaultAuthorName,
            authorUserId: viewerId ?? undefined,
            canOpenSubmission: viewerCanOpenOwnSubmission,
            content,
            createdAt: new Date().toISOString(),
            canEdit: true, // 방금 내가 쓴 댓글이므로 true
        };

        setComments((prev) => [tempComment, ...prev]);

        postReply(
            {
                postUuid: postid,
                payload: { reply_content: content, parent_uuid: null },
            },
            {
                onSuccess: (data) => {
                    const replyId = String(data?.uuid ?? data?.id ?? tempComment.id);
                    setComments((prev) =>
                        prev.map((c) =>
                            c.id === tempComment.id
                                ? {
                                      ...c,
                                      id: replyId,
                                      author: data?.user_name ?? c.author,
                                      authorUserId:
                                          typeof data?.user_id === "number"
                                              ? data.user_id
                                              : c.authorUserId,
                                      canOpenSubmission:
                                          typeof data?.can_open_submission === "boolean"
                                              ? data.can_open_submission
                                              : c.canOpenSubmission,
                                      parentId: data?.parent_uuid ?? c.parentId,
                                      content: data?.reply_content ?? c.content,
                                      createdAt: data?.reply_date ?? c.createdAt,
                                      canEdit: data?.can_edit ?? c.canEdit,
                                  }
                                : c
                        )
                    );
                    commentSubmitLockedRef.current = false;
                    setIsSubmittingComment(false);
                    toast.success("댓글이 등록되었습니다!");
                },
                onError: () => {
                    // console.error("댓글 작성 실패:", err);
                    // 실패 시 낙관적 댓글 롤백
                    setComments((prev) =>
                        prev.filter((c) => c.id !== tempComment.id)
                    );
                    setNewComment((current) =>
                        current.trim().length === 0 ? content : current
                    );
                    commentSubmitLockedRef.current = false;
                    setIsSubmittingComment(false);
                    toast.error("문제가 발생했습니다. 잠시 후 다시 시도해 주세요.");
                },
            }
        );
    };

    const handleSubmitReply = (parentComment: Comment) => {
        const content = replyValue.trim();
        if (!content || !post || commentSubmitLockedRef.current) return;

        commentSubmitLockedRef.current = true;
        setIsSubmittingComment(true);
        setReplyValue("");
        setReplyingToId(null);

        const tempComment: Comment = {
            id: `temp-child-${Date.now()}`,
            parentId: parentComment.id,
            author: defaultAuthorName,
            authorUserId: viewerId ?? undefined,
            canOpenSubmission: viewerCanOpenOwnSubmission,
            content,
            createdAt: new Date().toISOString(),
            canEdit: true,
        };

        setComments((prev) => [...prev, tempComment]);

        postReply(
            {
                postUuid: postid,
                payload: {
                    reply_content: content,
                    parent_uuid: parentComment.id,
                },
            },
            {
                onSuccess: (data) => {
                    const replyId = String(data?.uuid ?? data?.id ?? tempComment.id);
                    setComments((prev) =>
                        prev.map((comment) =>
                            comment.id === tempComment.id
                                ? {
                                      ...comment,
                                      id: replyId,
                                      author: data?.user_name ?? comment.author,
                                      authorUserId:
                                          typeof data?.user_id === "number"
                                              ? data.user_id
                                              : comment.authorUserId,
                                      canOpenSubmission:
                                          typeof data?.can_open_submission === "boolean"
                                              ? data.can_open_submission
                                              : comment.canOpenSubmission,
                                      parentId: data?.parent_uuid ?? comment.parentId,
                                      content: data?.reply_content ?? comment.content,
                                      createdAt: data?.reply_date ?? comment.createdAt,
                                      canEdit: data?.can_edit ?? comment.canEdit,
                                  }
                                : comment
                        )
                    );
                    commentSubmitLockedRef.current = false;
                    setIsSubmittingComment(false);
                    toast.success("답글이 등록되었습니다!");
                },
                onError: () => {
                    setComments((prev) =>
                        prev.filter((comment) => comment.id !== tempComment.id)
                    );
                    setReplyValue((current) =>
                        current.trim().length === 0 ? content : current
                    );
                    setReplyingToId(parentComment.id);
                    commentSubmitLockedRef.current = false;
                    setIsSubmittingComment(false);
                    toast.error("답글 작성 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.");
                },
            }
        );
    };

    const backPath = (() => {
        const from = searchParams?.get("from");
        const fromProblemId = searchParams?.get("problem_id");
        if (from === "problem" && fromProblemId) {
            return `/community/${fromProblemId}`;
        }
        if (from === "all") {
            return "/community";
        }
        if (post?.problem_uuid) {
            return `/community/${post.problem_uuid}`;
        }
        return "/community";
    })();

    const handleConfirmDeletePost = () => {
        deletePost(
            { postUuid: postid },
            {
                onSuccess: () => {
                    toast.success("게시글이 삭제되었습니다.");
                    setPostDeleteOpen(false);
                    // 목록으로 이동
                    router.push(backPath);
                },
                onError: () => {
                    // console.error("게시글 삭제 실패:", err);
                    toast.error("게시글 삭제 중 문제가 발생했습니다. 다시 시도해 주세요.");
                },
            }
        );
    };

    if (isLoading || !post) {
        return (
            <div className="min-h-screen bg-white">
                <div className="fluid-container pt-16 pb-10 font-kr">
                    <div className="h-6 w-40 bg-gray-200 rounded mb-4 animate-pulse" />
                    <div className="h-8 w-3/4 bg-gray-200 rounded mb-3 animate-pulse" />
                    <div className="h-4 w-1/3 bg-gray-200 rounded mb-6 animate-pulse" />
                    <div className="h-40 w-full bg-gray-100 rounded animate-pulse" />
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-white">
                <div className="fluid-container pt-16 pb-10 font-kr">
                    <p className="text-red-500 text-sm">
                        게시글을 불러오는 중 오류가 발생했습니다: {error.message}
                    </p>
                </div>
            </div>
        );
    }

    const createdTime = new Date(post.created_date).getTime();
    const updatedTime = new Date(post.updated_date).getTime();
    const isEditedNotice =
        Boolean(post.is_noticed) &&
        Number.isFinite(createdTime) &&
        Number.isFinite(updatedTime) &&
        updatedTime > createdTime;
    const visibleDate = new Date(
        isEditedNotice ? post.updated_date : post.created_date
    ).toLocaleString();
    const visibleDateLabel = isEditedNotice ? "수정일" : "작성일";

    const handleEditComment = (comment: Comment) => {
        if (!comment.canEdit) return;
        setEditingCommentId(comment.id);
        setEditValue(comment.content);
    };

    const handleCancelEdit = () => {
        setEditingCommentId(null);
        setEditValue("");
    };

    const handleSaveEdit = (commentId: string) => {
        const trimmed = editValue.trim();
        if (!trimmed) {
            toast.warn("내용을 입력해 주세요.");
            return;
        }

        const previousComments = [...comments]; // 롤백용 백업

        // 낙관적 업데이트
        setComments((prev) =>
            prev.map((c) =>
                c.id === commentId ? { ...c, content: trimmed } : c
            )
        );
        setEditingCommentId(null);
        setEditValue("");

        // 실제 PUT API 호출
        putReply(
            {
                postUuid: postid,
                replyId: commentId,
                payload: { reply_content: trimmed },
            },
            {
                onSuccess: () => {
                    toast.success("댓글이 수정되었습니다.");
                },
                onError: () => {
                    // console.error("댓글 수정 실패:", err);
                    setComments(previousComments); // 실패 시 롤백
                    toast.error(
                        "댓글 수정 중 문제가 발생했습니다. 다시 시도해 주세요."
                    );
                },
            }
        );
    };

    const handleDeleteComment = () => {
        if (selectedCommentId == null) {
            // console.log(selectedCommentId);
            return;
        }

        const replyId = selectedCommentId;
        const previousComments = comments; // 롤백용 백업
        const idsToRemove = collectReplyBranchIds(comments, replyId);

        // 1) 낙관적 삭제
        setComments((prev) => prev.filter((c) => !idsToRemove.has(c.id)));
        setDeleteModalOpen(false);
        setSelectedCommentId(null);
        if (editingCommentId && idsToRemove.has(editingCommentId)) {
            setEditingCommentId(null);
            setEditValue("");
        }
        if (replyingToId && idsToRemove.has(replyingToId)) {
            setReplyingToId(null);
            setReplyValue("");
        }

        // 2) 실제 DELETE API 호출
        deleteReply(
            { postUuid: postid, replyId },
            {
                onSuccess: () => {
                    toast.success("댓글이 삭제되었습니다.");
                },
                onError: () => {
                    // console.error("댓글 삭제 실패:", err);
                    // 3) 실패 시 롤백
                    setComments(previousComments);
                    toast.error(
                        "댓글 삭제 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요."
                    );
                },
            }
        );
    };

    const renderCommentCard = (comment: CommentBranch | Comment, isChild = false) => {
        const childComments = "children" in comment ? comment.children : [];
        const authorSubmissionHref = buildSubmissionHref(
            comment.authorUserId,
            comment.author
        );

        return (
            <div key={comment.id} className={isChild ? "mt-3" : ""}>
                <div
                    className={`rounded-lg border px-4 py-3 ${
                        isChild
                            ? "border-gray-200 bg-white"
                            : "border-gray-100 bg-gray-100"
                    }`}
                >
                    <div className="mb-1 flex items-center justify-between gap-3">
                        {canOpenSubmissionPage(
                            comment.authorUserId,
                            comment.canOpenSubmission
                        ) ? (
                            <button
                                type="button"
                                className="text-xs font-medium text-gray-700 hover:text-primary hover:underline"
                                onClick={() => router.push(authorSubmissionHref)}
                            >
                                {comment.author}
                            </button>
                        ) : (
                            <span className="text-xs font-medium text-gray-700">
                                {comment.author}
                            </span>
                        )}

                        <div className="flex items-center gap-2">
                            <span className="text-[11px] text-gray-400">
                                {new Date(comment.createdAt).toLocaleString()}
                            </span>

                            {!isChild && (
                                <button
                                    type="button"
                                    className="text-[11px] rounded border border-gray-300 px-2 py-0.5 text-gray-600 hover:bg-gray-200"
                                    onClick={() => {
                                        setReplyingToId(
                                            replyingToId === comment.id ? null : comment.id
                                        );
                                        setReplyValue("");
                                    }}
                                >
                                    답글
                                </button>
                            )}

                            {comment.canEdit && editingCommentId !== comment.id && (
                                <div className="flex gap-1">
                                    <button
                                        className="rounded border border-gray-300 px-2 py-0.5 text-[11px] text-gray-600 hover:bg-gray-200"
                                        onClick={() => handleEditComment(comment)}
                                    >
                                        수정
                                    </button>
                                    <button
                                        className="flex items-center justify-center rounded border border-red-300 px-2 py-0.5 hover:bg-red-50"
                                        onClick={() => {
                                            setSelectedCommentId(comment.id);
                                            setDeleteModalOpen(true);
                                        }}
                                    >
                                        <img
                                            src={TrashIcon}
                                            alt="댓글 삭제"
                                            className="h-4 w-4"
                                        />
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {editingCommentId === comment.id ? (
                        <div className="mt-2">
                            <textarea
                                className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary"
                                rows={3}
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                            />
                            <div className="mt-2 flex justify-end gap-2">
                                <button
                                    className="rounded border border-gray-300 px-3 py-1 text-xs text-gray-600 hover:bg-gray-200"
                                    onClick={handleCancelEdit}
                                >
                                    취소
                                </button>
                                <button
                                    className="rounded bg-primary px-3 py-1 text-xs text-bg-blue-600 hover:bg-blue-200"
                                    onClick={() => handleSaveEdit(comment.id)}
                                >
                                    저장
                                </button>
                            </div>
                        </div>
                    ) : (
                        <p className="whitespace-pre-wrap text-sm text-gray-800">
                            {comment.content}
                        </p>
                    )}

                    {!isChild && replyingToId === comment.id && (
                        <div className="mt-3 rounded-lg border border-gray-200 bg-white p-3">
                            <textarea
                                className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary"
                                rows={3}
                                placeholder={`${comment.author}님에게 답글을 입력하세요.`}
                                value={replyValue}
                                onChange={(e) => setReplyValue(e.target.value)}
                            />
                            <div className="mt-2 flex justify-end gap-2">
                                <button
                                    type="button"
                                    className="rounded border border-gray-300 px-3 py-1 text-xs text-gray-600 hover:bg-gray-200"
                                    onClick={() => {
                                        setReplyingToId(null);
                                        setReplyValue("");
                                    }}
                                >
                                    취소
                                </button>
                                <button
                                    type="button"
                                    className="rounded bg-primary px-3 py-1 text-xs text-bg-blue-600 hover:bg-blue-200 disabled:cursor-not-allowed disabled:opacity-50"
                                    disabled={
                                        isSubmittingComment ||
                                        isReplyPending ||
                                        !replyValue.trim()
                                    }
                                    onClick={() => handleSubmitReply(comment)}
                                >
                                    {isSubmittingComment || isReplyPending
                                        ? "작성 중..."
                                        : "답글 작성"}
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {!isChild && childComments.length > 0 && (
                    <div className="ml-6 border-l border-gray-200 pl-4">
                        {childComments.map((child) => renderCommentCard(child, true))}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="flex flex-col">
            <div className="fluid-container pt-4 pb-16">
                <div className="w-full rounded-xl border border-gray-300 bg-white px-4 py-8 shadow-sm sm:px-6 lg:px-8">
                    {/* 상단 영역: 문제 뱃지 + 제목 + 메타 정보 */}
                    <div className="mb-6">
                        {post.problem_uuid && (
                            <div className="mb-3">
                                <span
                                    className="inline-flex items-center px-3 py-1 rounded-full bg-[rgba(237,239,254,1)] text-[11px] font-medium text-primary cursor-pointer"
                                    onClick={() => {
                                        router.push(
                                            `/community/${post.problem_uuid}`
                                        );
                                    }}
                                >
                                    {post.problem_name}
                                </span>
                            </div>
                        )}

                        <div className="flex items-center gap-2 mb-2">
                            {post.is_noticed && (
                                <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-1 text-[11px] font-semibold text-red-600">
                                    공지
                                </span>
                            )}
                            <h1 className="text-3xl font-bold break-words">
                                {post.title}
                            </h1>
                        </div>

                        <div className="text-sm text-gray-500">
                            {canOpenSubmissionPage(
                                post?.user_id,
                                post?.can_open_submission
                            ) ? (
                                <button
                                    type="button"
                                    className="mr-2 hover:text-primary hover:underline"
                                    onClick={() => router.push(submissionHref)}
                                >
                                    {post.username}
                                </button>
                            ) : (
                                <span className="mr-2">{post.username}</span>
                            )}
                            <span>• {visibleDateLabel} {visibleDate}</span>
                        </div>
                    </div>

                    <hr className="border-gray-200 mb-6" />

                    {/* 마크다운 본문 */}
                    <div className="mb-10">
                        <MarkdownViewer
                            content={
                                isLoading ? "로딩 중입니다..." : post.content
                            }
                        />
                    </div>

                    {/* 댓글 영역 */}
                    <section className="mt-4">
                        <h2 className="text-lg font-semibold mb-4">댓글</h2>

                        {/* 댓글 작성 폼 */}
                        <div className="space-y-3 mb-6">
                            <textarea
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
                                rows={4}
                                placeholder="댓글을 입력하세요."
                                value={newComment}
                                onChange={(e) =>
                                    setNewComment(e.target.value)
                                }
                            />
                            <div className="flex justify-end mt-2">
                                <Btn
                                    text={
                                        isSubmittingComment || isReplyPending
                                            ? "작성 중..."
                                            : "댓글 작성"
                                    }
                                    onClick={handleSubmitComment}
                                    disabled={
                                        isSubmittingComment ||
                                        isReplyPending ||
                                        !newComment.trim()
                                    }
                                    height="h-9"
                                    width="w-28"
                                    textSize="text-xs"
                                />
                            </div>
                        </div>

                        {/* 댓글 리스트 */}
                        <div className="space-y-3">
                            {isRepliesLoading && comments.length === 0 ? (
                                <p className="text-sm text-gray-500">
                                    댓글을 불러오는 중입니다...
                                </p>
                            ) : comments.length === 0 ? (
                                <p className="text-sm text-gray-500">
                                    아직 등록된 댓글이 없습니다. 첫 댓글을 남겨 보세요.
                                </p>
                            ) : (
                                commentTree.map((comment) => renderCommentCard(comment))
                            )}
                        </div>
                    </section>

                    {/* 하단 버튼 영역 */}
                    <div className="mt-8 pt-4 border-t border-gray-100 flex justify-end gap-2">
                        <Btn
                            text="목록으로"
                            onClick={() => {
                                router.push(backPath);
                            }}
                            height="h-10"
                            width="w-28"
                            textSize="text-xs"
                            btnType="empty"
                            btnColor="blue"
                        />
                        {post.can_edit && (
                            <>
                                <Btn
                                    text="수정하기"
                                    onClick={() => {
                                        const qs = searchParams?.toString();
                                        router.push(
                                            `/community/posts/${postid}/edit${qs ? `?${qs}` : ""}`
                                        );
                                    }}
                                    height="h-10"
                                    width="w-28"
                                    textSize="text-xs"
                                />
                                <Btn
                                    text={
                                        isPostDeleting
                                            ? "삭제 중..."
                                            : "삭제하기"
                                    }
                                    onClick={() => setPostDeleteOpen(true)}
                                    height="h-10"
                                    width="w-28"
                                    textSize="text-xs"
                                    btnType="empty"
                                    btnColor="red"
                                />
                            </>
                        )}
                    </div>
                </div>
            </div>
            <DeleteModal
                open={deleteModalOpen}
                onClose={() => {
                    setDeleteModalOpen(false);
                    setSelectedCommentId(null);
                }}
                onConfirm={handleDeleteComment}
            />

            <DeleteModal
                open={postDeleteOpen}
                onClose={() => setPostDeleteOpen(false)}
                onConfirm={handleConfirmDeletePost}
            />
        </div>
    );
}
