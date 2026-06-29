// app/community/[problemid]/create/page.tsx
"use client";

import React from "react";
import { useParams, useRouter } from "next/navigation";
import { PostEditor } from "@/components/community/PostEditor";
import { useGetProblem } from "@/hooks/problems/useGetProblem";
import { usePostPost } from "@/hooks/board/Post/usePostPost";
import { toast } from "react-toastify";

const COMMUNITY_BOARD_ID = "1";

export default function CommunityProblemCreatePage() {
    const router = useRouter();
    const params = useParams<{ problemid: string }>();
    const problemid = params.problemid;

    const { data: problemData } = useGetProblem(problemid, {
        includeTestcases: false,
    });
    const { mutate: postPost, isPending } = usePostPost();

    const submittingRef = React.useRef(false);

    const title = problemData?.title;

    const handleSubmit = (data: { title: string; content: string; is_noticed?: boolean }) => {
        if (submittingRef.current || isPending) return;

        if (!problemid) {
            toast.error("문제 정보가 없습니다. 다시 시도해 주세요.");
            return;
        }
        if (!problemData?.id) {
            toast.error("문제 UUID를 불러오지 못했습니다. 잠시 뒤 다시 시도해 주세요.");
            return;
        }

        submittingRef.current = true;

        postPost(
            {
                board_uuid: COMMUNITY_BOARD_ID,
                problem_uuid: problemData.id,
                title: data.title,
                content: data.content,
                is_noticed: data.is_noticed,
            },
            {
                onSuccess: () => {
                    // console.log("문제 질문 생성 완료:", res);
                    toast.success("질문이 등록되었습니다.");
                    router.push(`/community/${problemid}`);
                },
                onError: () => {
                    // console.error("문제 질문 생성 실패:", err?.response?.data ?? err);
                    toast.error("질문 작성 중 오류가 발생했습니다. 잠시 뒤 다시 시도해주세요.");
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
                <h1 className="text-3xl font-bold mb-1">
                    {title ? `${title}: 질문 작성` : "질문 작성"}
                </h1>
                <p className="text-sm text-gray-500 mb-4">
                    이 페이지에서 작성한 글은{" "}
                    <span className="font-semibold">
                        {title ? `[${title}]` : "선택된 문제"}
                    </span>
                    와 연결됩니다. 문제를 변경하려면 해당 문제 게시판으로 이동하여 작성해주세요.
                </p>

                <div className="mb-6">
                    <label className="block text-gray-700 mb-1">문제</label>
                    <input
                        value={title ? `문제 [${title}]` : "문제 정보를 불러오는 중입니다..."}
                        readOnly
                        className="w-full border-2 border-gray-300 rounded px-3 py-2 bg-gray-50"
                    />
                </div>

                <PostEditor onSubmit={handleSubmit} contentTemplate="student" />
            </div>
        </div>
    );
}
