// app/community/create/page.tsx
"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { PostEditor } from "@/components/community/PostEditor";
import { usePostPost } from "@/hooks/board/Post/usePostPost";
import { toast } from "react-toastify";

const GENERAL_BOARD_ID = "1";

export default function CommunityCreatePage() {
    const router = useRouter();
    const { mutate: postPost, isPending } = usePostPost();

    const submittingRef = React.useRef(false);

    const handleSubmit = (data: { title: string; content: string; is_noticed?: boolean }) => {
        if (submittingRef.current || isPending) return;

        submittingRef.current = true;

        postPost(
            {
                board_uuid: GENERAL_BOARD_ID,
                title: data.title,
                content: data.content,
                is_noticed: data.is_noticed,
            },
            {
                onSuccess: () => {
                    // console.log("게시글 생성 완료:", res);
                    toast.success("게시글이 등록되었습니다!");
                    router.push("/community");
                },
                onError: () => {
                    // console.error("게시글 생성 실패:", err?.response?.data ?? err);
                    toast.error("게시글 등록 중 오류가 발생했습니다. 잠시 뒤 다시 시도해주세요.");
                },
                onSettled: () => {
                    submittingRef.current = false;
                },
            }
        );
    };

    return (
        <div className="min-h-screen bg-white">
            <div className="fluid-container pt-16 pb-10 font-kr">
                <h1 className="text-3xl font-bold mb-1">게시판 글쓰기</h1>
                <p className="text-sm text-gray-500 mb-4">
                    자유 글이나 공지 등, 특정 문제와 직접 관련이 없는 글을 작성할 수 있습니다.
                </p>

                <div className="mb-8 rounded-lg border border-gray-200 bg-slate-50 px-4 py-3 text-xs text-gray-600">
                    이 페이지에서 작성한 글은{" "}
                    <span className="font-semibold">문제와 자동으로 연결되지 않습니다.</span>
                    <br />
                    특정 문제에 대한 질문을 올리려면, 해당 문제의 게시판으로 이동한 뒤
                    ‘질문 작성’ 버튼을 사용해 주세요.
                </div>

                <PostEditor onSubmit={handleSubmit} contentTemplate="free" />
            </div>
        </div>
    );
}
