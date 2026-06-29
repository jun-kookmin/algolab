// app/community/posts/[postid]/edit/page.tsx
"use client";

import React from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { toast } from "react-toastify";
import { PostEditor } from "@/components/community/PostEditor";
import { useGetPostDetail } from "@/hooks/board/Get/useGetPostDetail"; // 실제 경로에 맞게 수정
import { usePutPost } from "@/hooks/board/Put/usePutPost";

export default function PostEditPage() {
    const router = useRouter();
    const params = useParams<{ postid: string }>();
    const searchParams = useSearchParams();
    const postid = params.postid;

    const { data: postData, isLoading, isError } = useGetPostDetail(postid, {
        params: { no_replies: 1 },
    });
    const { mutate: putPost } = usePutPost();

    const handleSubmit = (data: { title: string; content: string; is_noticed?: boolean }) => {
        if (!postid) {
            toast.error("잘못된 게시글 번호입니다.");
            return;
        }
        const payload = {
            title: data.title,
            content: data.content,
            ...(typeof data.is_noticed === "boolean"
                ? { is_noticed: data.is_noticed }
                : {}),
        };
        const qs = searchParams?.toString();
        const backToDetail = `/community/posts/${postid}${qs ? `?${qs}` : ""}`;

        putPost(
            {
                postUuid: postid,
                payload,
            },
            {
                onSuccess: () => {
                    // console.log("게시글 수정 완료:", res);
                    toast.success("게시글이 수정되었습니다.");
                    router.push(backToDetail);
                },
                onError: () => {
                    // console.error("게시글 수정 실패:", error);
                    toast.error(
                        "게시글 수정 중 오류가 발생했습니다. 잠시 뒤 다시 시도해주세요."
                    );
                },
            }
        );
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-white">
                <div className="fluid-container pt-16 pb-10 font-kr">
                    <p className="text-sm text-gray-500">
                        게시글 정보를 불러오는 중입니다...
                    </p>
                </div>
            </div>
        );
    }

    if (isError || !postData) {
        return (
            <div className="min-h-screen bg-white">
                <div className="fluid-container pt-16 pb-10 font-kr">
                    <p className="text-sm text-red-500">
                        게시글 정보를 찾을 수 없습니다. 목록에서 다시 시도해 주세요.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-white">
            <div className="fluid-container pt-16 pb-10 font-kr">
                {/* 상단 헤더 */}
                <h1 className="text-3xl font-bold mb-1">게시글 수정</h1>
                <p className="text-sm text-gray-500 mb-4">
                    기존에 작성한 내용을 수정할 수 있습니다.
                </p>

                {/* 공통 에디터 – 기존 제목/내용을 기본값으로 전달 */}
                <PostEditor
                    onSubmit={handleSubmit}
                    contentTemplate="student" // 혹은 "free" 등 상황에 맞게
                    initialTitle={postData.title}
                    initialContent={postData.content}
                    initialIsNoticed={postData.is_noticed ?? false}
                />
            </div>
        </div>
    );
}
