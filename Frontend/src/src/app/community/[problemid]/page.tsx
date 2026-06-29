// app/community/[problemid]/page.tsx
import Link from "next/link";
import { CommunityPostList } from "@/components/community/CommunityPostList";
import { ProblemCommunityHeader } from "@/components/community/ProblemCommunityHeader";
import {
    getServerPosts,
    getServerProblemSummary,
} from "../../../lib/serverApi";

/*
 * /community/[problemid]
 *
 * 특정 문제에 대한 질문만 모아서 보여주는 페이지입니다.
 * - URL 파라미터 problemid를 사용합니다.
 * - 상단에서 전체 질문(/community)으로 돌아갈 수 있습니다.
 */

const PAGE_SIZE = 20;

export const dynamic = "force-dynamic";

export default async function ProblemCommunityPage({
    params,
}: {
    params: Promise<{ problemid: string }>;
}) {
    const { problemid } = await params;

    let problemData = undefined;
    let initialData = undefined;
    try {
        problemData = await getServerProblemSummary(problemid);
    } catch {
        problemData = undefined;
    }
    try {
        initialData = await getServerPosts({
            page: 1,
            size: PAGE_SIZE,
            problem_uuid: problemid,
        });
    } catch {
        initialData = undefined;
    }

    const fallbackTitle =
        problemData?.title?.trim() ||
        initialData?.data?.find((post) => post.problem_name?.trim())?.problem_name?.trim() ||
        "";

    return (
        <div className="h-full flex flex-col overflow-hidden">
            <div className="bg-white pt-4">
                <div className="fluid-container">
                    {/* 상단 헤더 + 질문 작성 버튼 */}
                    <div className="flex justify-between items-center py-10">
                        <div className="flex flex-col gap-2">
                            <ProblemCommunityHeader
                                problemId={problemid}
                                fallbackTitle={fallbackTitle}
                            />
                        </div>
                        <div className="ml-auto">
                            <Link
                                href={`/community/${problemid}/create`}
                                className="inline-flex h-10 w-28 items-center justify-center rounded-[10px] border border-indigo-300 bg-white text-xs font-medium text-indigo-600 transition-colors hover:bg-indigo-50 active:scale-95"
                            >
                                질문 작성
                            </Link>
                        </div>
                    </div>
                    {/* 대시보드 탭 행과 동일한 높이 확보 */}
                    <div
                        className="mb-2 flex gap-6 invisible pointer-events-none select-none"
                        aria-hidden
                    >
                        <button className="font-kr pb-1 font-semibold border-b-2 border-primary text-primary">
                            이번학기
                        </button>
                    </div>
                </div>
            </div>

            <div className="w-full flex-1 overflow-auto bg-[rgba(237,239,254,1)]">
                <div className="fluid-container pt-4">
                    {/* 질문 목록 (검색 없음, 문제 뱃지 숨김) */}
                    <CommunityPostList
                        pageSize={PAGE_SIZE}
                        showSearch={false}
                        problemId={problemid}
                        origin="problem"
                        originProblemId={problemid}
                        initialData={initialData}
                    />
                </div>
            </div>
        </div>
    );
}
